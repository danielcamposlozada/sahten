// El proyecto como archivo, con la app real (jsdom): abrir, editar, guardar solo, reabrir, respaldos.
import { describe, it, expect, beforeAll } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { buildTestBundle, openApp } from './app-harness.js';
import { readJSON, root } from './helpers.js';
import { createMemoryAdapter } from '../src/project/adapters/memory.js';
import { serialize, migrate, emptyFile, fileToLegacy, contentHash } from '../src/project/schema.js';
import { ago, indicatorText } from '../src/project/indicator.js';

beforeAll(async () => { await buildTestBundle(); }, 120000);

/** App con un «disco» en memoria compartido entre aperturas. */
async function app(disk) {
  const a = await openApp();
  const mem = createMemoryAdapter({ files: disk });
  Object.assign(a.window.SAHTEN.project.adapter, { ...mem, store: disk });
  a.p = a.window.SAHTEN.project; a.s = a.p.session; a.mem = mem; a.disk = disk;
  a.ev = code => a.window.eval(code);
  return a;
}
const wait = ms => new Promise(r => setTimeout(r, ms));
const prices = a => Array.from(a.ev('PRODUCTS.map(mostradorFinalPrice)'));
const bizKeys = w => Object.keys(w.localStorage).concat(Array.from({ length: w.localStorage.length }, (_, i) => w.localStorage.key(i))).filter(k => /^(sahten_orders|sahten_customers|sahten_menu_config|sahten_tienda|sahten_report_data|sahten_mostrador|sahten_proj_snapshots|sahten_v4_data|sahten-customization|sahten_notifications)/.test(k));

describe('el proyecto es un archivo', () => {
  it('arranca en blanco con la bienvenida y sin proyecto abierto', async () => {
    const a = await app({});
    expect(a.window.document.getElementById('proj-welcome')).toBeTruthy();
    expect(a.ev('PRODUCTS.length')).toBe(0);
    expect(a.s.info().status).toBe('closed');
    a.window.close();
  }, 60000);

  it('demo → guardar como → editar → se guarda solo a los 2 s → reabrir da lo mismo; nada del negocio en localStorage', async () => {
    const disk = {};
    const a = await app(disk);
    await a.p.openDemo();
    expect(a.ev('PRODUCTS.length')).toBe(6);
    expect(a.s.info()).toMatchObject({ status: 'unsaved', hasFile: false });
    a.mem.queueSaveAs('Mi local.sahten');
    await a.s.saveAs();
    expect(disk['Mi local.sahten']).toBeTruthy();

    // datos del negocio que viven en módulos viejos: pedido, cliente, imagen, personalización, menú online
    a.ev(`SAHTEN_ORDERS.push({id:'o1',num:1,items:[{productId:'pizza_napo',qty:2}],status:'done',total:5000}); _saveOrders();
          SAHTEN_CUSTOMERS.push({id:'c1',name:'Ana'}); _saveCustomers();
          window.SAHTEN_IMAGES.pizza_napo='data:image/png;base64,AAAA';
          localStorage.setItem('sahten-customization', JSON.stringify({brandName:'La Esquina'}));
          MENU_CONFIG.whatsapp='5491100000000'; _saveMenuConfig();`);
    a.ev("PRODUCTS[0].priceAdj=1.1");
    a.p.markDirty();
    expect(a.s.info().status).toBe('dirty');
    await wait(2300);
    expect(a.s.info().status).toBe('saved');
    const saved = JSON.parse(disk['Mi local.sahten']);
    expect(saved.catalog.productos[0].priceAdj).toBe(1.1);
    expect(saved.sales.orders).toHaveLength(1);
    expect(saved.sales.customers[0].name).toBe('Ana');
    expect(saved.images.pizza_napo).toMatch(/^data:image/);
    expect(saved.settings.customization.brandName).toBe('La Esquina');
    expect(saved.online.menuConfig.whatsapp).toBe('5491100000000');
    expect(bizKeys(a.window)).toEqual([]);                      // sin localStorage para datos del negocio
    const before = prices(a); a.window.close();

    // otra «instalación»: abre el archivo
    const b = await app(disk);
    b.mem.queueOpen('Mi local.sahten', disk['Mi local.sahten']);
    await b.s.openFromPicker();
    expect(prices(b)).toEqual(before);
    expect(b.ev('SAHTEN_ORDERS.length')).toBe(1);
    expect(b.ev('SAHTEN_CUSTOMERS[0].name')).toBe('Ana');
    expect(b.ev('SAHTEN_IMAGES.pizza_napo')).toMatch(/^data:image/);
    expect(b.ev('MENU_CONFIG.whatsapp')).toBe('5491100000000');
    expect(JSON.parse(b.ev('localStorage.getItem("sahten-customization")')).brandName).toBe('La Esquina');
    // abrir y no tocar nada no reescribe el archivo
    const text = disk['Mi local.sahten'];
    await wait(2300); await b.s.saveNow();
    expect(disk['Mi local.sahten']).toBe(text);
    b.window.close();
  }, 60000);

  it('abrir un proyecto no mezcla datos con el anterior', async () => {
    const disk = {}; const a = await app(disk);
    await a.p.openDemo();
    a.ev("SAHTEN_ORDERS.push({id:'x',num:1,items:[]}); _saveOrders();");
    const vacio = emptyFile('Vacío'); vacio.project.id = 'pv';
    a.mem.queueOpen('Vacío.sahten', serialize(vacio));
    await a.s.openFromPicker();
    expect(a.ev('PRODUCTS.length')).toBe(0);
    expect(a.ev('SAHTEN_ORDERS.length')).toBe(0);
    expect(a.ev('GASTOS_OP.length')).toBe(0);
    a.window.close();
  }, 60000);

  it('abre un collectState() de v3 (.json), lo convierte y exige guardarlo como .sahten', async () => {
    const disk = {}; const a = await app(disk);
    const legacy = readJSON('tests/fixtures/legacy/v3-pizzeria.json');
    a.mem.queueOpen('Sahten_Proyecto_principal.json', JSON.stringify(legacy));
    const r = await a.s.openFromPicker();
    expect(r.converted).toBe(true);
    expect(a.ev('PRODUCTS.length')).toBe(legacy.PRODUCTS.length);
    expect(a.s.info().status).toBe('unsaved');
    a.mem.queueSaveAs('Convertido.sahten');
    await a.s.saveNow();
    expect(migrate(disk['Convertido.sahten']).kind).toBe('project');
    expect(JSON.parse(disk['Convertido.sahten']).format).toBe('sahten');
    a.window.close();
  }, 60000);

  it('conserva los datos online de un archivo aunque esta instalación no los use', async () => {
    const disk = {}; const a = await app(disk);
    const f = emptyFile('Con online'); f.project.id = 'po';
    f.online.supabase = { url: 'https://x.supabase.co', anonKey: 'k', storeId: 'tienda-1' }; f.futuro = { a: 1 };
    f.catalog.tiers = [{ id: 'T1', name: 'A', factor: 2 }];
    a.mem.queueOpen('Online.sahten', serialize(f));
    await a.s.openFromPicker();
    a.ev("GASTOS_OP.push({id:'g1',name:'Alquiler',amount:100})");
    await a.s.saveNow();
    const saved = JSON.parse(disk['Online.sahten']);
    expect(saved.online.supabase.url).toBe('https://x.supabase.co');
    expect(saved.futuro).toEqual({ a: 1 });
    expect(saved.costs.gastosOp[0].amount).toBe(100);
    a.window.close();
  }, 60000);

  it('estrategia: respaldo previo → aplicar → deshacer deja el archivo idéntico', async () => {
    const disk = {}; const a = await app(disk);
    await a.p.openDemo(); a.mem.queueSaveAs('E.sahten'); await a.s.saveAs();
    await a.s.saveNow({ force: true });
    const before = disk['E.sahten']; const pricesBefore = prices(a);
    await a.s.backupBeforeStrategy();
    a.ev("PRODUCTS.forEach(p=>{p.priceAdj=1.15}); SAHTEN_PROJECT.lastStrategy={name:'x',at:new Date().toISOString(),changes:27}; recalcAll();");
    await a.s.saveNow();
    expect(disk['E.sahten']).not.toBe(before);
    expect(prices(a)).not.toEqual(pricesBefore);
    await a.s.restoreBackup('preStrategy');
    expect(disk['E.sahten']).toBe(before);
    const pa = prices(a); const dif = pa.map((v, i) => v !== pricesBefore[i] ? [i, a.ev(`PRODUCTS[${i}].id`), pricesBefore[i], v] : null).filter(Boolean);
    expect(dif).toEqual([]);
    expect(a.ev('SAHTEN_PROJECT.lastStrategy')).toBeUndefined();
    await a.s.saveNow();
    expect(disk['E.sahten']).toBe(before);
    a.window.close();
  }, 60000);

  it('Ajustes › Archivo y respaldo se dibuja con los respaldos disponibles', async () => {
    const disk = {}; const a = await app(disk);
    await a.p.openDemo(); a.mem.queueSaveAs('R.sahten'); await a.s.saveAs();
    await a.s.backupBeforeStrategy();
    await a.window.SAHTEN.projectUi.renderBackupPanel();
    const html = a.window.document.getElementById('aj-tab-backup').innerHTML;
    expect(html).toMatch(/Restaurar respaldo de ayer/);
    expect(html).toMatch(/Deshacer última estrategia/);
    expect(html).not.toMatch(/Backup completo/);
    a.window.close();
  }, 60000);
});

describe('guardar → cargar no cambia nada (corrige combos y recetas de v3)', () => {
  it('el proyecto de ejemplo es un punto fijo: abrirlo y volver a cargarlo no mueve ni un precio', async () => {
    const a = await app({});
    await a.p.openDemo();
    const antes = prices(a); const h = contentHash(a.p.collect());
    for (let i = 0; i < 2; i++) await a.p.apply(migrate(JSON.parse(serialize(a.p.collect()))).file);
    expect(prices(a)).toEqual(antes);
    expect(contentHash(a.p.collect())).toBe(h);
    a.window.close();
  }, 60000);
  it('las filas de combo de v3 («Pizza Muzzarella x4», «Pizza Napolitana 1/2») conservan su cantidad al migrar', async () => {
    const a = await app({});
    const raw = fileToLegacy(migrate(readJSON('tests/fixtures/demo-raw-v3.sahten')).file);
    a.ev(`applyData(${JSON.stringify(raw)})`);
    const combos = JSON.parse(a.ev("JSON.stringify(PRODUCTS.find(p=>p.id==='combo_fiesta').combos)"));
    expect(combos.length).toBeGreaterThan(0);
    expect(combos.every(c => typeof c.qty === 'number' && c.qty > 0 && c.unit === 'u')).toBe(true);
    expect(combos.find(c => c.frac === '4').qty).toBe(4);
    expect(combos.find(c => c.frac === '1/2').qty).toBe(0.5);
    // ya no se pierden ni se multiplican al guardar y volver a cargar
    const c1 = prices(a);
    await a.p.apply(migrate(JSON.parse(serialize(a.p.collect()))).file);
    expect(prices(a)).toEqual(c1);
    a.window.close();
  }, 60000);
});

describe('«Nuevo proyecto» sin window.prompt (la app de escritorio no lo tiene)', () => {
  it('pide el nombre con un diálogo propio, crea el proyecto y abre el asistente', async () => {
    const a = await app({}); const w = a.window;
    w.prompt = () => null;                                         // como en el webview de Tauri
    a.p.adapter.queueSaveAs('Mi negocio.sahten');
    const run = a.window.SAHTEN.projectUi.run('new', true);
    await new Promise(r => setTimeout(r, 30));
    const input = w.document.querySelector('[role=dialog] input'); expect(input).toBeTruthy();
    input.value = 'Mi negocio';
    [...w.document.querySelectorAll('[role=dialog] button')].find(b => b.textContent === 'Aceptar').click();
    await run; await new Promise(r => setTimeout(r, 60));
    expect(a.p.session.info()).toMatchObject({ name: 'Mi negocio', status: 'saved' });
    expect(w.document.getElementById('sw-ov')).toBeTruthy();       // asistente de configuración
    w.close();
  }, 60000);
  it('cancelar el diálogo no crea nada', async () => {
    const a = await app({}); const run = a.window.SAHTEN.projectUi.run('new', true);
    await new Promise(r => setTimeout(r, 30));
    [...a.window.document.querySelectorAll('[role=dialog] button')].find(b => b.textContent === 'Cancelar').click();
    await run; expect(a.p.session.info().status).toBe('closed');
    a.window.close();
  }, 60000);
  it('ningún archivo de la app usa prompt() (en escritorio devuelve null)', async () => {
    const fs = await import('node:fs'), path = await import('node:path'); const { root } = await import('./helpers.js');
    const walk = d => fs.readdirSync(d, { withFileTypes: true }).flatMap(e => e.isDirectory() ? walk(path.join(d, e.name)) : [path.join(d, e.name)]);
    const bad = walk(path.join(root, 'src')).filter(f => f.endsWith('.js') && !f.endsWith('ask.js') && /(^|[^A-Za-z.])(window\.|w\.)?prompt\(/.test(fs.readFileSync(f, 'utf8')));
    expect(bad).toEqual([]);
  });
});

describe('abrir un .json de versiones anteriores y dónde se guarda', () => {
  it('se convierte en proyecto nuevo y pide YA dónde guardarlo (no queda «sin guardar» a medias)', async () => {
    const disk = {}; const a = await app(disk);
    const legacy = readJSON('tests/fixtures/legacy/v3-pizzeria.json');
    a.mem.queueOpen('Sahten_Proyecto_principal.json', JSON.stringify(legacy));
    a.mem.queueSaveAs('Recuperado.sahten');
    await a.p.open();
    expect(a.s.info()).toMatchObject({ status: 'saved', hasFile: true, fileName: 'Recuperado.sahten' });
    expect(JSON.parse(disk['Recuperado.sahten']).catalog.productos).toHaveLength(legacy.PRODUCTS.length);
    expect(a.ev('PRODUCTS.length')).toBe(legacy.PRODUCTS.length);
    a.window.close();
  }, 60000);
  it('el nombre propuesto sale del negocio', async () => {
    const disk = {}; const a = await app(disk); let suggested = null;
    const create = a.p.adapter.create; a.p.adapter.create = async (n, t) => { suggested = n; return create.call(a.p.adapter, n, t); };
    a.mem.queueOpen('x.json', JSON.stringify(readJSON('tests/fixtures/legacy/v3-pizzeria.json')));
    await a.p.open();
    expect(suggested).toMatch(/\.sahten$/); expect(suggested.length).toBeGreaterThan(7);
    a.window.close();
  }, 60000);
  it('reemplazar los datos del proyecto abierto con otro archivo (con confirmación y respaldo)', async () => {
    const disk = {}; const a = await app(disk);
    await a.p.openDemo(); a.mem.queueSaveAs('Mio.sahten'); await a.s.saveAs();
    a.window.showConfirm = (t, x, ok) => ok();
    const legacy = readJSON('tests/fixtures/legacy/v3-pizzeria.json');
    a.mem.queueOpen('copia.json', JSON.stringify(legacy));
    expect(await a.p.replaceFromFile()).toBe(true);
    expect(a.ev('PRODUCTS.length')).toBe(legacy.PRODUCTS.length);
    expect(a.s.info().hasFile).toBe(true); expect(a.s.info().fileName).toBe('Mio.sahten');
    expect((await a.s.backups()).preStrategy).toBeTruthy();
    await a.s.saveNow(); expect(JSON.parse(disk['Mio.sahten']).catalog.productos).toHaveLength(legacy.PRODUCTS.length);
    a.window.close();
  }, 60000);
  it('Ajustes › Archivo y respaldo muestra dónde está el archivo y las opciones de importar', async () => {
    const disk = {}; const a = await app(disk);
    await a.p.openDemo(); a.mem.queueSaveAs('Mi local.sahten'); await a.s.saveAs();
    await a.window.SAHTEN.projectUi.renderBackupPanel();
    const html = a.window.document.getElementById('aj-tab-backup').innerHTML;
    expect(html).toMatch(/Dónde está guardado/); expect(html).toMatch(/Mi local\.sahten/); expect(html).toMatch(/Cambiar ubicación/);
    expect(html).toMatch(/Importar una copia de seguridad/); expect(html).toMatch(/Reemplazar los datos de este proyecto/);
    a.window.close();
  }, 60000);
  it('el indicador «Sin guardar» se puede tocar para guardar', async () => {
    const a = await app({}); await a.p.openDemo();
    const el = a.window.document.getElementById('autosave-badge');
    a.window.document.getElementById('workspace-switcher-btn');
    await new Promise(r => setTimeout(r, 1100));
    expect(a.s.info().status).toBe('unsaved'); expect(el.style.cursor).toBe('pointer');
    a.window.close();
  }, 60000);
});

describe('indicador de guardado', () => {
  const now = new Date(2026, 9, 5, 12, 0, 0);
  it('«Guardado hace X s»', () => {
    expect(ago(new Date(now - 2000), now)).toBe('ahora');
    expect(ago(new Date(now - 12000), now)).toBe('hace 12 s');
    expect(ago(new Date(now - 125000), now)).toBe('hace 2 min');
    expect(ago(new Date(now - 3 * 3600000), now)).toBe('hace 3 h');
    expect(indicatorText({ status: 'saved', savedAt: new Date(now - 7000) }, now)).toBe('✓ Guardado hace 7 s');
  });
  it('Guardando… / Error / sin guardar', () => {
    expect(indicatorText({ status: 'saving' })).toBe('⏳ Guardando…');
    expect(indicatorText({ status: 'error' })).toBe('⚠ Error al guardar');
    expect(indicatorText({ status: 'unsaved', canAutosave: false })).toMatch(/descargá una copia/);
    expect(indicatorText({ status: 'dirty', canAutosave: true })).toBe('● Cambios sin guardar');
  });
});

describe('demo de la pizzería y tour guiado', () => {
  it('el demo es la pizzería ficticia: pocos platos, con stock, gastos y canales listos', async () => {
    const a = await app({}); await a.p.openDemo();
    expect(a.ev('SAHTEN_PROJECT.name')).toMatch(/Pizzería/); expect(a.ev('PRODUCTS.length')).toBe(6);
    expect(a.ev('INGREDIENTES.length')).toBeGreaterThan(8); expect(a.ev('ENVASES.length')).toBeGreaterThan(2);
    expect(a.ev('totalGF()')).toBeGreaterThan(0); expect(a.ev('Object.keys(STOCK).length')).toBeGreaterThan(10);
    expect(a.ev('PRODUCTS.every(p => mostradorFinalPrice(p) > p.receta_cost && p.receta_cost > 0)')).toBe(true);
    a.window.close();
  }, 60000);
  it('el demo abre el tour solo; se puede salir, repetir desde Ajustes y recorrer hasta el final', async () => {
    const a = await app({}); await a.p.openDemo(); const d = a.window.document;
    await new Promise(r => setTimeout(r, 600));
    expect(a.window.sahtenTour.isOpen()).toBe(true); expect(d.getElementById('st-tour')).toBeTruthy();
    d.querySelector('[data-t=next]').click(); expect(d.querySelector('[role=dialog][aria-label="Tour guiado"]').textContent).toMatch(/Paso 2/);
    d.querySelector('[data-t=skip]').click(); expect(a.window.sahtenTour.isOpen()).toBe(false);
    await a.window.SAHTEN.projectUi.renderBackupPanel();
    const btn = Array.from(d.querySelectorAll('#aj-tab-backup button')).find(b => /Ver el tour/.test(b.textContent)); expect(btn).toBeTruthy();
    btn.click(); expect(a.window.sahtenTour.isOpen()).toBe(true);
    for (let i = 0; i < 20 && a.window.sahtenTour.isOpen(); i++) d.querySelector('[data-t=next]').click();
    expect(a.window.sahtenTour.isOpen()).toBe(false); expect(a.window.sahtenTour.seen()).toBe(true);
    a.window.close();
  }, 60000);
  it('la versión que se muestra sale de APP_VERSION (una sola fuente)', async () => {
    const a = await app({}); const { APP_VERSION } = await import('../src/project/schema.js');
    expect(a.window.document.getElementById('brand-name-sub').textContent).toContain('Beta v' + APP_VERSION);
    expect(a.window.document.body.innerHTML).not.toMatch(/v0\.8/); a.window.close();
  }, 60000);
});

describe('la app arranca siempre limpia', () => {
  it('sin ningún dato de negocio cargado al abrir (ni productos, ni ingredientes, ni gastos, ni stock)', async () => {
    const a = await app({});
    ['PRODUCTS', 'INGREDIENTES', 'ENVASES', 'GASTOS_OP', 'GASTOS_S', 'MOVIMIENTOS', 'SAHTEN_ORDERS'].forEach(n => expect(a.ev(`${n}.length`)).toBe(0));
    expect(a.ev('Object.keys(STOCK).length')).toBe(0); expect(a.ev('_getTiendaConfig().address')).toBe('');
    a.window.close();
  }, 60000);
  it('el programa compilado no trae datos de ningún negocio', async () => {
    const { build } = await import('vite'); const out = path.join(root, '.tmp/dist-check');
    await build({ root, logLevel: 'silent', build: { outDir: out, emptyOutDir: true } });
    const dist = fs.readdirSync(path.join(out, 'assets')).filter(f => f.endsWith('.js')).map(f => fs.readFileSync(path.join(out, 'assets', f), 'utf8')).join('\n');
    expect(dist).not.toMatch(/Shawarma|Choukri|kibbe|2393-7295|Roca 1489/i);   // solo queda el ejemplo ficticio de la pizzería
  });
});
