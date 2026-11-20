// Prueba de carga: 1 presentador + N jugadores simulados juegan una partida completa contra Chispa (wrangler dev o producción)
const URL_BASE = (process.env.URL || 'http://127.0.0.1:8787').replace(/\/$/, '');
const N = parseInt(process.env.N || '150', 10);
const CLAVE = process.env.CLAVE || 'prueba123';
const t0 = Date.now();
const ok = (c, m) => { if (!c) { console.error('FALLO:', m); process.exit(1); } };

function conectar(pin) {
  return new Promise((res, rej) => {
    const ws = new WebSocket(URL_BASE.replace(/^http/, 'ws') + '/ws?pin=' + pin);
    const h = {}, acks = new Map(); let n = 0;
    const s = { ws, on: (e, f) => (h[e] = f), emit: (e, d) => new Promise(r => { const id = ++n; acks.set(id, r); ws.send(JSON.stringify({ t: e, d, id })); }) };
    ws.onmessage = ev => { const m = JSON.parse(ev.data); if (m.t === 'ack') { acks.get(m.id)(m.d); acks.delete(m.id); } else if (h[m.t]) h[m.t](m.d); };
    ws.onopen = () => res(s); ws.onerror = rej;
  });
}
const api = async (ruta, opts = {}) => {
  const r = await fetch(URL_BASE + '/api/' + ruta, { ...opts, headers: { 'content-type': 'application/json', 'x-chispa-clave': CLAVE }, body: opts.body && JSON.stringify(opts.body) });
  return { status: r.status, data: await r.json().catch(() => null) };
};

(async () => {
  let l = await api('login', { method: 'POST', body: { clave: CLAVE } });
  if (l.data.configurar) { l = await api('configurar', { method: 'POST', body: { clave: CLAVE } }); console.log('✔ contraseña creada'); }
  ok(l.status === 200, 'login ' + JSON.stringify(l.data));
  ok((await api('cuestionarios', { headers: {} })).status === 200, 'lista');
  const sin = await fetch(URL_BASE + '/api/cuestionarios'); ok(sin.status === 401, 'sin contraseña debe dar 401');
  const quiz = (await api('cuestionarios')).data[0];
  const p = await api('partidas', { method: 'POST', body: { cuestionarioId: quiz.id } });
  ok(p.data.pin, 'crear partida ' + JSON.stringify(p.data));
  const { pin, claveHost } = p.data;
  ok((await (await fetch(URL_BASE + '/api/partidas/' + pin)).json()).titulo, 'comprobar PIN');
  ok((await fetch(URL_BASE + '/api/partidas/000001')).status === 404, 'PIN inexistente 404');
  const host = await conectar(pin);
  ok((await host.emit('host:reanudar', { claveHost })).estado, 'host reanudar');
  ok((await host.emit('host:reanudar', { claveHost: 'mala' })).error, 'clave host mala');
  console.log(`Partida ${pin} (${quiz.titulo}, ${quiz.n} preguntas). Conectando ${N} jugadores…`);

  const bots = await Promise.all(Array.from({ length: N }, async (_, i) => {
    const s = await conectar(pin);
    const r = await s.emit('jugador:entrar', { apodo: 'Bot' + i }); ok(r.id, 'entrar ' + JSON.stringify(r)); s.data = r;
    s.on('jugador:pregunta', q => setTimeout(() => s.emit('jugador:responder', { opcion: Math.floor(Math.random() * q.opciones.length) }), q.empiezaEn + 200 + Math.random() * 2500));
    s.on('jugador:final', f => { s.final = f; });
    return s;
  }));
  const dup = await conectar(pin); ok((await dup.emit('jugador:entrar', { apodo: 'bot0' })).error, 'apodo repetido'); dup.ws.close();
  console.log(`✔ ${bots.length} jugadores dentro en ${Date.now() - t0} ms`);

  const victima = bots[0];
  let n = 0;
  host.on('host:resultado', async r => {
    n++; console.log(`  P${n}: respondieron ${r.respondieron}/${r.jugadores}, conteo ${r.conteo.join('/')}`);
    if (n === 1) {
      victima.ws.close();
      setTimeout(async () => {
        const nuevo = await conectar(pin);
        const rr = await nuevo.emit('jugador:entrar', { token: victima.data.token });
        ok(rr.id === victima.data.id, 'reconexión ' + JSON.stringify(rr)); console.log(`  ✔ reconexión OK (puntos conservados: ${rr.puntos})`); nuevo.ws.close();
      }, 300);
    }
    setTimeout(() => host.emit('host:siguiente', { claveHost }), 700);
  });
  host.on('host:ranking', () => setTimeout(() => host.emit('host:siguiente', { claveHost }), 300));
  host.on('host:podio', d => console.log('🏆 Podio:', d.podio.map(x => `${x.apodo} ${x.puntos}`).join(' | ')));
  host.on('host:informe', async inf => {
    const csv = await (await fetch(URL_BASE + '/' + inf.csv)).text();
    ok(csv.split('\n').length > N, 'CSV del informe'); console.log(`✔ Informe CSV: ${csv.split('\n').length} líneas`);
    await new Promise(r => setTimeout(r, 800));
    const finales = bots.filter(b => b.final).length;
    console.log(`✔ ${finales}/${bots.length - 1} jugadores recibieron su puesto final`);
    ok(finales >= bots.length - 1, 'finales');
    console.log(`TODO OK en ${((Date.now() - t0) / 1000).toFixed(1)} s`); process.exit(0);
  });
  host.emit('host:siguiente', { claveHost });
})().catch(e => { console.error('FALLO', e); process.exit(1); });
setTimeout(() => { console.error('FALLO: tiempo agotado'); process.exit(1); }, 240000);
