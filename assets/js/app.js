/* ==========================================================================
   MGB Dashboard - application logic
   Services are stored in localStorage ("mgb-services") so the Super Admin
   panel can add/edit/remove them. Defaults are seeded on first run.
   ========================================================================== */
(function () {
  "use strict";

  /* ------------------------------------------------------------------
   * 1) CONFIG - default services
   * ------------------------------------------------------------------ */
  var ICONS = {
    link: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M10.59 13.41a1 1 0 0 1 0-1.41l3.83-3.83a1 1 0 0 1 1.41 1.41l-3.83 3.83a1 1 0 0 1-1.41 0zm-1.41 1.41L7.76 16.24a3 3 0 1 0 4.24 4.24l1.41-1.41a1 1 0 0 1 1.41 1.41l-1.41 1.41a5 5 0 1 1-7.07-7.07l1.41-1.41a1 1 0 0 1 1.41 1.41zM14.83 9.17l1.41-1.41a5 5 0 0 1 7.07 7.07l-1.41 1.41a1 1 0 0 1-1.41-1.41l1.41-1.41a3 3 0 1 0-4.24-4.24l-1.41 1.41a1 1 0 0 1-1.41-1.41z"/></svg>',
    clock: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8zm.5-13H11v6l5.25 3.15.75-1.23-4.5-2.67z"/></svg>',
    diamond: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 2l-4 4v12l4 4h12l4-4V6l-4-4H6zm12 16H6V6h12v12zM12 6l5 6-5 6-5-6 5-6z"/></svg>',
    server: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20 3H4a2 2 0 0 0-2 2v4a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V5a2 2 0 0 0-2-2zm0 6H4V5h16v4zM4 11a2 2 0 0 0-2 2v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6a2 2 0 0 0-2-2H4zm0 8v-6h16v6H4z"/></svg>',
    user: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 12a5 5 0 1 0-5-5 5 5 0 0 0 5 5zm0 2c-4.42 0-8 2.24-8 5v1h16v-1c0-2.76-3.58-5-8-5z"/></svg>'
  };

  var DEFAULT_SERVICES = [
    {
      id: "travelorder",
      title: "Travel Order",
      subtitle: "Travel order module",
      online: "http://202.137.120.23:8080",
      offline: "http://starrs:8080/login",
      icon: ICONS.clock
    },
    {
      id: "diamond",
      title: "Diamond",
      subtitle: "Diamond reporting module",
      online: "http://202.137.120.23/diamond/",
      offline: "http://dats-server/diamond/index.php",
      icon: ICONS.diamond
    },
    {
      id: "dtr",
      title: "DTR",
      subtitle: "DTR transaction module",
      online: "http://202.137.120.23/dtr/",
      offline: "http://dats-server/dtr",
      icon: ICONS.server
    },
  ];

  var SERVICES = loadServices();

  function isSafeUrl(value) {
    if (typeof value !== "string") return false;
    var trimmed = value.trim();
    if (!trimmed) return false;
    try {
      var url = new URL(trimmed);
      if (url.protocol !== "http:" && url.protocol !== "https:") return false;
      if (url.username || url.password) return false;
      return true;
    } catch (e) {
      return false;
    }
  }

  function sanitizeService(svc) {
    if (!svc || typeof svc !== "object") return null;
    var title = typeof svc.title === "string" ? svc.title.trim() : "";
    if (!title) return null;
    var online = typeof svc.online === "string" ? svc.online.trim() : "";
    var offline = typeof svc.offline === "string" ? svc.offline.trim() : "";
    var isAdmin = !!svc.admin || title.toLowerCase() === "super admin";
    if (!isAdmin && !isSafeUrl(online)) return null;
    if (offline && !isSafeUrl(offline)) offline = "";
    var id = typeof svc.id === "string" && svc.id
      ? svc.id
      : title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || ("svc-" + Date.now() + "-" + Math.random().toString(36).slice(2, 8));
    return {
      id: id,
      title: title,
      subtitle: typeof svc.subtitle === "string" ? svc.subtitle.trim() : "",
      online: online,
      offline: offline,
      icon: typeof svc.icon === "string" ? svc.icon : "",
      admin: isAdmin
    };
  }

  function loadServices() {
    var list;
    try {
      var raw = localStorage.getItem("mgb-services");
      if (raw) {
        var parsed = JSON.parse(raw);
        if (Array.isArray(parsed) && parsed.length) list = parsed;
      }
    } catch (e) {
      /* ignore */
    }
    if (!list) list = DEFAULT_SERVICES.map(function (s) { return Object.assign({}, s); });
    list = list.map(sanitizeService).filter(function (s) { return s && !s.admin; });
    if (!list.length) list = DEFAULT_SERVICES.map(function (s) { return Object.assign({}, s); });
    try { localStorage.setItem("mgb-services", JSON.stringify(list)); } catch (e) {}
    return list;
  }

  function saveServices() {
    try {
      localStorage.setItem("mgb-services", JSON.stringify(SERVICES));
    } catch (e) {
      /* ignore */
    }
  }

  /* ------------------------------------------------------------------
   * 2) DOM refs
   * ------------------------------------------------------------------ */
  var grid = document.getElementById("grid");
  var clockEl = document.getElementById("clock");
  var refreshBtn = document.getElementById("refreshBtn");
  var themeBtn = document.getElementById("themeBtn");
  var adminBtn = document.getElementById("adminBtn");
  var adminModal = document.getElementById("adminModal");
  var adminClose = document.getElementById("adminClose");
  var adminLogin = document.getElementById("adminLogin");
  var adminPanel = document.getElementById("adminPanel");
  var adminPass = document.getElementById("adminPass");
  var adminUnlock = document.getElementById("adminUnlock");
  var adminLoginMsg = document.getElementById("adminLoginMsg");

  var EXT_ICON =
    '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M19 19H5V5h7V3H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7h-2v7zM14 3v2h3.59l-9.83 9.83 1.41 1.41L19 6.41V10h2V3h-7z"/></svg>';
  var WIFI_ICON =
    '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M1 9l2 2c4.97-4.97 13.03-4.97 18 0l2-2C16.93 2.93 7.08 2.93 1 9zm8 8l3 3 3-3c-1.65-1.66-4.34-1.66-6 0zm-4-4l2 2c2.76-2.76 7.24-2.76 10 0l2-2C15.14 9.14 8.87 9.14 5 13z"/></svg>';
  var LOCAL_ICON =
    '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20 3H4a2 2 0 0 0-2 2v4a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V5a2 2 0 0 0-2-2zm0 6H4V5h16v4zM4 11a2 2 0 0 0-2 2v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6a2 2 0 0 0-2-2H4zm0 8v-6h16v6H4z"/></svg>';

  /* ------------------------------------------------------------------
   * 3) Rendering
   * ------------------------------------------------------------------ */
  function linkButton(kind, label, url, icon) {
    var safeUrl = escapeHtml(url);
    return (
      '<a class="link-btn ' +
      kind +
      '" href="' +
      safeUrl +
      '" target="_blank" rel="noopener noreferrer" data-link="' +
      kind +
      '" data-url="' +
      safeUrl +
      '">' +
      '<span class="lb-main">' +
      '<span class="lb-ico">' +
      icon +
      '</span>' +
      '<span><span class="lb-name">' +
      escapeHtml(label) +
      '</span><span class="lb-url">' +
      safeUrl +
      '</span></span>' +
      "</span>" +
      '<span class="dot" data-dot="' +
      kind +
      '" title="Not checked"></span>' +
      "</a>"
    );
  }

  function isTrustedIcon(icon) {
    return Object.keys(ICONS).some(function (key) { return ICONS[key] === icon; });
  }

  function iconMarkup(icon) {
    if (!icon) return "";
    if (isTrustedIcon(icon)) return icon;

    var src = "";
    if (/^data:image\/(?:png|jpe?g|gif|webp|svg\+xml)(?:;|,)/i.test(icon)) {
      src = icon;
    } else if (/^https?:\/\//i.test(icon) || /^\.?\/?assets\//i.test(icon) || /\.(png|jpe?g|gif|webp|svg)(\?.*)?$/i.test(icon)) {
      src = icon;
    } else if (/^\s*<svg[\s>]/i.test(icon)) {
      src = "data:image/svg+xml;charset=utf-8," + encodeURIComponent(icon);
    } else {
      return "";
    }

    return '<img src="' + escapeHtml(src) + '" alt="" loading="lazy" referrerpolicy="no-referrer" style="width:100%;height:100%;object-fit:contain;border-radius:12px;" />';
  }

  function cardTemplate(svc) {
    var safeId = escapeHtml(svc.id);
    if (svc.admin) {
      return (
        '<article class="card" data-id="' +
        safeId +
        '">' +
        '<button class="card-icon admin-open" type="button" title="Open ' +
        escapeHtml(svc.title) +
        '">' +
        '<span class="tile">' +
        iconMarkup(svc.icon) +
        "</span>" +
        '<span class="card-meta">' +
        '<span class="card-title">' +
        escapeHtml(svc.title) +
        "</span>" +
        "</span>" +
        "</button>" +
        '<div class="links"><button class="link-btn online admin-open" type="button">Open Admin Panel</button></div>' +
        (svc.subtitle ? '<div class="card-sub">' + escapeHtml(svc.subtitle) + '</div>' : '') +
        "</article>"
      );
    }
    var safeOnline = escapeHtml(svc.online);
    var hasOnline = isSafeUrl(svc.online);
    var hasOffline = isSafeUrl(svc.offline);
    var cardClass = "card" + (hasOnline ? "" : " no-online");
    var cardIcon = hasOnline
      ? '<a class="card-icon" href="' + safeOnline + '" target="_blank" rel="noopener noreferrer" title="Open ' + escapeHtml(svc.title) + ' (online)">' +
        '<span class="tile">' + iconMarkup(svc.icon) + '</span>' +
        '<span class="card-meta"><span class="card-title">' + escapeHtml(svc.title) + '</span></span>' +
        '</a>'
      : '<div class="card-icon">' +
        '<span class="tile">' + iconMarkup(svc.icon) + '</span>' +
        '<span class="card-meta"><span class="card-title">' + escapeHtml(svc.title) + '</span></span>' +
        '</div>';
    var links = '';
    if (hasOnline) links += linkButton("online", "Online", svc.online, WIFI_ICON);
    if (hasOffline) links += linkButton("offline", "Offline", svc.offline, LOCAL_ICON);
    return (
      '<article class="' + cardClass + '" data-id="' +
      safeId +
      '">' +
      cardIcon +
      (links ? '<div class="links">' + links + '</div>' : '') +
      (svc.subtitle ? '<div class="card-sub">' + escapeHtml(svc.subtitle) + '</div>' : '') +
      "</article>"
    );
  }

  function render() {
    grid.innerHTML = SERVICES.map(cardTemplate).join("");
    var cards = grid.querySelectorAll(".card");
    cards.forEach(function (card, i) {
      card.style.animationDelay = (i * 70) + "ms";
    });
    grid.querySelectorAll(".admin-open").forEach(function (btn) {
      btn.addEventListener("click", openAdmin);
    });
  }

  /* ------------------------------------------------------------------
   * 4) Status detection
   * ------------------------------------------------------------------ */
  var STATUS_API = "api/check-status";
  var PROBE_TIMEOUT = 5000;

  function probeDirect(url, timeoutMs) {
    return new Promise(function (resolve) {
      var ctrl = typeof AbortController !== "undefined" ? new AbortController() : null;
      var timer = setTimeout(function () {
        if (ctrl) ctrl.abort();
        resolve(false);
      }, timeoutMs);

      fetch(url, {
        mode: "no-cors",
        cache: "no-store",
        redirect: "follow",
        signal: ctrl ? ctrl.signal : undefined
      })
        .then(function () {
          clearTimeout(timer);
          resolve(true);
        })
        .catch(function () {
          clearTimeout(timer);
          resolve(false);
        });
    });
  }

  function probeAll(urls) {
    if (!urls.length) return Promise.resolve({});

    return fetch(STATUS_API, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      cache: "no-store",
      body: JSON.stringify({ urls: urls })
    })
      .then(function (response) {
        if (!response.ok) throw new Error("Status API returned " + response.status);
        return response.json();
      })
      .then(function (data) {
        var map = {};
        (data && data.results ? data.results : []).forEach(function (item) {
          if (item && typeof item.url === "string") {
            map[item.url] = !!item.reachable;
          }
        });
        return map;
      });
  }

  function probeFallback(urls) {
    var map = {};
    return Promise.all(
      urls.map(function (url) {
        return probeDirect(url, PROBE_TIMEOUT).then(function (up) {
          map[url] = up;
        });
      })
    ).then(function () {
      return map;
    });
  }

  // Ask the serverless function first; fall back to direct probes when the
  // API is unavailable (e.g. opening from file:// or a plain static server).
  function probe(urls) {
    return probeAll(urls).catch(function () {
      return probeFallback(urls);
    });
  }

  function setDot(scope, kind, state) {
    var dot = scope.querySelector('[data-dot="' + kind + '"]');
    if (!dot) return;
    dot.className = "dot " + state;
    dot.title =
      state === "up"
        ? "Reachable"
        : state === "down"
        ? "Unreachable"
        : state === "busy"
        ? "Checking..."
        : "Not checked";
  }

  var isChecking = false;
  function checkAll() {
    if (isChecking) return;
    isChecking = true;
    refreshBtn.classList.add("spinning");

    var checks = [];
    var urls = [];
    var cardById = {};
    grid.querySelectorAll(".card").forEach(function (card) {
      cardById[card.getAttribute("data-id")] = card;
    });

    SERVICES.forEach(function (svc) {
      if (svc.admin) return;
      var scope = cardById[svc.id];
      if (!scope) return;

      if (isSafeUrl(svc.online)) {
        setDot(scope, "online", "busy");
        checks.push({ scope: scope, kind: "online", url: svc.online });
        urls.push(svc.online);
      } else {
        setDot(scope, "online", "down");
      }

      if (isSafeUrl(svc.offline)) {
        setDot(scope, "offline", "busy");
        checks.push({ scope: scope, kind: "offline", url: svc.offline });
        urls.push(svc.offline);
      } else {
        setDot(scope, "offline", "down");
      }
    });

    urls = urls.filter(function (url, index) {
      return url && urls.indexOf(url) === index;
    });

    probe(urls)
      .then(function (map) {
        checks.forEach(function (check) {
          var up = !!map[check.url];
          setDot(check.scope, check.kind, up ? "up" : "down");
        });

        isChecking = false;
        refreshBtn.classList.remove("spinning");
      })
      .catch(function () {
        isChecking = false;
        refreshBtn.classList.remove("spinning");
      });
  }

  function escapeHtml(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }

  /* ------------------------------------------------------------------
   * 5) Clock
   * ------------------------------------------------------------------ */
  var DAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  var MONTH_NAMES = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

  function tickClock() {
    var d = new Date();
    var hh = String(d.getHours()).padStart(2, "0");
    var mm = String(d.getMinutes()).padStart(2, "0");
    var ss = String(d.getSeconds()).padStart(2, "0");
    clockEl.innerHTML =
      '<span class="clock-time">' + hh + ":" + mm + ":" + ss + "</span>" +
      '<span class="clock-date">' + DAY_NAMES[d.getDay()] + ", " + MONTH_NAMES[d.getMonth()] + " " + d.getDate() + "</span>";
  }

  /* ------------------------------------------------------------------
   * 6) Theme
   * ------------------------------------------------------------------ */
  function applyTheme(theme) {
    document.documentElement.setAttribute("data-theme", theme);
    try {
      localStorage.setItem("mgb-theme", theme);
    } catch (e) {
      /* storage unavailable - ignore */
    }
  }

  function initTheme() {
    var saved = null;
    try {
      saved = localStorage.getItem("mgb-theme");
    } catch (e) {
      saved = null;
    }
    applyTheme(saved || "dark");
  }

  /* ------------------------------------------------------------------
   * 7) Super Admin
   * ------------------------------------------------------------------ */
  function getAdminPass() {
    try {
      return localStorage.getItem("mgb-admin-pass") || "admin";
    } catch (e) {
      return "admin";
    }
  }
  function setAdminPass(p) {
    try {
      localStorage.setItem("mgb-admin-pass", p);
    } catch (e) {
      /* ignore */
    }
  }

  var ADMIN_IDLE_MS = 5 * 60 * 1000;
  var adminIdleTimer = null;

  function clearAdminIdle() {
    if (adminIdleTimer) {
      clearTimeout(adminIdleTimer);
      adminIdleTimer = null;
    }
  }

  function resetAdminIdle() {
    if (adminModal.hidden) return;
    clearAdminIdle();
    adminIdleTimer = setTimeout(function () {
      closeAdmin();
    }, ADMIN_IDLE_MS);
  }

  function openAdmin() {
    adminModal.hidden = false;
    adminLogin.hidden = false;
    adminPanel.hidden = true;
    adminPass.value = "";
    adminLoginMsg.textContent = "";
    adminPass.focus();
    resetAdminIdle();
  }

  function closeAdmin() {
    clearAdminIdle();
    adminModal.hidden = true;
  }

  function unlock() {
    if (adminPass.value === getAdminPass()) {
      adminLogin.hidden = true;
      adminPanel.hidden = false;
      renderAdminList();
      resetForm();
      resetAdminIdle();
    } else {
      adminLoginMsg.textContent = "Wrong password.";
      adminLoginMsg.className = "admin-msg bad";
      resetAdminIdle();
    }
  }

  function resetForm() {
    document.getElementById("svcEditId").value = "";
    document.getElementById("svcTitle").value = "";
    document.getElementById("svcSub").value = "";
    document.getElementById("svcOnline").value = "";
    document.getElementById("svcOffline").value = "";
    document.getElementById("svcIconPreset").value = "link";
    document.getElementById("svcIconCustom").hidden = true;
    document.getElementById("svcIconCustom").value = "";
    document.getElementById("svcCancel").hidden = true;
    document.getElementById("svcSave").textContent = "Save system";
    document.getElementById("svcMsg").textContent = "";
  }

  function renderAdminList() {
    var list = document.getElementById("svcList");
    list.innerHTML = SERVICES.map(function (svc) {
      return (
        '<div class="admin-item" data-id="' + escapeHtml(svc.id) + '">' +
        '<div><div class="ai-title">' + escapeHtml(svc.title) + '</div>' +
        '<div class="ai-sub">' + escapeHtml(svc.subtitle || svc.online || "") + '</div></div>' +
        '<div class="ai-actions">' +
        '<button type="button" data-edit="' + escapeHtml(svc.id) + '">Edit</button>' +
        '<button type="button" data-del="' + escapeHtml(svc.id) + '">Delete</button>' +
        '</div></div>'
      );
    }).join("");

    list.querySelectorAll("[data-edit]").forEach(function (btn) {
      btn.addEventListener("click", function () {
        var svc = SERVICES.find(function (s) { return s.id === btn.getAttribute("data-edit"); });
        if (!svc) return;
        document.getElementById("svcEditId").value = svc.id;
        document.getElementById("svcTitle").value = svc.title || "";
        document.getElementById("svcSub").value = svc.subtitle || "";
        document.getElementById("svcOnline").value = svc.online || "";
        document.getElementById("svcOffline").value = svc.offline || "";
        var preset = "link";
        var isCustom = true;
        Object.keys(ICONS).forEach(function (k) {
          if (svc.icon === ICONS[k]) { preset = k; isCustom = false; }
        });
        if (svc.admin) { preset = "user"; isCustom = false; }
        document.getElementById("svcIconPreset").value = isCustom ? "custom" : preset;
        document.getElementById("svcIconCustom").hidden = !isCustom;
        document.getElementById("svcIconCustom").value = isCustom ? (svc.icon || "") : "";
        document.getElementById("svcCancel").hidden = false;
        document.getElementById("svcSave").textContent = "Update system";
        document.getElementById("svcMsg").textContent = "";
      });
    });

    list.querySelectorAll("[data-del]").forEach(function (btn) {
      btn.addEventListener("click", function () {
        var id = btn.getAttribute("data-del");
        if (!confirm("Delete this system?")) return;
        SERVICES = SERVICES.filter(function (s) { return s.id !== id; });
        saveServices();
        render();
        renderAdminList();
        resetForm();
      });
    });
  }

  function saveSystem(e) {
    e.preventDefault();
    var editId = document.getElementById("svcEditId").value;
    var title = document.getElementById("svcTitle").value.trim();
    var sub = document.getElementById("svcSub").value.trim();
    var online = document.getElementById("svcOnline").value.trim();
    var offline = document.getElementById("svcOffline").value.trim();
    var preset = document.getElementById("svcIconPreset").value;
    var custom = document.getElementById("svcIconCustom").value.trim();
    var icon = preset === "custom" ? custom : (ICONS[preset] || ICONS.link);

    if (!title) {
      showMsg("svcMsg", "Title is required.", "bad");
      return;
    }
    var isAdmin = title.toLowerCase() === "super admin";
    if (!isAdmin && !online) {
      showMsg("svcMsg", "Online URL is required.", "bad");
      return;
    }
    if (online && !isSafeUrl(online)) {
      showMsg("svcMsg", "Online URL must be a valid http:// or https:// address.", "bad");
      return;
    }
    if (offline && !isSafeUrl(offline)) {
      showMsg("svcMsg", "Offline URL must be a valid http:// or https:// address.", "bad");
      return;
    }
    if (title.length > 120 || sub.length > 200 || online.length > 2048 || offline.length > 2048) {
      showMsg("svcMsg", "One or more fields are too long.", "bad");
      return;
    }
    if (preset === "custom" && custom.length > 300000) {
      showMsg("svcMsg", "Icon is too large (maximum 300 KB).", "bad");
      return;
    }

    if (editId) {
      var svc = SERVICES.find(function (s) { return s.id === editId; });
      if (svc) {
        svc.title = title;
        svc.subtitle = sub;
        svc.online = online;
        svc.offline = offline;
        svc.icon = icon;
        svc.admin = isAdmin;
      }
    } else {
      var id = title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || ("svc-" + Date.now());
      if (SERVICES.some(function (s) { return s.id === id; })) id += "-" + Date.now();
      SERVICES.push({ id: id, title: title, subtitle: sub, online: online, offline: offline, icon: icon, admin: isAdmin });
    }

    saveServices();
    render();
    renderAdminList();
    resetForm();
    showMsg("svcMsg", "Saved.", "ok");
  }

  function showMsg(id, text, kind) {
    var el = document.getElementById(id);
    if (!el) return;
    el.textContent = text;
    el.className = "admin-msg " + (kind || "");
  }

  /* ------------------------------------------------------------------
   * 8) Pointer effects
   * ------------------------------------------------------------------ */
  var reduceMotion = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var cursorGlow = document.querySelector(".cursor-glow");
  var pointerX = 0;
  var pointerY = 0;

  function updateCursorGlow() {
    if (!cursorGlow) return;
    var size = 520;
    cursorGlow.style.transform =
      "translate3d(" + (pointerX - size / 2) + "px," + (pointerY - size / 2) + "px,0)";
  }

  function resetCardTilt(card) {
    card.style.setProperty("--rx", "0deg");
    card.style.setProperty("--ry", "0deg");
    card.style.setProperty("--mx", "50%");
    card.style.setProperty("--my", "50%");
  }

  function initPointerEffects() {
    if (reduceMotion) return;

    if (cursorGlow) {
      document.addEventListener("pointermove", function (e) {
        if (e.pointerType === "touch") return;
        pointerX = e.clientX;
        pointerY = e.clientY;
        if (!document.body.classList.contains("pointer-active")) {
          document.body.classList.add("pointer-active");
        }
        updateCursorGlow();
      }, { passive: true });

      document.documentElement.addEventListener("pointerleave", function () {
        document.body.classList.remove("pointer-active");
      });
      window.addEventListener("blur", function () {
        document.body.classList.remove("pointer-active");
      });
    }

    grid.addEventListener("pointermove", function (e) {
      if (e.pointerType === "touch") return;
      var card = e.target && e.target.closest ? e.target.closest(".card") : null;
      if (!card) return;
      var rect = card.getBoundingClientRect();
      if (!rect.width || !rect.height) return;
      var x = (e.clientX - rect.left) / rect.width;
      var y = (e.clientY - rect.top) / rect.height;
      var rx = (0.5 - y) * 7;
      var ry = (x - 0.5) * 7;
      card.style.setProperty("--rx", rx.toFixed(2) + "deg");
      card.style.setProperty("--ry", ry.toFixed(2) + "deg");
      card.style.setProperty("--mx", (x * 100).toFixed(1) + "%");
      card.style.setProperty("--my", (y * 100).toFixed(1) + "%");
    }, { passive: true });

    grid.addEventListener("pointerout", function (e) {
      var card = e.target && e.target.closest ? e.target.closest(".card") : null;
      if (!card) return;
      if (e.relatedTarget && card.contains(e.relatedTarget)) return;
      resetCardTilt(card);
    }, { passive: true });

    document.addEventListener("click", function (e) {
      var target = e.target && e.target.closest ? e.target.closest(".link-btn, .icon-btn, .admin-btn") : null;
      if (!target || target.disabled) return;
      var rect = target.getBoundingClientRect();
      var size = Math.max(rect.width, rect.height) * 1.6;
      var ripple = document.createElement("span");
      ripple.className = "ripple";
      ripple.style.width = size + "px";
      ripple.style.height = size + "px";
      ripple.style.left = (e.clientX - rect.left - size / 2) + "px";
      ripple.style.top = (e.clientY - rect.top - size / 2) + "px";
      target.appendChild(ripple);
      window.setTimeout(function () { ripple.remove(); }, 650);
    });
  }

  /* ------------------------------------------------------------------
   * 9) Init
   * ------------------------------------------------------------------ */
  render();
  initTheme();
  initPointerEffects();
  tickClock();
  setInterval(tickClock, 1000);
  setInterval(checkAll, 60000);

  refreshBtn.addEventListener("click", checkAll);
  themeBtn.addEventListener("click", function () {
    var current = document.documentElement.getAttribute("data-theme");
    applyTheme(current === "dark" ? "light" : "dark");
  });

  adminBtn.addEventListener("click", openAdmin);
  adminClose.addEventListener("click", closeAdmin);
  adminModal.querySelector(".modal-backdrop").addEventListener("click", closeAdmin);
  adminUnlock.addEventListener("click", unlock);
  adminPass.addEventListener("keydown", function (e) { if (e.key === "Enter") unlock(); });

  adminModal.addEventListener("pointermove", resetAdminIdle, { passive: true });
  adminModal.addEventListener("pointerdown", resetAdminIdle, { passive: true });
  adminModal.addEventListener("keydown", resetAdminIdle);
  adminModal.addEventListener("input", resetAdminIdle);
  adminModal.addEventListener("click", resetAdminIdle);

  document.getElementById("svcIconPreset").addEventListener("change", function () {
    document.getElementById("svcIconCustom").hidden = this.value !== "custom";
  });
  document.getElementById("svcIconFile").addEventListener("change", function () {
    var file = this.files && this.files[0];
    if (!file) return;
    var reader = new FileReader();
    reader.onload = function (e) {
      document.getElementById("svcIconPreset").value = "custom";
      document.getElementById("svcIconCustom").hidden = false;
      document.getElementById("svcIconCustom").value = e.target.result;
    };
    reader.readAsDataURL(file);
  });
  document.getElementById("svcForm").addEventListener("submit", saveSystem);
  document.getElementById("svcCancel").addEventListener("click", resetForm);

  document.getElementById("changePass").addEventListener("click", function () {
    var np = document.getElementById("newPass").value;
    if (!np) { showMsg("settingsMsg", "Enter a new password.", "bad"); return; }
    setAdminPass(np);
    document.getElementById("newPass").value = "";
    showMsg("settingsMsg", "Password changed.", "ok");
  });

  document.getElementById("resetDefaults").addEventListener("click", function () {
    if (!confirm("Reset all systems to defaults?")) return;
    SERVICES = DEFAULT_SERVICES.map(function (s) { return Object.assign({}, s); });
    saveServices();
    render();
    renderAdminList();
    resetForm();
    showMsg("settingsMsg", "Reset to defaults.", "ok");
  });

  window.addEventListener("load", function () {
    // Register the service worker for offline use (not available on file://)
    if ("serviceWorker" in navigator && location.protocol !== "file:") {
      navigator.serviceWorker.register("sw.js").catch(function () {});
    }
    setTimeout(checkAll, 400);
  });
  document.addEventListener("visibilitychange", function () {
    if (!document.hidden) checkAll();
  });
})();