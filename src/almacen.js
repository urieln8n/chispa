// Almacén permanente: cuestionarios, contraseña del presentador e informes de partidas
import { DurableObject } from 'cloudflare:workers';
import { idCorto, sha256, DEMO } from './comun.js';

export class Almacen extends DurableObject {
  async init() {
    if (this.listo) return;
    const ids = await this.ctx.storage.get('indice');
    if (!ids) {
      const id = idCorto();
      await this.ctx.storage.put('q:' + id, { id, ...DEMO, actualizado: Date.now() });
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
