const dns = require("dns");
const net = require("net");

const PROBE_TIMEOUT_MS = 5000;
const DNS_TIMEOUT_MS = 3000;
const MAX_REDIRECTS = 3;
const MAX_URLS = 20;
const MAX_URL_LENGTH = 2048;
const MAX_BODY_BYTES = 16 * 1024;

const RATE_LIMIT_WINDOW_MS = Number(process.env.STATUS_RATE_LIMIT_WINDOW_MS) || 60 * 1000;
const RATE_LIMIT_MAX = Number(process.env.STATUS_RATE_LIMIT_MAX) || 30;
const GLOBAL_RATE_LIMIT_MAX = Number(process.env.STATUS_GLOBAL_RATE_LIMIT_MAX) || 300;

const ALLOWED_HOSTS = (process.env.STATUS_ALLOWED_HOSTS || "")
  .split(",")
  .map((host) => host.trim().toLowerCase())
  .filter(Boolean);

const PRIVATE_HOST_SUFFIXES = [
  ".localhost",
  ".local",
  ".internal",
  ".home",
  ".lan",
  ".corp",
  ".intranet",
  ".private",
  ".test",
  ".invalid",
  ".example",
  ".onion"
];

const rateBuckets = new Map();
let globalBucket = { count: 0, resetAt: Date.now() + RATE_LIMIT_WINDOW_MS };
const resultCache = new Map();
const RESULT_CACHE_TTL_MS = 10 * 1000;
const RESULT_CACHE_MAX = 500;

function getClientIp(req) {
  const realIp = req.headers["x-real-ip"];
  if (typeof realIp === "string" && realIp.trim()) return realIp.trim();

  const forwarded = req.headers["x-forwarded-for"];
  if (typeof forwarded === "string" && forwarded.trim()) {
    return forwarded.split(",")[0].trim();
  }
  if (Array.isArray(forwarded) && forwarded.length) {
    return String(forwarded[0]).split(",")[0].trim();
  }

  return (req.socket && req.socket.remoteAddress) || "unknown";
}

function checkRateLimit(req) {
  const now = Date.now();

  if (now >= globalBucket.resetAt) {
    globalBucket = { count: 0, resetAt: now + RATE_LIMIT_WINDOW_MS };
  }
  globalBucket.count += 1;

  let bucket;
  if (globalBucket.count > GLOBAL_RATE_LIMIT_MAX) {
    bucket = globalBucket;
  } else {
    const ip = getClientIp(req);
    bucket = rateBuckets.get(ip);
    if (!bucket || now >= bucket.resetAt) {
      bucket = { count: 0, resetAt: now + RATE_LIMIT_WINDOW_MS };
      rateBuckets.set(ip, bucket);
    }
    bucket.count += 1;

    if (rateBuckets.size > 1000) {
      for (const [key, value] of rateBuckets) {
        if (now >= value.resetAt) rateBuckets.delete(key);
      }
    }
  }

  const limit = bucket === globalBucket ? GLOBAL_RATE_LIMIT_MAX : RATE_LIMIT_MAX;
  return {
    limited: bucket.count > limit,
    limit,
    remaining: Math.max(0, limit - bucket.count),
    reset: bucket.resetAt,
    retryAfter: Math.max(1, Math.ceil((bucket.resetAt - now) / 1000))
  };
}

function setRateLimitHeaders(res, rate) {
  res.setHeader("X-RateLimit-Limit", String(rate.limit));
  res.setHeader("X-RateLimit-Remaining", String(rate.remaining));
  res.setHeader("X-RateLimit-Reset", String(Math.ceil(rate.reset / 1000)));
}

function isPrivateIpv4(ip) {
  const parts = ip.split(".").map(Number);
  if (parts.length !== 4 || parts.some((n) => !Number.isInteger(n) || n < 0 || n > 255)) {
    return true;
  }

  const [a, b, c] = parts;
  if (a === 0 || a === 10 || a === 127) return true;
  if (a === 100 && b >= 64 && b <= 127) return true;
  if (a === 169 && b === 254) return true;
  if (a === 172 && b >= 16 && b <= 31) return true;
  if (a === 192 && b === 0 && (c === 0 || c === 2)) return true;
  if (a === 192 && b === 168) return true;
  if (a === 198 && (b === 18 || b === 19)) return true;
  if (a === 198 && b === 51 && c === 100) return true;
  if (a === 203 && b === 0 && c === 113) return true;
  if (a >= 224) return true;
  return false;
}

function expandIpv6(ip) {
  let address = ip.toLowerCase().split("%")[0];

  if (address.includes(".")) {
    const lastColon = address.lastIndexOf(":");
    const ipv4 = address.slice(lastColon + 1);
    if (net.isIP(ipv4) !== 4) return null;
    const [a, b, c, d] = ipv4.split(".").map(Number);
    address =
      address.slice(0, lastColon + 1) +
      ((a << 8) | b).toString(16) +
      ":" +
      ((c << 8) | d).toString(16);
  }

  const halves = address.split("::");
  if (halves.length > 2) return null;

  let left = halves[0] ? halves[0].split(":") : [];
  let right = halves.length === 2 && halves[1] ? halves[1].split(":") : [];

  if (halves.length === 1) {
    if (left.length !== 8) return null;
  } else {
    const missing = 8 - left.length - right.length;
    if (missing < 0) return null;
    left = left.concat(new Array(missing).fill("0"), right);
  }

  const groups = left.map((part) => parseInt(part, 16));
  if (groups.length !== 8 || groups.some((n) => !Number.isInteger(n) || n < 0 || n > 0xffff)) {
    return null;
  }
  return groups;
}

function isPrivateIpv6(ip) {
  const groups = expandIpv6(ip);
  if (!groups) return true;

  if ((groups[0] & 0xfe00) === 0xfc00) return true;
  if ((groups[0] & 0xffc0) === 0xfe80) return true;
  if ((groups[0] & 0xff00) === 0xff00) return true;
  if (groups[0] === 0x2001 && groups[1] === 0x0db8) return true;
  if (groups[0] === 0x2002) return true;
  if (groups.slice(0, 6).every((n) => n === 0)) return true;

  if (groups.slice(0, 5).every((n) => n === 0) && groups[5] === 0xffff) {
    const ipv4 = [
      (groups[6] >> 8) & 0xff,
      groups[6] & 0xff,
      (groups[7] >> 8) & 0xff,
      groups[7] & 0xff
    ].join(".");
    return isPrivateIpv4(ipv4);
  }

  return false;
}

function isPrivateIp(ip) {
  const address = String(ip).split("%")[0];
  const version = net.isIP(address);
  if (version === 4) return isPrivateIpv4(address);
  if (version === 6) return isPrivateIpv6(address);
  return true;
}

function lookupHost(hostname, timeoutMs) {
  return new Promise((resolve, reject) => {
    let timer = null;
    const lookup = dns.promises.lookup(hostname, { all: true, verbatim: true });

    if (timeoutMs > 0) {
      timer = setTimeout(() => reject(new Error("dns_timeout")), timeoutMs);
    }

    lookup.then(
      (addresses) => {
        if (timer) clearTimeout(timer);
        resolve(addresses);
      },
      (error) => {
        if (timer) clearTimeout(timer);
        reject(error);
      }
    );
  });
}

async function assertSafeUrl(value, deadline) {
  let url;
  try {
    url = new URL(value);
  } catch (error) {
    return { ok: false, error: "invalid_url" };
  }

  if (url.protocol !== "http:" && url.protocol !== "https:") {
    return { ok: false, error: "invalid_url" };
  }
  if (url.username || url.password) {
    return { ok: false, error: "invalid_url" };
  }

  const hostname = url.hostname.toLowerCase().replace(/\.$/, "");
  const bareHostname = hostname.replace(/^\[|\]$/g, "");
  if (!hostname) return { ok: false, error: "invalid_url" };

  if (ALLOWED_HOSTS.length && !ALLOWED_HOSTS.includes(hostname) && !ALLOWED_HOSTS.includes(bareHostname)) {
    return { ok: false, error: "host_not_allowed" };
  }

  if (
    hostname === "localhost" ||
    hostname.endsWith(".localhost") ||
    PRIVATE_HOST_SUFFIXES.some((suffix) => hostname.endsWith(suffix))
  ) {
    return { ok: false, error: "invalid_url" };
  }

  const ipVersion = net.isIP(bareHostname);
  if (ipVersion === 0) {
    if (!hostname.includes(".")) return { ok: false, error: "invalid_url" };
    if (/^\d+(\.\d+){1,3}$/.test(bareHostname)) {
      return { ok: false, error: "invalid_url" };
    }
  } else if (ipVersion === 4) {
    return isPrivateIpv4(bareHostname) ? { ok: false, error: "invalid_url" } : { ok: true };
  } else if (ipVersion === 6) {
    return isPrivateIpv6(bareHostname) ? { ok: false, error: "invalid_url" } : { ok: true };
  }

  const remaining = deadline - Date.now();
  if (remaining <= 0) return { ok: false, error: "timeout" };

  let addresses;
  try {
    addresses = await lookupHost(bareHostname, Math.min(DNS_TIMEOUT_MS, remaining));
  } catch (error) {
    return { ok: false, error: error && error.message === "dns_timeout" ? "timeout" : "unreachable" };
  }

  if (!addresses.length) return { ok: false, error: "unreachable" };
  if (addresses.some((entry) => isPrivateIp(entry.address))) {
    return { ok: false, error: "invalid_url" };
  }

  return { ok: true };
}

function getCachedResult(url) {
  const item = resultCache.get(url);
  if (!item) return null;
  if (Date.now() >= item.expiresAt) {
    resultCache.delete(url);
    return null;
  }
  return item.result;
}

function setCachedResult(url, result) {
  if (resultCache.size >= RESULT_CACHE_MAX) {
    const now = Date.now();
    for (const [key, value] of resultCache) {
      if (now >= value.expiresAt) resultCache.delete(key);
    }
    if (resultCache.size >= RESULT_CACHE_MAX) {
      const oldestKey = resultCache.keys().next().value;
      if (oldestKey) resultCache.delete(oldestKey);
    }
  }
  resultCache.set(url, { result, expiresAt: Date.now() + RESULT_CACHE_TTL_MS });
}

async function probe(originalUrl) {
  const cached = getCachedResult(originalUrl);
  if (cached) return cached;

  const deadline = Date.now() + PROBE_TIMEOUT_MS;
  let currentUrl = originalUrl;

  for (let redirectCount = 0; redirectCount <= MAX_REDIRECTS; redirectCount += 1) {
    const remaining = deadline - Date.now();
    if (remaining <= 0) {
      const result = { url: originalUrl, reachable: false, status: null, error: "timeout" };
      setCachedResult(originalUrl, result);
      return result;
    }

    const safe = await assertSafeUrl(currentUrl, deadline);
    if (!safe.ok) {
      const result = { url: originalUrl, reachable: false, status: null, error: safe.error };
      setCachedResult(originalUrl, result);
      return result;
    }

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), Math.max(1, deadline - Date.now()));

    try {
      const response = await fetch(currentUrl, {
        method: "GET",
        redirect: "manual",
        signal: controller.signal,
        headers: { "User-Agent": "MGB-Dashboard-Status/1.0" }
      });

      const location = response.headers.get("location");
      if (response.status >= 300 && response.status < 400 && location) {
        if (redirectCount === MAX_REDIRECTS) {
          const result = {
            url: originalUrl,
            reachable: false,
            status: response.status,
            error: "too_many_redirects"
          };
          setCachedResult(originalUrl, result);
          return result;
        }
        try {
          currentUrl = new URL(location, currentUrl).toString();
        } catch (error) {
          const result = {
            url: originalUrl,
            reachable: false,
            status: response.status,
            error: "invalid_redirect"
          };
          setCachedResult(originalUrl, result);
          return result;
        }
        continue;
      }

      if (response.body && typeof response.body.cancel === "function") {
        response.body.cancel().catch(() => {});
      }

      const result = { url: originalUrl, reachable: true, status: response.status };
      setCachedResult(originalUrl, result);
      return result;
    } catch (error) {
      const result = {
        url: originalUrl,
        reachable: false,
        status: null,
        error: error && error.name === "AbortError" ? "timeout" : "unreachable"
      };
      setCachedResult(originalUrl, result);
      return result;
    } finally {
      clearTimeout(timer);
    }
  }

  const result = { url: originalUrl, reachable: false, status: null, error: "too_many_redirects" };
  setCachedResult(originalUrl, result);
  return result;
}

module.exports = async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("Referrer-Policy", "no-referrer");
  res.setHeader("Cross-Origin-Resource-Policy", "same-origin");
  res.setHeader("Vary", "Origin");

  const rate = checkRateLimit(req);
  setRateLimitHeaders(res, rate);

  if (rate.limited) {
    res.setHeader("Retry-After", String(rate.retryAfter));
    res.status(429).json({ error: "Too many requests. Please try again later." });
    return;
  }

  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    res.status(405).json({ error: "Method not allowed. Use POST." });
    return;
  }

  const origin = req.headers.origin;
  if (origin) {
    const host = req.headers["x-forwarded-host"] || req.headers.host;
    const proto = req.headers["x-forwarded-proto"] || "https";
    const allowedOrigins = host
      ? [`${proto}://${host}`, `https://${host}`, `http://${host}`]
      : [];
    if (allowedOrigins.indexOf(origin) === -1) {
      res.status(403).json({ error: "Forbidden origin." });
      return;
    }
  }

  const contentType = String(req.headers["content-type"] || "").toLowerCase();
  if (!contentType.includes("application/json")) {
    res.status(415).json({ error: "Content-Type must be application/json." });
    return;
  }

  const contentLength = Number(req.headers["content-length"] || 0);
  if (contentLength > MAX_BODY_BYTES) {
    res.status(413).json({ error: "Request body too large." });
    return;
  }

  let body = req.body;
  if (typeof body === "string") {
    if (body.length > MAX_BODY_BYTES) {
      res.status(413).json({ error: "Request body too large." });
      return;
    }
    try {
      body = JSON.parse(body);
    } catch (error) {
      res.status(400).json({ error: "Invalid JSON body." });
      return;
    }
  }

  if (!body || !Array.isArray(body.urls)) {
    res.status(400).json({ error: "Request body must include a urls array." });
    return;
  }

  let serialized;
  try {
    serialized = JSON.stringify(body);
  } catch (error) {
    serialized = "";
  }
  if (serialized.length > MAX_BODY_BYTES) {
    res.status(413).json({ error: "Request body too large." });
    return;
  }

  const urls = body.urls
    .filter((url) => typeof url === "string")
    .map((url) => url.trim())
    .filter(Boolean);

  if (!urls.length) {
    res.status(400).json({ error: "No valid URLs supplied." });
    return;
  }

  const uniqueUrls = Array.from(new Set(urls));
  if (uniqueUrls.length > MAX_URLS) {
    res.status(400).json({ error: "Too many URLs. Maximum is " + MAX_URLS + "." });
    return;
  }
  if (uniqueUrls.some((url) => url.length > MAX_URL_LENGTH)) {
    res.status(400).json({ error: "One or more URLs are too long." });
    return;
  }

  const results = await Promise.all(uniqueUrls.map((url) => probe(url)));

  res.status(200).json({
    checkedAt: new Date().toISOString(),
    results
  });
};
