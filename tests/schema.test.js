import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { root, readJSON } from './helpers.js';
import { legacyToFile, fileToLegacy, migrate, mergeUnknown, serialize, contentHash, emptyFile, SCHEMA_VERSION, fileNameFor } from '../src/project/schema.js';

const fx = n => JSON.parse(fs.readFileSync(path.join(root, 'tests/fixtures/legacy', n), 'utf8'));
const V3 = () => fx('v3-pizzeria.json');
const V2 = () => fx('v2-pizzeria.json');

// campos que no viajan al archivo (derivados o de la sesión)
const strip = L => { const c = JSON.parse(JSON.stringify(L)); delete c.savedAt; delete c._version; return c; };

describe('formato .sahten', () => {
  it('collectState() de v3 → archivo → collectState() sin perder nada', () => {
    const L = V3();
    const back = fileToLegacy(legacyToFile(L));
    const a = strip(L), b = strip(back);
    // usdRate / globalCommission pasan de texto a número y vuelven a texto
    expect(String(b.usdRate)).toBe(String(a.usdRate)); expect(String(b.globalCommission)).toBe(String(a.globalCommission));
    delete a.usdRate; delete b.usdRate; delete a.globalCommission; delete b.globalCommission;
    // el extra de v4 (imágenes, tema, personalización) aparece vacío
    ['images', 'theme', 'customization', 'supabase'].forEach(k => { delete b[k]; });
    // v3 viejo no tenía gfMonths/project (quedan vacíos) y guardaba un descuento de GF en 0 que ya no existe
    ['gfMonths', 'project'].forEach(k => { if (a[k] === undefined && !Object.keys(b[k]).length) delete b[k]; });
    delete a.gfDiscPct; delete a.gfDiscNotes;
    Object.keys(a).forEach(k => { if (a[k] === undefined) delete a[k]; });
    expect(b).toEqual(a);
  });
  it('tiene todas las secciones del formato', () => {
    const f = legacyToFile(V3());
    expect(Object.keys(f)).toEqual(['format', 'schemaVersion', 'appVersion', 'modifiedAt', 'project', 'settings', 'catalog', 'costs', 'channels', 'stock', 'sales', 'projections', 'online', 'images', 'ui']);
    expect(f.schemaVersion).toBe(SCHEMA_VERSION);
    expect(f.catalog.productos.length).toBeGreaterThan(0);
    expect(f.catalog.categorias.length).toBeGreaterThan(0);
    expect(f.online.supabase).toEqual({ url: '', anonKey: '', storeId: '' });
    expect(f.sales.orders).toBeInstanceOf(Array);
  });
  it('los gastos conservan su id y los productos absorbeGF / priceAdj', () => {
    const L = V3(); L.GASTOS_OP[0].id = 'g123'; L.PRODUCTS[0].absorbeGF = false; L.PRODUCTS[0].priceAdj = 1.07;
    const f = legacyToFile(L);
    expect(f.costs.gastosOp[0].id).toBe('g123');
    expect(f.catalog.productos[0]).toMatchObject({ absorbeGF: false, priceAdj: 1.07 });
  });
  it('serialización estable: guardar → leer → guardar da exactamente el mismo texto', () => {
    const f = legacyToFile(V3(), { modifiedAt: '2026-10-04T12:00:00.000Z' });
    const t1 = serialize(f);
    const t2 = serialize(migrate(t1).file);
    expect(t2).toBe(t1);
  });
  it('contentHash ignora modifiedAt y ui, pero no los datos', () => {
    const f = legacyToFile(V3());
    const h = contentHash(f);
    expect(contentHash({ ...f, modifiedAt: 'otra', ui: { currentPanel: 'stock' } })).toBe(h);
    const g = JSON.parse(JSON.stringify(f)); g.catalog.productos[0].priceAdj = 1.2;
    expect(contentHash(g)).not.toBe(h);
  });
  it('nombre de archivo seguro', () => {
    expect(fileNameFor('La Esquina / Centro: 2')).toBe('La Esquina Centro 2.sahten');
    expect(fileNameFor('')).toBe('Proyecto.sahten');
  });
});

describe('migrate()', () => {
  it('acepta el JSON de collectState() de v3 y de v2', () => {
    [V3(), V2()].forEach(L => {
      const r = migrate(L);
      expect(r.kind).toBe('project');
      expect(r.file.format).toBe('sahten');
      expect(r.file.catalog.productos.length).toBe(L.PRODUCTS.length);
      expect(r.notes[0]).toMatch(/convertido/);
    });
  });
  it('acepta un texto JSON', () => { expect(migrate(JSON.stringify(V3())).kind).toBe('project'); });
  it('esquema 1 (Fase A) → 2: completa las secciones que faltaban', () => {
    const r = migrate(readJSON('tests/fixtures/demo-raw-v3.sahten'));
    expect(r.file.schemaVersion).toBe(SCHEMA_VERSION);
    expect(r.file.sales).toEqual({ orders: [], customers: [], discounts: [], payments: [], reportData: {} });
    expect(r.file.online.supabase).toEqual({ url: '', anonKey: '', storeId: '' });
    expect(r.file.catalog.categorias.length).toBeGreaterThan(0);
    expect(r.notes).toContain('Esquema 1 → 2');
  });
  it('Proyeccion_*.json → proyecciones para agregar a un proyecto abierto', () => {
    ['tests/fixtures/legacy/Proyeccion_Mostrador_60.json', 'tests/fixtures/legacy/Proyeccion_Objetivo_5M.json'].forEach(n => {
      const r = migrate(readJSON(n));
      expect(r.kind).toBe('projection');
      expect(r.file.projections.snapshots).toHaveLength(1);
    });
    expect(migrate([readJSON('tests/fixtures/legacy/Proyeccion_Mostrador_60.json'), readJSON('tests/fixtures/legacy/Proyeccion_Objetivo_5M.json')]).file.projections.snapshots).toHaveLength(2);
  });
  it('un archivo de una versión más nueva se abre con aviso y conserva lo desconocido', () => {
    const f = emptyFile('X'); f.schemaVersion = 99; f.futuro = { a: 1 };
    const r = migrate(f);
    expect(r.notes[0]).toMatch(/versión más nueva/);
    expect(r.file.futuro).toEqual({ a: 1 });
    expect(r.file.schemaVersion).toBe(99);
  });
  it('lo que no es de Sahten da un error entendible', () => {
    expect(() => migrate('{no json')).toThrow(/JSON válido/);
    expect(() => migrate({ hola: 1 })).toThrow(/No reconozco/);
    expect(() => migrate(42)).toThrow();
  });
});

describe('mismo formato con o sin online', () => {
  it('conserva online.supabase y claves desconocidas al volver a generar el archivo', () => {
    const prev = emptyFile('Con online');
    prev.online.supabase = { url: 'https://x.supabase.co', anonKey: 'anon', storeId: 'tienda-1' };
    prev.online.realtime = { canal: 'pedidos' };
    prev.futuro = { rol: 'owner' };
    prev.costs.extra = 7;
    // una instalación sin online arma el archivo desde su estado (supabase vacío)
    const generated = legacyToFile(fileToLegacy(prev), { prev });
    expect(generated.online.supabase).toEqual({ url: 'https://x.supabase.co', anonKey: 'anon', storeId: 'tienda-1' });
    expect(generated.online.realtime).toEqual({ canal: 'pedidos' });
    expect(generated.futuro).toEqual({ rol: 'owner' });
    expect(generated.costs.extra).toBe(7);
  });
  it('si el usuario configura supabase, lo nuevo gana', () => {
    const prev = emptyFile(); prev.online.supabase = { url: 'a', anonKey: 'b', storeId: 'c' };
    const next = emptyFile(); next.online.supabase = { url: 'nuevo', anonKey: '', storeId: '' };
    expect(mergeUnknown(prev, next).online.supabase).toEqual({ url: 'nuevo', anonKey: 'b', storeId: 'c' });
  });
});
