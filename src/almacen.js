// Almacén permanente: cuestionarios, contraseña del presentador e informes de partidas
import { DurableObject } from 'cloudflare:workers';
import { idCorto, sha256, DEMO, DEMO_FE, huella } from './comun.js';
import { LIGA_MAX_DIA } from './liga.js';

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
    this.ligaLista = true;
    return sql;
  }
  // Suma puntos (o solo actualiza apodo y grupo si xp = 0) respetando el tope diario
  async ligaSumar({ semana, dia, jugador, apodo, grupo, xp }) {
    const sql = this.ligaTabla();
    const fila = sql.exec('SELECT dia, xp_dia FROM liga WHERE semana = ? AND jugador = ?', semana, jugador).toArray()[0];
    const yaHoy = fila && fila.dia === dia ? fila.xp_dia : 0;
    const suma = Math.max(0, Math.min(xp, LIGA_MAX_DIA - yaHoy));
    sql.exec(`INSERT INTO liga (semana, jugador, apodo, grupo, xp, dia, xp_dia, act) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT (semana, jugador) DO UPDATE SET apodo = excluded.apodo, grupo = excluded.grupo, xp = liga.xp + excluded.xp,
      dia = excluded.dia, xp_dia = CASE WHEN liga.dia = excluded.dia THEN liga.xp_dia + excluded.xp ELSE excluded.xp END,
      act = CASE WHEN excluded.xp > 0 THEN excluded.act ELSE liga.act END`, semana, jugador, apodo, grupo, suma, dia, suma, Date.now());
    // Limpieza: borra semanas de hace más de un mes
    if (Math.random() < 0.02) sql.exec('DELETE FROM liga WHERE semana < ?', semanaAntigua(semana));
    return { sumados: suma };
  }
  // «Salir de la liga»: borra todas las filas de ese jugador
  async ligaBorrar(jugador) { this.ligaTabla().exec('DELETE FROM liga WHERE jugador = ?', jugador); }
  // Clasificación de la semana: top 50 (global o de un grupo) y tu puesto
  async ligaClasificacion({ semana, jugador, grupo }) {
    const sql = this.ligaTabla();
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
