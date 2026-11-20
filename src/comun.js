// Utilidades compartidas del servidor
export function aleatorio(bytes = 9) {
  const a = new Uint8Array(bytes);
  crypto.getRandomValues(a);
  return btoa(String.fromCharCode(...a)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
export function idCorto() {
  const a = new Uint8Array(6); crypto.getRandomValues(a);
  return [...a].map(b => b.toString(16).padStart(2, '0')).join('');
}
export function iguales(a, b) {
  a = String(a ?? ''); b = String(b ?? '');
  if (a.length !== b.length) return false;
  let r = 0;
  for (let i = 0; i < a.length; i++) r |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return r === 0;
}
export async function sha256(texto) {
  const h = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(texto));
  return [...new Uint8Array(h)].map(b => b.toString(16).padStart(2, '0')).join('');
}
export function json(data, status = 200, headers = {}) {
  return new Response(JSON.stringify(data), { status, headers: { 'content-type': 'application/json; charset=utf-8', ...headers } });
}

export function limpiarCuestionario(body) {
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

export const DEMO = {
  titulo: 'Cultura general exprés',
  preguntas: [
    { texto: '¿Cuál es el planeta más grande del sistema solar?', opciones: ['Saturno', 'Júpiter', 'Neptuno', 'La Tierra'], correcta: 1, tiempo: 20, imagen: '' },
    { texto: '¿En qué año llegó el ser humano a la Luna?', opciones: ['1965', '1972', '1969', '1959'], correcta: 2, tiempo: 20, imagen: '' },
    { texto: '¿Cuántos lados tiene un hexágono?', opciones: ['6', '8', '5', '7'], correcta: 0, tiempo: 15, imagen: '' },
    { texto: '¿Qué gas absorben las plantas para hacer la fotosíntesis?', opciones: ['Oxígeno', 'Nitrógeno', 'Helio', 'Dióxido de carbono'], correcta: 3, tiempo: 20, imagen: '' },
    { texto: '¿Quién pintó «Las Meninas»?', opciones: ['Goya', 'Velázquez', 'Picasso', 'El Greco'], correcta: 1, tiempo: 20, imagen: '' }
  ]
};
