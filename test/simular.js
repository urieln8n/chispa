// Prueba de carga: 1 presentador + N jugadores simulados juegan una partida completa
const { io } = require('socket.io-client');
const URL = process.env.URL || 'http://127.0.0.1:3070';
const N = parseInt(process.env.N || '200', 10);
const CLAVE = process.env.CLAVE;
const t0 = Date.now();
const ok = (c, m) => { if (!c) { console.error('FALLO:', m); process.exit(1); } };

(async () => {
  const r = await fetch(URL + '/api/cuestionarios', { headers: { 'x-chispa-clave': CLAVE } });
  ok(r.ok, 'login API'); const lista = await r.json(); const quiz = lista[0];
  const host = io(URL, { transports: ['websocket'] });
  const creada = await new Promise(res => host.emit('host:crear', { clave: CLAVE, cuestionarioId: quiz.id }, res));
  ok(creada.pin, 'crear partida ' + JSON.stringify(creada));
  const { pin, claveHost } = creada;
  console.log(`Partida ${pin} (${quiz.titulo}, ${quiz.n} preguntas). Conectando ${N} jugadores…`);

  const bots = [];
  await Promise.all(Array.from({ length: N }, (_, i) => new Promise(res => {
    const s = io(URL, { transports: ['websocket'], forceNew: true });
    s.on('connect', () => s.emit('jugador:entrar', { pin, apodo: 'Bot' + i }, r => { ok(r.id, 'entrar ' + JSON.stringify(r)); s.data = r; bots.push(s); res(); }));
    s.on('jugador:pregunta', p => setTimeout(() => s.emit('jugador:responder', { opcion: Math.floor(Math.random() * p.opciones.length) }, () => {}), p.empiezaEn + 200 + Math.random() * 2500));
    s.on('jugador:final', f => { s.final = f; });
  })));
  // apodo repetido debe rechazarse
  const dup = io(URL, { transports: ['websocket'], forceNew: true });
  const rdup = await new Promise(res => dup.on('connect', () => dup.emit('jugador:entrar', { pin, apodo: 'bot0' }, res)));
  ok(rdup.error, 'apodo repetido debe fallar'); dup.close();
  console.log(`✔ ${bots.length} jugadores dentro en ${Date.now() - t0} ms`);

  // Reconexión: un bot se desconecta y vuelve con su token
  const victima = bots[0]; const token = victima.data.token;

  let preguntas = 0;
  host.on('host:resultado', r => {
    preguntas++;
    console.log(`  P${preguntas}: respondieron ${r.respondieron}/${r.jugadores}, conteo ${r.conteo.join('/')}`);
    if (preguntas === 1) {
      victima.disconnect();
      setTimeout(() => {
        const nuevo = io(URL, { transports: ['websocket'], forceNew: true });
        nuevo.on('connect', () => nuevo.emit('jugador:entrar', { pin, token }, rr => { ok(rr.id === victima.data.id && rr.puntos >= 0, 'reconexión'); console.log(`  ✔ reconexión OK (puntos conservados: ${rr.puntos})`); nuevo.close(); }));
      }, 200);
    }
    setTimeout(() => host.emit('host:siguiente', { claveHost }), 600);
  });
  host.on('host:ranking', () => setTimeout(() => host.emit('host:siguiente', { claveHost }), 300));
  host.on('host:podio', d => console.log('🏆 Podio:', d.podio.map(p => `${p.apodo} ${p.puntos}`).join(' | ')));
  host.on('host:informe', async inf => {
    const csv = await (await fetch(URL + '/' + inf.csv)).text();
    ok(csv.split('\n').length > N, 'CSV del informe');
    console.log(`✔ Informe CSV: ${csv.split('\n').length} líneas`);
    await new Promise(r => setTimeout(r, 500));
    const finales = bots.filter(b => b.final).length;
    console.log(`✔ ${finales}/${bots.length - 1} jugadores recibieron su puesto final`);
    ok(finales >= bots.length - 1, 'finales');
    console.log(`TODO OK en ${((Date.now() - t0) / 1000).toFixed(1)} s`);
    process.exit(0);
  });
  host.emit('host:siguiente', { claveHost });
})();
setTimeout(() => { console.error('FALLO: tiempo agotado'); process.exit(1); }, 240000);
