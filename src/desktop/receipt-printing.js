import { invoke } from '@tauri-apps/api/core';
import { isTauri } from './preload.js';
const KEY = 'sahten-direct-printer';

// Preferences and printer names belong to this workstation, never to the project/catalog.
export function createDirectPrinting({ storage, native = false, call = invoke }) {
  let printers = [], supported = native, loading = false, error = '', request = 0;
  const selected = () => { try { return storage.getItem(KEY) || ''; } catch { return ''; } };
  return {
    info: () => ({ printers: [...printers], selected: selected(), supported, loading, error }),
    select(name) { storage.setItem(KEY, String(name || '')); },
    async refresh() {
      if (!native) { supported = false; return; }
      const id = ++request; loading = true; error = '';
      try {
        const result = await call('receipt_printers');
        if (id !== request) return;
        supported = result.supported === true;
        printers = Array.isArray(result.printers) ? result.printers.filter(p => typeof p === 'string') : [];
      } catch (e) { if (id === request) error = String(e?.message || e); }
      finally { if (id === request) loading = false; }
    },
    async print(html, { paperWidthMm }) {
      if (!native) throw Error('La impresión directa requiere la app de escritorio actualizada.');
      const printer = selected();
      if (!printer) throw Error('Elegí la impresora en Ajustes → Impresión.');
      // Native command validates the selected queue again; never silently uses another one.
      try { await call('receipt_print', { html, printer, paperWidthMm: Number(paperWidthMm) }); }
      catch (e) { throw Error(String(e?.message || e)); }
      return { status: 'sent', printer };
    },
  };
}

export function installDirectPrinting(w) {
  const api = createDirectPrinting({ storage: w.localStorage, native: isTauri(w) });
  let requested = false;
  const render = () => {
    const root = w.document.getElementById('receipt-direct-settings');
    if (!root) return;
    const info = api.info(), select = root.querySelector('select'), status = root.querySelector('[role="status"]');
    select.replaceChildren();
    const option = (value, text) => { const el = w.document.createElement('option'); el.value = value; el.textContent = text; select.appendChild(el); };
    option('', 'Elegir impresora de este equipo');
    if (info.selected && !info.printers.includes(info.selected)) option(info.selected, info.selected + ' · no disponible');
    info.printers.forEach(name => option(name, name));
    select.value = info.selected;
    select.disabled = !info.supported || info.loading;
    status.textContent = info.loading ? 'Buscando impresoras instaladas…' : !info.supported ? 'Disponible en la app de escritorio para Windows y Mac.' : info.error ? 'No se pudieron consultar las impresoras: ' + info.error : !info.printers.length ? 'No hay impresoras instaladas. Agregá la impresora en el sistema y actualizá esta lista.' : info.selected && !info.printers.includes(info.selected) ? 'La impresora elegida no está disponible. Revisá su conexión o elegí otra.' : info.selected ? 'Impresora elegida: ' + info.selected : 'Elegí una impresora para usar el modo sin diálogo.';
    for (const origin of ['local', 'online']) {
      const input = w.document.getElementById('receipt-direct-' + origin), auto = w.document.getElementById('receipt-auto-' + origin);
      if (input) { input.disabled = !info.supported || !info.selected || !auto?.checked; input.checked = w.SAHTEN.receipts.options()[origin === 'local' ? 'directLocal' : 'directOnline']; }
    }
  };
  return { ...api, render() { render(); if (!requested && isTauri(w)) { requested = true; this.refresh(); } },
    async refresh() { const p = api.refresh(); render(); await p; render(); },
    select(name) { api.select(name); render(); },
    save() {
      const checked = id => !!w.document.getElementById(id)?.checked;
      w.SAHTEN.receipts.save({autoLocal:checked('receipt-auto-local'),autoOnline:checked('receipt-auto-online'),directLocal:checked('receipt-direct-local'),directOnline:checked('receipt-direct-online')});
      render();
    },
  };
}
