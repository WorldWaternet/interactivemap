/* Service worker – مياه اسكاكا */
const SHELL = "iskaka-shell-v1";
const TILES = "iskaka-tiles";
const FONTS = "iskaka-fonts";
const MAX_TILES = 300;
const FILES = ["./", "index.html", "manifest.webmanifest", "icons/icon-192.png", "icons/icon-512.png", "icons/apple-touch-icon.png"];
const isTile = u => /arcgisonline\.com|tile\.openstreetmap\.org|tile\.opentopomap\.org/.test(u.hostname);
const isFont = u => /fonts\.(googleapis|gstatic)\.com/.test(u.hostname);

self.addEventListener("install", e => {
  e.waitUntil(caches.open(SHELL).then(c => c.addAll(FILES)).then(() => self.skipWaiting()));
});
self.addEventListener("activate", e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k.startsWith("iskaka-shell-") && k !== SHELL).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

async function trim(name, max) {
  const c = await caches.open(name), ks = await c.keys();
  if (ks.length > max) await Promise.all(ks.slice(0, ks.length - max).map(k => c.delete(k)));
}
async function cacheFirst(req, name, max) {
  const c = await caches.open(name), hit = await c.match(req);
  if (hit) return hit;
  const res = await fetch(req);
  if (res && (res.ok || res.type === "opaque")) {
    try { await c.put(req, res.clone()); if (max) trim(name, max); } catch (e) {}
  }
  return res;
}
async function staleWhileRevalidate(req, name) {
  const c = await caches.open(name), hit = await c.match(req);
  const net = fetch(req).then(res => { if (res && (res.ok || res.type === "opaque")) c.put(req, res.clone()).catch(() => {}); return res; }).catch(() => hit);
  return hit || net;
}

self.addEventListener("fetch", e => {
  const req = e.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);

  if (req.mode === "navigate") {
    e.respondWith(
      fetch(req).then(res => { const copy = res.clone(); caches.open(SHELL).then(c => c.put("index.html", copy)); return res; })
        .catch(() => caches.match("index.html"))
    );
    return;
  }
  if (isTile(url)) { e.respondWith(cacheFirst(req, TILES, MAX_TILES).catch(() => Response.error())); return; }
  if (isFont(url)) { e.respondWith(staleWhileRevalidate(req, FONTS)); return; }
  if (url.origin === location.origin) { e.respondWith(staleWhileRevalidate(req, SHELL)); }
});
