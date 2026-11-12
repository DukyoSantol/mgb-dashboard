# MGB Dashboard

A single-page, tap-friendly dashboard that links straight to the three internal apps
with their **Online** and **Offline** addresses.

## PWA files

| File | Purpose |
| --- | --- |
| [`manifest.json`](manifest.json) | Web app manifest — name, standalone display, dark theme colours and 192/512 icons |
| [`sw.js`](sw.js) | Service worker — precaches the app shell and serves it cache-first so the dashboard opens offline |
| [`assets/icons/icon.svg`](assets/icons/icon.svg) | Vector app icon (favicon / any-size icon) |
| `assets/icons/icon-192.png` | 192×192 home-screen icon |
| `assets/icons/icon-512.png` | 512×512 home-screen / splash icon |
| [`index.html`](index.html) | Page structure plus manifest, favicon and iOS web-app meta tags |
| [`assets/css/style.css`](assets/css/style.css) | Dashboard styling |
| [`assets/js/app.js`](assets/js/app.js) | Dashboard logic and service-worker registration |

## Install as an app (PWA)

**Open the dashboard over http (or https), then use “Add to Home Screen” / “Install”.**

The manifest and service worker make the dashboard installable and keep the app shell
available offline. Service workers need a secure context: use `https://`,
`http://localhost` or `http://127.0.0.1`. Opening `index.html` directly from `file://`
still works as a page, but cannot install the PWA or cache it offline.

> After changing a cached file (`index.html`, CSS, JS, icons or `manifest.json`), bump
> `CACHE_NAME` in [`sw.js`](sw.js) so installed clients pick up the new version.

## Links configured

| App | Online | Offline |
| --- | --- | --- |
| Travel Order | `http://202.137.120.23:8080` | `http://starrs:8080/login` |
| Diamond | `http://202.137.120.23/diamond/` | `http://dats-server/diamond/index.php` |
| DTR | `http://202.137.120.23/dtr/` | `http://dats-server/dtr` |

## How to use

1. Open [`index.html`](index.html) in any browser (double-click is fine — no server or
   internet connection required for the page itself).
2. (Recommended) Install it as an app: **open the page over http(s), then choose
   “Add to Home Screen” / “Install”**. It will then launch like a normal app icon and
   work offline. (Use `https://` or `localhost` for service-worker support.)
3. **Tap the big coloured icon** → opens the app's **Online** address in a new tab.
4. Tap the **Online** / **Offline** buttons on a card → opens that specific address.
5. Tap the 🔄 button in the header → re-checks which links are reachable.
   A **green dot** = reachable, **red dot** = unreachable, **amber dot** = checking.
6. Tap the 🌙 button in the header → switches between dark and light theme.

> Tip for phone/tablet use: add the page to your home screen (Chrome/Safari "Add to
> Home Screen") so it behaves like a native app icon launcher.

## Editing / adding a link

All links live in one array at the top of [`assets/js/app.js`](assets/js/app.js):

```js
var SERVICES = [
  {
    id: "travelorder",               // unique id used in the DOM
    title: "Travel Order",           // card heading
    subtitle: "Main application sign-in",
    online: "http://202.137.120.23:8080",
    offline: "http://starrs:8080/login",
    icon: "<svg ...>"                 // any inline SVG
  }
  // add more objects here -> a new card is created automatically
];
```

Change the URLs, save, and refresh the browser — no other file needs editing.

## Notes on the status dots

* The Offline addresses (`starrs`, `dats-server`) are internal host names. They only
  resolve from inside the company network, so the dot may show red when the dashboard
  is opened from outside — the link itself still works from a machine on the LAN.
* Detection is best-effort (CORS/`no-cors` probe with a 5 second timeout); the dots are
  an indicator only, the buttons always open the exact URLs you configured.

## Serving it as a real site (optional)

To share it on the LAN instead of opening the file directly, run any static server
from this folder, e.g.:

```bash
python -m http.server 8080
```

then browse to `http://localhost:8080` (or `http://<server-ip>:8080`). Service workers
need a secure context, so install/offline caching works on `localhost`, `127.0.0.1` or
over **https**. A plain `http://<server-ip>` page still loads, but cannot install the
PWA; use https or a local server to get the full offline app (see `manifest.json` and
`sw.js`).
