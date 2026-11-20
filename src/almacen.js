// Almacén permanente: cuestionarios, contraseña del presentador e informes de partidas
import { DurableObject } from 'cloudflare:workers';
import { idCorto, sha256, DEMO, DEMO_FE, huella } from './comun.js';

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
