// Prueba del cobro de Fiestón (sin llamar a Stripe): límites del plan gratis y licencias firmadas.
// Uso: npx wrangler dev --env fiesta --var STRIPE_SECRET_KEY:sk_test_prueba  y luego: CLAVE=sk_test_prueba node test/fiesta-pagos.js
const U = (process.env.URL || 'http://127.0.0.1:8787').replace(/\/$/, ''), CLAVE = process.env.CLAVE || 'sk_test_prueba';
const ok = (c, m) => { if (!c) { console.error('FALLO:', m); process.exit(1); } };
const b64 = buf => Buffer.from(buf).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
async function firmar(plan, caduca, clave = CLAVE) {
  const cuerpo = b64(JSON.stringify({ p: plan, e: caduca }));
  const k = await crypto.subtle.importKey('raw', new TextEncoder().encode('fieston:' + clave), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  return cuerpo + '.' + b64(await crypto.subtle.sign('HMAC', k, new TextEncoder().encode(cuerpo)));
}
const post = async (r, b) => { const x = await fetch(U + '/api/fiesta/' + r, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(b) }); return { s: x.status, d: await x.json() }; };
const rondas = async pin => { const ws = new WebSocket(U.replace(/^http/, 'ws') + '/ws?pin=' + pin); return { ws }; };
(async () => {
  const g = (await post('permisos', {})).d; ok(g.pagos && g.plan === 'gratis' && g.rondas === 8 && !g.ia, 'gratis ' + JSON.stringify(g));
  const lic = await firmar('familia', Date.now() + 86400e3);
  const f = (await post('permisos', { licencia: lic })).d; ok(f.plan === 'familia' && f.rondas === 16 && f.ia, 'familia ' + JSON.stringify(f));
  const falsa = await firmar('empresa', Date.now() + 86400e3, 'otra-clave');
  ok((await post('permisos', { licencia: falsa })).d.plan === 'gratis', 'licencia falsificada aceptada');
  const vieja = await firmar('familia', Date.now() - 1000);
  ok((await post('permisos', { licencia: vieja })).d.plan === 'gratis', 'licencia caducada aceptada');
  // crear: gratis se limita a 8 rondas aunque pida 16; con licencia, 16
  const c1 = (await post('crear', { rondas: 16, datos: 'Juan siempre llega tarde' })).d; ok(c1.pin && /Pack Familia/.test(c1.aviso), 'crear gratis ' + JSON.stringify(c1));
  const host = async (c) => new Promise(res => { const ws = new WebSocket(U.replace(/^http/, 'ws') + '/ws?pin=' + c.pin); ws.onopen = () => ws.send(JSON.stringify({ t: 'host:reanudar', d: { claveHost: c.claveHost }, id: 1 })); ws.onmessage = e => { const m = JSON.parse(e.data); if (m.t === 'ack') { ws.close(); res(m.d.estado); } }; });
  ok((await host(c1)).total === 8, 'gratis debería tener 8 rondas');
  const c2 = (await post('crear', { rondas: 16, licencia: lic })).d; ok((await host(c2)).total === 16, 'familia debería tener 16 rondas');
  ok((await post('canjear', { sesion: 'nada' })).s === 400, 'canjear sesión inválida');
  console.log('✔ Cobro: plan gratis limitado, licencias válidas aceptadas, falsas y caducadas rechazadas');
  process.exit(0);
})().catch(e => { console.error(e); process.exit(1); });
