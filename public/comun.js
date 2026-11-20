// Utilidades compartidas de Chispa
const BASE = location.pathname.replace(/[^/]*$/, '');
const FORMAS = [
  '<svg class="forma" viewBox="0 0 24 24"><path d="M12 2l2.9 6.6 7.1.6-5.4 4.7 1.6 7.1L12 17.3 5.8 21l1.6-7.1L2 9.2l7.1-.6z"/></svg>',
  '<svg class="forma" viewBox="0 0 24 24"><path d="M13.5 2L4 14h6.5L9 22l11-13h-6.8z"/></svg>',
  '<svg class="forma" viewBox="0 0 24 24"><path d="M14.5 2.5A9.5 9.5 0 1 0 21.5 16 8 8 0 0 1 14.5 2.5z"/></svg>',
  '<svg class="forma" viewBox="0 0 24 24"><path d="M12 21s-8-5.2-8-11a4.5 4.5 0 0 1 8-2.8A4.5 4.5 0 0 1 20 10c0 5.8-8 11-8 11z"/></svg>'
];
const NOMBRES_FORMA = ['estrella', 'rayo', 'luna', 'corazón'];
const LOGO = '<svg class="chispa" viewBox="0 0 32 32" aria-hidden="true"><circle cx="16" cy="16" r="15" fill="#FFB020"/><path d="M18 5 9 18h6l-2 9 10-13h-6z" fill="#0F1B2D"/></svg>';
function marca() { return `<a class="marca" href="${BASE}">${LOGO}Chispa</a>`; }
function esc(s) { return String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])); }
function $(s) { return document.querySelector(s); }
function aviso(msg, ms = 2500) {
  const d = document.createElement('div'); d.className = 'aviso pop'; d.textContent = msg;
  document.body.appendChild(d); setTimeout(() => d.remove(), ms);
}
function conectar() { return io({ path: BASE + 'socket.io', transports: ['websocket', 'polling'] }); }
function clave() { try { return localStorage.getItem('chispa-clave') || ''; } catch { return ''; } }
function guardarClave(c) { try { localStorage.setItem('chispa-clave', c); } catch {} }
async function api(ruta, opts = {}) {
  const r = await fetch(BASE + 'api/' + ruta, {
    ...opts, headers: { 'content-type': 'application/json', 'x-chispa-clave': clave(), ...(opts.headers || {}) },
    body: opts.body ? JSON.stringify(opts.body) : undefined
  });
  const data = await r.json().catch(() => ({}));
  if (r.status === 401 && !ruta.startsWith('login')) { location.href = BASE + 'panel'; throw new Error('login'); }
  if (!r.ok) throw new Error(data.error || 'Error');
  return data;
}
function sonido(tipo) {
  try {
    const ctx = sonido.ctx || (sonido.ctx = new (window.AudioContext || window.webkitAudioContext)());
    const o = ctx.createOscillator(), g = ctx.createGain();
    const f = { tic: 880, ok: 660, mal: 200, fin: 523 }[tipo] || 440;
    o.frequency.value = f; o.type = tipo === 'mal' ? 'sawtooth' : 'triangle';
    g.gain.setValueAtTime(.08, ctx.currentTime); g.gain.exponentialRampToValueAtTime(.0001, ctx.currentTime + (tipo === 'tic' ? .08 : .35));
    o.connect(g).connect(ctx.destination); o.start(); o.stop(ctx.currentTime + .4);
  } catch {}
}
