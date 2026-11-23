// Liga semanal de Lumbrera: clasificación global y por grupo, sin cuentas.
// Cada dispositivo guarda un token secreto; el servidor solo conoce su huella (jugador).
import { sha256 } from './comun.js';

export const LIGA_MAX_ENVIO = 2000; // puntos como mucho en un envío (una partida larga de 150 preguntas ronda los 1.700)
export const LIGA_MAX_DIA = 5000;   // tope diario por jugador para frenar trampas
const ZONA = 'Europe/Madrid';

// Semana ISO (lunes a domingo) en hora de España, p. ej. «2026-W48»
export function semanaLiga(ms = Date.now()) {
  const [y, m, d] = new Date(ms).toLocaleDateString('sv-SE', { timeZone: ZONA }).split('-').map(Number);
  const t = new Date(Date.UTC(y, m - 1, d));
  const dia = t.getUTCDay() || 7;
  t.setUTCDate(t.getUTCDate() + 4 - dia);
  const anio = t.getUTCFullYear();
  const n = Math.ceil(((t - Date.UTC(anio, 0, 1)) / 864e5 + 1) / 7);
  return `${anio}-W${String(n).padStart(2, '0')}`;
}
export const diaLiga = (ms = Date.now()) => new Date(ms).toLocaleDateString('sv-SE', { timeZone: ZONA });

export async function jugadorDe(token) {
  const t = String(token || '');
  if (!/^[A-Za-z0-9_-]{24,64}$/.test(t)) return null;
  return (await sha256('liga:' + t)).slice(0, 24);
}

// Palabras que no se aceptan en apodos ni códigos de grupo (se comparan sin tildes y deshaciendo 0→o, 1→i, 3→e, 4→a, 5→s, 7→t)
const PROHIBIDAS = ['puta', 'puto', 'mierda', 'cabron', 'cojon', 'polla', 'joder', 'follar', 'folla', 'zorra', 'marica', 'maricon', 'gilipolla',
  'idiota', 'imbecil', 'subnormal', 'retrasad', 'nazi', 'hitler', 'porno', 'sexo', 'sexy', 'culo', 'tetas', 'verga', 'pinga', 'chingar', 'chinga', 'pendej', 'mamon',
  'hijueputa', 'hdp', 'malparid', 'gonorrea', 'satan', 'diablo', 'fuck', 'shit', 'bitch', 'pussy', 'nigga', 'nigger', 'whore', 'slut', 'cunt', 'suicid'];
function limpioDeTacos(s) {
  const n = s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/0/g, 'o').replace(/1/g, 'i').replace(/3/g, 'e').replace(/4/g, 'a').replace(/5/g, 's').replace(/7/g, 't').replace(/[^a-zñ]/g, '');
  return !PROHIBIDAS.some(p => n.includes(p.normalize('NFD').replace(/[̀-ͯ]/g, '')));
}

// Apodo público: 2–16 caracteres, letras, números, espacios y . _ -
export function apodoValido(a) {
  const s = String(a || '').replace(/\s+/g, ' ').trim();
  if (s.length < 2 || s.length > 16) return { error: 'El apodo debe tener entre 2 y 16 caracteres' };
  if (!/^[\p{L}\p{N} ._-]+$/u.test(s)) return { error: 'Usa solo letras, números y espacios en el apodo' };
  if (!limpioDeTacos(s)) return { error: 'Elige otro apodo, por favor' };
  return { apodo: s };
}
// Código de grupo: 3–20 caracteres en minúsculas, números y guiones (vacío = sin grupo)
export function grupoValido(g) {
  const s = String(g || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').trim().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '').replace(/-+/g, '-').replace(/^-|-$/g, '');
  if (!s) return { grupo: '' };
  if (s.length < 3 || s.length > 20) return { error: 'El código de grupo debe tener entre 3 y 20 letras o números' };
  if (!limpioDeTacos(s)) return { error: 'Elige otro código de grupo, por favor' };
  return { grupo: s };
}

// ---- Divisiones (como las ligas de Duolingo): cada semana compites en un grupo de hasta 30 de tu división ----
// Piedras del pectoral del sumo sacerdote (Éxodo 28) después de los metales
export const DIVISIONES = [
  { nombre: 'Bronce', icono: '🥉' }, { nombre: 'Plata', icono: '🥈' }, { nombre: 'Oro', icono: '🥇' },
  { nombre: 'Zafiro', icono: '🔷' }, { nombre: 'Rubí', icono: '♦️' }, { nombre: 'Esmeralda', icono: '💚' },
  { nombre: 'Amatista', icono: '💜' }, { nombre: 'Perla', icono: '🤍' }, { nombre: 'Ónice', icono: '🖤' }, { nombre: 'Diamante', icono: '💎' },
];
export const TAM_GRUPO = 30;
export const XP_SUBIR_SOLO = 300; // si estás solo en tu grupo, subes si haces al menos ~3 lecciones en la semana

// Cuántos suben y cuántos bajan en un grupo con n participantes (con puntos)
export function zonas(n, division) {
  let suben = n >= 2 ? Math.min(10, Math.ceil(n / 3)) : 0;
  let bajan = n >= 10 ? Math.min(5, Math.floor(n / 6)) : 0;
  if (division >= DIVISIONES.length - 1) suben = 0;
  if (division <= 0) bajan = 0;
  return { suben, bajan };
}
// Resultado de la semana: 'sube' | 'baja' | 'queda'
export function resultadoSemana({ puesto, n, xp, division }) {
  if (!xp) return 'queda';
  const z = zonas(n, division);
  if (n === 1 && division < DIVISIONES.length - 1) return xp >= XP_SUBIR_SOLO ? 'sube' : 'queda';
  if (puesto <= z.suben) return 'sube';
  if (z.bajan && puesto > n - z.bajan) return 'baja';
  return 'queda';
}
