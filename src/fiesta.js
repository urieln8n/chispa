// Fiestón: juego de fiesta (la tele es el tablero, cada móvil es un mando). Vive en el mismo Durable Object que el trivial y el bingo.
// Rondas: «trivial» (4 opciones, una correcta) y «probable» (¿Quién es más probable…? Se vota a un jugador).
import { aleatorio, iguales } from './comun.js';

export const COLORES = ['#F2B544', '#9AD1B5', '#F4A6A0', '#B8C7F0', '#F6F1E7', '#E7C6F2', '#FFD08A', '#A7E3E0', '#F7B7D2', '#C9E4A6', '#D9C2A7', '#BFD4FF'];
const PUNTOS_MESA = 500; // por votar con la mayoría en «más probable»

export function crear(self, pin, partida) {
  const rondas = (partida.rondas || []).filter(r => r && r.texto);
  if (!rondas.length) return { error: 'La partida no tiene rondas' };
  self.g = {
    tipo: 'fiesta', pin, quiz: { titulo: partida.titulo || 'Fiestón' }, rondas, indice: -1, estado: 'sala',
    claveHost: aleatorio(12), jugadores: new Map(), apodos: new Set(), respuestas: new Map(),
    resultado: null, podio: null, timer: null, inicio: 0, fin: 0, ultima: Date.now(), anfitrion: partida.anfitrion || '', max: Math.min(Math.max(parseInt(partida.maxJugadores, 10) || 12, 2), 50)
  };
  return { pin, claveHost: self.g.claveHost };
}

// ---------- utilidades ----------
const publico = p => ({ id: p.id, apodo: p.apodo, color: p.color, conectado: p.conectado });
const publicos = g => [...g.jugadores.values()].map(publico);
const ranking = g => [...g.jugadores.values()].sort((a, b) => b.puntos - a.puntos || a.msTotal - b.msTotal);
const top = (g, n = 5) => ranking(g).slice(0, n).map(p => ({ apodo: p.apodo, color: p.color, puntos: p.puntos }));
const ronda = g => g.rondas[g.indice];

function datosRonda(g, paraJugador = false) {
  const r = ronda(g); if (!r) return null;
  const d = { indice: g.indice, total: g.rondas.length, tipo: r.tipo, texto: r.texto, tiempo: r.tiempo, propia: !!r.propia,
    empiezaEn: Math.max(0, g.inicio - Date.now()), restante: Math.max(0, g.fin - Date.now()) };
  if (r.tipo === 'trivial') d.opciones = r.opciones;
  else if (r.tipo === 'probable') d.opciones = publicos(g).map(p => ({ id: p.id, apodo: p.apodo, color: p.color }));
  else {
    d.fase = g.fase;
    if (g.fase === 'votar') { d.opciones = g.opcionesMentira.map(o => o.texto); d.tiempo = r.tiempoVoto; }
  }
  if (!paraJugador) d.respondieron = g.fase === 'escribir' ? [...g.mentiras.keys()] : [...g.respuestas.keys()];
  return d;
}

function estadoHost(g) {
  return { tipo: 'fiesta', pin: g.pin, titulo: g.quiz.titulo, estado: g.estado, indice: g.indice, total: g.rondas.length,
    jugadores: publicos(g), ronda: g.estado === 'pregunta' ? datosRonda(g) : null,
    resultado: g.estado === 'resultado' ? g.resultado : null, podio: g.estado === 'podio' ? g.podio : null, anfitrion: g.anfitrion };
}

function personal(g, p) {
  const rk = ranking(g), i = rk.indexOf(p), u = p.ultimo || {};
  return { ...u, puntos: p.puntos, puesto: i + 1, total: rk.length };
}

function estadoJugador(g, p) {
  const r = { id: p.id, token: p.token, apodo: p.apodo, color: p.color, estado: g.estado, titulo: g.quiz.titulo, puntos: p.puntos, total: g.rondas.length };
  if (g.estado === 'pregunta') {
    r.ronda = datosRonda(g, true); r.yaRespondio = g.fase === 'escribir' ? g.mentiras.has(p.id) : g.respuestas.has(p.id);
    if (g.fase === 'votar') r.ronda.mia = suya(g, p.id);
  }
  if (g.estado === 'resultado') r.resultado = { ...personal(g, p), texto: ronda(g).texto, tipo: ronda(g).tipo };
  if (g.estado === 'podio') r.final = { ...personal(g, p), podio: g.podio };
  return r;
}

// ---------- flujo ----------
function siguiente(self) {
  const g = self.g;
  if (g.estado === 'pregunta') { if (g.fase === 'escribir') { empezarVoto(self); return { ok: true }; } return terminar(self); }
  if (g.estado === 'podio') return { error: 'La partida ha terminado' };
  if (g.estado === 'sala' && g.jugadores.size < 2) return { error: 'Hacen falta al menos 2 jugadores' };
  if (g.indice + 1 >= g.rondas.length) return final(self);
  g.indice++; empezar(self);
  return { ok: true };
}

function empezar(self) {
  const g = self.g, r = ronda(g);
  g.estado = 'pregunta'; g.respuestas = new Map(); g.resultado = null;
  g.fase = r.tipo === 'mentira' ? 'escribir' : null; g.mentiras = new Map(); g.opcionesMentira = [];
  g.inicio = Date.now() + 3000; g.fin = g.inicio + r.tiempo * 1000;
  anunciar(self);
  clearTimeout(g.timer);
  g.timer = setTimeout(() => r.tipo === 'mentira' ? empezarVoto(self) : terminar(self), g.fin - Date.now() + 300);
}

function anunciar(self) {
  const g = self.g;
  self.aHosts('fiesta:ronda', datosRonda(g));
  for (const p of g.jugadores.values()) {
    const d = datosRonda(g, true);
    if (g.fase === 'votar') d.mia = suya(g, p.id);
    self.aJugador(p, 'fiesta:ronda', d);
  }
}

// «Verdad o mentira»
const normal = t => String(t || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9ñ ]+/g, ' ').replace(/\s+/g, ' ').trim();
const suya = (g, id) => g.opcionesMentira.findIndex(o => o.autores.includes(id));

function empezarVoto(self) {
  const g = self.g, r = ronda(g);
  if (!g || g.estado !== 'pregunta' || g.fase !== 'escribir') return;
  clearTimeout(g.timer);
  const ops = [{ texto: r.verdad, autores: [], verdad: true }];
  for (const [id, texto] of g.mentiras) {
    const o = ops.find(x => normal(x.texto) === normal(texto));
    if (o && !o.verdad) o.autores.push(id); else if (!o) ops.push({ texto, autores: [id], verdad: false });
  }
  // con muy pocas mentiras, el juego añade alguna de relleno para que no sea obvio
  const relleno = ['bufandas', 'calcetines', 'castañas', 'campanas', 'velas', 'sombreros', 'mandarinas'];
  for (const x of barajarLocal(relleno)) { if (ops.length >= 3) break; if (!ops.some(o => normal(o.texto) === normal(x))) ops.push({ texto: x, autores: [], verdad: false, casa: true }); }
  g.opcionesMentira = barajarLocal(ops);
  g.fase = 'votar'; g.respuestas = new Map();
  g.inicio = Date.now() + 1500; g.fin = g.inicio + r.tiempoVoto * 1000;
  anunciar(self);
  g.timer = setTimeout(() => terminar(self), g.fin - Date.now() + 300);
}
function barajarLocal(a) { a = [...a]; for (let i = a.length - 1; i > 0; i--) { const j = crypto.getRandomValues(new Uint32Array(1))[0] % (i + 1); [a[i], a[j]] = [a[j], a[i]]; } return a; }

function terminar(self) {
  const g = self.g;
  if (!g || g.estado !== 'pregunta') return { ok: true };
  clearTimeout(g.timer);
  g.estado = 'resultado';
  const r = ronda(g), jug = [...g.jugadores.values()];
  let res;
  if (r.tipo === 'trivial') {
    const conteo = r.opciones.map(() => 0);
    for (const x of g.respuestas.values()) conteo[x.opcion]++;
    for (const p of jug) {
      const x = g.respuestas.get(p.id);
      let ganados = 0, acierto = false;
      if (x && x.opcion === r.correcta) {
        acierto = true; p.racha++;
        const frac = Math.min(x.ms / (r.tiempo * 1000), 1);
        ganados = Math.round(1000 * (1 - frac / 2)) + Math.min(Math.max(p.racha - 1, 0), 5) * 100;
      } else p.racha = 0;
      if (x) p.msTotal += x.ms;
      p.puntos += ganados;
      p.ultimo = { respondio: !!x, acierto, ganados };
    }
    res = { tipo: 'trivial', texto: r.texto, opciones: r.opciones, correcta: r.correcta, conteo, propia: !!r.propia };
  } else if (r.tipo === 'mentira') {
    const ops = g.opcionesMentira, nombre = id => (g.jugadores.get(id) || {}).apodo || '';
    const votantes = ops.map(() => []);
    for (const p of jug) p.ultimo = { respondio: g.respuestas.has(p.id), acierto: false, ganados: 0, engañados: 0 };
    for (const [id, x] of g.respuestas) {
      const o = ops[x.opcion], p = g.jugadores.get(id); if (!o || !p) continue;
      votantes[x.opcion].push(nombre(id));
      if (o.verdad) { p.puntos += 1000; p.ultimo.acierto = true; p.ultimo.ganados += 1000; }
      else for (const a of o.autores) { const au = g.jugadores.get(a); if (au && a !== id) { au.puntos += 500; au.ultimo.ganados += 500; au.ultimo.engañados++; } }
    }
    res = { tipo: 'mentira', texto: r.texto, verdad: r.verdad,
      opciones: ops.map((o, i) => ({ texto: o.texto, verdad: !!o.verdad, casa: !!o.casa, autores: o.autores.map(nombre), votantes: votantes[i] })) };
  } else {
    const votos = new Map();
    for (const x of g.respuestas.values()) votos.set(x.voto, (votos.get(x.voto) || 0) + 1);
    const max = Math.max(0, ...votos.values());
    const elegidos = max > 0 ? [...votos.entries()].filter(([, v]) => v === max).map(([id]) => id) : [];
    for (const p of jug) {
      const x = g.respuestas.get(p.id);
      const conMesa = !!(x && elegidos.includes(x.voto));
      const ganados = conMesa ? PUNTOS_MESA : 0;
      p.puntos += ganados;
      p.ultimo = { respondio: !!x, acierto: conMesa, ganados, elegido: elegidos.includes(p.id), votos: votos.get(p.id) || 0 };
    }
    const lista = jug.map(p => ({ apodo: p.apodo, color: p.color, votos: votos.get(p.id) || 0, elegido: elegidos.includes(p.id) }))
      .filter(x => x.votos > 0).sort((a, b) => b.votos - a.votos);
    res = { tipo: 'probable', texto: r.texto, votos: lista, elegidos: lista.filter(x => x.elegido).map(x => x.apodo), votaron: g.respuestas.size };
  }
  res.indice = g.indice; res.total = g.rondas.length; res.ultima = g.indice + 1 >= g.rondas.length;
  res.ranking = top(g);
  g.resultado = res;
  self.aHosts('fiesta:resultado', res);
  for (const p of jug) self.aJugador(p, 'fiesta:resultado', { ...personal(g, p), texto: r.texto, tipo: r.tipo, elegidos: res.elegidos || null, verdad: r.verdad || null });
  return { ok: true };
}

function final(self) {
  const g = self.g; clearTimeout(g.timer);
  g.estado = 'podio';
  g.podio = { top: top(g, 3), total: g.jugadores.size, ranking: top(g, 50) };
  self.aHosts('fiesta:podio', g.podio);
  for (const p of g.jugadores.values()) self.aJugador(p, 'fiesta:podio', { ...personal(g, p), podio: g.podio });
  return { ok: true };
}

function responder(self, c, d) {
  const g = self.g;
  const p = g.jugadores.get(c.jid);
  if (!p || c.rol !== 'jugador') return { error: 'No estás en la partida' };
  if (g.estado !== 'pregunta') return { error: 'Ahora no se puede responder' };
  const ahora = Date.now();
  if (ahora < g.inicio - 200 || ahora > g.fin + 500) return { error: 'Fuera de tiempo' };
  if (g.fase !== 'escribir' && g.respuestas.has(p.id)) return { error: 'Ya has respondido' };
  const r = ronda(g), ms = Math.max(0, Math.min(ahora - g.inicio, g.fin - g.inicio));
  if (r.tipo === 'mentira' && g.fase === 'escribir') {
    if (g.mentiras.has(p.id)) return { error: 'Ya has escrito tu respuesta' };
    const texto = String(d.texto || '').replace(/\s+/g, ' ').trim().slice(0, 40);
    if (!texto) return { error: 'Escribe una respuesta' };
    if (normal(texto) === normal(r.verdad)) return { error: '¡Esa es la respuesta de verdad! Invéntate otra' };
    g.mentiras.set(p.id, texto);
    self.aHosts('fiesta:respuestas', { respondieron: [...g.mentiras.keys()], jugadores: g.jugadores.size });
    const conectados = [...g.jugadores.values()].filter(x => x.conectado).length;
    if (g.mentiras.size >= conectados) queueMicrotask(() => empezarVoto(self));
    return { ok: true };
  }
  if (r.tipo === 'trivial' || r.tipo === 'mentira') {
    const opcion = parseInt(d.opcion, 10);
    const n = r.tipo === 'trivial' ? r.opciones.length : g.opcionesMentira.length;
    if (!(opcion >= 0 && opcion < n)) return { error: 'Opción no válida' };
    if (r.tipo === 'mentira' && g.opcionesMentira[opcion].autores.includes(p.id)) return { error: 'No puedes votar tu propia mentira' };
    g.respuestas.set(p.id, { opcion, ms });
  } else {
    if (!g.jugadores.has(String(d.voto || ''))) return { error: 'Esa persona no está en la partida' };
    g.respuestas.set(p.id, { voto: String(d.voto), ms });
  }
  self.aHosts('fiesta:respuestas', { respondieron: [...g.respuestas.keys()], jugadores: g.jugadores.size });
  const conectados = [...g.jugadores.values()].filter(x => x.conectado).length;
  if (g.respuestas.size >= conectados) queueMicrotask(() => terminar(self));
  return { ok: true };
}

function entrar(self, c, d) {
  const g = self.g;
  if (d.token) {
    const p = [...g.jugadores.values()].find(x => iguales(x.token, d.token));
    if (p) {
      if (p.conn && p.conn !== c) p.conn.rol = null;
      p.conn = c; p.conectado = true; c.rol = 'jugador'; c.jid = p.id;
      self.aHosts('host:jugadores', publicos(g));
      return estadoJugador(g, p);
    }
  }
  const apodo = String(d.apodo || '').replace(/\s+/g, ' ').trim().slice(0, 16);
  if (!apodo) return { error: d.token ? 'reentrar' : 'Escribe tu nombre' };
  if (g.estado !== 'sala') return { error: 'La partida ya ha empezado' };
  if (g.jugadores.size >= g.max) return { error: `La partida está llena (máximo ${g.max})` };
  if (g.apodos.has(apodo.toLowerCase())) return { error: 'Ese nombre ya está cogido, prueba otro' };
  const p = { id: aleatorio(5), token: aleatorio(12), apodo, color: COLORES[g.jugadores.size % COLORES.length], puntos: 0, racha: 0, msTotal: 0, conn: c, conectado: true, ultimo: null };
  g.jugadores.set(p.id, p); g.apodos.add(apodo.toLowerCase());
  c.rol = 'jugador'; c.jid = p.id;
  self.aHosts('host:jugadores', publicos(g));
  return estadoJugador(g, p);
}

export function mensaje(self, c, m, d, ok) {
  const g = self.g, esHost = c.rol === 'host';
  const soloHost = fn => { if (!esHost) return ok({ error: 'Solo la pantalla principal' }); ok(fn() || { ok: true }); };
  switch (m.t) {
    case 'host:reanudar':
      if (!iguales(d.claveHost, g.claveHost)) return ok({ error: 'Partida no encontrada' });
      c.rol = 'host'; return ok({ estado: estadoHost(g) });
    case 'host:siguiente': return soloHost(() => siguiente(self));
    case 'host:terminar': return soloHost(() => final(self));
    case 'host:expulsar': return soloHost(() => {
      const p = g.jugadores.get(d.id); if (!p || g.estado !== 'sala') return { error: 'Solo se puede quitar a alguien antes de empezar' };
      g.jugadores.delete(p.id); g.apodos.delete(p.apodo.toLowerCase());
      if (p.conn) { self.enviar(p.conn, 'jugador:expulsado', {}); p.conn.rol = null; }
      self.aHosts('host:jugadores', publicos(g));
    });
    case 'jugador:entrar': return ok(entrar(self, c, d));
    case 'fiesta:responder': return ok(responder(self, c, d));
  }
  ok({ error: 'Acción desconocida' });
}

export function info(g) { return { titulo: g.quiz.titulo, estado: g.estado, tipo: 'fiesta' }; }
export function desconectado(self) { self.aHosts('host:jugadores', publicos(self.g)); }
