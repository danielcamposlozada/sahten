import { guessCustomerColumns, IMPORT_FIELDS, planCustomerImport, materializeCustomerImport, addressText } from '../core/customer-import.js';
import { bindModalFocus } from './workspace.js';
const esc = v => String(v ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const labels = { name: 'Nombre', surname: 'Apellido', phone: 'Teléfono', email: 'Correo', address: 'Dirección completa', externalId: 'ID del cliente', secondaryEmail: 'Correo secundario', purchaseCount: 'Compras anteriores', lastPurchase: 'Última compra', active: 'Activo', origin: 'Origen', street: 'Calle', number: 'Número', floor: 'Piso / Depto', city: 'Ciudad', reference: 'Referencia', primary: 'Es principal' };

export function installCustomerImport(w = window) {
  const d = w.document;
  const allowed = () => !w.SAHTEN.project.session.readOnly && !d.body.classList.contains('role-readonly');
  let closeCurrent;
  function open() {
    if (!allowed()) return;
    closeCurrent?.();
    const project = w.SAHTEN.state.project;
    const ov = d.createElement('div'); ov.className = 'pricing-overlay';
    const box = d.createElement('section'); box.className = 'pricing-dialog customer-import-dialog'; box.tabIndex = -1;
    box.setAttribute('role', 'dialog'); box.setAttribute('aria-modal', 'true'); box.setAttribute('aria-labelledby', 'customer-import-title');
    ov.append(box); d.body.append(ov);
    box.innerHTML = `<div class="pricing-heading"><div><h2 id="customer-import-title">Importar clientes</h2><p>CSV o Excel · revisión antes de guardar</p></div><button type="button" data-close aria-label="Cerrar importación">×</button></div>
      <label for="customer-import-file">Lista de clientes (.csv, .xlsx o .xls)</label><input id="customer-import-file" type="file" accept=".csv,.xlsx,.xls" style="width:100%"><p class="pricing-help">Hasta 5 MB y 10.000 clientes. La primera fila debe contener los títulos. Los teléfonos se leen como texto. El archivo se procesa en este equipo.</p>
      <div data-import-controls hidden></div><div data-import-preview aria-live="polite"></div><p class="pricing-error" role="alert"></p><div class="pricing-actions"><button type="button" data-close>Cancelar</button><button type="button" data-import-save class="btn-primary" disabled>Importar clientes</button></div>`;
    let release = () => {}, closed = false, data = {}, sheet = '', addressSheet = '', mapping = {}, addressMapping = {}, country = 'keep', plan = null, busy = false;
    const close = () => { closed = true; release(); ov.remove(); closeCurrent = null; };
    closeCurrent = close;
    release = bindModalFocus(box, { w, close, background: [d.querySelector('.main'), d.querySelector('.sidebar')] });
    box.querySelectorAll('[data-close]').forEach(b => b.addEventListener('click', close));
    const controls = box.querySelector('[data-import-controls]'), preview = box.querySelector('[data-import-preview]'), error = box.querySelector('[role=alert]'), save = box.querySelector('[data-import-save]');
    const headers = which => data[which]?.[0] || [];
    const mappingControl = (which, value, field) => `<label>${labels[field]}<select data-map="${field}" data-sheet-kind="${which}"><option value="-1">No importar</option>${headers(which === 'customers' ? sheet : addressSheet).map((h, i) => `<option value="${i}" ${value === i ? 'selected' : ''}>${esc(h || 'Columna ' + (i + 1))}</option>`).join('')}</select></label>`;
    function review() {
      error.textContent = ''; plan = null; save.disabled = true;
      try {
        if ([mapping.name, mapping.phone, mapping.email].every(v => v < 0)) throw new Error('Asigná al menos Nombre, Teléfono o Correo.');
        if (addressSheet && (mapping.externalId < 0 || addressMapping.externalId < 0)) throw new Error('Para vincular Direcciones, asigná el ID del cliente en ambas hojas.');
        plan = planCustomerImport({ rows: data[sheet].slice(1), mapping, addresses: addressSheet ? data[addressSheet].slice(1) : [], addressMapping: addressSheet ? addressMapping : null, existing: w.sahtenCustomers(), country });
        const addresses = plan.rows.filter(r => r.status === 'new').reduce((n, r) => n + r.customer.addresses.length, 0), purchases = plan.rows.filter(r => r.status === 'new').reduce((n, r) => n + r.customer.importedPurchaseCount, 0);
        preview.innerHTML = `<h3>Vista previa</h3><p><strong>${plan.newCount} clientes nuevos · ${addresses} direcciones</strong><br>${plan.duplicateCount} duplicados omitidos · ${plan.invalidCount} filas inválidas${plan.orphanAddresses ? ` · ${plan.orphanAddresses} direcciones sin cliente vinculado` : ''}<br>Compras anteriores declaradas en la lista: ${purchases}. Se conservan como dato importado; no se crean ventas.</p><p class="pricing-help">Los teléfonos compartidos no fusionan personas. Los clientes existentes se conservan. Se muestran las primeras 40 filas; se importarán todas las filas nuevas válidas.</p><div class="customer-import-preview">${plan.rows.slice(0, 40).map(r => `<article><strong>Fila ${r.row} · ${esc(r.customer.name || 'Sin datos')}</strong><p>${esc([r.customer.phone, r.customer.email].filter(Boolean).join(' · '))}</p><p>${r.customer.addresses.map(a => esc(addressText(a)) + (a.isPrimary ? ' · Principal' : '')).join('<br>') || esc(r.customer.address)}</p><small>${esc(r.message || (r.status === 'new' ? 'Nuevo cliente' : r.status))}${r.warnings.length ? ' · ' + esc(r.warnings.join(' · ')) : ''}</small></article>`).join('')}</div>`;
        save.textContent = `Importar ${plan.newCount} clientes`; save.disabled = !plan.newCount;
      } catch (e) { error.textContent = e.message; preview.innerHTML = ''; }
    }
    function renderMappings() {
      controls.hidden = false;
      controls.innerHTML = `<label>Hoja de clientes<select id="customer-import-sheet">${Object.keys(data).map(name => `<option ${name === sheet ? 'selected' : ''}>${esc(name)}</option>`).join('')}</select></label><label>Hoja de direcciones vinculadas<select id="customer-import-address-sheet"><option value="">Sin hoja adicional</option>${Object.keys(data).filter(n => n !== sheet).map(n => `<option ${n === addressSheet ? 'selected' : ''}>${esc(n)}</option>`).join('')}</select></label><label>Formato de teléfono<select id="customer-import-country"><option value="keep" ${country === 'keep' ? 'selected' : ''}>Conservar texto del archivo</option><option value="AR" ${country === 'AR' ? 'selected' : ''}>Argentina · +54 9 y código de área</option></select></label>
        <h3>Columnas de clientes</h3><div class="customer-import-mapping">${['name', 'surname', 'phone', 'email', 'externalId', 'address'].map(f => mappingControl('customers', mapping[f], f)).join('')}</div><details><summary>Más datos de clientes</summary><div class="customer-import-mapping">${Object.keys(IMPORT_FIELDS).filter(f => !['name', 'surname', 'phone', 'email', 'externalId', 'address', 'primary'].includes(f)).map(f => mappingControl('customers', mapping[f], f)).join('')}</div></details>${addressSheet ? `<h3>Columnas de direcciones</h3><div class="customer-import-mapping">${['externalId', 'street', 'number', 'floor', 'city', 'reference', 'primary', 'origin', 'address'].map(f => mappingControl('addresses', addressMapping[f], f)).join('')}</div>` : ''}`;
      controls.querySelector('#customer-import-sheet').addEventListener('change', e => { sheet = e.target.value; mapping = guessCustomerColumns(headers(sheet)); if (sheet === addressSheet) addressSheet = ''; renderMappings(); review(); });
      controls.querySelector('#customer-import-address-sheet').addEventListener('change', e => { addressSheet = e.target.value; addressMapping = guessCustomerColumns(headers(addressSheet)); renderMappings(); review(); });
      controls.querySelector('#customer-import-country').addEventListener('change', e => { country = e.target.value; review(); });
      controls.querySelectorAll('[data-map]').forEach(el => el.addEventListener('change', () => { (el.dataset.sheetKind === 'customers' ? mapping : addressMapping)[el.dataset.map] = Number(el.value); review(); }));
    }
    box.querySelector('input[type=file]').addEventListener('change', async e => {
      const file = e.target.files?.[0]; if (!file) return;
      save.disabled = true; plan = null; error.textContent = ''; preview.textContent = 'Leyendo archivo…'; controls.hidden = true; busy = true;
      try {
        if (!/\.(csv|xlsx|xls)$/i.test(file.name)) throw new Error('Elegí un archivo CSV o Excel.');
        if (file.size > 5 * 1024 * 1024) throw new Error('El archivo supera 5 MB. Dividí la lista antes de importar.');
        const XLSX = await w.SAHTEN.libs.xlsx();
        const bytes = new Uint8Array(await file.arrayBuffer());
        const csv = /\.csv$/i.test(file.name);
        const input = csv ? new TextDecoder('utf-8', { fatal: true }).decode(bytes) : bytes;
        const workbook = XLSX.read(input, { type: csv ? 'string' : 'array', raw: true, cellText: true, sheetRows: 20003 });
        if (closed) return;
        data = Object.fromEntries(workbook.SheetNames.map(n => [n, XLSX.utils.sheet_to_json(workbook.Sheets[n], { header: 1, raw: false, defval: '', blankrows: false })]));
        sheet = workbook.SheetNames.find(n => /^clientes$/i.test(n)) || workbook.SheetNames[0];
        if (!sheet || data[sheet].length < 2) throw new Error('La hoja debe tener títulos y al menos un cliente.');
        addressSheet = workbook.SheetNames.find(n => /^direcciones$/i.test(n)) || '';
        mapping = guessCustomerColumns(headers(sheet)); addressMapping = guessCustomerColumns(headers(addressSheet));
        renderMappings(); review();
      } catch (e) { error.textContent = 'No se pudo preparar la importación: ' + e.message; preview.textContent = ''; }
      finally { busy = false; }
    });
    save.addEventListener('click', () => {
      if (!allowed() || w.SAHTEN.state.project !== project) { error.textContent = 'Cambió el proyecto o el permiso. Volvé a abrir el importador.'; return; }
      if (busy || !plan) return;
      review(); if (!plan?.newCount) return;
      const customers = materializeCustomerImport(plan);
      w.sahtenCustomers().push(...customers); w._saveCustomers(); w.SAHTEN.project.markDirty(); w.scheduleSave();
      w.renderMostrador(); close(); w._posToast?.(`${customers.length} clientes importados con sus direcciones`);
    });
  }
  return { open };
}
