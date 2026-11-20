// Una partida en vivo = un Durable Object (identificado por su PIN). Todo en tiempo real por WebSocket.
import { DurableObject } from 'cloudflare:workers';
import { aleatorio, iguales } from './comun.js';

export class Juego extends DurableObject {
  constructor(ctx, env) {
    super(ctx, env);
    this.g = null;          // estado de la partida (en memoria)
    this.conns = new Set(); // conexiones abiertas
  }

  // ---------- llamadas desde el Worker ----------
  async crear(pin, quiz) {
    if (this.g && Date.now() - this.g.ultima < 3 * 3600e3) return { ocupado: true };
    this.g = {
      pin, quiz, claveHost: aleatorio(12), estado: 'sala', indice: -1,
      jugadores: new Map(), apodos: new Set(), respuestas: new Map(), timer: null, ultima: Date.now(), informe: null
    };
    return { pin, claveHost: this.g.claveHost };
  }
  async info() { return this.g ? { titulo: this.g.quiz.titulo, estado: this.g.estado } : null; }

  async fetch(req) {
    if (req.headers.get('Upgrade') !== 'websocket') return new Response('Se esperaba WebSocket', { status: 426 });
    const [cliente, servidor] = Object.values(new WebSocketPair());
    servidor.accept();
    const c = { ws: servidor, rol: null, jid: null };
    this.conns.add(c);
    servidor.addEventListener('message', ev => this.mensaje(c, ev.data));
    const cerrar = () => this.cerrado(c);
    servidor.addEventListener('close', cerrar);
    servidor.addEventListener('error', cerrar);
    return new Response(null, { status: 101, webSocket: cliente });
  }

  // ---------- envío ----------
  enviar(c, t, d) { try { c.ws.send(JSON.stringify({ t, d })); } catch {} }
  responder(c, id, d) { if (id) try { c.ws.send(JSON.stringify({ t: 'ack', id, d })); } catch {} }
  aHosts(t, d) { for (const c of this.conns) if (c.rol === 'host') this.enviar(c, t, d); }
  aJugadores(t, d) { for (const c of this.conns) if (c.rol === 'jugador') this.enviar(c, t, d); }
  aJugador(p, t, d) { if (p.conn) this.enviar(p.conn, t, d); }

  cerrado(c) {
    if (!this.conns.delete(c)) return;
    const g = this.g;
    if (g && c.rol === 'jugador') {
      const p = g.jugadores.get(c.jid);
      if (p && p.conn === c) { p.conn = null; p.conectado = false; this.mandarJugadores(); }
    }
  }

  mensaje(c, raw) {
    let m; try { m = JSON.parse(raw); } catch { return; }
    if (m.t === 'ping') return;
    const g = this.g, d = m.d || {}, ok = r => this.responder(c, m.id, r);
    if (!g) return ok({ error: 'Esta partida ya no existe' });
    g.ultima = Date.now();
    const esHost = c.rol === 'host';
    switch (m.t) {
      case 'host:reanudar':
        if (!iguales(d.claveHost, g.claveHost)) return ok({ error: 'Partida no encontrada' });
        c.rol = 'host';
        return ok({ estado: this.estadoHost() });
      case 'host:siguiente': if (esHost) this.siguiente(); return ok({ ok: true });
      case 'host:expulsar': {
        if (!esHost) return;
        const p = g.jugadores.get(d.id); if (!p) return;
        g.jugadores.delete(p.id); g.apodos.delete(p.apodo.toLowerCase());
        this.aJugador(p, 'jugador:expulsado', {});
        if (p.conn) p.conn.rol = null;
        return this.mandarJugadores();
      }
      case 'host:terminar':
        if (!esHost) return;
        clearTimeout(g.timer); this.aJugadores('jugador:cerrada', {}); this.g = null; return ok({ ok: true });
      case 'jugador:entrar': return ok(this.entrar(c, d));
      case 'jugador:responder': return ok(this.responderPregunta(c, d));
    }
  }

  // ---------- lógica de juego ----------
  publicos() { return [...this.g.jugadores.values()].map(p => ({ id: p.id, apodo: p.apodo, conectado: p.conectado })); }
  mandarJugadores() { if (this.g) this.aHosts('host:jugadores', this.publicos()); }
  ranking() { return [...this.g.jugadores.values()].sort((a, b) => b.puntos - a.puntos || a.msTotal - b.msTotal); }
  pregunta() { return this.g.quiz.preguntas[this.g.indice]; }
  estadoHost() {
    const g = this.g;
    return { pin: g.pin, titulo: g.quiz.titulo, estado: g.estado, indice: g.indice, total: g.quiz.preguntas.length, jugadores: this.publicos(), informe: g.informe };
  }

  siguiente() {
    const g = this.g, ultima = g.indice + 1 >= g.quiz.preguntas.length;
    if (g.estado === 'sala' || g.estado === 'ranking') { if (ultima) return this.final(); g.indice++; this.empezarPregunta(); }
    else if (g.estado === 'pregunta') this.terminarPregunta();
    else if (g.estado === 'resultado') ultima ? this.final() : this.mostrarRanking();
  }

  empezarPregunta() {
    const g = this.g, q = this.pregunta();
    g.estado = 'pregunta'; g.respuestas = new Map();
    g.inicio = Date.now() + 3000; g.fin = g.inicio + q.tiempo * 1000;
    const datos = { indice: g.indice, total: g.quiz.preguntas.length, texto: q.texto, opciones: q.opciones, imagen: q.imagen || '', tiempo: q.tiempo, empiezaEn: 3000 };
    this.aHosts('host:pregunta', datos);
    this.aJugadores('jugador:pregunta', datos);
    clearTimeout(g.timer);
    g.timer = setTimeout(() => this.terminarPregunta(), g.fin - Date.now() + 300);
  }

  terminarPregunta() {
    const g = this.g;
    if (!g || g.estado !== 'pregunta') return;
    clearTimeout(g.timer);
    g.estado = 'resultado';
    const q = this.pregunta(), conteo = q.opciones.map(() => 0);
    for (const r of g.respuestas.values()) conteo[r.opcion]++;
    for (const p of g.jugadores.values()) {
      const r = g.respuestas.get(p.id);
      let ganados = 0, acierto = false;
      if (r && r.opcion === q.correcta) {
        acierto = true; p.racha++;
        const frac = Math.min(r.ms / (q.tiempo * 1000), 1);
        ganados = Math.round(1000 * (1 - frac / 2)) + Math.min(Math.max(p.racha - 1, 0), 5) * 100;
      } else p.racha = 0;
      p.puntos += ganados;
      if (r) p.msTotal += r.ms;
      p.historial[g.indice] = r ? { opcion: r.opcion, ok: acierto, ms: r.ms } : null;
      p.ultimo = { ganados, acierto, respondio: !!r };
    }
    this.aHosts('host:resultado', { correcta: q.correcta, conteo, respondieron: g.respuestas.size, jugadores: g.jugadores.size, ultima: g.indice === g.quiz.preguntas.length - 1 });
    const rk = this.ranking();
    rk.forEach((p, i) => this.aJugador(p, 'jugador:resultado', this.resultado(p, rk, i)));
  }

  resultado(p, rk = this.ranking(), i = rk.indexOf(p)) {
    const delante = i > 0 ? rk[i - 1] : null, u = p.ultimo || { ganados: 0, acierto: false, respondio: false };
    return { acierto: u.acierto, respondio: u.respondio, ganados: u.ganados, puntos: p.puntos, puesto: i + 1, racha: p.racha,
      delante: delante ? { apodo: delante.apodo, diferencia: delante.puntos - p.puntos } : null };
  }

  mostrarRanking() {
    this.g.estado = 'ranking';
    this.aHosts('host:ranking', { top: this.ranking().slice(0, 5).map(p => ({ apodo: p.apodo, puntos: p.puntos })) });
  }

  final() {
    const g = this.g; clearTimeout(g.timer);
    g.estado = 'podio';
    const rk = this.ranking(), podio = rk.slice(0, 3).map(p => ({ apodo: p.apodo, puntos: p.puntos }));
    this.aHosts('host:podio', { podio, total: rk.length });
    rk.forEach((p, i) => this.aJugador(p, 'jugador:final', { puesto: i + 1, puntos: p.puntos, total: rk.length, podio }));
    this.guardarInforme(rk);
  }

  async guardarInforme(rk) {
    const g = this.g;
    const preguntas = g.quiz.preguntas.map((q, i) => {
      const ok = rk.filter(p => p.historial[i] && p.historial[i].ok).length;
      return { texto: q.texto, porcentaje: rk.length ? Math.round(100 * ok / rk.length) : 0 };
    });
    const inf = {
      pin: g.pin, titulo: g.quiz.titulo, fecha: new Date().toISOString(), claveHost: g.claveHost, preguntas,
      jugadores: rk.map((p, i) => ({ puesto: i + 1, apodo: p.apodo, puntos: p.puntos, aciertos: p.historial.filter(h => h && h.ok).length,
        respuestas: g.quiz.preguntas.map((_, k) => p.historial[k] || null) }))
    };
    try { await this.env.ALMACEN.get(this.env.ALMACEN.idFromName('principal')).guardarInforme(inf); } catch (e) { console.error('informe', e); }
    g.informe = { preguntas, csv: `api/informes/${g.pin}.csv?k=${encodeURIComponent(g.claveHost)}` };
    this.aHosts('host:informe', g.informe);
  }

  entrar(c, d) {
    const g = this.g;
    if (d.token) {
      const p = [...g.jugadores.values()].find(x => iguales(x.token, d.token));
      if (p) {
        if (p.conn && p.conn !== c) p.conn.rol = null;
        p.conn = c; p.conectado = true; c.rol = 'jugador'; c.jid = p.id;
        this.mandarJugadores();
        const r = { id: p.id, token: p.token, apodo: p.apodo, estado: g.estado, puntos: p.puntos };
        if (g.estado === 'pregunta') {
          const q = this.pregunta();
          r.pregunta = { indice: g.indice, total: g.quiz.preguntas.length, texto: q.texto, opciones: q.opciones, imagen: q.imagen || '', tiempo: q.tiempo,
            empiezaEn: Math.max(0, g.inicio - Date.now()), restante: Math.max(0, g.fin - Date.now()), yaRespondio: g.respuestas.has(p.id) };
        } else if (g.estado === 'resultado' || g.estado === 'ranking') r.resultado = this.resultado(p);
        else if (g.estado === 'podio') {
          const rk = this.ranking();
          r.final = { puesto: rk.indexOf(p) + 1, puntos: p.puntos, total: rk.length, podio: rk.slice(0, 3).map(x => ({ apodo: x.apodo, puntos: x.puntos })) };
        }
        return r;
      }
    }
    const apodo = String(d.apodo || '').replace(/\s+/g, ' ').trim().slice(0, 20);
    if (!apodo) return { error: d.token ? 'reentrar' : 'Escribe un apodo' };
    if (g.estado !== 'sala') return { error: 'La partida ya ha empezado' };
    if (g.jugadores.size >= parseInt(this.env.MAX_PLAYERS || '500', 10)) return { error: 'La partida está llena' };
    if (g.apodos.has(apodo.toLowerCase())) return { error: 'Ese apodo ya está cogido, prueba otro' };
    const p = { id: aleatorio(5), token: aleatorio(12), apodo, puntos: 0, racha: 0, msTotal: 0, historial: [], conn: c, conectado: true };
    g.jugadores.set(p.id, p); g.apodos.add(apodo.toLowerCase());
    c.rol = 'jugador'; c.jid = p.id;
    this.mandarJugadores();
    return { id: p.id, token: p.token, apodo, estado: 'sala', puntos: 0 };
  }

  responderPregunta(c, d) {
    const g = this.g;
    if (c.rol !== 'jugador') return { error: 'No estás en la partida' };
    if (g.estado !== 'pregunta') return { error: 'Ahora no se puede responder' };
    const ahora = Date.now();
    if (ahora < g.inicio - 200 || ahora > g.fin + 500) return { error: 'Fuera de tiempo' };
    if (g.respuestas.has(c.jid)) return { error: 'Ya has respondido' };
    const opcion = parseInt(d.opcion, 10);
    if (!(opcion >= 0 && opcion < this.pregunta().opciones.length)) return { error: 'Opción no válida' };
    g.respuestas.set(c.jid, { opcion, ms: Math.max(0, Math.min(ahora - g.inicio, g.fin - g.inicio)) });
    this.aHosts('host:respuestas', { respondieron: g.respuestas.size, jugadores: g.jugadores.size });
    const conectados = [...g.jugadores.values()].filter(p => p.conectado).length;
    if (g.respuestas.size >= conectados) queueMicrotask(() => this.terminarPregunta());
    return { ok: true };
  }
}
