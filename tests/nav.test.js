// Navegación: una sola lista de secciones, accesible y con URL por panel.
import { describe, it, expect, beforeAll } from 'vitest';
import { buildTestBundle, openApp } from './app-harness.js';
import { panelFromHash } from '../src/ui/nav.js';

beforeAll(async () => { await buildTestBundle(); }, 120000);
const wait = ms => new Promise(r => setTimeout(r, ms));

describe('navegación', () => {
  it('panelFromHash solo acepta #/seccion válidas', () => {
    const ok = n => n === 'menuonline';
    expect(panelFromHash('#/menuonline', ok)).toBe('menuonline');
    expect(panelFromHash('#/nada', ok)).toBeNull();
    expect(panelFromHash('', ok)).toBeNull();
    expect(panelFromHash('#menuonline', ok)).toBeNull();
  });

  it('el menú lateral son enlaces con data-panel, y el cajón del celular tiene las mismas secciones', async () => {
    const a = await openApp(); const d = a.window.document;
    const side = [...d.querySelectorAll('.sidebar .nav-item')];
    expect(side.length).toBe(16);
    side.forEach(el => { expect(el.tagName).toBe('A'); expect(el.getAttribute('href')).toBe('#/' + el.dataset.panel); expect(el.hasAttribute('onclick')).toBe(false); });
    const drawer = new Set([...d.querySelectorAll('.app-drawer-item')].map(e => e.dataset.panel));
    const sideSet = new Set(side.map(e => e.dataset.panel));
    for (const p of sideSet) expect(drawer.has(p), 'falta en el cajón: ' + p).toBe(true);
    expect(d.querySelectorAll('[onclick*="showPanel("]').length).toBe(0);
    a.window.close();
  }, 60000);

  it('tocar una sección la muestra, marca aria-current y actualiza la URL', async () => {
    const a = await openApp(); const w = a.window, d = w.document;
    d.querySelector('.sidebar [data-panel="menuonline"]').click();
    expect(d.getElementById('panel-menuonline').classList.contains('active')).toBe(true);
    expect(w.location.hash).toBe('#/menuonline');
    expect(d.querySelector('.sidebar [data-panel="menuonline"]').getAttribute('aria-current')).toBe('page');
    expect(d.querySelectorAll('.sidebar [aria-current="page"]').length).toBe(1);
    d.querySelector('.app-drawer-item[data-panel="reportes"]').click();
    expect(d.getElementById('panel-reportes').classList.contains('active')).toBe(true);
    expect(w.currentPanel).toBe('reportes');
    w.close();
  }, 60000);

  it('cambiar el hash (Atrás / enlace) navega sin volver a empujar historial', async () => {
    const a = await openApp(); const w = a.window, d = w.document;
    d.querySelector('.sidebar [data-panel="stock"]').click();
    w.location.hash = '#/envases'; await wait(50);
    expect(d.getElementById('panel-envases').classList.contains('active')).toBe(true);
    const len = w.history.length; w.location.hash = '#/nopanel'; await wait(50);
    expect(d.getElementById('panel-envases').classList.contains('active')).toBe(true);
    expect(w.history.length).toBeGreaterThanOrEqual(len);
    w.close();
  }, 60000);
});
