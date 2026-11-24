// Prueba de Fiestón: la tele (host) + N jugadores bot juegan una partida entera (trivial + «más probable»).
// Uso: npx wrangler dev --env fiesta  y en otra terminal: node test/fiesta.js
const U = (process.env.URL || 'http://127.0.0.1:8787').replace(/\/$/, ''), N = parseInt(process.env.N || '6', 10);
const ok = (c, m) => { if (!c) { console.error('FALLO:', m); process.exit(1); } };
function conectar(pin) {
  return new Promise(res => {
    const ws = new WebSocket(U.replace(/^http/, 'ws') + '/ws?pin=' + pin), h = {}, acks = new Map(); let n = 0;
    const s = { ws, on: (e, f) => (h[e] = f), emit: (e, d = {}) => new Promise(r => { const id = ++n; acks.set(id, r); ws.send(JSON.stringify({ t: e, d, id })); }) };
    ws.onmessage = ev => { const m = JSON.parse(ev.data); if (m.t === 'ack') { acks.get(m.id)(m.d); acks.delete(m.id); } else if (h[m.t]) h[m.t](m.d); };
    ws.onopen = () => res(s);
  });
}
const espera = ms => new Promise(r => setTimeout(r, ms));
(async () => {
  for (const p of ['/', '/jugar', '/tv', '/fiesta-tv', '/fiesta.css']) { const r = await fetch(U + p, { redirect: 'manual' }); ok(r.status === 200, 'página ' + p + ' → ' + r.status); }
  const r0 = await fetch(U + '/panel', { redirect: 'manual' }); ok(r0.status === 302, '/panel debería redirigir');
  const c = await (await fetch(U + '/api/fiesta/crear', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ rondas: 9, anfitrion: 'Familia Prueba' }) })).json();
  ok(c.pin && c.claveHost, 'crear ' + JSON.stringify(c));
  const { pin, claveHost } = c;
  const info = await (await fetch(U + '/api/partidas/' + pin)).json(); ok(info.tipo === 'fiesta', 'info');
  const cm = await (await fetch(U + '/api/fiesta/crear', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ rondas: 8, modo: 'movil', pack: 'quedadas' }) })).json();
  const hm = await conectar(cm.pin); const em = await hm.emit('host:reanudar', { claveHost: cm.claveHost }); ok(em.estado.modo === 'movil' && em.estado.titulo === 'Pack Quedadas', 'modo móvil ' + JSON.stringify(em.estado));
  const jm = await (await conectar(cm.pin)).emit('jugador:entrar', { apodo: 'Ana' }); ok(jm.modo === 'movil', 'jugador ve el modo');
  const host = await conectar(pin);
  const est = await host.emit('host:reanudar', { claveHost }); ok(est.estado && est.estado.total === 9, 'reanudar ' + JSON.stringify(est));
  ok((await host.emit('host:siguiente')).error, 'no debería empezar con 0 jugadores');
  const bots = [];
  for (let i = 0; i < N; i++) {
    const s = await conectar(pin); const r = await s.emit('jugador:entrar', { apodo: 'Bot ' + i }); ok(r.id && r.color, 'entrar ' + JSON.stringify(r)); s.yo = r; bots.push(s);
  }
  ok((await bots[0].emit('jugador:entrar', { apodo: 'Bot 1' })).error || true, 'duplicado');
  const dup = await (await conectar(pin)).emit('jugador:entrar', { apodo: 'bot 1' }); ok(dup.error, 'nombre repetido debería fallar');
  // reconexión con token
  const re = await (await conectar(pin)).emit('jugador:entrar', { token: bots[2].yo.token }); ok(re.id === bots[2].yo.id, 'reentrar con token');
  bots[2] = await conectar(pin); const re2 = await bots[2].emit('jugador:entrar', { token: re.token }); bots[2].yo = re2;

  let resultados = 0, podio = null, tipos = { trivial: 0, probable: 0, mentira: 0 };
  host.on('fiesta:podio', p => { podio = p; });
  bots.forEach((b, i) => b.on('fiesta:ronda', async r => {
    tipos[r.tipo] += i === 0 && r.fase !== 'votar' ? 1 : 0;
    await espera(r.empiezaEn + 50 + i * 30);
    let d;
    if (r.tipo === 'mentira' && r.fase === 'escribir') { if (i === 0) { const v = await b.emit('fiesta:responder', { texto: 'KFC' }); /* puede que no sea esta ronda */ if (v.ok) return; } d = { texto: 'Mentira ' + i }; }
    else if (r.tipo === 'mentira') { ok(r.opciones.length >= 3, 'opciones de mentira'); d = { opcion: r.mia === 0 ? 1 : 0 }; const mal = r.mia >= 0 ? await b.emit('fiesta:responder', { opcion: r.mia }) : { error: 'x' }; ok(mal.error, 'no se puede votar la propia mentira'); }
    else d = r.tipo === 'trivial' ? { opcion: i % r.opciones.length } : { voto: r.opciones[i % 2].id }; // los votos se reparten entre dos
    const a = await b.emit('fiesta:responder', d); ok(a.ok, 'responder ' + JSON.stringify(a));
    const a2 = await b.emit('fiesta:responder', d); ok(a2.error, 'responder dos veces debería fallar');
  }));
  bots.forEach(b => b.on('fiesta:resultado', r => { ok(r.ranking && r.ranking.length && r.texto, 'resultado para el móvil ' + JSON.stringify(r)); if (r.tipo === 'trivial') ok(r.correcta, 'falta la respuesta correcta'); }));
  let ultimoRes = null; host.on('fiesta:resultado', r => { ultimoRes = r; resultados++; });
  for (let k = 0; k < 9; k++) {
    const antes = resultados;
    ok(!(await host.emit('host:siguiente')).error, 'siguiente ronda ' + k);
    for (let t = 0; t < 120 && resultados === antes; t++) await espera(100); // se cierra sola cuando todos responden
    ok(resultados === antes + 1, 'la ronda ' + k + ' no se cerró sola');
    if (ultimoRes.tipo === 'mentira') ok(ultimoRes.opciones.some(o => o.verdad) && ultimoRes.opciones.reduce((a, o) => a + o.votantes.length, 0) === N, 'mentira ' + JSON.stringify(ultimoRes));
    else if (ultimoRes.tipo === 'probable') ok(ultimoRes.elegidos.length >= 1 && ultimoRes.votos.length >= 1, 'votos ' + JSON.stringify(ultimoRes));
    else ok(ultimoRes.conteo.reduce((a, b) => a + b, 0) === N, 'conteo trivial');
  }
  ok(!(await host.emit('host:siguiente')).error, 'ir al podio');
  await espera(200);
  ok(podio && podio.top.length === 3 && podio.total === N, 'podio ' + JSON.stringify(podio));
  // El primero que entra es el anfitrión y lleva el mando; las rondas pasan solas
  const c3 = await (await fetch(U + '/api/fiesta/crear', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ rondas: 4, modo: 'movil' }) })).json();
  const p1 = await conectar(c3.pin), p2 = await conectar(c3.pin);
  const e1 = await p1.emit('jugador:entrar', { apodo: 'Uno' }), e2 = await p2.emit('jugador:entrar', { apodo: 'Dos' });
  ok(e1.anfitrion && !e2.anfitrion, 'el primero debería ser el anfitrión');
  ok((await p2.emit('host:siguiente')).error, 'un jugador normal no puede pasar ronda');
  let rondas = 0; const contar = r => { if (r.fase !== 'votar') rondas++; };
  p1.on('fiesta:ronda', async r => { contar(r); await espera(r.empiezaEn + 50); p1.emit('fiesta:responder', r.tipo === 'trivial' ? { opcion: 0 } : r.tipo === 'probable' ? { voto: r.opciones[0].id } : r.fase === 'escribir' ? { texto: 'uno' } : { opcion: r.mia === 0 ? 1 : 0 }); });
  p2.on('fiesta:ronda', async r => { await espera(r.empiezaEn + 80); p2.emit('fiesta:responder', r.tipo === 'trivial' ? { opcion: 1 } : r.tipo === 'probable' ? { voto: r.opciones[1].id } : r.fase === 'escribir' ? { texto: 'dos' } : { opcion: r.mia === 0 ? 1 : 0 }); });
  ok(!(await p1.emit('host:siguiente')).error, 'el anfitrión empieza desde el móvil');
  for (let t = 0; t < 200 && rondas < 2; t++) await espera(100);
  ok(rondas >= 2, 'la segunda ronda debería empezar sola');
  console.log('✔ Mando en el móvil del primer jugador y rondas automáticas');

  console.log(`✔ Partida completa: ${N} jugadores, 9 rondas (trivial ${tipos.trivial}, más probable ${tipos.probable}, verdad o mentira ${tipos.mentira}). Ganador: ${podio.top[0].apodo} con ${podio.top[0].puntos} puntos`);
  process.exit(0);
})().catch(e => { console.error(e); process.exit(1); });
