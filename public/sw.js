// Lumbrera: permite instalarla como app y aprender sin conexión.
// Solo lo registra la web de Lumbrera (aprender.html). Nunca guarda la API ni las partidas en vivo.
const VERSION = 'lumbrera-v1';
const BASICO = ['/', '/aprender', '/jugar', '/styles.css', '/comun.js', '/biblia/libros.json', '/biblia/genesis.json',
  '/app/manifest.webmanifest', '/app/icono-192.png', '/app/icono-512.png'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(VERSION).then(c => c.addAll(BASICO)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== VERSION).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  const fuentes = url.hostname === 'fonts.googleapis.com' || url.hostname === 'fonts.gstatic.com';
  if (url.origin !== location.origin && !fuentes) return;
  if (url.pathname.startsWith('/api/') || url.pathname === '/ws') return;

  // Páginas: primero la red (para tener siempre la última versión); sin conexión, la copia guardada
  if (req.mode === 'navigate') {
    e.respondWith(fetch(req).then(res => {
      const copia = res.clone(); caches.open(VERSION).then(c => c.put(req, copia)); return res;
    }).catch(async () => (await caches.match(req, { ignoreSearch: true })) || caches.match('/aprender')));
    return;
  }
  // Resto (estilos, datos, iconos, fuentes): respuesta inmediata desde la copia y actualización en segundo plano
  e.respondWith(caches.match(req).then(guardada => {
    const red = fetch(req).then(res => {
      if (res.ok || res.type === 'opaque') { const copia = res.clone(); caches.open(VERSION).then(c => c.put(req, copia)); }
      return res;
    }).catch(() => guardada);
    return guardada || red;
  }));
});
