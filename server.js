// Chispa — quiz en vivo multijugador en tiempo real
// Servidor: Express (web + API) + Socket.IO (tiempo real). Sin base de datos externa.
'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const http = require('http');
const express = require('express');
const { Server } = require('socket.io');
const QRCode = require('qrcode');

// ---------- Configuración ----------
const PORT = parseInt(process.env.PORT || '3070', 10);
const HOST = process.env.HOST || '127.0.0.1';
const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, 'data');
const MAX_PLAYERS = parseInt(process.env.MAX_PLAYERS || '500', 10);
const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY || '';
const ANTHROPIC_MODEL = process.env.ANTHROPIC_MODEL || 'claude-sonnet-5-5';
const AI_DAILY_LIMIT = parseInt(process.env.AI_DAILY_LIMIT || '50', 10);

fs.mkdirSync(path.join(DATA_DIR, 'informes'), { recursive: true });
const QUIZ_FILE = path.join(DATA_DIR, 'cuestionarios.json');
const PASS_FILE = path.join(DATA_DIR, 'contrasena-presentador.txt');

// Contraseña del presentador: de la variable de entorno, o generada y guardada la primera vez.
let ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || '';
if (!ADMIN_PASSWORD) {
  if (fs.existsSync(PASS_FILE)) ADMIN_PASSWORD = fs.readFileSync(PASS_FILE, 'utf8').trim();
  else {
    ADMIN_PASSWORD = crypto.randomBytes(6).toString('base64url');
    fs.writeFileSync(PASS_FILE, ADMIN_PASSWORD + '\n', { mode: 0o600 });
    console.log('[chispa] Contraseña del presentador generada en', PASS_FILE);
  }
}
const safeEq = (a, b) => {
  const x = Buffer.from(String(a || '')), y = Buffer.from(String(b || ''));
  return x.length === y.length && crypto.timingSafeEqual(x, y);
};

// ---------- Cuestionarios (archivo JSON) ----------
function loadQuizzes() {
  try { return JSON.parse(fs.readFileSync(QUIZ_FILE, 'utf8')); }
  catch { return seedQuizzes(); }
}
function saveQuizzes(list) {
  const tmp = QUIZ_FILE + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify(list, null, 2));
  fs.renameSync(tmp, QUIZ_FILE);
}
function seedQuizzes() {
  const demo = [{
    id: newId(), titulo: 'Cultura general exprés', actualizado: Date.now(),
    preguntas: [
      { texto: '¿Cuál es el planeta más grande del sistema solar?', opciones: ['Saturno', 'Júpiter', 'Neptuno', 'La Tierra'], correcta: 1, tiempo: 20 },
      { texto: '¿En qué año llegó el ser humano a la Luna?', opciones: ['1965', '1972', '1969', '1959'], correcta: 2, tiempo: 20 },
      { texto: '¿Cuántos lados tiene un hexágono?', opciones: ['6', '8', '5', '7'], correcta: 0, tiempo: 15 },
      { texto: '¿Qué gas absorben las plantas para hacer la fotosíntesis?', opciones: ['Oxígeno', 'Nitrógeno', 'Helio', 'Dióxido de carbono'], correcta: 3, tiempo: 20 },
      { texto: '¿Quién pintó «Las Meninas»?', opciones: ['Goya', 'Velázquez', 'Picasso', 'El Greco'], correcta: 1, tiempo: 20 }
    ]
  }];
  saveQuizzes(demo);
  return demo;
}
function newId() { return crypto.randomBytes(6).toString('hex'); }

function cleanQuiz(body) {
  const titulo = String(body.titulo || '').trim().slice(0, 200) || 'Cuestionario sin título';
  const preguntas = (Array.isArray(body.preguntas) ? body.preguntas : []).slice(0, 200).map(p => {
    const opciones = (Array.isArray(p.opciones) ? p.opciones : []).slice(0, 4).map(o => String(o || '').trim().slice(0, 300));
    while (opciones.length < 2) opciones.push('');
    let correcta = parseInt(p.correcta, 10);
    if (!(correcta >= 0 && correcta < opciones.length)) correcta = 0;
    let tiempo = parseInt(p.tiempo, 10);
    if (!(tiempo >= 5 && tiempo <= 240)) tiempo = 20;
    const imagen = /^https?:\/\//i.test(String(p.imagen || '')) ? String(p.imagen).slice(0, 1000) : '';
    return { texto: String(p.texto || '').trim().slice(0, 1000), opciones, correcta, tiempo, imagen };
  }).filter(p => p.texto && p.opciones.filter(Boolean).length >= 2);
  return { titulo, preguntas };
}

// ---------- Web + API ----------
const app = express();
app.disable('x-powered-by');
app.use(express.json({ limit: '1mb' }));
app.use(express.static(path.join(__dirname, 'public'), { extensions: ['html'] }));

function auth(req, res, next) {
  if (safeEq(req.get('x-chispa-clave'), ADMIN_PASSWORD)) return next();
  res.status(401).json({ error: 'Contraseña de presentador incorrecta' });
}

app.post('/api/login', (req, res) => {
  if (safeEq(req.body && req.body.clave, ADMIN_PASSWORD)) return res.json({ ok: true, ia: !!ANTHROPIC_API_KEY });
  res.status(401).json({ error: 'Contraseña incorrecta' });
});
app.get('/api/cuestionarios', auth, (req, res) => {
  res.json(loadQuizzes().map(q => ({ id: q.id, titulo: q.titulo, n: q.preguntas.length, actualizado: q.actualizado })));
});
app.get('/api/cuestionarios/:id', auth, (req, res) => {
  const q = loadQuizzes().find(x => x.id === req.params.id);
  q ? res.json(q) : res.status(404).json({ error: 'No existe' });
});
app.post('/api/cuestionarios', auth, (req, res) => {
  const list = loadQuizzes();
  const q = { id: newId(), ...cleanQuiz(req.body || {}), actualizado: Date.now() };
  list.unshift(q); saveQuizzes(list); res.json(q);
});
app.put('/api/cuestionarios/:id', auth, (req, res) => {
  const list = loadQuizzes();
  const i = list.findIndex(x => x.id === req.params.id);
  if (i < 0) return res.status(404).json({ error: 'No existe' });
  list[i] = { id: list[i].id, ...cleanQuiz(req.body || {}), actualizado: Date.now() };
  saveQuizzes(list); res.json(list[i]);
});
app.post('/api/cuestionarios/:id/duplicar', auth, (req, res) => {
  const list = loadQuizzes();
  const q = list.find(x => x.id === req.params.id);
  if (!q) return res.status(404).json({ error: 'No existe' });
  const copia = { ...JSON.parse(JSON.stringify(q)), id: newId(), titulo: q.titulo + ' (copia)', actualizado: Date.now() };
  list.unshift(copia); saveQuizzes(list); res.json(copia);
});
app.delete('/api/cuestionarios/:id', auth, (req, res) => {
  saveQuizzes(loadQuizzes().filter(x => x.id !== req.params.id)); res.json({ ok: true });
});

app.get('/api/qr', async (req, res) => {
  const text = String(req.query.t || '').slice(0, 500);
  if (!/^https?:\/\//.test(text)) return res.status(400).end();
  const svg = await QRCode.toString(text, { type: 'svg', margin: 1, color: { dark: '#0F1B2D', light: '#FFFFFF' } });
  res.type('image/svg+xml').send(svg);
});

// Informe final de una partida (mejora frente al original): CSV para Excel
app.get('/api/informes/:pin.csv', (req, res) => {
  const file = path.join(DATA_DIR, 'informes', String(req.params.pin).replace(/\D/g, '') + '.json');
  if (!fs.existsSync(file)) return res.status(404).send('Informe no encontrado');
  const inf = JSON.parse(fs.readFileSync(file, 'utf8'));
  if (!safeEq(req.query.k, inf.claveHost) && !safeEq(req.query.k, ADMIN_PASSWORD)) return res.status(401).send('Sin permiso');
  const esc = v => '"' + String(v).replace(/"/g, '""') + '"';
  const head = ['Puesto', 'Apodo', 'Puntos', 'Aciertos', ...inf.preguntas.map((p, i) => `P${i + 1}`)];
  const rows = inf.jugadores.map(j => [j.puesto, j.apodo, j.puntos, j.aciertos,
    ...inf.preguntas.map((p, i) => { const r = j.respuestas[i]; return r == null ? 'sin responder' : (r.ok ? 'bien' : 'mal') + ` (${(r.ms / 1000).toFixed(1)}s)`; })]);
  rows.push([]);
  inf.preguntas.forEach((p, i) => rows.push([`P${i + 1}`, p.texto, `${p.porcentaje}% acierto`]));
  const csv = '﻿' + [head, ...rows].map(r => r.map(esc).join(';')).join('\r\n');
  res.set('Content-Disposition', `attachment; filename="chispa-informe-${inf.pin}.csv"`);
  res.type('text/csv; charset=utf-8').send(csv);
});

// IA opcional: crear un cuestionario a partir de un tema o texto (API de Anthropic)
let aiCount = { day: '', n: 0 };
app.post('/api/ia/generar', auth, async (req, res) => {
  if (!ANTHROPIC_API_KEY) return res.status(503).json({ error: 'La IA no está activada. Añade ANTHROPIC_API_KEY en el servidor.' });
  const today = new Date().toISOString().slice(0, 10);
  if (aiCount.day !== today) aiCount = { day: today, n: 0 };
  if (aiCount.n >= AI_DAILY_LIMIT) return res.status(429).json({ error: 'Se ha alcanzado el tope diario de IA.' });
  const tema = String((req.body && req.body.tema) || '').trim().slice(0, 8000);
  const n = Math.min(Math.max(parseInt(req.body && req.body.n, 10) || 8, 3), 20);
  const nivel = String((req.body && req.body.nivel) || 'general').slice(0, 60);
  if (!tema) return res.status(400).json({ error: 'Escribe un tema o pega un texto.' });
  aiCount.n++;
  const prompt = `Crea un cuestionario de ${n} preguntas de opción múltiple en español sobre el siguiente tema o texto. Nivel: ${nivel}.
Cada pregunta tiene exactamente 4 opciones, una sola correcta, y respuestas incorrectas creíbles. Varía la posición de la correcta.
Responde SOLO con JSON válido, sin texto extra, con esta forma:
{"titulo":"...","preguntas":[{"texto":"...","opciones":["a","b","c","d"],"correcta":0,"tiempo":20}]}

TEMA O TEXTO:
${tema}`;
  try {
    const r = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-api-key': ANTHROPIC_API_KEY, 'anthropic-version': '2023-06-01' },
      body: JSON.stringify({ model: ANTHROPIC_MODEL, max_tokens: 4000, messages: [{ role: 'user', content: prompt }] })
    });
    const data = await r.json();
    if (!r.ok) throw new Error((data.error && data.error.message) || 'Error de la IA');
    const text = (data.content || []).map(c => c.text || '').join('');
    const json = JSON.parse(text.slice(text.indexOf('{'), text.lastIndexOf('}') + 1));
    res.json(cleanQuiz(json));
  } catch (e) {
    console.error('[chispa] IA:', e.message);
    res.status(502).json({ error: 'La IA no ha podido crear el cuestionario. Prueba otra vez.' });
  }
});

app.get('/api/salud', (req, res) => res.json({ ok: true, partidas: games.size }));

// ---------- Tiempo real ----------
const server = http.createServer(app);
const io = new Server(server, { pingInterval: 10000, pingTimeout: 20000, maxHttpBufferSize: 1e5 });

const games = new Map(); // pin -> partida

function newPin() {
  let pin;
  do { pin = String(crypto.randomInt(100000, 1000000)); } while (games.has(pin));
  return pin;
}
const room = pin => 'g:' + pin;
const hostRoom = pin => 'h:' + pin;

function ranking(g) {
  return [...g.players.values()].sort((a, b) => b.score - a.score || a.totalMs - b.totalMs);
}
function publicPlayers(g) {
  return [...g.players.values()].map(p => ({ id: p.id, apodo: p.nick, conectado: p.connected }));
}
function sendPlayers(g) { io.to(hostRoom(g.pin)).emit('host:jugadores', publicPlayers(g)); }

function currentQ(g) { return g.quiz.preguntas[g.qIndex]; }

function startQuestion(g) {
  const q = currentQ(g);
  g.state = 'pregunta';
  g.answers = new Map();
  g.qStartedAt = Date.now() + 3000; // 3 s de "¡Prepárate!"
  g.qEndsAt = g.qStartedAt + q.tiempo * 1000;
  const payload = {
    indice: g.qIndex, total: g.quiz.preguntas.length, texto: q.texto, opciones: q.opciones,
    imagen: q.imagen || '', tiempo: q.tiempo, empiezaEn: 3000
  };
  io.to(hostRoom(g.pin)).emit('host:pregunta', payload);
  io.to(room(g.pin)).emit('jugador:pregunta', payload);
  clearTimeout(g.timer);
  g.timer = setTimeout(() => endQuestion(g), g.qEndsAt - Date.now() + 300);
  touch(g);
}

function endQuestion(g) {
  if (g.state !== 'pregunta') return;
  clearTimeout(g.timer);
  g.state = 'resultado';
  const q = currentQ(g);
  const counts = q.opciones.map(() => 0);
  for (const a of g.answers.values()) counts[a.choice]++;
  // calcular puntos
  for (const p of g.players.values()) {
    const a = g.answers.get(p.id);
    let gained = 0, ok = false;
    if (a && a.choice === q.correcta) {
      ok = true;
      p.streak++;
      const frac = Math.min(a.ms / (q.tiempo * 1000), 1);
      gained = Math.round(1000 * (1 - frac / 2)) + Math.min(Math.max(p.streak - 1, 0), 5) * 100;
    } else p.streak = 0;
    p.score += gained;
    if (a) p.totalMs += a.ms;
    p.history[g.qIndex] = a ? { choice: a.choice, ok, ms: a.ms } : null;
    p.lastGain = gained; p.lastOk = ok; p.lastAnswered = !!a;
  }
  const rk = ranking(g);
  rk.forEach((p, i) => { p.rank = i + 1; });
  io.to(hostRoom(g.pin)).emit('host:resultado', {
    correcta: q.correcta, conteo: counts, respondieron: g.answers.size, jugadores: g.players.size,
    ultima: g.qIndex === g.quiz.preguntas.length - 1
  });
  for (const p of g.players.values()) {
    if (p.socketId) io.to(p.socketId).emit('jugador:resultado', resultFor(g, p));
  }
  touch(g);
}

function resultFor(g, p) {
  const rk = ranking(g);
  const idx = rk.indexOf(p);
  const ahead = idx > 0 ? rk[idx - 1] : null;
  return {
    acierto: p.lastOk, respondio: p.lastAnswered, ganados: p.lastGain, puntos: p.score, puesto: idx + 1,
    racha: p.streak, delante: ahead ? { apodo: ahead.nick, diferencia: ahead.score - p.score } : null
  };
}

function showLeaderboard(g) {
  g.state = 'ranking';
  const top = ranking(g).slice(0, 5).map(p => ({ apodo: p.nick, puntos: p.score }));
  io.to(hostRoom(g.pin)).emit('host:ranking', { top });
  touch(g);
}

function finishGame(g) {
  clearTimeout(g.timer);
  g.state = 'podio';
  const rk = ranking(g);
  const podio = rk.slice(0, 3).map(p => ({ apodo: p.nick, puntos: p.score }));
  io.to(hostRoom(g.pin)).emit('host:podio', { podio, total: rk.length });
  rk.forEach((p, i) => { if (p.socketId) io.to(p.socketId).emit('jugador:final', { puesto: i + 1, puntos: p.score, total: rk.length, podio }); });
  saveReport(g, rk);
  touch(g);
}

function saveReport(g, rk) {
  const preguntas = g.quiz.preguntas.map((q, i) => {
    const resp = rk.map(p => p.history[i]).filter(Boolean);
    const ok = resp.filter(r => r.ok).length;
    return { texto: q.texto, porcentaje: rk.length ? Math.round(100 * ok / rk.length) : 0 };
  });
  const inf = {
    pin: g.pin, titulo: g.quiz.titulo, fecha: new Date().toISOString(), claveHost: g.hostKey, preguntas,
    jugadores: rk.map((p, i) => ({
      puesto: i + 1, apodo: p.nick, puntos: p.score,
      aciertos: p.history.filter(h => h && h.ok).length,
      respuestas: g.quiz.preguntas.map((_, k) => p.history[k] || null)
    }))
  };
  fs.writeFileSync(path.join(DATA_DIR, 'informes', g.pin + '.json'), JSON.stringify(inf));
  g.report = { preguntas, csv: `api/informes/${g.pin}.csv?k=${g.hostKey}` };
  io.to(hostRoom(g.pin)).emit('host:informe', g.report);
}

function touch(g) { g.lastActivity = Date.now(); }

// Limpieza de partidas abandonadas (3 h sin actividad)
setInterval(() => {
  const now = Date.now();
  for (const [pin, g] of games) if (now - g.lastActivity > 3 * 3600e3) { clearTimeout(g.timer); games.delete(pin); }
}, 10 * 60e3).unref();

function hostState(g) {
  return {
    pin: g.pin, titulo: g.quiz.titulo, estado: g.state, indice: g.qIndex, total: g.quiz.preguntas.length,
    jugadores: publicPlayers(g), informe: g.report || null
  };
}

io.on('connection', socket => {
  // ---- Presentador ----
  socket.on('host:crear', ({ clave, cuestionarioId } = {}, cb = () => {}) => {
    if (!safeEq(clave, ADMIN_PASSWORD)) return cb({ error: 'Contraseña incorrecta' });
    const quiz = loadQuizzes().find(q => q.id === cuestionarioId);
    if (!quiz || !quiz.preguntas.length) return cb({ error: 'Ese cuestionario no tiene preguntas' });
    const pin = newPin();
    const g = {
      pin, quiz: JSON.parse(JSON.stringify(quiz)), hostKey: crypto.randomBytes(12).toString('base64url'),
      state: 'sala', qIndex: -1, players: new Map(), nicks: new Set(), answers: new Map(), timer: null, lastActivity: Date.now()
    };
    games.set(pin, g);
    socket.join(hostRoom(pin));
    socket.data.hostPin = pin;
    cb({ pin, claveHost: g.hostKey, estado: hostState(g) });
  });

  socket.on('host:reanudar', ({ pin, claveHost } = {}, cb = () => {}) => {
    const g = games.get(String(pin));
    if (!g || !safeEq(claveHost, g.hostKey)) return cb({ error: 'Partida no encontrada' });
    socket.join(hostRoom(g.pin));
    socket.data.hostPin = g.pin;
    cb({ estado: hostState(g) });
  });

  const hostGame = (claveHost) => {
    const g = games.get(socket.data.hostPin);
    return g && safeEq(claveHost, g.hostKey) ? g : null;
  };

  socket.on('host:siguiente', ({ claveHost } = {}) => {
    const g = hostGame(claveHost); if (!g) return;
    if (g.state === 'sala' || g.state === 'ranking') {
      if (g.qIndex + 1 >= g.quiz.preguntas.length) return finishGame(g);
      g.qIndex++; startQuestion(g);
    } else if (g.state === 'pregunta') endQuestion(g);
    else if (g.state === 'resultado') {
      if (g.qIndex + 1 >= g.quiz.preguntas.length) finishGame(g); else showLeaderboard(g);
    }
  });

  socket.on('host:expulsar', ({ claveHost, id } = {}) => {
    const g = hostGame(claveHost); if (!g) return;
    const p = g.players.get(id); if (!p) return;
    g.players.delete(id); g.nicks.delete(p.nick.toLowerCase());
    if (p.socketId) io.to(p.socketId).emit('jugador:expulsado');
    sendPlayers(g);
  });

  socket.on('host:terminar', ({ claveHost } = {}) => {
    const g = hostGame(claveHost); if (!g) return;
    clearTimeout(g.timer);
    io.to(room(g.pin)).emit('jugador:cerrada');
    games.delete(g.pin);
  });

  // ---- Jugador ----
  socket.on('jugador:comprobar', ({ pin } = {}, cb = () => {}) => {
    const g = games.get(String(pin || '').replace(/\D/g, ''));
    if (!g) return cb({ error: 'No hay ninguna partida con ese PIN' });
    cb({ ok: true, titulo: g.quiz.titulo });
  });

  socket.on('jugador:entrar', ({ pin, apodo, token } = {}, cb = () => {}) => {
    const g = games.get(String(pin || '').replace(/\D/g, ''));
    if (!g) return cb({ error: 'No hay ninguna partida con ese PIN' });

    // Reconexión: mismo token => recupera puntos y estado
    if (token) {
      const p = [...g.players.values()].find(x => safeEq(x.token, token));
      if (p) {
        p.socketId = socket.id; p.connected = true;
        socket.join(room(g.pin)); socket.data.player = { pin: g.pin, id: p.id };
        sendPlayers(g);
        const snap = { id: p.id, token: p.token, apodo: p.nick, estado: g.state, puntos: p.score };
        if (g.state === 'pregunta') {
          const q = currentQ(g);
          snap.pregunta = { indice: g.qIndex, total: g.quiz.preguntas.length, texto: q.texto, opciones: q.opciones, imagen: q.imagen || '', tiempo: q.tiempo,
            empiezaEn: Math.max(0, g.qStartedAt - Date.now()), restante: Math.max(0, g.qEndsAt - Date.now()), yaRespondio: g.answers.has(p.id) };
        } else if (g.state === 'resultado' || g.state === 'ranking') snap.resultado = resultFor(g, p);
        else if (g.state === 'podio') {
          const rk = ranking(g);
          snap.final = { puesto: rk.indexOf(p) + 1, puntos: p.score, total: rk.length, podio: rk.slice(0, 3).map(x => ({ apodo: x.nick, puntos: x.score })) };
        }
        return cb(snap);
      }
    }

    const nick = String(apodo || '').replace(/\s+/g, ' ').trim().slice(0, 20);
    if (!nick) return cb({ error: 'Escribe un apodo' });
    if (g.state !== 'sala') return cb({ error: 'La partida ya ha empezado' });
    if (g.players.size >= MAX_PLAYERS) return cb({ error: 'La partida está llena' });
    if (g.nicks.has(nick.toLowerCase())) return cb({ error: 'Ese apodo ya está cogido, prueba otro' });

    const p = {
      id: crypto.randomBytes(5).toString('hex'), token: crypto.randomBytes(12).toString('base64url'),
      nick, score: 0, streak: 0, totalMs: 0, history: [], socketId: socket.id, connected: true
    };
    g.players.set(p.id, p); g.nicks.add(nick.toLowerCase());
    socket.join(room(g.pin)); socket.data.player = { pin: g.pin, id: p.id };
    sendPlayers(g); touch(g);
    cb({ id: p.id, token: p.token, apodo: nick, estado: 'sala', puntos: 0 });
  });

  socket.on('jugador:responder', ({ opcion } = {}, cb = () => {}) => {
    const sp = socket.data.player; if (!sp) return cb({ error: 'No estás en una partida' });
    const g = games.get(sp.pin); if (!g || g.state !== 'pregunta') return cb({ error: 'Ahora no se puede responder' });
    const now = Date.now();
    if (now < g.qStartedAt - 200 || now > g.qEndsAt + 500) return cb({ error: 'Fuera de tiempo' });
    if (g.answers.has(sp.id)) return cb({ error: 'Ya has respondido' });
    const choice = parseInt(opcion, 10);
    if (!(choice >= 0 && choice < currentQ(g).opciones.length)) return cb({ error: 'Opción no válida' });
    g.answers.set(sp.id, { choice, ms: Math.max(0, Math.min(now - g.qStartedAt, g.qEndsAt - g.qStartedAt)) });
    cb({ ok: true });
    io.to(hostRoom(g.pin)).emit('host:respuestas', { respondieron: g.answers.size, jugadores: g.players.size });
    const conectados = [...g.players.values()].filter(p => p.connected).length;
    if (g.answers.size >= conectados) endQuestion(g); // todos han respondido: no esperar
  });

  socket.on('disconnect', () => {
    const sp = socket.data.player;
    if (sp) {
      const g = games.get(sp.pin);
      const p = g && g.players.get(sp.id);
      if (p && p.socketId === socket.id) { p.connected = false; p.socketId = null; sendPlayers(g); }
    }
  });
});

server.listen(PORT, HOST, () => console.log(`[chispa] Escuchando en http://${HOST}:${PORT}`));
module.exports = { server };
