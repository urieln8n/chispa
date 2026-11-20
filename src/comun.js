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

export function limpiarListaBingo(body) {
  const titulo = String(body.titulo || '').trim().slice(0, 200) || 'Lista de bingo sin título';
  const categoria = String(body.categoria || 'Bingo musical').replace(/\s+/g, ' ').trim().slice(0, 40) || 'Bingo musical';
  const vistas = new Set();
  const canciones = (Array.isArray(body.canciones) ? body.canciones : []).map(c => ({
    titulo: String((c && c.titulo) || '').replace(/\s+/g, ' ').trim().slice(0, 80),
    artista: String((c && c.artista) || '').replace(/\s+/g, ' ').trim().slice(0, 60)
  })).filter(c => c.titulo && !vistas.has(c.titulo.toLowerCase()) && vistas.add(c.titulo.toLowerCase())).slice(0, 300);
  return { tipo: 'bingo', titulo, categoria, canciones, preguntas: [] };
}

export function limpiarCuestionario(body) {
  if (body && body.tipo === 'bingo') return limpiarListaBingo(body);
  const titulo = String(body.titulo || '').trim().slice(0, 200) || 'Cuestionario sin título';
  const categoria = String(body.categoria || '').replace(/\s+/g, ' ').trim().slice(0, 40);
  const preguntas = (Array.isArray(body.preguntas) ? body.preguntas : []).slice(0, 200).map(p => {
    const opciones = (Array.isArray(p.opciones) ? p.opciones : []).slice(0, 4).map(o => String(o || '').trim().slice(0, 300));
    while (opciones.length < 2) opciones.push('');
    let correcta = parseInt(p.correcta, 10);
    if (!(correcta >= 0 && correcta < opciones.length)) correcta = 0;
    let tiempo = parseInt(p.tiempo, 10);
    if (!(tiempo >= 5 && tiempo <= 240)) tiempo = 20;
    const imagen = /^https?:\/\//i.test(String(p.imagen || '')) ? String(p.imagen).slice(0, 1000) : '';
    const r = p.reflexion || {};
    const reflexion = String(r.texto || '').trim() ? { cita: String(r.cita || '').trim().slice(0, 80), texto: String(r.texto).trim().slice(0, 600) } : null;
    return { texto: String(p.texto || '').trim().slice(0, 1000), opciones, correcta, tiempo, imagen, reflexion };
  }).filter(p => p.texto && p.opciones.filter(Boolean).length >= 2);
  const c = body.cierre || {};
  const cierre = String(c.texto || '').trim() ? {
    titulo: String(c.titulo || '').trim().slice(0, 120), texto: String(c.texto).trim().slice(0, 1500),
    cita: String(c.cita || '').trim().slice(0, 120), contacto: c.contacto !== false
  } : null;
  return { titulo, categoria, preguntas, cierre };
}

export function normalizarLugar(l) {
  return String(l || '').replace(/\s+/g, ' ').trim().slice(0, 60);
}
export async function huella(texto) {
  return (await sha256(String(texto).toLowerCase().replace(/[^\p{L}\p{N}]+/gu, ' ').trim())).slice(0, 16);
}

export const MARCAS = {
  chispa: { id: 'chispa', nombre: 'Pulsazo', tema: 'chispa', lema: 'Trivial y bingo musical en vivo para bares y eventos' },
  fe: { id: 'fe', nombre: 'Lumbrera', tema: 'fe', lema: 'Lámpara es a mis pies tu palabra (Salmo 119:105)',
    creditos: 'Texto bíblico: Reina-Valera 1960 © Sociedades Bíblicas en América Latina, 1960. Renovado © Sociedades Bíblicas Unidas, 1988.' }
};
export const marcaDe = env => MARCAS[env && env.MARCA] || MARCAS.chispa;

export const DEMO_FE = {
  titulo: 'Vida de Jesús · Prueba rápida', categoria: 'Vida de Jesús',
  preguntas: [
    { texto: '¿En qué ciudad nació Jesús? (Mateo 2:1)', opciones: ['Nazaret', 'Belén', 'Jerusalén', 'Capernaum'], correcta: 1, tiempo: 20, imagen: '' },
    { texto: '¿Quién bautizó a Jesús en el río Jordán?', opciones: ['Pedro', 'Elías', 'Juan el Bautista', 'Andrés'], correcta: 2, tiempo: 20, imagen: '' },
    { texto: '¿Cuántos apóstoles escogió Jesús?', opciones: ['12', '7', '10', '70'], correcta: 0, tiempo: 15, imagen: '' }
  ]
};

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
