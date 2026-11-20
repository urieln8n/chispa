// Prueba del bingo musical: presentador + N jugadores (uno hace trampa) hasta cartón lleno
const U = (process.env.URL || 'http://127.0.0.1:8787').replace(/\/$/, ''), N = parseInt(process.env.N || '120', 10), CLAVE = process.env.CLAVE || 'prueba123';
const ok = (c, m) => { if (!c) { console.error('FALLO:', m); process.exit(1); } };
const H = { 'content-type': 'application/json', 'x-chispa-clave': CLAVE };
const api = async (r, o = {}) => { const x = await fetch(U + '/api/' + r, { ...o, headers: H, body: o.body && JSON.stringify(o.body) }); return { s: x.status, d: await x.json() }; };
function conectar(pin) {
  return new Promise(res => {
    const ws = new WebSocket(U.replace(/^http/, 'ws') + '/ws?pin=' + pin), h = {}, acks = new Map(); let n = 0;
    const s = { ws, on: (e, f) => (h[e] = f), emit: (e, d = {}) => new Promise(r => { const id = ++n; acks.set(id, r); ws.send(JSON.stringify({ t: e, d, id })); }) };
    ws.onmessage = ev => { const m = JSON.parse(ev.data); if (m.t === 'ack') { acks.get(m.id)(m.d); acks.delete(m.id); } else if (h[m.t]) h[m.t](m.d); };
    ws.onopen = () => res(s);
  });
}
const LINEAS = n => { const L = []; for (let f = 0; f < n; f++) L.push([...Array(n)].map((_, c) => f * n + c)); for (let c = 0; c < n; c++) L.push([...Array(n)].map((_, f) => f * n + c)); L.push([...Array(n)].map((_, i) => i * n + i)); L.push([...Array(n)].map((_, i) => i * n + n - 1 - i)); return L; };
(async () => {
  let l = await api('login', { method: 'POST', body: { clave: CLAVE } }); if (l.d.configurar) await api('configurar', { method: 'POST', body: { clave: CLAVE } });
  let lista = (await api('cuestionarios')).d.find(q => q.tipo === 'bingo' && /Navidad/.test(q.titulo));
  if (!lista) { const p = await (await fetch(U + '/packs/bingo-navidad.json')).json(); console.log('import', (await api('importar', { method: 'POST', body: p })).d); lista = (await api('cuestionarios')).d.find(q => q.tipo === 'bingo'); }
  console.log('Lista:', lista.titulo, lista.n, 'canciones');
  const malo = await api('partidas', { method: 'POST', body: { cuestionarioId: lista.id, opciones: { tamano: 5 } } });
  console.log('5×5 con 40 canciones →', malo.s, malo.d.error || 'ok');
  const p = await api('partidas', { method: 'POST', body: { cuestionarioId: lista.id, opciones: { tamano: 4, rondas: ['linea', 'doble', 'lleno'], revelar: 0, tema: 'navidad' } } });
  ok(p.d.pin, 'crear ' + JSON.stringify(p.d)); const { pin, claveHost } = p.d;
  const info = await (await fetch(U + '/api/partidas/' + pin)).json(); ok(info.tipo === 'bingo' && info.tema === 'navidad', 'info ' + JSON.stringify(info));
  const host = await conectar(pin); const est = await host.emit('host:reanudar', { claveHost }); ok(est.estado && est.estado.tipo === 'bingo', 'reanudar');
  const t0 = Date.now(); const bots = [];
  for (let i = 0; i < N; i++) {
    const s = await conectar(pin); const r = await s.emit('jugador:entrar', { apodo: 'Bot' + i }); ok(r.carton && r.carton.length === 16, 'cartón'); s.st = r; s.marc = new Set(); bots.push(s);
  }
  const distintos = new Set(bots.map(b => b.st.carton.map(c => c.titulo).join('|'))).size;
  console.log(`✔ ${N} jugadores con ${distintos} cartones distintos (${Date.now() - t0} ms)`);
  // tramposo: marca todo y canta
  const tramposo = bots[N - 1];
  // bots marcan al revelarse y cantan cuando creen que tienen la jugada
  const L = LINEAS(4); let rondaNom = 'Línea', falsos = 0;
  bots.forEach((b, i) => {
    b.on('bingo:ronda', d => { rondaNom = d.nombreRonda; b.cantado = false; });
    b.on('bingo:revelada', async d => {
      if (b === tramposo) return;
      const k = b.st.carton.findIndex(c => c && c.titulo === d.cancion.titulo);
      if (k >= 0) { b.marc.add(k); await b.emit('bingo:marcar', { celda: k, marcar: true }); }
      const comp = L.filter(li => li.every(x => b.marc.has(x))).length;
      const tiene = rondaNom === 'Línea' ? comp >= 1 : rondaNom === 'Dos líneas' ? comp >= 2 : b.marc.size === 16;
      if (tiene && !b.cantado) { const r = await b.emit('bingo:cantar'); if (r.valido) b.cantado = true; }
    });
  });
  for (let k = 0; k < 16; k++) await tramposo.emit('bingo:marcar', { celda: k, marcar: true });
  const ganadores = [];
  host.on('bingo:falso', d => { falsos++; });
  host.on('bingo:ganador', d => { if (d.primero) { ganadores.push(`${d.nombreRonda}: ${d.apodo} (patrón ${d.carton.filter(c => c.patron).length} casillas)`); setTimeout(() => host.emit('bingo:siguienteRonda'), 300); } });
  let fin = false; host.on('bingo:final', d => { fin = true; console.log('🏆 Final:', JSON.stringify(d.ganadores)); });
  // primera canción + trampa
  await host.emit('bingo:siguiente'); await host.emit('bingo:revelar');
  const rt = await tramposo.emit('bingo:cantar'); ok(rt.valido === false, 'el tramposo debe fallar'); console.log('✔ Tramposo rechazado:', rt.motivo);
  ok((await tramposo.emit('bingo:cantar')).error, 'bloqueo 10 s');
  // deshacer
  await host.emit('bingo:siguiente'); const antes = (await host.emit('host:reanudar', { claveHost })).estado.numero; await host.emit('bingo:deshacer');
  const desp = (await host.emit('host:reanudar', { claveHost })).estado.numero; ok(desp === antes - 1, 'deshacer'); console.log('✔ Deshacer OK');
  for (let i = 0; i < 40 && !fin; i++) {
    const r = await host.emit('bingo:siguiente'); if (r.error) break;
    await host.emit('bingo:revelar'); await new Promise(r => setTimeout(r, 120));
  }
  await new Promise(r => setTimeout(r, 800));
  console.log('Ganadores:\n  ' + ganadores.join('\n  '));
  const e = (await host.emit('host:reanudar', { claveHost })).estado;
  console.log(`Canciones sonadas: ${e.numero} · bingos falsos: ${falsos} · estado: ${e.estado}`);
  ok(fin && ganadores.length === 3, 'deben salir las 3 rondas');
  // reconexión de un jugador
  const nuevo = await conectar(pin); const rr = await nuevo.emit('jugador:entrar', { token: bots[0].st.token }); ok(rr.carton && rr.final, 'reconexión con final');
  console.log('✔ Reconexión OK · TODO OK en', ((Date.now() - t0) / 1000).toFixed(1), 's'); process.exit(0);
})().catch(e => { console.error('FALLO', e); process.exit(1); });
setTimeout(() => { console.error('FALLO: tiempo'); process.exit(1); }, 200000);
