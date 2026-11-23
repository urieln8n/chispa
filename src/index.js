// Chispa en Cloudflare: el Worker sirve la web, la API y reparte cada partida a su Durable Object.
import QRCode from 'qrcode';
import { json, iguales, limpiarCuestionario, normalizarLugar, huella, marcaDe } from './comun.js';
import { semanaLiga, diaLiga, jugadorDe, apodoValido, grupoValido, LIGA_MAX_ENVIO } from './liga.js';
import { endpointValido, horaValida, zonaValida } from './push.js';
const CONTACTO_PUSH = 'https://genesis.andresrendon.com/privacidad'; // contacto VAPID (la página de privacidad tiene el email)
export { Juego } from './juego.js';
export { Almacen } from './almacen.js';

// Resumen para asistentes de IA (ChatGPT, Perplexity, Claude…) de la web de Lumbrera
const LLMS_LUMBRERA = `# Lumbrera · Aprende Génesis y Éxodo

> App gratuita para aprender la Biblia (Génesis y Éxodo, 150 preguntas de cada libro) con lecciones cortas, repaso de fallos, racha, liga semanal y partidas en grupo con PIN. Sin registro. Se puede instalar como app y funciona sin conexión.

## Qué incluye
- 150 preguntas de Génesis (50 capítulos) y 150 de Éxodo (40 capítulos), cada libro en 5 unidades y 15 lecciones de 10 preguntas.
- Tipos de pregunta: elegir respuesta, verdadero o falso, completar versículos, ordenar hechos y emparejar personajes.
- Cada respuesta muestra la cita bíblica y una explicación breve. Citas de la Reina-Valera 1960.
- Puntos, racha diaria, meta diaria, logros y repaso de las preguntas falladas. El progreso se guarda en el propio dispositivo.

## Unidades de Génesis
1. La creación y la caída (Génesis 1–5)
2. Noé y la torre de Babel (Génesis 6–11)
3. Abraham, el amigo de Dios (Génesis 12–24)
4. Isaac, Esaú y Jacob (Génesis 25–36)
5. José en Egipto (Génesis 37–50)

## Unidades de Éxodo
1. Esclavitud y el llamado de Moisés (Éxodo 1–6)
2. Las plagas y la Pascua (Éxodo 7–13)
3. El mar Rojo y el desierto (Éxodo 14–18)
4. El Sinaí y los Diez Mandamientos (Éxodo 19–24)
5. El tabernáculo y el becerro de oro (Éxodo 25–40)

## Jugar en grupo
Se elige el libro, de 10 a 150 preguntas y de 10 a 60 segundos por pregunta. La pantalla muestra un PIN y cada persona juega desde su móvil en {{ORIGEN}}/jugar, sin contraseña.

## Enlaces
- Aprender: {{ORIGEN}}/
- Entrar en una partida con PIN: {{ORIGEN}}/jugar
- Autor: Andrés Rendón, https://www.andresrendon.com/
`;

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
      if (ruta === '/robots.txt') return new Response(`User-agent: *\nAllow: /\nDisallow: /panel\nDisallow: /estadisticas\nDisallow: /editor\nDisallow: /presentar\nDisallow: /bingo-\nDisallow: /api/\nSitemap: ${url.origin}/sitemap.xml\n`, { headers: { 'content-type': 'text/plain; charset=utf-8' } });
      if (ruta === '/llms.txt' && env.MARCA === 'fe') return new Response(LLMS_LUMBRERA.replaceAll('{{ORIGEN}}', url.origin), { headers: { 'content-type': 'text/plain; charset=utf-8', 'cache-control': 'public, max-age=3600' } });
      if (ruta === '/sitemap.xml') {
        const urls = env.MARCA === 'fe' ? ['/', '/grupos', '/jugar', '/privacidad'] : ['/', '/privacidad'];
        return new Response(`<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${urls.map(u => `<url><loc>${url.origin}${u}</loc></url>`).join('')}</urlset>`, { headers: { 'content-type': 'application/xml; charset=utf-8' } });
      }
      // Lumbrera aún no tiene web de presentación: su portada es la página para jugar
      if (env.MARCA === 'fe' && (ruta === '/' || ruta === '/index.html')) {
        // Lumbrera: la portada es «Aprender»; los enlaces con ?pin= siguen llevando a la partida
        if (url.searchParams.get('pin')) return Response.redirect(url.origin + '/jugar' + url.search, 302);
        return env.ASSETS.fetch(new Request(new URL('/aprender', url), req));
      }
      if (env.MARCA !== 'fe' && (ruta === '/aprender' || ruta === '/aprender.html' || ruta === '/grupos' || ruta === '/grupos.html')) return Response.redirect(url.origin + '/', 302);
      if (env.MARCA !== 'fe' && (ruta === '/privacidad-lumbrera' || ruta === '/privacidad-lumbrera.html')) return Response.redirect(url.origin + '/privacidad', 302);
      // Lumbrera: la página para entrar con PIN es compartida con Pulsazo; aquí se le pone el título y la vista previa de Lumbrera (WhatsApp lee el HTML, no el JavaScript)
      if (env.MARCA === 'fe' && (ruta === '/jugar' || ruta === '/jugar.html')) {
        const res = await env.ASSETS.fetch(req);
        if (!(res.headers.get('content-type') || '').includes('text/html')) return res;
        const pin = /^\d{6}$/.test(url.searchParams.get('pin') || '') ? url.searchParams.get('pin') : '';
        const desc = pin ? `Entra con el PIN ${pin.slice(0, 3)} ${pin.slice(3)} y juega desde tu móvil. Sin instalar nada y sin registrarte.` : 'Escribe el PIN de la partida y juega desde tu móvil. Sin instalar nada y sin registrarte.';
        const at = t => t.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');
        const metas = `<meta name="description" content="${at(desc)}"><meta property="og:type" content="website"><meta property="og:site_name" content="Lumbrera">` +
          `<meta property="og:title" content="🎮 Entra a jugar en Lumbrera"><meta property="og:description" content="${at(desc)}">` +
          `<meta property="og:url" content="${at(url.origin + '/jugar' + (pin ? '?pin=' + pin : ''))}"><meta property="og:image" content="${at(url.origin)}/app/icono-512.png"><meta name="twitter:card" content="summary">` +
          `<link rel="icon" href="/app/icono-192.png" type="image/png">`;
        return new HTMLRewriter()
          .on('title', { element(e) { e.setInnerContent('Lumbrera · Entra a jugar'); } })
          .on('meta[name="theme-color"]', { element(e) { e.setAttribute('content', '#1B1640'); } })
          .on('head', { element(e) { e.append(metas, { html: true }); } })
          .transform(res);
      }
      // Lumbrera tiene su propia política de privacidad en la misma dirección /privacidad
      const res = env.MARCA === 'fe' && (ruta === '/privacidad' || ruta === '/privacidad.html')
        ? await env.ASSETS.fetch(new Request(new URL('/privacidad-lumbrera', url), req))
        : await env.ASSETS.fetch(req);
      // En la portada, fija la dirección canónica y las imágenes de redes con el dominio real (sirve igual con workers.dev o con tu dominio)
      if ((ruta === '/' || ruta === '/privacidad') && (res.headers.get('content-type') || '').includes('text/html')) {
        return new HTMLRewriter()
          .on('link[rel="canonical"]', { element(e) { e.setAttribute('href', url.origin + ruta); } })
          .on('meta[property="og:url"]', { element(e) { e.setAttribute('content', url.origin + ruta); } })
          .on('meta[property="og:image"]', { element(e) { e.setAttribute('content', url.origin + '/og.png'); } })
          .on('script#jsonld', { text(t) { if (t.text) t.replace(t.text.replaceAll('{{ORIGEN}}', url.origin)); } })
          .transform(res);
      }
      return res;
    } catch (e) {
      console.error(e);
      return json({ error: 'Error del servidor' }, 500);
    }
  },
  // Cada hora (solo Lumbrera): recordatorios push a quien aún no ha hecho su lección hoy
  async scheduled(ev, env, ctx) {
    if (env.MARCA !== 'fe') return;
    ctx.waitUntil(almacen(env).pushEnviar({ contacto: CONTACTO_PUSH }).then(r => console.log('push', JSON.stringify(r))));
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

  // --- Públicas ---
  if (ruta === 'marca' && m === 'GET') return json(marcaDe(env), 200, { 'cache-control': 'public, max-age=300' });
  // Lumbrera: cualquiera puede montar una partida en grupo de un libro (Génesis, Éxodo…) eligiendo cuántas preguntas (sin contraseña)
  if (ruta === 'libro/partida' && m === 'POST') {
    if (env.MARCA !== 'fe') return json({ error: 'No disponible' }, 404);
    const b = await cuerpo();
    const n = Math.max(5, Math.min(150, parseInt(b.n, 10) || 10));
    const tiempo = Math.max(5, Math.min(120, parseInt(b.tiempo, 10) || 0)) || null; // segundos por pregunta que elige el grupo
    const cat = await env.ASSETS.fetch(new Request(new URL('/biblia/libros.json', url))).then(r => r.json());
    const lid = cat.libros.some(x => x.id === b.libro && x.preguntas) ? b.libro : 'genesis';
    const L = await env.ASSETS.fetch(new Request(new URL(`/biblia/${lid}.json`, url))).then(r => r.json());
    const todas = []; L.unidades.forEach(u => u.lecciones.forEach(l => l.preguntas.forEach(q => todas.push(q))));
    const quiz = limpiarCuestionario({ titulo: `${L.nombre} · ${n} preguntas`, preguntas: barajar(todas).slice(0, n).map(preguntaEnVivo).map(p => tiempo ? { ...p, tiempo } : p) });
    for (let i = 0; i < 8; i++) {
      const pin = String(100000 + (crypto.getRandomValues(new Uint32Array(1))[0] % 900000));
      const res = await juego(env, pin).crear(pin, { titulo: quiz.titulo, preguntas: quiz.preguntas, cierre: null });
      if (!res.ocupado) { const d = diaLiga(); try { await st.metricaSumar([[d, 'grupo_partidas', 1], ['S:' + semanaLiga(), 'grupo_partidas', 1], ['M:' + d.slice(0, 7), 'grupo_partidas', 1]]); } catch {} return json({ ...res, n: quiz.preguntas.length }); }
    }
    return json({ error: 'No se ha podido crear la partida, prueba otra vez' }, 503);
  }
  // Lumbrera: liga semanal (sin cuentas; cada móvil manda su token secreto)
  if (ruta === 'liga/puntos' && m === 'POST') {
    if (env.MARCA !== 'fe') return json({ error: 'No disponible' }, 404);
    const b = await cuerpo();
    const jugador = await jugadorDe(b.token);
    if (!jugador) return json({ error: 'Falta tu clave de la liga' }, 400);
    const a = apodoValido(b.apodo); if (a.error) return json(a, 400);
    const g = grupoValido(b.grupo); if (g.error) return json(g, 400);
    const xp = Math.max(0, Math.min(LIGA_MAX_ENVIO, parseInt(b.xp, 10) || 0));
    const semana = semanaLiga();
    const caducado = !!(b.semana && b.semana !== semana); // puntos de una semana ya cerrada: no cuentan, pero el perfil sí se guarda
    const r = await st.ligaSumar({ semana, dia: diaLiga(), jugador, apodo: a.apodo, grupo: g.grupo, xp: caducado ? 0 : xp });
    return json({ semana, apodo: a.apodo, grupo: g.grupo, caducado, ...r });
  }
  // Lumbrera: contadores anónimos de uso (sin identificadores ni datos personales)
  if (ruta === 'm' && m === 'POST') {
    if (env.MARCA !== 'fe') return json({ ok: true });
    const b = await cuerpo(), dia = diaLiga(), sem = 'S:' + semanaLiga(), mes = 'M:' + dia.slice(0, 7), pares = [];
    const sumar = (clave, enSemana = false, enMes = false) => { pares.push([dia, clave, 1]); if (enSemana) pares.push([sem, clave, 1]); if (enMes) pares.push([mes, clave, 1]); };
    if (b.e === 'activo') {
      sumar('activos');
      if (b.semana === true) pares.push([sem, 'activos', 1]);
      if (b.mes === true) pares.push([mes, 'activos', 1]);
      if (b.nuevo === true) { sumar('nuevos', true, true); pares.push(['total', 'nuevos', 1]); }
      if (b.racha === true) sumar('en_racha');
      if (b.app === true) sumar('desde_app');
    } else if (b.e === 'leccion') {
      const modo = ['leccion', 'repaso', 'libre'].includes(b.modo) ? b.modo : 'leccion';
      sumar(modo === 'leccion' ? 'lecciones' : modo === 'repaso' ? 'repasos' : 'partidas_libres', true, true);
      if (b.perfecta === true && modo === 'leccion') sumar('perfectas', true, true);
    } else if (b.e === 'compartir') sumar('compartidos', true, true);
    else return json({ error: 'Evento desconocido' }, 400);
    await st.metricaSumar(pares);
    return json({ ok: true });
  }
  // Lumbrera: notificaciones push (recordatorio diario)
  if (ruta.startsWith('push/')) {
    if (env.MARCA !== 'fe') return json({ error: 'No disponible' }, 404);
    if (ruta === 'push/clave' && m === 'GET') return json({ clave: await st.pushClavePublica() }, 200, { 'cache-control': 'no-store' });
    const b = m === 'POST' ? await cuerpo() : {};
    const local = env.PUSH_PERMITIR_LOCAL === '1';
    if (!endpointValido(b.endpoint, local)) return json({ error: 'Suscripción no válida' }, 400);
    if (ruta === 'push/suscribir' && m === 'POST') return json({ ok: true, ...(await st.pushGuardar({ endpoint: b.endpoint, hora: horaValida(b.hora), zona: zonaValida(b.zona), dia: /^\d{4}-\d{2}-\d{2}$/.test(b.dia || '') ? b.dia : '' })) });
    if (ruta === 'push/hecho' && m === 'POST') { if (/^\d{4}-\d{2}-\d{2}$/.test(b.dia || '')) await st.pushHecho(b.endpoint, b.dia); return json({ ok: true }); }
    if (ruta === 'push/borrar' && m === 'POST') { await st.pushBorrar(b.endpoint); return json({ ok: true }); }
    if (ruta === 'push/probar' && m === 'POST') return json(await st.pushEnviar({ contacto: CONTACTO_PUSH, soloEndpoint: b.endpoint }));
    return json({ error: 'No encontrado' }, 404);
  }
  if (ruta === 'liga/salir' && m === 'POST') {
    if (env.MARCA !== 'fe') return json({ error: 'No disponible' }, 404);
    const jugador = await jugadorDe((await cuerpo()).token);
    if (!jugador) return json({ error: 'Falta tu clave de la liga' }, 400);
    await st.ligaBorrar(jugador);
    return json({ ok: true });
  }
  if (ruta === 'liga' && m === 'GET') {
    if (env.MARCA !== 'fe') return json({ error: 'No disponible' }, 404);
    const g = grupoValido(url.searchParams.get('grupo')); if (g.error) return json(g, 400);
    const jugador = await jugadorDe(url.searchParams.get('token'));
    return json(await st.ligaClasificacion({ semana: semanaLiga(), jugador, grupo: g.grupo }), 200, { 'cache-control': 'no-store' });
  }
  if (ruta === 'contactos' && m === 'POST') {
    const b = await cuerpo();
    const pin = String(b.pin || '');
    if (!/^\d{6}$/.test(pin) || !(await juego(env, pin).info())) return json({ error: 'La actividad ya no está abierta' }, 400);
    if (b.consentimiento !== true) return json({ error: 'Necesitamos tu permiso para guardar estos datos' }, 400);
    const tipo = b.tipo === 'oracion' ? 'oracion' : 'saber-mas';
    const contacto = String(b.contacto || '').trim().slice(0, 120);
    if (tipo === 'saber-mas' && !contacto) return json({ error: 'Déjanos un teléfono o un email para poder contactarte' }, 400);
    const ok = await st.guardarContacto({ tipo, pin, actividad: String(b.actividad || '').slice(0, 200),
      nombre: String(b.nombre || '').trim().slice(0, 80), contacto, mensaje: String(b.mensaje || '').trim().slice(0, 1000) });
    return ok ? json({ ok: true }) : json({ error: 'No se ha podido guardar ahora mismo' }, 503);
  }

  if (ruta === 'solicitud' && m === 'POST') {
    const b = await cuerpo();
    if (b.web) return json({ ok: true }); // campo trampa para bots
    if (b.consentimiento !== true) return json({ error: 'Marca la casilla para darnos permiso para contactarte' }, 400);
    const contacto = String(b.contacto || '').trim().slice(0, 120), nombre = String(b.nombre || '').trim().slice(0, 80);
    if (!nombre || !contacto) return json({ error: 'Escribe tu nombre y un teléfono o email' }, 400);
    const ok = await st.guardarContacto({ tipo: 'solicitud', nombre, contacto, negocio: String(b.negocio || '').trim().slice(0, 120),
      evento: String(b.evento || '').trim().slice(0, 60), mensaje: String(b.mensaje || '').trim().slice(0, 1000), actividad: 'Web' + (b.negocio ? ' · ' + String(b.negocio).slice(0, 80) : '') });
    return ok ? json({ ok: true }) : json({ error: 'No se ha podido enviar ahora mismo. Prueba en un rato.' }, 503);
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

  if (ruta === 'metricas' && m === 'GET') {
    const desde = diaLiga(Date.now() - 34 * 864e5);
    return json({ hoy: diaLiga(), semana: semanaLiga(), ...(await st.metricas({ desdeDia: desde, semana: semanaLiga() })) }, 200, { 'cache-control': 'no-store' });
  }
  if (ruta === 'cuestionarios' && m === 'GET')
    return json((await st.listar()).map(q => ({ id: q.id, titulo: q.titulo, categoria: q.categoria || '', tipo: q.tipo || 'trivial',
      n: q.tipo === 'bingo' ? q.canciones.length : q.preguntas.length, actualizado: q.actualizado })));
  if (ruta === 'cuestionarios' && m === 'POST') return json(await st.guardar(limpiarCuestionario(await cuerpo())));
  if ((r = ruta.match(/^cuestionarios\/([a-f0-9]+)$/))) {
    const id = r[1];
    if (m === 'GET') { const q = await st.leer(id); return q ? json(q) : json({ error: 'No existe' }, 404); }
    if (m === 'PUT') { const q = await st.guardar({ id, ...limpiarCuestionario(await cuerpo()) }); return q ? json(q) : json({ error: 'No existe' }, 404); }
    if (m === 'DELETE') { await st.borrar(id); return json({ ok: true }); }
  }
  if ((r = ruta.match(/^cuestionarios\/([a-f0-9]+)\/duplicar$/)) && m === 'POST') {
    const q = await st.leer(r[1]); if (!q) return json({ error: 'No existe' }, 404);
    return json(await st.guardar(limpiarCuestionario({ ...q, id: undefined, titulo: q.titulo + ' (copia)' })));
  }

  // --- Biblioteca: exportar / importar ---
  if (ruta === 'exportar' && m === 'GET') {
    const id = url.searchParams.get('id');
    let lista = await st.listar();
    if (id) lista = lista.filter(q => q.id === id);
    const datos = { app: 'chispa', version: 1, exportado: new Date().toISOString(),
      cuestionarios: lista.map(q => q.tipo === 'bingo' ? { tipo: 'bingo', titulo: q.titulo, categoria: q.categoria || '', canciones: q.canciones } : { titulo: q.titulo, categoria: q.categoria || '', preguntas: q.preguntas, cierre: q.cierre || null }) };
    const nombre = id && lista[0] ? 'chispa-' + lista[0].titulo.toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 40) : 'chispa-biblioteca';
    return new Response(JSON.stringify(datos, null, 2), { headers: { 'content-type': 'application/json; charset=utf-8', 'content-disposition': `attachment; filename="${nombre}.json"` } });
  }
  if (ruta === 'importar' && m === 'POST') {
    const b = await cuerpo();
    const lista = Array.isArray(b) ? b : Array.isArray(b.cuestionarios) ? b.cuestionarios : (b.preguntas ? [b] : []);
    if (!lista.length) return json({ error: 'El archivo no tiene cuestionarios de Chispa' }, 400);
    const existentes = new Set((await st.listar()).map(q => q.titulo));
    let creados = 0, saltados = 0;
    for (const q of lista.slice(0, 300)) {
      const limpio = limpiarCuestionario(q);
      if (limpio.tipo === 'bingo' ? !limpio.canciones.length : !limpio.preguntas.length) { saltados++; continue; }
      if (b.saltarRepetidos && existentes.has(limpio.titulo)) { saltados++; continue; }
      await st.guardar(limpio); creados++;
    }
    return json({ creados, saltados });
  }

  // --- Contactos recibidos ---
  if (ruta === 'contactos' && m === 'GET') return json(await st.contactos());
  if (ruta === 'contactos/borrar-todo' && m === 'POST') { await st.borrarContactos(); return json({ ok: true }); }
  if ((r = ruta.match(/^contactos\/([a-f0-9]+)$/)) && m === 'DELETE') { await st.borrarContacto(r[1]); return json({ ok: true }); }

  // --- Lugares (para no repetir preguntas en el mismo bar) ---
  if (ruta === 'lugares' && m === 'GET') return json(await st.lugares());
  if (ruta === 'lugares/reiniciar' && m === 'POST') {
    const lugar = normalizarLugar((await cuerpo()).lugar);
    if (lugar) await st.reiniciarLugar(lugar);
    return json({ ok: true });
  }

  // --- Montar una noche mezclando rondas ---
  if (ruta === 'mezclar' && m === 'POST') {
    const b = await cuerpo();
    const lugar = normalizarLugar(b.lugar);
    const usadas = lugar && b.evitarUsadas !== false ? await st.usadas(lugar) : new Set();
    const fuentes = (Array.isArray(b.fuentes) ? b.fuentes : []).slice(0, 50);
    const elegidas = [], vistas = new Set();
    let evitadas = 0, faltan = 0;
    for (const f of fuentes) {
      const q = await st.leer(String(f.id || '')); if (!q || q.tipo === 'bingo') continue;
      const pedidas = Math.max(0, parseInt(f.n, 10) || 0); if (!pedidas) continue;
      const candidatas = [];
      for (const p of q.preguntas) {
        const h = await huella(p.texto);
        if (vistas.has(h)) continue;
        if (usadas.has(h)) { evitadas++; continue; }
        candidatas.push({ p, h });
      }
      barajar(candidatas);
      const tomar = candidatas.slice(0, pedidas);
      faltan += pedidas - tomar.length;
      tomar.forEach(x => { vistas.add(x.h); elegidas.push(x.p); });
    }
    if (!elegidas.length) return json({ error: evitadas ? 'Todas esas preguntas ya se usaron en ' + lugar + '. Elige otras rondas o reinicia ese lugar.' : 'Elige al menos una ronda y cuántas preguntas quieres' }, 400);
    if (b.barajar) barajar(elegidas);
    const fecha = new Date().toLocaleDateString('es-ES', { day: 'numeric', month: 'short' });
    const titulo = String(b.titulo || '').trim() || `Noche${lugar ? ' en ' + lugar : ''} · ${fecha}`;
    const quiz = await st.guardar(limpiarCuestionario({ titulo, categoria: 'Noches', preguntas: elegidas }));
    return json({ quiz: { id: quiz.id, titulo: quiz.titulo, n: quiz.preguntas.length }, evitadas, faltan });
  }
  if (ruta === 'partidas' && m === 'POST') {
    const { cuestionarioId, lugar: lugarBruto, opciones } = await cuerpo();
    const quiz = await st.leer(String(cuestionarioId || ''));
    if (quiz && quiz.tipo === 'bingo') {
      for (let i = 0; i < 8; i++) {
        const pin = String(100000 + (crypto.getRandomValues(new Uint32Array(1))[0] % 900000));
        const res = await juego(env, pin).crearBingo(pin, { titulo: quiz.titulo, canciones: quiz.canciones }, opciones || {});
        if (res.error) return json(res, 400);
        if (!res.ocupado) return json(res);
      }
      return json({ error: 'No se ha podido crear la partida, prueba otra vez' }, 503);
    }
    if (!quiz || !quiz.preguntas.length) return json({ error: 'Ese cuestionario no tiene preguntas' }, 400);
    const lugar = normalizarLugar(lugarBruto);
    if (lugar) await st.marcarUsadas(lugar, quiz.preguntas.map(p => p.texto));
    for (let i = 0; i < 8; i++) {
      const pin = String(100000 + (crypto.getRandomValues(new Uint32Array(1))[0] % 900000));
      const res = await juego(env, pin).crear(pin, { titulo: quiz.titulo, preguntas: quiz.preguntas, cierre: quiz.cierre || null });
      if (!res.ocupado) return json(res);
    }
    return json({ error: 'No se ha podido crear la partida, prueba otra vez' }, 503);
  }
  if (ruta === 'ia/generar' && m === 'POST') return generarIA(env, st, await cuerpo());
  if (ruta === 'ia/canciones' && m === 'POST') return generarCanciones(env, st, await cuerpo());
  return json({ error: 'No encontrado' }, 404);
}

// Convierte una pregunta de «Aprender» al formato del juego en vivo (4 opciones o verdadero/falso)
function preguntaEnVivo(q) {
  const ref = q.ref ? ` (${q.ref})` : '';
  const reflexion = q.exp ? { cita: q.ref || '', texto: q.exp } : null;
  const conOpciones = (texto, buena, malas, tiempo) => { const ops = barajar([buena, ...malas]); return { texto, opciones: ops, correcta: ops.indexOf(buena), tiempo, reflexion }; };
  if (q.t === 'vf') return { texto: `Verdadero o falso: ${q.q}${ref}`, opciones: ['Verdadero', 'Falso'], correcta: q.v ? 0 : 1, tiempo: 15, reflexion };
  if (q.t === 'ordenar') return conOpciones(`¿Qué ocurrió primero?${ref}`, q.orden[0], q.orden.slice(1), 25);
  if (q.t === 'emparejar') {
    const [a, b] = q.pares[Math.floor(Math.random() * q.pares.length)];
    return conOpciones(`¿Qué corresponde a «${a}»?${ref}`, b, q.pares.filter(p => p[1] !== b).map(p => p[1]), 20);
  }
  return conOpciones(`${String(q.q).replace('___', '_____')}${ref}`, q.ok, q.malas, 20);
}

function barajar(a) {
  for (let i = a.length - 1; i > 0; i--) { const j = crypto.getRandomValues(new Uint32Array(1))[0] % (i + 1); [a[i], a[j]] = [a[j], a[i]]; }
  return a;
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

async function llamarIA(env, prompt) {
  const r = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-api-key': env.ANTHROPIC_API_KEY, 'anthropic-version': '2023-06-01' },
    body: JSON.stringify({ model: env.ANTHROPIC_MODEL || 'claude-sonnet-5-5', max_tokens: 4000, messages: [{ role: 'user', content: prompt }] })
  });
  const data = await r.json();
  if (!r.ok) throw new Error((data.error && data.error.message) || 'Error de la IA');
  const texto = (data.content || []).map(c => c.text || '').join('');
  return JSON.parse(texto.slice(texto.indexOf('{'), texto.lastIndexOf('}') + 1));
}

async function generarCanciones(env, st, body) {
  if (!env.ANTHROPIC_API_KEY) return json({ error: 'La IA no está activada. Añade el secreto ANTHROPIC_API_KEY en Cloudflare.' }, 503);
  const tema = String(body.tema || '').trim().slice(0, 2000);
  const n = Math.min(Math.max(parseInt(body.n, 10) || 40, 20), 80);
  if (!tema) return json({ error: 'Escribe un tema para la lista.' }, 400);
  if (!(await st.usoIA(parseInt(env.AI_DAILY_LIMIT || '50', 10)))) return json({ error: 'Se ha alcanzado el tope diario de IA.' }, 429);
  try {
    const j = await llamarIA(env, `Crea una lista de ${n} canciones REALES y muy conocidas para un bingo musical en un bar de España sobre este tema: ${tema}.
Usa el título original exacto y el artista o grupo más conocido de cada una. Sin repetir canciones. Si no estás seguro de que una canción exista, no la pongas.
Responde SOLO con JSON válido: {"titulo":"...","canciones":[{"titulo":"...","artista":"..."}]}`);
    return json(limpiarCuestionario({ tipo: 'bingo', titulo: j.titulo || tema, canciones: j.canciones }));
  } catch (e) {
    console.error('IA canciones', e.message);
    return json({ error: 'La IA no ha podido crear la lista. Prueba otra vez.' }, 502);
  }
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
