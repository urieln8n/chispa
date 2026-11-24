// Almacén permanente: cuestionarios, contraseña del presentador e informes de partidas
import { DurableObject } from 'cloudflare:workers';
import { idCorto, sha256, DEMO, DEMO_FE, huella } from './comun.js';
import { LIGA_MAX_DIA, DIVISIONES, TAM_GRUPO, zonas, resultadoSemana } from './liga.js';
import { generarClavesVapid, cabeceraVapid } from './push.js';

export class Almacen extends DurableObject {
  async init() {
    if (this.listo) return;
    const ids = await this.ctx.storage.get('indice');
    if (!ids) {
      const id = idCorto();
      await this.ctx.storage.put('q:' + id, { id, ...(this.env.MARCA === 'fe' ? DEMO_FE : DEMO), actualizado: Date.now() });
      await this.ctx.storage.put('indice', [id]);
    }
    this.listo = true;
  }

  // ---- Contraseña del presentador ----
  async hayClave() { return !!(await this.ctx.storage.get('clave')); }
  async ponerClave(clave) {
    if (await this.ctx.storage.get('clave')) return false;
    const sal = idCorto();
    await this.ctx.storage.put('clave', { sal, hash: await sha256(sal + clave) });
    return true;
  }
  async comprobarClave(clave) {
    const c = await this.ctx.storage.get('clave');
    if (!c || !clave) return false;
    return (await sha256(c.sal + clave)) === c.hash;
  }

  // ---- Cuestionarios ----
  async listar() {
    await this.init();
    const ids = (await this.ctx.storage.get('indice')) || [];
    const mapa = await this.ctx.storage.get(ids.map(i => 'q:' + i));
    return ids.map(i => mapa.get('q:' + i)).filter(Boolean);
  }
  async leer(id) { await this.init(); return (await this.ctx.storage.get('q:' + id)) || null; }
  async guardar(q) {
    await this.init();
    const ids = (await this.ctx.storage.get('indice')) || [];
    if (!q.id) { q.id = idCorto(); ids.unshift(q.id); await this.ctx.storage.put('indice', ids); }
    else if (!ids.includes(q.id)) return null;
    q.actualizado = Date.now();
    await this.ctx.storage.put('q:' + q.id, q);
    return q;
  }
  async borrar(id) {
    const ids = ((await this.ctx.storage.get('indice')) || []).filter(i => i !== id);
    await this.ctx.storage.put('indice', ids);
    await this.ctx.storage.delete('q:' + id);
  }

  // ---- Informes ----
  async guardarInforme(inf) { await this.ctx.storage.put('inf:' + inf.pin, inf); }
  async leerInforme(pin) { return (await this.ctx.storage.get('inf:' + pin)) || null; }

  // ---- Preguntas ya usadas en cada lugar (bar, iglesia, colegio…) ----
  claveLugar(lugar) { return 'u:' + lugar.toLowerCase(); }
  async marcarUsadas(lugar, textos) {
    const k = this.claveLugar(lugar);
    const u = (await this.ctx.storage.get(k)) || { nombre: lugar, huellas: [] };
    const set = new Set(u.huellas);
    for (const t of textos) set.add(await huella(t));
    u.huellas = [...set].slice(-20000); u.nombre = lugar; u.ultima = Date.now();
    await this.ctx.storage.put(k, u);
    const lista = (await this.ctx.storage.get('lugares')) || [];
    if (!lista.includes(k)) { lista.push(k); await this.ctx.storage.put('lugares', lista); }
  }
  async usadas(lugar) {
    const u = await this.ctx.storage.get(this.claveLugar(lugar));
    return new Set(u ? u.huellas : []);
  }
  async lugares() {
    const lista = (await this.ctx.storage.get('lugares')) || [];
    const mapa = await this.ctx.storage.get(lista);
    return lista.map(k => mapa.get(k)).filter(Boolean).map(u => ({ nombre: u.nombre, usadas: u.huellas.length, ultima: u.ultima }))
      .sort((a, b) => (b.ultima || 0) - (a.ultima || 0));
  }
  async reiniciarLugar(lugar) { await this.ctx.storage.delete(this.claveLugar(lugar)); }

  // ---- Contactos («Quiero saber más» / petición de oración), con consentimiento ----
  async guardarContacto(c) {
    const lista = (await this.ctx.storage.get('contactos')) || [];
    if (lista.length >= 5000) return false;
    lista.unshift({ id: idCorto(), fecha: new Date().toISOString(), ...c });
    await this.ctx.storage.put('contactos', lista);
    return true;
  }
  async contactos() { return (await this.ctx.storage.get('contactos')) || []; }
  async borrarContacto(id) {
    const lista = ((await this.ctx.storage.get('contactos')) || []).filter(c => c.id !== id);
    await this.ctx.storage.put('contactos', lista);
  }
  async borrarContactos() { await this.ctx.storage.delete('contactos'); }

  // ---- Liga semanal de Lumbrera (tabla SQL en este mismo almacén) ----
  ligaTabla() {
    if (this.ligaLista) return this.ctx.storage.sql;
    const sql = this.ctx.storage.sql;
    sql.exec(`CREATE TABLE IF NOT EXISTS liga (semana TEXT NOT NULL, jugador TEXT NOT NULL, apodo TEXT NOT NULL, grupo TEXT NOT NULL DEFAULT '',
      xp INTEGER NOT NULL DEFAULT 0, dia TEXT NOT NULL DEFAULT '', xp_dia INTEGER NOT NULL DEFAULT 0, act INTEGER NOT NULL, PRIMARY KEY (semana, jugador))`);
    sql.exec('CREATE INDEX IF NOT EXISTS liga_xp ON liga (semana, xp DESC)');
    sql.exec('CREATE INDEX IF NOT EXISTS liga_grupo ON liga (semana, grupo, xp DESC)');
    // Divisiones: columnas nuevas en la tabla de la liga y una tabla con la división de cada jugador
    const cols = sql.exec('PRAGMA table_info(liga)').toArray().map(c => c.name);
    if (!cols.includes('division')) sql.exec('ALTER TABLE liga ADD COLUMN division INTEGER NOT NULL DEFAULT 0');
    if (!cols.includes('cohorte')) sql.exec('ALTER TABLE liga ADD COLUMN cohorte INTEGER');
    sql.exec('CREATE INDEX IF NOT EXISTS liga_cohorte ON liga (semana, division, cohorte, xp DESC)');
    sql.exec(`CREATE TABLE IF NOT EXISTS liga_div (jugador TEXT PRIMARY KEY, division INTEGER NOT NULL DEFAULT 0, semana TEXT NOT NULL,
      resultado TEXT NOT NULL DEFAULT '', de INTEGER, puesto INTEGER, de_semana TEXT)`);
    this.ligaLista = true;
    return sql;
  }
  // División del jugador esta semana: si es la primera vez que aparece esta semana, aplica el resultado de la anterior
  ligaDivision(jugador, semana, anterior) {
    const sql = this.ligaTabla();
    const d = sql.exec('SELECT * FROM liga_div WHERE jugador = ?', jugador).toArray()[0];
    if (d && d.semana === semana) return d;
    let division = d ? d.division : 0, resultado = '', puesto = null;
    const prev = anterior && sql.exec('SELECT xp, act, division, cohorte FROM liga WHERE semana = ? AND jugador = ?', anterior, jugador).toArray()[0];
    if (prev && prev.cohorte !== null && prev.xp > 0) {
      const n = sql.exec('SELECT COUNT(*) AS n FROM liga WHERE semana = ? AND division = ? AND cohorte = ? AND xp > 0', anterior, prev.division, prev.cohorte).one().n;
      puesto = sql.exec('SELECT COUNT(*) AS n FROM liga WHERE semana = ? AND division = ? AND cohorte = ? AND (xp > ? OR (xp = ? AND act < ?))', anterior, prev.division, prev.cohorte, prev.xp, prev.xp, prev.act).one().n + 1;
      resultado = resultadoSemana({ puesto, n, xp: prev.xp, division: prev.division });
      division = Math.max(0, Math.min(DIVISIONES.length - 1, prev.division + (resultado === 'sube' ? 1 : resultado === 'baja' ? -1 : 0)));
    }
    const de = prev ? prev.division : null;
    sql.exec(`INSERT INTO liga_div (jugador, division, semana, resultado, de, puesto, de_semana) VALUES (?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT (jugador) DO UPDATE SET division = excluded.division, semana = excluded.semana, resultado = excluded.resultado, de = excluded.de, puesto = excluded.puesto, de_semana = excluded.de_semana`,
      jugador, division, semana, resultado, de, puesto, prev ? anterior : null);
    return sql.exec('SELECT * FROM liga_div WHERE jugador = ?', jugador).toArray()[0];
  }
  // Mete al jugador en un grupo (cohorte) de su división con hueco; se hace al sumar sus primeros puntos de la semana
  ligaAsignarCohorte(semana, jugador, division) {
    const sql = this.ligaTabla();
    const hueco = sql.exec('SELECT cohorte, COUNT(*) AS n FROM liga WHERE semana = ? AND division = ? AND cohorte IS NOT NULL GROUP BY cohorte HAVING n < ? ORDER BY cohorte LIMIT 1', semana, division, TAM_GRUPO).toArray()[0];
    const cohorte = hueco ? hueco.cohorte : (sql.exec('SELECT COALESCE(MAX(cohorte), -1) AS m FROM liga WHERE semana = ? AND division = ?', semana, division).one().m + 1);
    sql.exec('UPDATE liga SET division = ?, cohorte = ? WHERE semana = ? AND jugador = ?', division, cohorte, semana, jugador);
  }
  // Suma puntos (o solo actualiza apodo y grupo si xp = 0) respetando el tope diario
  async ligaSumar({ semana, anterior, dia, jugador, apodo, grupo, xp }) {
    const sql = this.ligaTabla();
    const div = this.ligaDivision(jugador, semana, anterior);
    const fila = sql.exec('SELECT dia, xp_dia FROM liga WHERE semana = ? AND jugador = ?', semana, jugador).toArray()[0];
    const yaHoy = fila && fila.dia === dia ? fila.xp_dia : 0;
    const suma = Math.max(0, Math.min(xp, LIGA_MAX_DIA - yaHoy));
    sql.exec(`INSERT INTO liga (semana, jugador, apodo, grupo, xp, dia, xp_dia, act) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT (semana, jugador) DO UPDATE SET apodo = excluded.apodo, grupo = excluded.grupo, xp = liga.xp + excluded.xp,
      dia = excluded.dia, xp_dia = CASE WHEN liga.dia = excluded.dia THEN liga.xp_dia + excluded.xp ELSE excluded.xp END,
      act = CASE WHEN excluded.xp > 0 THEN excluded.act ELSE liga.act END`, semana, jugador, apodo, grupo, suma, dia, suma, Date.now());
    const fila2 = sql.exec('SELECT xp, cohorte FROM liga WHERE semana = ? AND jugador = ?', semana, jugador).toArray()[0];
    if (fila2 && fila2.xp > 0 && fila2.cohorte === null) this.ligaAsignarCohorte(semana, jugador, div.division);
    // Limpieza: borra semanas de hace más de un mes
    if (Math.random() < 0.02) sql.exec('DELETE FROM liga WHERE semana < ?', semanaAntigua(semana));
    return { sumados: suma };
  }
  // «Salir de la liga»: borra todas las filas de ese jugador
  async ligaBorrar(jugador) { const sql = this.ligaTabla(); sql.exec('DELETE FROM liga WHERE jugador = ?', jugador); sql.exec('DELETE FROM liga_div WHERE jugador = ?', jugador); }
  // ---- Plan Grupo de Lumbrera: el líder registra un código de grupo y recibe una clave secreta para su panel ----
  grupoTablas() {
    if (this.grupoListo) return this.ctx.storage.sql;
    const sql = this.ligaTabla();
    sql.exec(`CREATE TABLE IF NOT EXISTS grupos (codigo TEXT PRIMARY KEY, nombre TEXT NOT NULL, sal TEXT NOT NULL, hash TEXT NOT NULL,
      creado INTEGER NOT NULL, hasta INTEGER NOT NULL, plan TEXT NOT NULL DEFAULT 'prueba')`);
    sql.exec(`CREATE TABLE IF NOT EXISTS grupo_lec (codigo TEXT NOT NULL, semana TEXT NOT NULL, jugador TEXT NOT NULL, libro TEXT NOT NULL, unidad INTEGER NOT NULL,
      lecciones INTEGER NOT NULL DEFAULT 0, preguntas INTEGER NOT NULL DEFAULT 0, errores INTEGER NOT NULL DEFAULT 0, act INTEGER NOT NULL,
      PRIMARY KEY (codigo, semana, jugador, libro, unidad))`);
    sql.exec(`CREATE TABLE IF NOT EXISTS grupo_preg (codigo TEXT NOT NULL, id TEXT NOT NULL, datos TEXT NOT NULL, creado INTEGER NOT NULL, PRIMARY KEY (codigo, id))`);
    this.grupoListo = true;
    return sql;
  }
  async grupoCrear({ codigo, nombre, clave, dias }) {
    const sql = this.grupoTablas();
    if (sql.exec('SELECT 1 FROM grupos WHERE codigo = ?', codigo).toArray().length) return { error: 'Ese código ya está registrado por otro líder. Elige otro.' };
    const hoyN = sql.exec('SELECT COUNT(*) AS n FROM grupos WHERE creado > ?', Date.now() - 864e5).one().n;
    if (hoyN >= 300) return { error: 'Hoy se han creado demasiados grupos. Prueba mañana.' };
    const sal = idCorto(), ahora = Date.now();
    sql.exec('INSERT INTO grupos (codigo, nombre, sal, hash, creado, hasta) VALUES (?, ?, ?, ?, ?, ?)', codigo, nombre, sal, await sha256(sal + clave), ahora, ahora + dias * 864e5);
    return { ok: true, hasta: ahora + dias * 864e5 };
  }
  async grupoEntrar(codigo, clave) {
    const sql = this.grupoTablas();
    const g = sql.exec('SELECT * FROM grupos WHERE codigo = ?', codigo).toArray()[0];
    if (!g || !clave || (await sha256(g.sal + clave)) !== g.hash) return null;
    return { codigo: g.codigo, nombre: g.nombre, creado: g.creado, hasta: g.hasta, plan: g.plan, activo: g.hasta > Date.now() };
  }
  // Una lección hecha por un miembro (solo cuenta si el grupo está registrado)
  async grupoLeccion({ codigo, semana, jugador, libro, unidad, preguntas, errores }) {
    const sql = this.grupoTablas();
    if (!sql.exec('SELECT 1 FROM grupos WHERE codigo = ?', codigo).toArray().length) return { ok: false };
    sql.exec(`INSERT INTO grupo_lec (codigo, semana, jugador, libro, unidad, lecciones, preguntas, errores, act) VALUES (?, ?, ?, ?, ?, 1, ?, ?, ?)
      ON CONFLICT (codigo, semana, jugador, libro, unidad) DO UPDATE SET lecciones = lecciones + 1, preguntas = preguntas + excluded.preguntas,
      errores = errores + excluded.errores, act = excluded.act`, codigo, semana, jugador, libro, unidad, preguntas, errores, Date.now());
    if (Math.random() < 0.02) sql.exec('DELETE FROM grupo_lec WHERE semana < ?', semanaAntigua(semana));
    return { ok: true };
  }
  // Todo lo que ve el líder: miembros (de la liga, con su código), lecciones, temas flojos y preguntas propias
  grupoPanel(codigo, semanas) {
    const sql = this.grupoTablas();
    const qs = semanas.map(() => '?').join(',');
    const liga = sql.exec(`SELECT jugador, apodo, semana, xp, act FROM liga WHERE grupo = ? AND semana IN (${qs})`, codigo, ...semanas).toArray();
    const lec = sql.exec(`SELECT jugador, semana, libro, unidad, lecciones, preguntas, errores, act FROM grupo_lec WHERE codigo = ? AND semana IN (${qs})`, codigo, ...semanas).toArray();
    const miembros = {};
    const m = j => (miembros[j] = miembros[j] || { apodo: null, xp: {}, lecciones: {}, preguntas: 0, errores: 0, ultimo: 0 });
    liga.forEach(f => { const x = m(f.jugador); if (!x.apodo || f.semana === semanas[0]) x.apodo = f.apodo; x.xp[f.semana] = f.xp; x.ultimo = Math.max(x.ultimo, f.act || 0); });
    lec.forEach(f => { const x = m(f.jugador); x.lecciones[f.semana] = (x.lecciones[f.semana] || 0) + f.lecciones; x.preguntas += f.preguntas; x.errores += f.errores; x.ultimo = Math.max(x.ultimo, f.act); });
    const temas = {};
    lec.forEach(f => { const k = f.libro + ':' + f.unidad; const t = (temas[k] = temas[k] || { libro: f.libro, unidad: f.unidad, preguntas: 0, errores: 0, personas: new Set() }); t.preguntas += f.preguntas; t.errores += f.errores; t.personas.add(f.jugador); });
    const preg = sql.exec('SELECT id, datos FROM grupo_preg WHERE codigo = ? ORDER BY creado', codigo).toArray().map(r => ({ id: r.id, ...JSON.parse(r.datos) }));
    return {
      miembros: Object.values(miembros).filter(x => x.apodo || Object.keys(x.lecciones).length).map((x, i) => ({ ...x, apodo: x.apodo || `Miembro ${i + 1}` })),
      temas: Object.values(temas).map(t => ({ libro: t.libro, unidad: t.unidad, preguntas: t.preguntas, errores: t.errores, personas: t.personas.size })),
      preguntas: preg,
    };
  }
  grupoPreguntas(codigo) { return this.grupoTablas().exec('SELECT id, datos FROM grupo_preg WHERE codigo = ? ORDER BY creado', codigo).toArray().map(r => ({ id: r.id, ...JSON.parse(r.datos) })); }
  grupoPreguntaPoner(codigo, p) {
    const sql = this.grupoTablas();
    if (sql.exec('SELECT COUNT(*) AS n FROM grupo_preg WHERE codigo = ?', codigo).one().n >= 300) return { error: 'Has llegado al máximo de 300 preguntas propias' };
    const id = idCorto();
    sql.exec('INSERT INTO grupo_preg (codigo, id, datos, creado) VALUES (?, ?, ?, ?)', codigo, id, JSON.stringify(p), Date.now());
    return { ok: true, id };
  }
  grupoPreguntaBorrar(codigo, id) { this.grupoTablas().exec('DELETE FROM grupo_preg WHERE codigo = ? AND id = ?', codigo, String(id)); return { ok: true }; }
  // Para Andrés (con la contraseña del panel): lista de grupos y activar o ampliar un plan
  grupoLista() {
    const sql = this.grupoTablas();
    return sql.exec(`SELECT g.codigo, g.nombre, g.creado, g.hasta, g.plan,
      (SELECT COUNT(DISTINCT jugador) FROM grupo_lec l WHERE l.codigo = g.codigo) AS miembros,
      (SELECT COALESCE(SUM(lecciones), 0) FROM grupo_lec l WHERE l.codigo = g.codigo) AS lecciones,
      (SELECT COUNT(*) FROM grupo_preg p WHERE p.codigo = g.codigo) AS propias FROM grupos g ORDER BY g.creado DESC LIMIT 500`).toArray();
  }
  grupoAmpliar(codigo, dias, plan) {
    const sql = this.grupoTablas();
    const g = sql.exec('SELECT hasta FROM grupos WHERE codigo = ?', codigo).toArray()[0];
    if (!g) return { error: 'Ese grupo no existe' };
    const hasta = Math.max(g.hasta, Date.now()) + dias * 864e5;
    sql.exec('UPDATE grupos SET hasta = ?, plan = ? WHERE codigo = ?', hasta, plan, codigo);
    return { ok: true, hasta };
  }
  async grupoNuevaClave(codigo, clave) {
    const sql = this.grupoTablas();
    if (!sql.exec('SELECT 1 FROM grupos WHERE codigo = ?', codigo).toArray().length) return { error: 'Ese grupo no existe' };
    const sal = idCorto(); sql.exec('UPDATE grupos SET sal = ?, hash = ? WHERE codigo = ?', sal, await sha256(sal + clave), codigo);
    return { ok: true };
  }

  // Clasificación de la semana: top 50 (global o de un grupo) y tu puesto
  async ligaClasificacion({ semana, anterior, jugador, grupo, vista }) {
    const sql = this.ligaTabla();
    if (vista === 'mi') return this.ligaMiDivision({ semana, anterior, jugador });
    const filtro = grupo ? ' AND grupo = ?' : '', args = grupo ? [semana, grupo] : [semana];
    const top = sql.exec(`SELECT jugador, apodo, xp FROM liga WHERE semana = ? AND xp > 0${filtro} ORDER BY xp DESC, act ASC LIMIT 50`, ...args).toArray();
    const total = sql.exec(`SELECT COUNT(*) AS n FROM liga WHERE semana = ? AND xp > 0${filtro}`, ...args).one().n;
    let yo = null;
    if (jugador) {
      const f = sql.exec('SELECT apodo, grupo, xp, act FROM liga WHERE semana = ? AND jugador = ?', semana, jugador).toArray()[0];
      if (f && (!grupo || f.grupo === grupo)) {
        const delante = f.xp > 0 ? sql.exec(`SELECT COUNT(*) AS n FROM liga WHERE semana = ? AND (xp > ? OR (xp = ? AND act < ?))${filtro}`, semana, f.xp, f.xp, f.act, ...(grupo ? [grupo] : [])).one().n : null;
        yo = { apodo: f.apodo, grupo: f.grupo, xp: f.xp, puesto: delante === null ? null : delante + 1 };
      }
    }
    return { semana, total, top: top.map((t, i) => ({ puesto: i + 1, apodo: t.apodo, xp: t.xp, yo: t.jugador === jugador })), yo };
  }

  // Tu grupo de la semana (hasta 30 de tu división), con las zonas de subida y bajada
  ligaMiDivision({ semana, anterior, jugador }) {
    const sql = this.ligaTabla();
    if (!jugador) return { error: 'Únete a la liga para ver tu división' };
    const d = this.ligaDivision(jugador, semana, anterior);
    let f = sql.exec('SELECT apodo, xp, act, cohorte FROM liga WHERE semana = ? AND jugador = ?', semana, jugador).toArray()[0];
    if (f && f.xp > 0 && f.cohorte === null) { this.ligaAsignarCohorte(semana, jugador, d.division); f = sql.exec('SELECT apodo, xp, act, cohorte FROM liga WHERE semana = ? AND jugador = ?', semana, jugador).toArray()[0]; }
    const info = i => ({ n: i, ...DIVISIONES[i] });
    const base = { semana, vista: 'mi', division: info(d.division), divisiones: DIVISIONES,
      resultado: d.resultado && d.de !== null ? { tipo: d.resultado, de: info(d.de), a: info(d.division), puesto: d.puesto, semana: d.de_semana } : null };
    if (!f || f.cohorte === null) return { ...base, total: 0, top: [], yo: f ? { apodo: f.apodo, xp: f.xp, puesto: null } : null, zonas: zonas(0, d.division) };
    const top = sql.exec('SELECT jugador, apodo, xp FROM liga WHERE semana = ? AND division = ? AND cohorte = ? AND xp > 0 ORDER BY xp DESC, act ASC', semana, d.division, f.cohorte).toArray();
    const lista = top.map((t, i) => ({ puesto: i + 1, apodo: t.apodo, xp: t.xp, yo: t.jugador === jugador }));
    const yo = lista.find(t => t.yo) || null;
    return { ...base, total: lista.length, top: lista, yo, zonas: zonas(lista.length, d.division) };
  }

  // ---- Métricas anónimas de Lumbrera: solo contadores por día, semana y mes (sin identificadores) ----
  metricaTabla() {
    if (this.metLista) return this.ctx.storage.sql;
    this.ctx.storage.sql.exec('CREATE TABLE IF NOT EXISTS metricas (periodo TEXT NOT NULL, clave TEXT NOT NULL, n INTEGER NOT NULL DEFAULT 0, PRIMARY KEY (periodo, clave))');
    this.metLista = true;
    return this.ctx.storage.sql;
  }
  async metricaSumar(pares) {
    const sql = this.metricaTabla();
    for (const [periodo, clave, n] of pares) sql.exec('INSERT INTO metricas (periodo, clave, n) VALUES (?, ?, ?) ON CONFLICT (periodo, clave) DO UPDATE SET n = metricas.n + excluded.n', periodo, clave, n);
  }
  async metricas({ desdeDia, semana }) {
    const sql = this.metricaTabla();
    const filas = sql.exec("SELECT periodo, clave, n FROM metricas WHERE (periodo >= ? AND periodo LIKE '____-__-__') OR periodo LIKE 'S:%' OR periodo LIKE 'M:%' OR periodo = 'total'", desdeDia).toArray();
    let liga = 0, ligaGrupos = 0;
    try {
      const sl = this.ligaTabla();
      liga = sl.exec('SELECT COUNT(*) AS n FROM liga WHERE semana = ?', semana).one().n;
      ligaGrupos = sl.exec("SELECT COUNT(DISTINCT grupo) AS n FROM liga WHERE semana = ? AND grupo != ''", semana).one().n;
    } catch {}
    let avisos = 0; try { avisos = this.pushTabla().exec('SELECT COUNT(*) AS n FROM push').one().n; } catch {}
    return { filas, liga, ligaGrupos, avisos };
  }

  // ---- Notificaciones push (recordatorio diario de Lumbrera) ----
  pushTabla() {
    if (this.pushLista) return this.ctx.storage.sql;
    this.ctx.storage.sql.exec(`CREATE TABLE IF NOT EXISTS push (endpoint TEXT PRIMARY KEY, hora TEXT NOT NULL, zona TEXT NOT NULL,
      ultimo_dia TEXT NOT NULL DEFAULT '', ultimo_envio TEXT NOT NULL DEFAULT '', creado INTEGER NOT NULL)`);
    this.pushLista = true;
    return this.ctx.storage.sql;
  }
  async pushClaves() {
    let c = await this.ctx.storage.get('vapid');
    if (!c) { c = await generarClavesVapid(); await this.ctx.storage.put('vapid', c); }
    return c;
  }
  async pushClavePublica() { return (await this.pushClaves()).publica; }
  async pushGuardar({ endpoint, hora, zona, dia }) {
    this.pushTabla().exec(`INSERT INTO push (endpoint, hora, zona, ultimo_dia, creado) VALUES (?, ?, ?, ?, ?)
      ON CONFLICT (endpoint) DO UPDATE SET hora = excluded.hora, zona = excluded.zona, ultimo_dia = CASE WHEN excluded.ultimo_dia > push.ultimo_dia THEN excluded.ultimo_dia ELSE push.ultimo_dia END`,
      endpoint, hora, zona, dia || '', Date.now());
    return { total: this.pushTabla().exec('SELECT COUNT(*) AS n FROM push').one().n };
  }
  async pushHecho(endpoint, dia) { this.pushTabla().exec('UPDATE push SET ultimo_dia = ? WHERE endpoint = ? AND ultimo_dia < ?', dia, endpoint, dia); }
  async pushBorrar(endpoint) { this.pushTabla().exec('DELETE FROM push WHERE endpoint = ?', endpoint); }
  async pushContar() { return this.pushTabla().exec('SELECT COUNT(*) AS n FROM push').one().n; }
  // Cada hora: avisa a quien tenga esa hora elegida (en su zona) y todavía no haya hecho su lección hoy.
  // Si alguien lleva más de 14 días sin usar la app, deja de recibir avisos (para no molestar).
  async pushEnviar({ contacto, ahora = Date.now(), soloEndpoint = null } = {}) {
    const sql = this.pushTabla(), claves = await this.pushClaves();
    const filas = soloEndpoint ? sql.exec('SELECT * FROM push WHERE endpoint = ?', soloEndpoint).toArray() : sql.exec('SELECT * FROM push').toArray();
    const toca = [];
    for (const f of filas) {
      let dia, hora;
      try {
        dia = new Date(ahora).toLocaleDateString('sv-SE', { timeZone: f.zona });
        hora = new Intl.DateTimeFormat('en-GB', { timeZone: f.zona, hour: '2-digit', hourCycle: 'h23' }).format(ahora).padStart(2, '0');
      } catch { continue; }
      if (!soloEndpoint) {
        if (hora !== f.hora.slice(0, 2) || f.ultimo_dia === dia || f.ultimo_envio === dia) continue;
        if (f.ultimo_dia && (new Date(dia) - new Date(f.ultimo_dia)) / 864e5 > 14) continue;
      }
      toca.push({ ...f, dia });
    }
    let enviados = 0, borrados = 0, fallos = 0;
    for (let i = 0; i < toca.length; i += 50) {
      await Promise.all(toca.slice(i, i + 50).map(async f => {
        try {
          const r = await fetch(f.endpoint, { method: 'POST', headers: { Authorization: await cabeceraVapid(f.endpoint, claves, contacto), TTL: '43200', Urgency: 'normal', Topic: 'racha', 'Content-Length': '0' } });
          if (r.status === 404 || r.status === 410) { sql.exec('DELETE FROM push WHERE endpoint = ?', f.endpoint); borrados++; }
          else if (r.ok) { sql.exec('UPDATE push SET ultimo_envio = ? WHERE endpoint = ?', f.dia, f.endpoint); enviados++; }
          else { fallos++; console.error('push', r.status, await r.text().catch(() => '')); }
        } catch (e) { fallos++; console.error('push', e); }
      }));
    }
    return { candidatos: toca.length, enviados, borrados, fallos };
  }

  // ---- Tope diario de IA ----
  async usoIA(limite) {
    const hoy = new Date().toISOString().slice(0, 10);
    const u = (await this.ctx.storage.get('ia')) || { dia: hoy, n: 0 };
    if (u.dia !== hoy) { u.dia = hoy; u.n = 0; }
    if (u.n >= limite) return false;
    u.n++; await this.ctx.storage.put('ia', u);
    return true;
  }
}

// «2026-W48» → la semana de hace 5 semanas, para borrar datos viejos de la liga
function semanaAntigua(semana) {
  const [a, w] = semana.split('-W').map(Number);
  const n = w - 5;
  return n >= 1 ? `${a}-W${String(n).padStart(2, '0')}` : `${a - 1}-W${String(52 + n).padStart(2, '0')}`;
}
