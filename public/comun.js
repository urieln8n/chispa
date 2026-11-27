// Utilidades compartidas de Chispa
const BASE = location.pathname.replace(/[^/]*$/, '');
const FORMAS = [
  '<svg class="forma" viewBox="0 0 24 24"><path d="M12 2l2.9 6.6 7.1.6-5.4 4.7 1.6 7.1L12 17.3 5.8 21l1.6-7.1L2 9.2l7.1-.6z"/></svg>',
  '<svg class="forma" viewBox="0 0 24 24"><path d="M13.5 2L4 14h6.5L9 22l11-13h-6.8z"/></svg>',
  '<svg class="forma" viewBox="0 0 24 24"><path d="M14.5 2.5A9.5 9.5 0 1 0 21.5 16 8 8 0 0 1 14.5 2.5z"/></svg>',
  '<svg class="forma" viewBox="0 0 24 24"><path d="M12 21s-8-5.2-8-11a4.5 4.5 0 0 1 8-2.8A4.5 4.5 0 0 1 20 10c0 5.8-8 11-8 11z"/></svg>'
];
const NOMBRES_FORMA = ['estrella', 'rayo', 'luna', 'corazón'];
// ---- Marca (Chispa o Lumbrera): el mismo motor con dos nombres ----
const LOGOS = {
  chispa: '<svg class="chispa" viewBox="0 0 32 32" aria-hidden="true"><circle cx="16" cy="16" r="15" fill="#FFB020"/><path d="M18 5 9 18h6l-2 9 10-13h-6z" fill="#0F1B2D"/></svg>',
  fe: '<svg class="chispa" viewBox="0 0 32 32" aria-hidden="true"><circle cx="16" cy="16" r="15" fill="#F2C46B"/><path d="M16 6c3 4 5 6.5 5 9.5a5 5 0 0 1-10 0C11 12.5 13 10 16 6z" fill="#1B1640"/><path d="M9 22h14l-1.5 4h-11z" fill="#1B1640"/></svg>'
};
let MARCA = { id: 'chispa', nombre: 'Pulsazo', tema: 'chispa', lema: '' };
try { const m = JSON.parse(localStorage.getItem('chispa-marca') || 'null'); if (m && m.id && m.nombre !== 'Chispa') MARCA = m; } catch {}
const lemaVisible = () => MARCA.id === 'fe' ? (MARCA.lema || '') : '';
function marca() { return `<a class="marca" href="${BASE}" aria-label="${esc(MARCA.nombre)} · inicio"><span class="marca-logo">${LOGOS[MARCA.id] || LOGOS.chispa}</span><span class="marca-txt"><span class="marca-nombre">${esc(MARCA.nombre)}</span><span class="marca-lema">${esc(lemaVisible())}</span></span></a>`; }
function aplicarMarca() {
  document.querySelectorAll('.marca-logo').forEach(e => e.innerHTML = LOGOS[MARCA.id] || LOGOS.chispa);
  document.querySelectorAll('.marca-nombre').forEach(e => e.textContent = MARCA.nombre);
  document.querySelectorAll('.marca-lema').forEach(e => e.textContent = lemaVisible());
  document.title = document.title.replace(/^(Chispa|Pulsazo|Lumbrera)/, MARCA.nombre);
  document.documentElement.dataset.marca = MARCA.id;
  if (MARCA.tema === 'fe' && !document.body.classList.contains('tema-navidad')) document.body.classList.add('tema-fe');
  const cr = document.getElementById('creditos'); if (cr) cr.textContent = MARCA.creditos || '';
}
fetch(BASE + 'api/marca').then(r => r.json()).then(m => {
  if (!m || !m.id) return;
  MARCA = m; try { localStorage.setItem('chispa-marca', JSON.stringify(m)); } catch {}
  if (document.body) aplicarMarca(); else document.addEventListener('DOMContentLoaded', aplicarMarca);
}).catch(() => {});
document.addEventListener('DOMContentLoaded', aplicarMarca);
function esc(s) { return String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])); }
function $(s) { return document.querySelector(s); }
function aviso(msg, ms = 2500) {
  const d = document.createElement('div'); d.className = 'aviso pop'; d.textContent = msg;
  document.body.appendChild(d); setTimeout(() => d.remove(), ms);
}
// Conexión en tiempo real a una partida (WebSocket con reconexión automática)
function conectarJuego(pin) {
  const handlers = {}, acks = new Map(); let ws, n = 0, cola = [], cerrado = false, intentos = 0;
  const s = {
    connected: false,
    on(e, f) { (handlers[e] = handlers[e] || []).push(f); },
    emit(e, d, cb) {
      const m = { t: e, d: d || {} };
      if (cb) { m.id = ++n; acks.set(m.id, cb); }
      const txt = JSON.stringify(m);
      if (s.connected) ws.send(txt); else cola.push(txt);
    },
    close() { cerrado = true; if (ws) ws.close(); }
  };
  const fire = (e, d) => (handlers[e] || []).forEach(f => f(d));
  function abrir() {
    ws = new WebSocket(`${location.protocol === 'https:' ? 'wss:' : 'ws:'}//${location.host}${BASE}ws?pin=${pin}`);
    ws.onopen = () => { s.connected = true; intentos = 0; fire('connect'); cola.splice(0).forEach(t => ws.send(t)); };
    ws.onmessage = ev => {
      let m; try { m = JSON.parse(ev.data); } catch { return; }
      if (m.t === 'ack') { const cb = acks.get(m.id); acks.delete(m.id); if (cb) cb(m.d); } else fire(m.t, m.d);
    };
    ws.onclose = () => {
      const era = s.connected; s.connected = false;
      if (era) fire('disconnect');
      if (!cerrado) setTimeout(abrir, Math.min(5000, 400 * 2 ** intentos++));
    };
  }
  abrir();
  setInterval(() => { if (s.connected) ws.send('{"t":"ping"}'); }, 25000);
  document.addEventListener('visibilitychange', () => { if (!document.hidden && !s.connected && ws && ws.readyState > 1) abrir(); });
  return s;
}
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

// Tema visual (Chispa o Navidad)
function aplicarTema(t) {
  document.body.classList.toggle('tema-navidad', t === 'navidad');
  document.body.classList.toggle('tema-fe', t !== 'navidad' && MARCA.tema === 'fe');
  document.querySelectorAll('.copo').forEach(c => c.remove());
  if (t !== 'navidad') return;
  for (let i = 0; i < 36; i++) {
    const c = document.createElement('span'); c.className = 'copo'; c.textContent = '❄';
    c.style.left = Math.random() * 100 + 'vw'; c.style.fontSize = 8 + Math.random() * 14 + 'px';
    c.style.animationDuration = 7 + Math.random() * 10 + 's'; c.style.animationDelay = -Math.random() * 15 + 's';
    c.setAttribute('aria-hidden', 'true'); document.body.appendChild(c);
  }
}
function confeti(n = 120) {
  const cols = ['#FF5A5F', '#2EC4B6', '#8B5CF6', '#FFB020', '#fff'];
  for (let i = 0; i < n; i++) {
    const d = document.createElement('div'); d.className = 'confeti';
    d.style.cssText = `position:fixed;top:-20px;width:10px;height:16px;z-index:60;left:${Math.random() * 100}vw;background:${cols[i % 5]};animation:caer ${2.5 + Math.random() * 2.5}s linear ${Math.random() * 1.2}s forwards`;
    document.body.appendChild(d); setTimeout(() => d.remove(), 7000);
  }
}
(function () { const st = document.createElement('style'); st.textContent = '@keyframes caer{to{transform:translateY(110vh) rotate(720deg)}}'; document.head.appendChild(st); })();

// ===== Compartir (partidas, resultados, invitaciones) =====
// Usa el menú nativo del móvil (WhatsApp, Telegram, Instagram…); si no existe, abre WhatsApp.
async function compartir(texto, url) {
  if (navigator.share) {
    try { await navigator.share({ title: MARCA.nombre, text: texto, url }); return; }
    catch (e) { if (e && e.name === 'AbortError') return; }
  }
  abrirWhatsApp(texto, url);
}
function abrirWhatsApp(texto, url) { window.open('https://wa.me/?text=' + encodeURIComponent(texto + (url ? '\n' + url : '')), '_blank', 'noopener'); }
async function copiarTexto(t) {
  try { await navigator.clipboard.writeText(t); aviso('Enlace copiado ✓'); }
  catch { aviso('Copia este enlace: ' + t, 6000); }
}
// Tres botones: menú del móvil, WhatsApp directo y copiar enlace
function barraCompartir(texto, url, etiqueta = 'Compartir') {
  const d = esc(JSON.stringify({ texto, url }));
  return `<div class="compartir">
    <button type="button" class="btn" data-compartir="${d}">📤 ${esc(etiqueta)}</button>
    <button type="button" class="btn wa" data-compartir="${d}" data-modo="wa">WhatsApp</button>
    <button type="button" class="btn sec" data-compartir="${d}" data-modo="copiar">🔗 Copiar enlace</button></div>`;
}
document.addEventListener('click', e => {
  const b = e.target.closest('[data-compartir]'); if (!b) return;
  e.preventDefault();
  let d; try { d = JSON.parse(b.dataset.compartir); } catch { return; }
  if (b.dataset.modo === 'wa') abrirWhatsApp(d.texto, d.url);
  else if (b.dataset.modo === 'copiar') copiarTexto(d.url || d.texto);
  else compartir(d.texto, d.url);
});
