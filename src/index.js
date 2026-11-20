// Chispa en Cloudflare: el Worker sirve la web, la API y reparte cada partida a su Durable Object.
import QRCode from 'qrcode';
import { json, iguales, limpiarCuestionario } from './comun.js';
export { Juego } from './juego.js';
export { Almacen } from './almacen.js';

const almacen = env => env.ALMACEN.get(env.ALMACEN.idFromName('principal'));
const juego = (env, pin) => env.JUEGO.get(env.JUEGO.idFromName(pin));

async function autorizado(req, env) {
  const clave = req.headers.get('x-chispa-clave') || '';
  if (!clave) return false;
  if (env.ADMIN_PASSWORD) return iguales(clave, env.ADMIN_PASSWORD);
  return almacen(env).comprobarClave(clave);
}

export default {
  async fetch(req, env) {
    const url = new URL(req.url);
    const ruta = url.pathname;
    try {
      if (ruta === '/ws') {
        const pin = url.searchParams.get('pin') || '';
        if (!/^\d{6}$/.test(pin)) return new Response('PIN no válido', { status: 400 });
        return juego(env, pin).fetch(req);
      }
      if (ruta.startsWith('/api/')) return await api(req, env, url, ruta.slice(5));
      return env.ASSETS.fetch(req);
    } catch (e) {
      console.error(e);
      return json({ error: 'Error del servidor' }, 500);
    }
  }
};

async function api(req, env, url, ruta) {
  const m = req.method;
  const cuerpo = async () => { try { return await req.json(); } catch { return {}; } };
  const st = almacen(env);

  // --- Acceso del presentador ---
  if (ruta === 'login' && m === 'POST') {
    const { clave } = await cuerpo();
    const ia = !!env.ANTHROPIC_API_KEY;
    if (!env.ADMIN_PASSWORD && !(await st.hayClave())) return json({ configurar: true });
    const ok = env.ADMIN_PASSWORD ? iguales(clave, env.ADMIN_PASSWORD) : await st.comprobarClave(clave);
    return ok ? json({ ok: true, ia }) : json({ error: 'Contraseña incorrecta' }, 401);
  }
  if (ruta === 'configurar' && m === 'POST') {
    const { clave } = await cuerpo();
    if (env.ADMIN_PASSWORD) return json({ error: 'La contraseña ya está configurada' }, 400);
    if (!clave || String(clave).length < 6) return json({ error: 'Usa al menos 6 caracteres' }, 400);
    return (await st.ponerClave(String(clave))) ? json({ ok: true, ia: !!env.ANTHROPIC_API_KEY }) : json({ error: 'La contraseña ya está configurada' }, 400);
  }

  // --- Jugadores (sin contraseña) ---
  let r;
  if ((r = ruta.match(/^partidas\/(\d{6})$/)) && m === 'GET') {
    const info = await juego(env, r[1]).info();
    return info ? json(info) : json({ error: 'No hay ninguna partida con ese PIN' }, 404);
  }
  if (ruta === 'qr' && m === 'GET') {
    const t = String(url.searchParams.get('t') || '').slice(0, 500);
    if (!/^https?:\/\//.test(t)) return new Response('', { status: 400 });
    const svg = await QRCode.toString(t, { type: 'svg', margin: 1, color: { dark: '#0F1B2D', light: '#FFFFFF' } });
    return new Response(svg, { headers: { 'content-type': 'image/svg+xml', 'cache-control': 'public, max-age=3600' } });
  }
  if ((r = ruta.match(/^informes\/(\d{6})\.csv$/)) && m === 'GET') return informeCsv(env, r[1], url.searchParams.get('k'));

  // --- A partir de aquí, solo presentador ---
  if (!(await autorizado(req, env))) return json({ error: 'Contraseña de presentador incorrecta' }, 401);

  if (ruta === 'cuestionarios' && m === 'GET')
    return json((await st.listar()).map(q => ({ id: q.id, titulo: q.titulo, n: q.preguntas.length, actualizado: q.actualizado })));
  if (ruta === 'cuestionarios' && m === 'POST') return json(await st.guardar(limpiarCuestionario(await cuerpo())));
  if ((r = ruta.match(/^cuestionarios\/([a-f0-9]+)$/))) {
    const id = r[1];
    if (m === 'GET') { const q = await st.leer(id); return q ? json(q) : json({ error: 'No existe' }, 404); }
    if (m === 'PUT') { const q = await st.guardar({ id, ...limpiarCuestionario(await cuerpo()) }); return q ? json(q) : json({ error: 'No existe' }, 404); }
    if (m === 'DELETE') { await st.borrar(id); return json({ ok: true }); }
  }
  if ((r = ruta.match(/^cuestionarios\/([a-f0-9]+)\/duplicar$/)) && m === 'POST') {
    const q = await st.leer(r[1]); if (!q) return json({ error: 'No existe' }, 404);
    return json(await st.guardar({ titulo: q.titulo + ' (copia)', preguntas: q.preguntas }));
  }
  if (ruta === 'partidas' && m === 'POST') {
    const { cuestionarioId } = await cuerpo();
    const quiz = await st.leer(String(cuestionarioId || ''));
    if (!quiz || !quiz.preguntas.length) return json({ error: 'Ese cuestionario no tiene preguntas' }, 400);
    for (let i = 0; i < 8; i++) {
      const pin = String(100000 + (crypto.getRandomValues(new Uint32Array(1))[0] % 900000));
      const res = await juego(env, pin).crear(pin, { titulo: quiz.titulo, preguntas: quiz.preguntas });
      if (!res.ocupado) return json(res);
    }
    return json({ error: 'No se ha podido crear la partida, prueba otra vez' }, 503);
  }
  if (ruta === 'ia/generar' && m === 'POST') return generarIA(env, st, await cuerpo());
  return json({ error: 'No encontrado' }, 404);
}

async function informeCsv(env, pin, k) {
  const inf = await almacen(env).leerInforme(pin);
  if (!inf) return new Response('Informe no encontrado', { status: 404 });
  if (!iguales(k, inf.claveHost)) return new Response('Sin permiso', { status: 401 });
  const esc = v => '"' + String(v ?? '').replace(/"/g, '""') + '"';
  const cab = ['Puesto', 'Apodo', 'Puntos', 'Aciertos', ...inf.preguntas.map((_, i) => `P${i + 1}`)];
  const filas = inf.jugadores.map(j => [j.puesto, j.apodo, j.puntos, j.aciertos,
    ...inf.preguntas.map((_, i) => { const x = j.respuestas[i]; return x == null ? 'sin responder' : (x.ok ? 'bien' : 'mal') + ` (${(x.ms / 1000).toFixed(1)}s)`; })]);
  filas.push([]);
  inf.preguntas.forEach((p, i) => filas.push([`P${i + 1}`, p.texto, `${p.porcentaje}% acierto`]));
  const csv = '﻿' + [cab, ...filas].map(f => f.map(esc).join(';')).join('\r\n');
  return new Response(csv, { headers: { 'content-type': 'text/csv; charset=utf-8', 'content-disposition': `attachment; filename="chispa-informe-${pin}.csv"` } });
}

async function generarIA(env, st, body) {
  if (!env.ANTHROPIC_API_KEY) return json({ error: 'La IA no está activada. Añade el secreto ANTHROPIC_API_KEY en Cloudflare.' }, 503);
  const tema = String(body.tema || '').trim().slice(0, 8000);
  const n = Math.min(Math.max(parseInt(body.n, 10) || 8, 3), 20);
  const nivel = String(body.nivel || 'general').slice(0, 60);
  if (!tema) return json({ error: 'Escribe un tema o pega un texto.' }, 400);
  if (!(await st.usoIA(parseInt(env.AI_DAILY_LIMIT || '50', 10)))) return json({ error: 'Se ha alcanzado el tope diario de IA.' }, 429);
  const prompt = `Crea un cuestionario de ${n} preguntas de opción múltiple en español sobre el siguiente tema o texto. Nivel: ${nivel}.
Cada pregunta tiene exactamente 4 opciones, una sola correcta, y respuestas incorrectas creíbles. Varía la posición de la correcta.
Responde SOLO con JSON válido, sin texto extra, con esta forma:
{"titulo":"...","preguntas":[{"texto":"...","opciones":["a","b","c","d"],"correcta":0,"tiempo":20}]}

TEMA O TEXTO:
${tema}`;
  try {
    const r = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-api-key': env.ANTHROPIC_API_KEY, 'anthropic-version': '2023-06-01' },
      body: JSON.stringify({ model: env.ANTHROPIC_MODEL || 'claude-sonnet-5-5', max_tokens: 4000, messages: [{ role: 'user', content: prompt }] })
    });
    const data = await r.json();
    if (!r.ok) throw new Error((data.error && data.error.message) || 'Error de la IA');
    const texto = (data.content || []).map(c => c.text || '').join('');
    return json(limpiarCuestionario(JSON.parse(texto.slice(texto.indexOf('{'), texto.lastIndexOf('}') + 1))));
  } catch (e) {
    console.error('IA', e.message);
    return json({ error: 'La IA no ha podido crear el cuestionario. Prueba otra vez.' }, 502);
  }
}
