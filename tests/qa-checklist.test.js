// Checklist manual de QA (puntos 1–4 y 7) automatizado con la app REAL en jsdom.
// 5 (estrategia aplicar → deshacer idéntico) y 6 (archivo con online en el build sin online) están en project-app / online-app.
// 8 (modo oscuro en todos los paneles) se verifica en un navegador real (ver CHANGELOG / resumen de QA).
import { describe, it, expect, beforeAll } from 'vitest';
import { PGlite } from '@electric-sql/pglite';
import fs from 'node:fs';
import path from 'node:path';
import { buildTestBundle, openApp } from './app-harness.js';
import { createMemoryAdapter } from '../src/project/adapters/memory.js';
import { root } from './helpers.js';

beforeAll(async () => { await buildTestBundle(); }, 180000);
const wait = ms => new Promise(r => setTimeout(r, ms));
async function app() {
  const a = await openApp(); const w = a.window; const disk = {};
  Object.assign(a.window.SAHTEN.project.adapter, createMemoryAdapter({ files: disk }));
  a.ev = c => w.eval(c); a.p = w.SAHTEN.project; a.disk = disk; a.errors = []; w.addEventListener('error', e => a.errors.push(e.message));
  w.alert = m => a.errors.push('alert: ' + m); w.confirm = () => true;
  return a;
}

describe('1 · Proyecto nuevo → asistente de configuración → próximos pasos', () => {
  it('crea el negocio con 10 preguntas y deja los datos y la guía de próximos pasos', async () => {
    const a = await app(); a.p.adapter.queueSaveAs('La Esquina.sahten');
    await a.p.newProject('La Esquina');
    const d = a.window.document;
    expect(d.getElementById('sw-ov')).toBeTruthy();                                   // el asistente se abre solo
    a.ev(`swSet('name','La Esquina'); swSet('type','Rotisería'); swSet('currency','ARS'); swSet('gfMode','detalle');
          swGf('Alquiler','400000'); swGf('Servicios','120000'); swSet('employees','2'); swSet('salary','300000'); swSet('owner','500000');
          swSet('perDay','40'); swSet('days','26'); swSet('margin','40'); swSet('delivery',false); swSet('online',false);`);
    for (let i = 0; i < 3; i++) a.ev('swGo(10)');
    await a.ev('swFinish()'); await wait(100);
    expect(d.getElementById('sw-ov')).toBeNull();
    expect(a.ev('SAHTEN_PROJECT.name')).toBe('La Esquina');
    expect(a.ev('SAHTEN_PROJECT.setupDone')).toBe(true);
    expect(a.ev('totalGFRaw()')).toBe(400000 + 120000 + 2 * 300000 + 500000);
    expect(a.ev('SAHTEN_PROJECT.estUnitsMonth')).toBe(40 * 26);
    expect(a.ev('TIERS.length')).toBeGreaterThanOrEqual(3);
    expect(a.ev("CHANNELS.find(c=>c.id==='mostrador').enabled")).toBe(true);
    a.ev("showPanel('dashboard'); renderDashboard()"); await wait(50);
    expect(d.querySelector('.sp-check')).toBeTruthy();                                // «próximos pasos»
    expect(d.querySelector('.sp-check').textContent).toMatch(/ingrediente|producto|receta/i);
    expect(a.errors).toEqual([]);
    await a.p.session.saveNow({ force: true });
    expect(JSON.parse(a.disk['La Esquina.sahten']).project.setupDone).toBe(true);
    a.window.close();
  }, 60000);
});

describe('2 · Producto desde cero y «¿De dónde sale este precio?»', () => {
  it('ingrediente → envase → receta → tier → precio, y el desglose cuadra con el precio', async () => {
    const a = await app(); await a.p.openDemo(); const w = a.window;
    // ingrediente y envase nuevos
    a.ev("INGREDIENTES.push({id:'ing_t',name:'Harina QA',precioPkg:2000,grPaquete:1000,cantidad:1000,unit:'g'}); ENVASES.push({id:'env_t',name:'Caja QA',precioPkg:5000,cantidad:100});");
    // producto nuevo por el flujo de la pantalla
    w.document.getElementById('np-name').value = 'Pan QA'; w.document.getElementById('np-tier').value = a.ev('TIERS[1].id');
    a.ev('npGoStep2()');
    const id = a.ev('PRODUCTS[PRODUCTS.length-1].id'); const i = a.ev('PRODUCTS.length-1');
    a.ev(`(function(p){ p.ingredients.push({ingId:'ing_t',qty:500,unit:'g',v:0}); p.packaging.push({envId:'env_t',qty:1,unit:'u',v:0}); p.porciones=10; p.avgMes=100; })(PRODUCTS[${i}])`);
    // cuentas a mano
    const ing = 500 * 2, pack = 5000 / 100, cpu = (ing + pack) / 10;
    expect(a.ev(`costPerUnit(PRODUCTS[${i}])`)).toBeCloseTo(cpu, 9);
    const gfu = a.ev('gfPerUnit()'), factor = a.ev(`getTier(PRODUCTS[${i}].tier).factor`);
    const mostSur = a.ev("CHANNELS.find(c=>c.id==='mostrador').surcharge"), gc = a.ev('globalComm()');
    const raw = (cpu + gfu) * factor, rnd = a.ev('SAHTEN_PROJECT.roundTo') || 50;
    const mp = Math.round(raw / rnd) * rnd, expected = Math.round(mp * (1 + mostSur) * (1 + gc) / rnd) * rnd;
    expect(a.ev(`mostradorFinalPrice(PRODUCTS[${i}])`)).toBe(expected);
    // el desglose lo muestra
    a.ev(`sahtenWhy('${id}')`);
    const txt = w.document.getElementById('why-ov').textContent.replace(/\s+/g, ' ');
    const money = n => a.ev(`fmt(${n})`);
    expect(txt).toContain('¿De dónde sale este precio?'); expect(txt).toContain('Pan QA');
    expect(txt).toContain(money(cpu)); expect(txt).toContain(money(expected)); expect(txt).toMatch(/Tier/); expect(txt).toContain('÷ 10');
    expect(a.errors).toEqual([]);
    w.close();
  }, 60000);
});

describe('3 · Control mensual de gastos fijos', () => {
  it('editar, eliminar y gasto extraordinario; cierre automático y recordatorio', async () => {
    const a = await app(); await a.p.openDemo(); a.ev("showPanel('gastos'); renderGastos();"); await wait(40);
    const key = a.ev('gfmNowKey()');
    expect(a.ev(`!!GF_MONTHS['${key}']`)).toBe(true);                                   // el mes en curso se crea solo al abrir
    // editar monto y nombre → queda en el registro de cambios del mes
    const total0 = a.ev('totalGF()'), amount0 = a.ev('GASTOS_OP[0].amount');
    a.ev("gfEditAmount('op',0,'2000000'); gfEditName('op',1,'Sistema nuevo');");
    expect(a.ev('totalGF()')).toBe(total0 - amount0 + 2000000);
    // gasto extraordinario
    a.ev("gfmMonth=gfmNowKey(); gfmAddExtra(); gfmExtraName(GF_MONTHS[gfmMonth].items.length-1,'Reparación horno'); gfmSetReal(GF_MONTHS[gfmMonth].items.length-1,'45000');");
    const m = a.ev(`JSON.parse(JSON.stringify(GF_MONTHS['${key}']))`);
    expect(m.items.at(-1)).toMatchObject({ extra: true, name: 'Reparación horno', real: 45000 });
    // eliminar un gasto
    const n0 = a.ev('GASTOS_OP.length'); a.ev("gfEnsureIds(); showConfirm=(t,x,cb)=>cb(); confirmGastoDel(0,'op');");
    expect(a.ev('GASTOS_OP.length')).toBe(n0 - 1);
    const log = a.ev(`GF_MONTHS['${key}'].log.map(l=>l.action)`);
    ['amount', 'rename', 'extra', 'delete'].forEach(x => expect(Array.from(log)).toContain(x));
    // cierre automático de meses pasados
    a.ev("GF_MONTHS['2020-01']={items:[{name:'X',type:'op',budget:1,real:1}],note:'',closed:false,reviewed:true,log:[]}; gfmEnsureMonths();");
    expect(a.ev("GF_MONTHS['2020-01'].closed")).toBe(true);
    // recordatorio: mes en curso sin revisar
    a.ev(`GF_MONTHS['${key}'].reviewed=false`);
    expect(a.ev('gfmReminder()').text).toMatch(/Revisá los gastos fijos|Empieza/);
    expect(a.errors).toEqual([]);
    a.window.close();
  }, 60000);
});

describe('4 · Mostrador: retiro y delivery con zona y envío gratis; descontar y revertir stock', () => {
  it('flujo completo', async () => {
    const a = await app(); await a.p.openDemo(); const w = a.window;
    a.ev("showPanel('mostrador'); renderMostrador();"); await wait(60);
    a.ev("_saveTiendaConfig({..._getTiendaConfig()}); initStock();");
    const cfg = a.ev('JSON.parse(JSON.stringify(_getTiendaConfig()))');
    const pid = 'pizza_muzza', price = a.ev(`mostradorFinalPrice(PRODUCTS.find(p=>p.id==='${pid}'))`);
    // retiro
    a.ev(`mostradorAddToCart('${pid}'); mostradorAddToCart('${pid}'); mostradorSetOrderType('retiro'); mostradorCheckout();`); await wait(50);
    let o = a.ev('JSON.parse(JSON.stringify(SAHTEN_ORDERS[0]))');
    expect(o.items[0]).toMatchObject({ productId: pid, qty: 2, lineTotal: price * 2 }); expect(o.shipping).toBe(0); expect(o.total).toBe(price * 2);
    // delivery dentro de zona A (en el local): cobra el envío de la zona
    a.ev(`mostradorAddToCart('${pid}'); mostradorSetOrderType('delivery'); _mostSetDeliveryPoint(${cfg.lat},${cfg.lng},'Siempreviva 750');`);
    const zoneA = cfg.zones.find(z => z.id === 'z1');
    expect(a.ev('_calcCartTotals().shipping')).toBe(zoneA.baseCost);
    a.ev('mostradorCheckout()'); await wait(50);
    o = a.ev('JSON.parse(JSON.stringify(SAHTEN_ORDERS[0]))'); expect(o.shipping).toBe(zoneA.baseCost); expect(o.address).toBe('Siempreviva 750'); expect(o.total).toBe(price + zoneA.baseCost);
    // envío gratis por monto: carrito grande en delivery
    const units = Math.ceil(cfg.freeShippingMin / price) + 1;
    a.ev(`for(let k=0;k<${units};k++) mostradorAddToCart('${pid}'); mostradorSetOrderType('delivery'); _mostSetDeliveryPoint(${cfg.lat},${cfg.lng},'Siempreviva 750');`);
    const t = a.ev('(function(){const t=_calcCartTotals(); return {shipping:t.shipping,freeShip:t.freeShip,subtotal:t.subtotal}})()');
    expect(t).toMatchObject({ shipping: 0, freeShip: true }); expect(t.subtotal).toBeGreaterThanOrEqual(cfg.freeShippingMin);
    a.ev('mostradorCheckout()'); await wait(50);
    // fuera de zona: se avisa y se puede cargar a mano
    a.ev(`mostradorClearCart(); mostradorAddToCart('${pid}'); mostradorSetOrderType('delivery'); _mostSetDeliveryPoint(${cfg.lat - 1},${cfg.lng},'Lejos 1');`);
    expect(a.ev('mostradorDelivery.out')).toBe(true); expect(a.ev('_calcCartTotals().shipping')).toBe(0);
    a.ev('mostradorShipManual=true; mostradorShipping=2500;'); expect(a.ev('_calcCartTotals().shipping')).toBe(2500);
    // descontar y revertir stock de la primera orden (2 pizzas)
    const oid = a.ev('SAHTEN_ORDERS[SAHTEN_ORDERS.length-1].id');
    const stockBefore = a.ev('JSON.parse(JSON.stringify(STOCK))'); const movs0 = a.ev('MOVIMIENTOS.length');
    a.ev("Object.keys(STOCK).forEach(k=>{STOCK[k].actual=100000});");
    const base = a.ev('JSON.parse(JSON.stringify(STOCK))');
    a.ev(`orderDeductStock('${oid}')`);
    expect(a.ev(`!!SAHTEN_ORDERS.find(o=>o.id==='${oid}').stockDeducted`)).toBe(true);
    const after = a.ev('JSON.parse(JSON.stringify(STOCK))');
    expect(Object.keys(after).some(k => after[k].actual < base[k].actual)).toBe(true);
    expect(a.ev('MOVIMIENTOS.length')).toBeGreaterThan(movs0);
    a.ev(`orderRestoreStock('${oid}', true)`);
    expect(a.ev('JSON.parse(JSON.stringify(STOCK))')).toEqual(base);
    expect(a.ev(`!!SAHTEN_ORDERS.find(o=>o.id==='${oid}').stockDeducted`)).toBe(false);
    expect(stockBefore).toBeTruthy();
    expect(a.errors.filter(e => !/^alert: Cargá/.test(e))).toEqual([]);
    w.close();
  }, 60000);
});

describe('7 · Dos proyectos → dos tiendas (Supabase)', () => {
  it('los pedidos de cada tienda llegan solo a su proyecto; no se mezclan ni se pueden leer desde afuera', async () => {
    const db = new PGlite();
    await db.exec(fs.readFileSync(path.join(root, 'tests/fixtures/supabase-prelude.sql'), 'utf8'));
    const U = { a: '00000000-0000-0000-0000-0000000000b1', b: '00000000-0000-0000-0000-0000000000b2' };
    for (const [k, v] of Object.entries(U)) await db.query('insert into auth.users (id,email) values ($1,$2)', [v, k + '@x.com']);
    await db.exec(fs.readFileSync(path.join(root, 'supabase/schema.sql'), 'utf8'));
    const as = async (who, fn) => { await db.exec(who === 'anon' ? "reset role; select set_config('request.jwt.claim.sub','',false); set role anon" : `reset role; select set_config('request.jwt.claim.sub','${U[who]}',false); select set_config('request.jwt.claims','{"email":"${who}@x.com"}',false); set role authenticated`); try { return await fn(); } finally { await db.exec('reset role'); } };
    const mk = async (who, slug) => { const pid = (await as(who, () => db.query("select public.create_project($1,'{}'::jsonb,'{}'::jsonb) as id", [slug]))).rows[0].id; return { pid, store: (await as(who, () => db.query('insert into public.stores (slug,name,owner,project_id) values ($1,$1,$2,$3) returning id', [slug, U[who], pid]))).rows[0].id }; };
    const A = await mk('a', 'tienda-uno'), B = await mk('b', 'tienda-dos');
    await as('anon', () => db.query("insert into public.orders (store_id,payload) values ($1,'{\"customerName\":\"Cliente 1\"}'::jsonb)", [A.store]));
    await as('anon', () => db.query("insert into public.orders (store_id,payload) values ($1,'{\"customerName\":\"Cliente 2\"}'::jsonb)", [B.store]));
    const seen = who => as(who, async () => (await db.query('select payload from public.orders')).rows.map(r => r.payload.customerName));
    expect(await seen('a')).toEqual(['Cliente 1']); expect(await seen('b')).toEqual(['Cliente 2']);
    await as('b', async () => { let e = null; try { await db.query("select public.get_project_data($1)", [A.pid]); } catch (x) { e = x; } expect(e).toBeTruthy(); });
    await as('a', () => db.query('insert into public.menus (store_id,json) values ($1,$2::jsonb)', [A.store, '{"products":[1]}']));
    await as('b', () => db.query("update public.menus set json='{\"products\":[]}'::jsonb"));       // B no toca el menú de A
    expect((await as('anon', () => db.query('select s.slug, m.json from public.stores s join public.menus m on m.store_id = s.id'))).rows[0].json.products).toHaveLength(1);
  }, 60000);
});

describe('Mostrador: cobra el mismo precio que muestra el Menú', () => {
  it('con descuento del canal o del producto, la grilla, el carrito y el pedido usan el precio con descuento', async () => {
    const a = await app(); await a.p.openDemo(); a.window.sahtenTour && a.window.sahtenTour.close();
    const pos = () => { a.ev('renderMostrador()'); return Array.from(a.window.document.querySelectorAll('.most-product')).map(e => e.querySelector('.most-product-price').textContent); };
    const base = a.ev("mostradorFinalPrice(PRODUCTS[0])");
    expect(a.ev("channelPriceWithDisc(PRODUCTS[0],'mostrador')")).toBe(base);          // sin descuento: nada cambia
    a.ev("CHANNELS.find(c=>c.id==='mostrador').channelDisc=10;");
    const conDesc = a.ev("channelPriceWithDisc(PRODUCTS[0],'mostrador')"); expect(conDesc).toBeLessThan(base);
    a.ev("showPanel('productos'); renderProductos();");
    expect(a.window.document.getElementById('prod-tbody').rows[0].textContent).toContain(conDesc.toLocaleString('es-AR'));   // el Menú muestra el precio con descuento
    expect(pos()[0].replace(/\D/g, '')).toBe(String(conDesc));                            // la grilla del Mostrador, igual
    a.ev("mostradorAddToCart('pizza_muzza'); mostradorSetOrderType('retiro'); mostradorCheckout();"); await wait(50);
    expect(a.ev('SAHTEN_ORDERS[0].items[0].unitPrice')).toBe(conDesc); expect(a.ev('SAHTEN_ORDERS[0].total')).toBe(conDesc);
    a.window.close();
  }, 60000);
});
