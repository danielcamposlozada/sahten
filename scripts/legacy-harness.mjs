// Carga una página HTML de Sahten (v3 original o la app refactorizada ya compilada) en jsdom,
// sin red, para poder leer números y ejecutar funciones del código legacy.
import { JSDOM, ResourceLoader, VirtualConsole } from 'jsdom';
import fs from 'node:fs';
import path from 'node:path';

class LocalLoader extends ResourceLoader {
  constructor(root) { super(); this.root = root; }
  fetch(url) {
    const u = new URL(url);
    if (u.hostname !== 'localhost') return Promise.resolve(Buffer.from('')); // sin red
    const p = path.join(this.root, decodeURIComponent(u.pathname));
    if (!fs.existsSync(p)) return Promise.resolve(Buffer.from(''));
    return Promise.resolve(fs.readFileSync(p));
  }
}

export async function loadLegacy({ root, file, storage = {}, quiet = true }) {
  const html = fs.readFileSync(path.join(root, file), 'utf8');
  const vc = new VirtualConsole();
  const logs = [];
  vc.on('jsdomError', e => logs.push('jsdomError: ' + (e.detail?.stack || e.message)));
  vc.on('error', (...a) => logs.push('error: ' + a.join(' ')));
  if (!quiet) vc.sendTo(console);
  const dom = new JSDOM(html, {
    url: 'http://localhost/' + encodeURIComponent(file),
    runScripts: 'dangerously', resources: new LocalLoader(root), pretendToBeVisual: true, virtualConsole: vc,
    beforeParse(w) {
      Object.entries(storage).forEach(([k, v]) => w.localStorage.setItem(k, v));
      w.Chart = function () { return { destroy() {}, update() {}, data: {}, options: {} }; };
      w.Chart.defaults = { font: {}, color: '', plugins: { legend: { labels: {} } }, scale: {}, scales: {} };
      w.Chart.register = () => {};
      w.matchMedia = w.matchMedia || (() => ({ matches: false, addListener() {}, removeListener() {}, addEventListener() {}, removeEventListener() {} }));
      w.scrollTo = () => {};
      w.HTMLCanvasElement.prototype.getContext = () => null;
      w.alert = () => {}; w.confirm = () => true;
    },
  });
  await Promise.race([new Promise(r => dom.window.addEventListener('load', r)), new Promise(r => setTimeout(r, 8000))]);
  await new Promise(r => setTimeout(r, 300));
  return { dom, window: dom.window, logs };
}
