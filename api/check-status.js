const PROBE_TIMEOUT_MS = 5000;
const MAX_URLS = 20;

const BLOCKED_HOSTS = [
  "localhost",
  "127.0.0.1",
  "0.0.0.0",
  "::1",
  "[::1]",
  "169.254.169.254"
];

function isHttpUrl(value) {
  try {
    const url = new URL(value);
    if (url.protocol !== "http:" && url.protocol !== "https:") return false;
    if (url.username || url.password) return false;
    return BLOCKED_HOSTS.indexOf(url.hostname.toLowerCase()) === -1;
  } catch (error) {
    return false;
  }
}

async function probe(url) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), PROBE_TIMEOUT_MS);

  try {
    const response = await fetch(url, {
      method: "GET",
      redirect: "follow",
      signal: controller.signal,
      headers: {
        "User-Agent": "MGB-Dashboard-Status/1.0"
      }
    });

    // We only need the response headers; discard the body to save bandwidth.
    if (response.body && typeof response.body.cancel === "function") {
      response.body.cancel().catch(() => {});
    }

    return {
      url,
      reachable: true,
      status: response.status
    };
  } catch (error) {
    return {
      url,
      reachable: false,
      status: null,
      error: error && error.name === "AbortError" ? "timeout" : "unreachable"
    };
  } finally {
    clearTimeout(timer);
  }
}

module.exports = async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");

  if (req.method !== "POST") {
    res.status(405).json({ error: "Method not allowed. Use POST." });
    return;
  }

  let body = req.body;
  if (typeof body === "string") {
    try {
      body = JSON.parse(body);
    } catch (error) {
      body = null;
    }
  }

  if (!body || !Array.isArray(body.urls)) {
    res.status(400).json({ error: "Request body must include a urls array." });
    return;
  }

  const urls = body.urls
    .filter((url) => typeof url === "string")
    .map((url) => url.trim())
    .filter(Boolean);

  const uniqueUrls = Array.from(new Set(urls));

  if (uniqueUrls.length > MAX_URLS) {
    res.status(400).json({ error: "Too many URLs. Maximum is " + MAX_URLS + "." });
    return;
  }

  const results = await Promise.all(
    uniqueUrls.map((url) => {
      if (!isHttpUrl(url)) {
        return {
          url,
          reachable: false,
          status: null,
          error: "invalid_url"
        };
      }
      return probe(url);
    })
  );

  res.status(200).json({
    checkedAt: new Date().toISOString(),
    results
  });
};
