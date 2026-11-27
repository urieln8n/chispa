// Lumbrera: permite instalarla como app y aprender sin conexión.
// Solo lo registra la web de Lumbrera (aprender.html). Nunca guarda la API ni las partidas en vivo.
const VERSION = 'lumbrera-v12';
const BASICO = ['/', '/aprender', '/jugar', '/styles.css', '/comun.js', '/biblia/libros.json', '/biblia/genesis.json', '/biblia/exodo.json', '/biblia/mateo.json', '/biblia/marcos.json', '/biblia/lucas.json', '/biblia/juan.json', '/biblia/hechos.json', '/biblia/navidad.json', '/biblia/temas.json', '/biblia/personajes.json', '/biblia/versiculos.json',
  '/app/manifest.webmanifest', '/app/icono-192.png', '/app/icono-512.png',
  '/fonts/baloo-2-latin-600-normal.woff2', '/fonts/baloo-2-latin-800-normal.woff2', '/fonts/nunito-latin-400-normal.woff2', '/fonts/nunito-latin-600-normal.woff2', '/fonts/nunito-latin-800-normal.woff2'];

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
    const copiaGuardada = async () => (await caches.match(req, { ignoreSearch: true })) || caches.match('/aprender');
    e.respondWith(fetch(req).then(async res => {
      if (res.ok) { const copia = res.clone(); caches.open(VERSION).then(c => c.put(req, copia)); return res; }
      // Error del servidor o cupo diario agotado (p. ej. error 1027 de Cloudflare): mejor la app guardada que una página de error
      if (res.status >= 429 && res.status !== 501) { const g = await copiaGuardada(); if (g) return g; }
      return res;
    }).catch(copiaGuardada));
    return;
  }
  // Fuentes de Google: de la copia (no cambian)
  if (fuentes) {
    e.respondWith(caches.match(req).then(g => g || fetch(req).then(res => { const c = res.clone(); caches.open(VERSION).then(x => x.put(req, c)); return res; })));
    return;
  }
  // Código y datos de la web: primero la red (nunca se mezcla una versión vieja con una nueva); sin conexión, la copia
  e.respondWith(fetch(req).then(res => {
    if (res.ok) { const c = res.clone(); caches.open(VERSION).then(x => x.put(req, c)); }
    return res;
  }).catch(() => caches.match(req)));
});

// ===================== Notificaciones: recordatorio diario =====================
// El aviso llega sin texto; aquí se elige según la racha que la app guarda en IndexedDB.
function leerEstado() {
  return new Promise(ok => {
    try {
      const r = indexedDB.open('lumbrera', 1);
      r.onupgradeneeded = () => r.result.createObjectStore('kv');
      r.onerror = () => ok(null);
      r.onsuccess = () => { try { const g = r.result.transaction('kv').objectStore('kv').get('estado'); g.onsuccess = () => ok(g.result || null); g.onerror = () => ok(null); } catch { ok(null); } };
    } catch { ok(null); }
  });
}
self.addEventListener('push', e => {
  e.waitUntil(leerEstado().then(est => {
    const hoy = new Date().toLocaleDateString('sv-SE'), ayer = new Date(Date.now() - 864e5).toLocaleDateString('sv-SE');
    const racha = est && est.racha || 0, nombre = est && est.nombre ? est.nombre.split(' ')[0] : '';
    let titulo, cuerpo;
    if (est && est.ultimoDia === hoy) { titulo = '✨ ¡Bien hecho hoy!'; cuerpo = 'Ya has hecho tu lección. Mañana te espera otra.'; }
    else if (racha >= 2 && est.ultimoDia === ayer) { titulo = `🔥 Tu racha de ${racha} días está en peligro`; cuerpo = `${nombre ? nombre + ', haz' : 'Haz'} una lección de 2 minutos para no perderla.`; }
    else if (racha === 1 && est.ultimoDia === ayer) { titulo = '🔥 ¡Mantén viva tu racha!'; cuerpo = 'Ayer empezaste. Hoy toca el día 2.'; }
    else { titulo = '📖 Tu lección de Génesis te espera'; cuerpo = 'Unos minutos al día bastan. ¡Vamos!'; }
    return self.registration.showNotification(titulo, { body: cuerpo, icon: '/app/icono-192.png', badge: '/app/icono-192.png', tag: 'racha', renotify: true, data: { url: '/' } });
  }));
});
self.addEventListener('notificationclick', e => {
  e.notification.close();
  e.waitUntil(self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(cs => {
    const c = cs.find(x => new URL(x.url).origin === location.origin);
    return c ? c.focus().then(w => w && w.navigate ? w.navigate('/') : w).catch(() => self.clients.openWindow('/')) : self.clients.openWindow('/');
  }));
});
