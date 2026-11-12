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
    list = list.filter(function (s) { return !s.admin; });
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
  var statusLine = document.getElementById("statusLine");
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
    return (
      '<a class="link-btn ' +
      kind +
      '" href="' +
      url +
      '" target="_blank" rel="noopener noreferrer" data-link="' +
      kind +
      '" data-url="' +
      url +
      '">' +
      '<span class="lb-main">' +
      '<span class="lb-ico">' +
      icon +
      '</span>' +
      '<span><span class="lb-name">' +
      label +
      '</span><span class="lb-url">' +
      url +
      '</span></span>' +
      "</span>" +
      '<span class="dot" data-dot="' +
      kind +
      '" title="Not checked"></span>' +
      "</a>"
    );
  }

  function iconMarkup(icon) {
    if (!icon) return "";
    if (/^data:image\//.test(icon) || /\.(png|jpe?g|gif|webp|svg)(\?.*)?$/i.test(icon)) {
      return '<img src="' + icon + '" alt="" style="width:100%;height:100%;object-fit:contain;border-radius:12px;" />';
    }
    return icon;
  }

  function cardTemplate(svc) {
    if (svc.admin) {
      return (
        '<article class="card" data-id="' +
        svc.id +
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
    return (
      '<article class="card" data-id="' +
      svc.id +
      '">' +
      '<a class="card-icon" href="' +
      svc.online +
      '" target="_blank" rel="noopener noreferrer" title="Open ' +
      escapeHtml(svc.title) +
      ' (online)">' +
      '<span class="tile">' +
      iconMarkup(svc.icon) +
      "</span>" +
      '<span class="card-meta">' +
      '<span class="card-title">' +
      escapeHtml(svc.title) +
      "</span>" +
      "</span>" +
      "</a>" +
      '<div class="links">' +
      linkButton("online", "Online", svc.online, WIFI_ICON) +
      linkButton("offline", "Offline", svc.offline, LOCAL_ICON) +
      "</div>" +
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
  function probe(url, timeoutMs) {
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
    statusLine.textContent = "Checking link status...";

    var jobs = [];
    var results = { up: 0, down: 0, total: 0 };
    SERVICES.forEach(function (svc) {
      if (svc.admin) return;
      var scope = grid.querySelector('.card[data-id="' + svc.id + '"]');
      if (!scope) return;
      setDot(scope, "online", "busy");
      setDot(scope, "offline", "busy");

      jobs.push(
        probe(svc.online, 5000).then(function (up) {
          setDot(scope, "online", up ? "up" : "down");
          results.total++;
          if (up) results.up++; else results.down++;
          return up;
        })
      );
      jobs.push(
        probe(svc.offline, 5000).then(function (up) {
          setDot(scope, "offline", up ? "up" : "down");
          results.total++;
          if (up) results.up++; else results.down++;
          return up;
        })
      );
    });

    Promise.all(jobs).then(function () {
      isChecking = false;
      refreshBtn.classList.remove("spinning");
      var now = new Date();
      var timeStr = now.toLocaleTimeString();
      var summary = results.total
        ? results.up + "/" + results.total + " reachable"
        : "no links checked";
      statusLine.innerHTML =
        '<span class="status-time">' + escapeHtml(timeStr) + "</span>" +
        " - " + summary + " - green = reachable, red = unreachable.";
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

  function openAdmin() {
    adminModal.hidden = false;
    adminLogin.hidden = false;
    adminPanel.hidden = true;
    adminPass.value = "";
    adminLoginMsg.textContent = "";
    adminPass.focus();
  }

  function closeAdmin() {
    adminModal.hidden = true;
  }

  function unlock() {
    if (adminPass.value === getAdminPass()) {
      adminLogin.hidden = true;
      adminPanel.hidden = false;
      renderAdminList();
      resetForm();
    } else {
      adminLoginMsg.textContent = "Wrong password.";
      adminLoginMsg.className = "admin-msg bad";
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
   * 8) Init
   * ------------------------------------------------------------------ */
  render();
  initTheme();
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