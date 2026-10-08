/* Service worker – مياه اسكاكا  (v5) */
const SHELL = "iskaka-shell-v5";
const TILES = "iskaka-tiles-v2";      // جديد: يتجاهل الكاش القديم "iskaka-tiles" الذي قد يحوي صور خريطة فارغة/تالفة
const FONTS = "iskaka-fonts";
const MAX_TILES = 800;
const FILES = [
  "./", "index.html", "manifest.webmanifest",
  "icons/icon-192.png", "icons/icon-512.png", "icons/apple-touch-icon.png", "icons/logo-mark.svg", "icons/logo-mark-white.svg",
  "data/lines.js", "data/valves.js", "data/fittings.js", "data/tank.js", "data/culverts.js"
];
const isTile = u => /arcgisonline\.com|tile\.openstreetmap\.org|tile\.opentopomap\.org/.test(u.hostname);
const isFont = u => /fonts\.(googleapis|gstatic)\.com/.test(u.hostname);

self.addEventListener("install", e => {
  e.waitUntil(caches.open(SHELL).then(c => Promise.all(FILES.map(f => c.add(f).catch(() => {})))).then(() => self.skipWaiting()));   // لا يفشل التثبيت إن غاب ملف
});
self.addEventListener("activate", e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys
        .filter(k => (k.startsWith("iskaka-shell-") && k !== SHELL) || k === "iskaka-tiles")   // حذف الكاش القديم بما فيه الصور التالفة
        .map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

async function trim(name, max) {
  const c = await caches.open(name), ks = await c.keys();
  if (ks.length > max) await Promise.all(ks.slice(0, ks.length - max).map(k => c.delete(k)));
}

/* الصور: نخزّن فقط الردود السليمة (res.ok). الطلب العادي للصور "opaque" فلا نعرف إن كان خطأً،
   لذلك نجلبها بوضع CORS لنتحقق من الحالة، وإن فشل نمرّر الطلب كما هو دون تخزين. */
async function tileFirst(req) {
  const c = await caches.open(TILES), hit = await c.match(req.url);
  if (hit) return hit;
  try {
    const res = await fetch(req.url, { mode: "cors", credentials: "omit" });
    if (res.ok) { try { await c.put(req.url, res.clone()); trim(TILES, MAX_TILES); } catch (e) {} }
    return res;
  } catch (e) {
    return fetch(req);
  }
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
  if (isTile(url)) { e.respondWith(tileFirst(req).catch(() => Response.error())); return; }
  if (isFont(url)) { e.respondWith(staleWhileRevalidate(req, FONTS)); return; }
  if (url.origin === location.origin) { e.respondWith(staleWhileRevalidate(req, SHELL)); }
});
