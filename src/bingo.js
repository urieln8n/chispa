// Bingo musical: la lógica de una partida vive en el mismo Durable Object que el trivial (self = la instancia de Juego).
// Chispa NO reproduce música: el presentador la pone con el equipo (y la licencia) del local y marca aquí qué suena.
import { aleatorio, iguales } from './comun.js';

export const RONDAS = { linea: 'Línea', doble: 'Dos líneas', lleno: 'Cartón lleno' };

function azar(n) { return crypto.getRandomValues(new Uint32Array(1))[0] % n; }
function barajar(a) { for (let i = a.length - 1; i > 0; i--) { const j = azar(i + 1); [a[i], a[j]] = [a[j], a[i]]; } return a; }

// Las líneas posibles de un cartón n×n: filas, columnas y las dos diagonales
function lineas(n) {
  const L = [];
  for (let f = 0; f < n; f++) L.push([...Array(n)].map((_, c) => f * n + c));
  for (let c = 0; c < n; c++) L.push([...Array(n)].map((_, f) => f * n + c));
  L.push([...Array(n)].map((_, i) => i * n + i));
  L.push([...Array(n)].map((_, i) => i * n + (n - 1 - i)));
  return L;
}

export function crear(self, pin, lista, op = {}) {
  const n = [3, 4, 5].includes(+op.tamano) ? +op.tamano : 4;
  const libre = n === 5;
  const celdas = n * n - (libre ? 1 : 0);
  const canciones = (lista.canciones || []).filter(c => c && c.titulo);
  if (canciones.length < celdas + 4) return { error: `Para cartones de ${n}×${n} necesitas al menos ${celdas + 4} canciones en la lista (tiene ${canciones.length}).` };
  let rondas = (Array.isArray(op.rondas) ? op.rondas : []).filter(r => RONDAS[r]);
  if (!rondas.length) rondas = ['linea', 'lleno'];
  rondas = ['linea', 'doble', 'lleno'].filter(r => rondas.includes(r));
  const revelar = Math.min(Math.max(parseInt(op.revelar, 10), 0), 180);
  self.g = {
    tipo: 'bingo', pin, quiz: { titulo: lista.titulo }, canciones, n, libre, lineas: lineas(n), rondas, ronda: 0,
    estado: 'sala', sonadas: [], revelada: false, orden: barajar(canciones.map((_, i) => i)),
    claveHost: aleatorio(12), jugadores: new Map(), apodos: new Set(), ganadores: rondas.map(() => []),
    mostrar: op.mostrar === 'artista' ? 'artista' : 'titulo', revelarSeg: Number.isFinite(revelar) ? revelar : 20,
    tema: op.tema === 'navidad' ? 'navidad' : 'chispa', ultima: Date.now(), timer: null
  };
  return { pin, claveHost: self.g.claveHost };
}

// ---------- utilidades de estado ----------
const actual = g => g.sonadas.length ? g.sonadas[g.sonadas.length - 1] : -1;
const sonadaSet = g => new Set(g.sonadas);
function siguienteSugerida(g) { const s = sonadaSet(g); return g.orden.find(i => !s.has(i)) ?? -1; }
function cancion(g, i) { const c = g.canciones[i]; return c ? { idx: i, titulo: c.titulo, artista: c.artista || '' } : null; }

function carton(g) {
  const elegidas = barajar(g.canciones.map((_, i) => i)).slice(0, g.n * g.n - (g.libre ? 1 : 0));
  const out = [];
  const centro = g.libre ? Math.floor(g.n * g.n / 2) : -1;
  for (let k = 0, j = 0; k < g.n * g.n; k++) out.push(k === centro ? -1 : elegidas[j++]);
  return out;
}

// celdas "buenas": libres, o marcadas por el jugador Y cuya canción ha sonado
function buenas(g, p, soloSonadas = false) {
  const s = sonadaSet(g), ok = new Set();
  p.carton.forEach((idx, k) => { if (idx === -1 || (s.has(idx) && (soloSonadas || p.marcadas.has(k)))) ok.add(k); });
  return ok;
}
function evaluar(g, okSet, ronda) {
  const completas = g.lineas.filter(l => l.every(k => okSet.has(k)));
  if (ronda === 'linea') return completas.length >= 1 ? completas[0] : null;
  if (ronda === 'doble') return completas.length >= 2 ? [...new Set([...completas[0], ...completas[1]])] : null;
  const todas = [...Array(g.n * g.n).keys()];
  return todas.every(k => okSet.has(k)) ? todas : null;
}
// cuántas canciones le faltan como mínimo (contando solo lo que ha sonado) para cantar la ronda actual
function faltan(g, p) {
  const ok = buenas(g, p, true), ronda = g.rondas[g.ronda];
  const miss = g.lineas.map(l => l.filter(k => !ok.has(k)).length).sort((a, b) => a - b);
  if (ronda === 'linea') return miss[0];
  if (ronda === 'doble') return miss[0] + miss[1];
  return g.n * g.n - ok.size;
}
function cerca(g) {
  if (g.estado !== 'juego') return 0;
  let n = 0; for (const p of g.jugadores.values()) if (faltan(g, p) === 1) n++;
  return n;
}

function publicos(g) { return [...g.jugadores.values()].map(p => ({ id: p.id, apodo: p.apodo, conectado: p.conectado })); }
function nombreRonda(g) { return RONDAS[g.rondas[g.ronda]] || ''; }
function ganadoresPublicos(g) { return g.rondas.map((r, i) => ({ ronda: RONDAS[r], jugadores: g.ganadores[i].map(w => w.apodo) })); }

function estadoHost(g) {
  const s = sonadaSet(g);
  return {
    tipo: 'bingo', pin: g.pin, titulo: g.quiz.titulo, estado: g.estado, n: g.n, tema: g.tema, revelarSeg: g.revelarSeg,
    rondas: g.rondas.map(r => RONDAS[r]), ronda: g.ronda, nombreRonda: nombreRonda(g),
    numero: g.sonadas.length, actual: cancion(g, actual(g)), revelada: g.revelada,
    historial: g.sonadas.slice(0, g.revelada ? undefined : -1).slice(-12).reverse().map(i => cancion(g, i)),
    siguiente: cancion(g, siguienteSugerida(g)),
    canciones: g.canciones.map((c, i) => ({ idx: i, titulo: c.titulo, artista: c.artista || '', sonada: s.has(i) })),
    jugadores: publicos(g), ganadores: ganadoresPublicos(g), cerca: cerca(g)
  };
}
function estadoJugador(g, p) {
  const s = sonadaSet(g), ult = actual(g);
  return {
    id: p.id, token: p.token, apodo: p.apodo, estado: g.estado, tema: g.tema, titulo: g.quiz.titulo, n: g.n, mostrar: g.mostrar,
    carton: p.carton.map(i => i === -1 ? null : { titulo: g.canciones[i].titulo, artista: g.canciones[i].artista || '' }),
    marcadas: [...p.marcadas], numero: g.sonadas.length, nombreRonda: nombreRonda(g), ronda: g.ronda, totalRondas: g.rondas.length,
    revelada: g.revelada && ult >= 0 ? cancion(g, ult) : null,
    final: g.estado === 'final' ? { ganadores: ganadoresPublicos(g) } : null
  };
}

function aHosts(self, t, d) { self.aHosts(t, d); }
function refrescarHosts(self) { aHosts(self, 'bingo:estado', estadoHost(self.g)); }

// ---------- acciones ----------
function sonar(self, idx) {
  const g = self.g;
  if (g.estado === 'final') return { error: 'La partida ha terminado' };
  if (!(idx >= 0 && idx < g.canciones.length)) return { error: 'Esa canción no está en la lista' };
  if (g.sonadas.includes(idx)) return { error: 'Esa canción ya ha sonado' };
  g.estado = 'juego'; g.sonadas.push(idx); g.revelada = false;
  clearTimeout(g.timer);
  if (g.revelarSeg > 0) g.timer = setTimeout(() => revelar(self), g.revelarSeg * 1000);
  self.aJugadores('bingo:cancion', { numero: g.sonadas.length });
  aHosts(self, 'bingo:cancion', { numero: g.sonadas.length, cancion: cancion(g, idx), revelarSeg: g.revelarSeg });
  refrescarHosts(self);
  return { ok: true };
}
function revelar(self) {
  const g = self.g; if (!g || g.revelada || !g.sonadas.length) return;
  clearTimeout(g.timer); g.revelada = true;
  const c = cancion(g, actual(g));
  self.aJugadores('bingo:revelada', { numero: g.sonadas.length, cancion: c });
  aHosts(self, 'bingo:revelada', { numero: g.sonadas.length, cancion: c });
  refrescarHosts(self);
}
function deshacer(self) {
  const g = self.g; if (!g.sonadas.length) return;
  clearTimeout(g.timer);
  g.sonadas.pop(); g.revelada = true;
  self.aJugadores('bingo:deshecha', { numero: g.sonadas.length });
  refrescarHosts(self);
}
function siguienteRonda(self) {
  const g = self.g;
  if (g.ronda + 1 >= g.rondas.length) return final(self);
  g.ronda++;
  const d = { ronda: g.ronda, nombreRonda: nombreRonda(g) };
  self.aJugadores('bingo:ronda', d); aHosts(self, 'bingo:ronda', d); refrescarHosts(self);
}
function final(self) {
  const g = self.g; clearTimeout(g.timer); g.estado = 'final';
  const d = { ganadores: ganadoresPublicos(g) };
  self.aJugadores('bingo:final', d); aHosts(self, 'bingo:final', d); refrescarHosts(self);
}

function cantar(self, c) {
  const g = self.g;
  const p = g.jugadores.get(c.jid); if (!p) return { error: 'No estás en la partida' };
  if (g.estado !== 'juego') return { error: g.estado === 'final' ? 'La partida ha terminado' : 'Aún no ha empezado' };
  const ahora = Date.now();
  if (p.bloqueo > ahora) return { error: `Espera ${Math.ceil((p.bloqueo - ahora) / 1000)} s para volver a cantar` };
  const ronda = g.rondas[g.ronda];
  if (g.ganadores[g.ronda].some(w => w.id === p.id)) return { error: 'Ya has cantado esta ronda' };
  const patron = evaluar(g, buenas(g, p), ronda);
  if (!patron) {
    p.bloqueo = ahora + 10000;
    const marcadasNoSonadas = [...p.marcadas].filter(k => p.carton[k] !== -1 && !g.sonadas.includes(p.carton[k])).length;
    aHosts(self, 'bingo:falso', { apodo: p.apodo });
    return { valido: false, motivo: marcadasNoSonadas ? 'Has marcado canciones que todavía no han sonado.' : `Aún no tienes ${RONDAS[ronda].toLowerCase()}.` };
  }
  const s = sonadaSet(g);
  g.ganadores[g.ronda].push({ id: p.id, apodo: p.apodo, numero: g.sonadas.length });
  const primero = g.ganadores[g.ronda].length === 1;
  aHosts(self, 'bingo:ganador', {
    apodo: p.apodo, nombreRonda: RONDAS[ronda], primero, n: g.n, ultima: g.ronda + 1 >= g.rondas.length,
    carton: p.carton.map((idx, k) => ({ titulo: idx === -1 ? '★' : g.canciones[idx].titulo, libre: idx === -1, sonada: idx === -1 || s.has(idx), patron: patron.includes(k) }))
  });
  self.aJugadores('bingo:hayGanador', { apodo: p.apodo, nombreRonda: RONDAS[ronda] });
  refrescarHosts(self);
  return { valido: true, nombreRonda: RONDAS[ronda] };
}

function entrar(self, c, d) {
  const g = self.g;
  if (d.token) {
    const p = [...g.jugadores.values()].find(x => iguales(x.token, d.token));
    if (p) {
      if (p.conn && p.conn !== c) p.conn.rol = null;
      p.conn = c; p.conectado = true; c.rol = 'jugador'; c.jid = p.id;
      aHosts(self, 'host:jugadores', publicos(g));
      return estadoJugador(g, p);
    }
  }
  const apodo = String(d.apodo || '').replace(/\s+/g, ' ').trim().slice(0, 20);
  if (!apodo) return { error: d.token ? 'reentrar' : 'Escribe un apodo' };
  if (g.estado === 'final') return { error: 'La partida ya ha terminado' };
  if (g.jugadores.size >= parseInt(self.env.MAX_PLAYERS || '500', 10)) return { error: 'La partida está llena' };
  if (g.apodos.has(apodo.toLowerCase())) return { error: 'Ese apodo ya está cogido, prueba otro' };
  const p = { id: aleatorio(5), token: aleatorio(12), apodo, carton: carton(g), marcadas: new Set(), conn: c, conectado: true, bloqueo: 0 };
  g.jugadores.set(p.id, p); g.apodos.add(apodo.toLowerCase());
  c.rol = 'jugador'; c.jid = p.id;
  aHosts(self, 'host:jugadores', publicos(g));
  return estadoJugador(g, p);
}

export function mensaje(self, c, m, d, ok) {
  const g = self.g, esHost = c.rol === 'host';
  const soloHost = fn => { if (!esHost) return ok({ error: 'Solo el presentador' }); const r = fn(); ok(r || { ok: true }); };
  switch (m.t) {
    case 'host:reanudar':
      if (!iguales(d.claveHost, g.claveHost)) return ok({ error: 'Partida no encontrada' });
      c.rol = 'host'; return ok({ estado: estadoHost(g) });
    case 'bingo:siguiente': return soloHost(() => { const i = siguienteSugerida(g); return i < 0 ? { error: 'Ya han sonado todas las canciones' } : sonar(self, i); });
    case 'bingo:sonar': return soloHost(() => sonar(self, parseInt(d.idx, 10)));
    case 'bingo:revelar': return soloHost(() => revelar(self));
    case 'bingo:deshacer': return soloHost(() => deshacer(self));
    case 'bingo:siguienteRonda': return soloHost(() => siguienteRonda(self));
    case 'bingo:terminar': return soloHost(() => final(self));
    case 'host:expulsar': return soloHost(() => {
      const p = g.jugadores.get(d.id); if (!p) return;
      g.jugadores.delete(p.id); g.apodos.delete(p.apodo.toLowerCase());
      if (p.conn) { self.enviar(p.conn, 'jugador:expulsado', {}); p.conn.rol = null; }
      aHosts(self, 'host:jugadores', publicos(g));
    });
    case 'jugador:entrar': return ok(entrar(self, c, d));
    case 'bingo:marcar': {
      const p = g.jugadores.get(c.jid); if (!p || c.rol !== 'jugador') return ok({ error: 'No estás en la partida' });
      const k = parseInt(d.celda, 10);
      if (!(k >= 0 && k < g.n * g.n) || p.carton[k] === -1) return ok({ error: 'Casilla no válida' });
      d.marcar === false ? p.marcadas.delete(k) : d.marcar === true ? p.marcadas.add(k) : (p.marcadas.has(k) ? p.marcadas.delete(k) : p.marcadas.add(k));
      return ok({ marcadas: [...p.marcadas] });
    }
    case 'bingo:cantar': return ok(cantar(self, c));
  }
  ok({ error: 'Acción desconocida' });
}

export function info(g) { return { titulo: g.quiz.titulo, estado: g.estado, tipo: 'bingo', tema: g.tema }; }
export function desconectado(self) { aHosts(self, 'host:jugadores', publicos(self.g)); }
