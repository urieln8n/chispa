// Notificaciones push de Lumbrera (Web Push con VAPID, sin librerías).
// Los avisos van sin contenido cifrado: el service worker del móvil decide el texto con la racha que guarda la app.
// Las claves VAPID las genera el propio servidor la primera vez y se guardan en el Almacén (no hace falta configurar secretos).

export const b64u = buf => btoa(String.fromCharCode(...new Uint8Array(buf))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const deB64u = s => Uint8Array.from(atob(s.replace(/-/g, '+').replace(/_/g, '/') + '==='.slice((s.length + 3) % 4)), c => c.charCodeAt(0));
const texto = s => new TextEncoder().encode(s);

export async function generarClavesVapid() {
  const par = await crypto.subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, true, ['sign', 'verify']);
  return { privada: await crypto.subtle.exportKey('jwk', par.privateKey), publica: b64u(await crypto.subtle.exportKey('raw', par.publicKey)) };
}

// Cabecera Authorization «vapid t=<JWT>, k=<clave pública>» para un endpoint
export async function cabeceraVapid(endpoint, claves, contacto) {
  const aud = new URL(endpoint).origin;
  const cab = b64u(texto(JSON.stringify({ typ: 'JWT', alg: 'ES256' })));
  const cuerpo = b64u(texto(JSON.stringify({ aud, exp: Math.floor(Date.now() / 1000) + 12 * 3600, sub: contacto })));
  const clave = await crypto.subtle.importKey('jwk', claves.privada, { name: 'ECDSA', namedCurve: 'P-256' }, false, ['sign']);
  const firma = await crypto.subtle.sign({ name: 'ECDSA', hash: 'SHA-256' }, clave, texto(cab + '.' + cuerpo));
  return `vapid t=${cab}.${cuerpo}.${b64u(firma)}, k=${claves.publica}`;
}

// Solo se aceptan servicios de push conocidos (evita que alguien use el servidor para llamar a otras webs)
const SERVICIOS = [/^fcm\.googleapis\.com$/, /^updates\.push\.services\.mozilla\.com$/, /^web\.push\.apple\.com$/, /\.notify\.windows\.com$/, /^push\.services\.mozilla\.com$/];
export function endpointValido(e, permitirLocal = false) {
  try {
    const u = new URL(String(e || ''));
    if (String(e).length > 1000) return false;
    if (permitirLocal && u.hostname === '127.0.0.1') return true;
    return u.protocol === 'https:' && SERVICIOS.some(r => r.test(u.hostname));
  } catch { return false; }
}
export const horaValida = h => /^([01]\d|2[0-3]):00$/.test(String(h || '')) ? h : '20:00';
export function zonaValida(z) {
  try { new Intl.DateTimeFormat('es-ES', { timeZone: String(z) }); return String(z).slice(0, 64); } catch { return 'Europe/Madrid'; }
}
export { deB64u };
