// Fiestón · cobro con Stripe Checkout y licencias firmadas (sin base de datos).
// Sin el secreto STRIPE_SECRET_KEY el cobro está apagado y todo es gratis.
export const PLANES = {
  familia: { nombre: 'Fiestón · Pack Familia', precio: 399, dias: 30, rondas: 16, jugadores: 12, ia: true },
  empresa: { nombre: 'Fiestón · Evento Empresa', precio: 7900, dias: 30, rondas: 20, jugadores: 50, ia: true }
};
export const GRATIS = { rondas: 8, jugadores: 12, ia: false };

const b64 = buf => btoa(String.fromCharCode(...new Uint8Array(buf))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const desde64 = s => atob(s.replace(/-/g, '+').replace(/_/g, '/'));
async function hmac(clave, texto) {
  const k = await crypto.subtle.importKey('raw', new TextEncoder().encode('fieston:' + clave), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  return b64(await crypto.subtle.sign('HMAC', k, new TextEncoder().encode(texto)));
}
export async function firmarLicencia(env, plan, caduca) {
  const cuerpo = b64(new TextEncoder().encode(JSON.stringify({ p: plan, e: caduca })));
  return cuerpo + '.' + await hmac(env.STRIPE_SECRET_KEY, cuerpo);
}
export async function leerLicencia(env, token) {
  try {
    const [cuerpo, firma] = String(token || '').split('.');
    if (!cuerpo || !firma || firma !== await hmac(env.STRIPE_SECRET_KEY, cuerpo)) return null;
    const d = JSON.parse(desde64(cuerpo));
    if (!PLANES[d.p] || !(d.e > Date.now())) return null;
    return { plan: d.p, caduca: d.e, ...PLANES[d.p] };
  } catch { return null; }
}
// Lo que puede hacer quien crea la partida
export async function permisos(env, licencia) {
  if (!env.STRIPE_SECRET_KEY) return { rondas: 20, jugadores: 12, ia: true, plan: 'abierto' };
  const l = await leerLicencia(env, licencia);
  return l ? { rondas: l.rondas, jugadores: l.jugadores, ia: l.ia, plan: l.plan, caduca: l.caduca } : { ...GRATIS, plan: 'gratis' };
}

async function stripe(env, ruta, form) {
  const r = await fetch('https://api.stripe.com/v1/' + ruta, {
    method: form ? 'POST' : 'GET',
    headers: { authorization: 'Bearer ' + env.STRIPE_SECRET_KEY, ...(form ? { 'content-type': 'application/x-www-form-urlencoded' } : {}) },
    body: form ? new URLSearchParams(form).toString() : undefined
  });
  const d = await r.json();
  if (!r.ok) throw new Error((d.error && d.error.message) || 'Error de Stripe');
  return d;
}
export async function crearPago(env, origen, plan) {
  const p = PLANES[plan]; if (!p) throw new Error('Plan no válido');
  const s = await stripe(env, 'checkout/sessions', {
    mode: 'payment', locale: 'es', allow_promotion_codes: 'true',
    success_url: origen + '/?pago={CHECKOUT_SESSION_ID}', cancel_url: origen + '/?pago=cancelado',
    'line_items[0][quantity]': '1', 'line_items[0][price_data][currency]': 'eur',
    'line_items[0][price_data][unit_amount]': String(p.precio), 'line_items[0][price_data][product_data][name]': p.nombre,
    'metadata[plan]': plan
  });
  return s.url;
}
export async function canjearPago(env, sesion) {
  if (!/^cs_[A-Za-z0-9_]+$/.test(String(sesion || ''))) throw new Error('Pago no válido');
  const s = await stripe(env, 'checkout/sessions/' + sesion);
  if (s.payment_status !== 'paid') throw new Error('El pago aún no está completado');
  const plan = s.metadata && s.metadata.plan; if (!PLANES[plan]) throw new Error('Plan no válido');
  const caduca = s.created * 1000 + PLANES[plan].dias * 86400e3;
  if (caduca < Date.now()) throw new Error('Esta compra ya ha caducado');
  return { licencia: await firmarLicencia(env, plan, caduca), plan, caduca };
}
