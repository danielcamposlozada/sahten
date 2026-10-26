const normalized = value => String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
export function customerMatches(customers, query, limit = 8) {
  const q = normalized(query), digits = q.replace(/\D/g, '');
  return (customers || []).filter(c => {
    if (!q) return true;
    if (digits && !/[a-z]/.test(q)) return String(c.phone || '').replace(/\D/g, '').includes(digits);
    const hay = normalized([c.name, c.phone, c.email].join(' '));
    return q.split(/\s+/).every(word => hay.includes(word));
  }).sort((a, b) => (normalized(b.name).startsWith(q) ? 1 : 0) - (normalized(a.name).startsWith(q) ? 1 : 0) || String(a.name).localeCompare(String(b.name), 'es')).slice(0, limit);
}

/** Busca solo en los clientes de este proyecto: no consulta ni envía datos a servicios externos. */
export function installCustomerPicker(w = window) {
  let state = { project: null, selected: null, query: '' }, mounted;
  const node = (tag, text) => { const el = w.document.createElement(tag); if (text) el.textContent = text; return el; };
  function mount(root, { list, selected, select, create }) {
    if (!root) return;
    root.replaceChildren();
    const project = w.SAHTEN.project.session.id, chosen = list().find(c => c.id === selected());
    if (state.project !== project || state.selected !== (chosen?.id || null)) state = { project, selected: chosen?.id || null, query: chosen ? [chosen.name, chosen.phone].filter(Boolean).join(' · ') : '' };
    const label = node('label', 'Cliente'); label.htmlFor = 'most-customer-search';
    const row = node('div'); row.className = 'most-customer-search-row';
    const input = node('input'); input.id = 'most-customer-search'; input.type = 'text'; input.value = state.query;
    input.placeholder = 'Nombre, teléfono o email…'; input.autocomplete = 'off'; input.setAttribute('role', 'combobox'); input.setAttribute('aria-autocomplete', 'list'); input.setAttribute('aria-expanded', 'false'); input.setAttribute('aria-controls', 'most-customer-options'); input.setAttribute('aria-describedby', 'most-customer-selection');
    const clear = node('button', 'Limpiar'); clear.type = 'button'; clear.setAttribute('aria-label', 'Usar Consumidor Final');
    const results = node('div'); results.id = 'most-customer-options'; results.setAttribute('role', 'listbox'); results.setAttribute('aria-label', 'Clientes encontrados'); results.hidden = true;
    const status = node('div'); status.id = 'most-customer-selection'; status.className = 'most-customer-selection'; status.setAttribute('role', 'status');
    const add = node('button', 'Nuevo cliente'); add.type = 'button'; add.className = 'most-customer-create';
    row.append(input, clear); root.append(label, row, status, results, add);
    let options = [], active = -1;
    function selectionText() {
      const c = list().find(c => c.id === selected());
      status.textContent = c ? 'Asignado: ' + c.name + (c.phone ? ' · ' + c.phone : '') : state.query ? 'Elegí una sugerencia o creá un cliente.' : 'Consumidor Final';
      clear.hidden = !c && !state.query;
    }
    function close() { results.hidden = true; input.setAttribute('aria-expanded', 'false'); input.removeAttribute('aria-activedescendant'); active = -1; }
    function choose(id) {
      const c = list().find(c => c.id === id); select(c?.id || null);
      state.selected = c?.id || null; state.query = c ? [c.name, c.phone].filter(Boolean).join(' · ') : '';
      input.value = state.query; selectionText(); input.focus(); close();
    }
    function focusOption(index) {
      active = index;
      [...results.children].forEach((el, i) => { el.setAttribute('aria-selected', String(i === index)); el.classList.toggle('is-active', i === index); });
      if (index >= 0) { input.setAttribute('aria-activedescendant', results.children[index].id); results.children[index].scrollIntoView?.({ block: 'nearest' }); }
      else input.removeAttribute('aria-activedescendant');
    }
    function search() {
      const q = state.selected ? '' : input.value;
      options = customerMatches(list(), q).map(c => ({ id: c.id, name: c.name, detail: [c.phone, c.email].filter(Boolean).join(' · ') }));
      if (!q.trim()) options.unshift({ id: null, name: 'Consumidor Final', detail: 'Continuar sin asignar un cliente' });
      results.replaceChildren();
      options.forEach((c, i) => {
        const option = node('div'); option.id = 'most-customer-option-' + i; option.setAttribute('role', 'option'); option.setAttribute('aria-selected', 'false');
        option.append(node('strong', c.name), node('span', c.detail));
        option.onmousedown = event => event.preventDefault(); option.onclick = () => choose(c.id); results.append(option);
      });
      if (!options.length) status.textContent = 'No hay coincidencias. Podés crear un cliente con estos datos.';
      else if (!state.selected && state.query) status.textContent = options.length + ' sugerencia(s). Elegí el cliente antes de guardar el pedido.';
      results.hidden = !options.length; input.setAttribute('aria-expanded', String(options.length > 0)); focusOption(-1);
    }
    input.oninput = () => { state.query = input.value; state.selected = null; select(null); selectionText(); search(); };
    input.onfocus = () => { search(); if (state.selected) input.select(); };
    input.onkeydown = event => {
      if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); close(); return; }
      if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
        event.preventDefault(); if (results.hidden) search(); if (!options.length) return;
        const step = event.key === 'ArrowDown' ? 1 : -1; focusOption(active < 0 ? (step > 0 ? 0 : options.length - 1) : (active + step + options.length) % options.length);
      } else if (event.key === 'Enter') { event.preventDefault(); if (active >= 0 && options[active]) choose(options[active].id); }
    };
    root.addEventListener('focusout', event => { if (!root.contains(event.relatedTarget)) close(); });
    clear.onclick = () => { choose(null); close(); };
    add.onclick = () => { close(); const q = state.selected ? '' : state.query.trim(); create(q && !/[a-záéíóúñ]/i.test(q) ? { phone: q } : { name: q }); };
    mounted = { root, input, selected, list, status }; selectionText();
  }
  function valid() {
    if (!state.query.trim() || (state.selected && mounted?.list().some(c=>c.id===state.selected))) return true;
    if (mounted?.root.isConnected) { mounted.status.textContent = 'Elegí un cliente de la lista, creá uno nuevo o limpiá la búsqueda para usar Consumidor Final.'; mounted.input.focus(); }
    return false;
  }
  function reset() { state = { project: null, selected: null, query: '' }; }
  return { mount, valid, reset };
}
