// ═══════════════════════════════════════════════════════════
// SITIO WEB — editor modular (pestaña «Sitio web» de Menú Online): cada sección es una tarjeta que se enciende, se mueve y se edita,
// con la vista previa REAL de la página al lado (la misma que se publica).
// ═══════════════════════════════════════════════════════════
const _sbUi = { open: 'hero', device: 'desktop', timer: null, scroll: 0, focus: null, bound: false, googleMsg: '' };
const _sbKey = { get: () => { try { return localStorage.getItem('sahten-google-key') || ''; } catch (e) { return ''; } }, set: v => { try { localStorage.setItem('sahten-google-key', v); } catch (e) { /* */ } } };

// Cómo se edita cada sección: [tipo, ruta, etiqueta, ayuda|filas, ...]. tipos: text · area · image · list
const _SB_FIELDS = {
  seo: [['text', 'url', 'Dirección pública de la web', 'https://tudominio.com/'], ['text', 'title', 'Título para Google'], ['area', 'description', 'Descripción para buscadores', 3], ['text', 'cuisine', 'Tipo de cocina'], ['text', 'streetAddress', 'Calle y número'], ['text', 'locality', 'Localidad'], ['text', 'region', 'Provincia o región'], ['text', 'country', 'Código de país', 'AR'], ['text', 'openingHours', 'Horarios para buscadores', 'Mo-Th 18:00-22:00, Fr-Sa 18:00-23:00'], ['text', 'areaServed', 'Barrios donde reparten (separados por coma)', 'Belgrano, Núñez, Olivos'], ['text', 'sameAs', 'Otros perfiles públicos (Facebook, TripAdvisor, Google Maps; separados por coma)', 'https://www.facebook.com/tunegocio'], ['text', 'brandKit', 'Kit de imágenes de marca (íconos e imagen al compartir; hoy: sahten)', 'sahten']],
  hero: [['logo'], ['text', 'title', 'Título', 'Ej: Las mejores pizzas del barrio'], ['area', 'subtitle', 'Bajada', 2], ['text', 'cta', 'Texto del botón principal'], ['image', 'hero', 'Foto de fondo (opcional)'],
    ['list', 'highlights', 'Destacados (hasta 4)', { add: 'Agregar destacado', max: 4, fields: [['icon', 'Ícono 🍕', 'sm'], ['title', 'Título'], ['text', 'Detalle']] }]],
  favoritos: [['text', 'title', 'Título'], ['area', 'text', 'Texto de introducción', 2], ['note', 'Muestra los productos marcados con ⭐ en la lista de Menú (hasta 6).']],
  menu: [['text', 'title', 'Título de la sección'], ['note', 'Es tu carta con categorías y el carrito. Siempre está; solo podés moverla de lugar.']],
  como: [['text', 'title', 'Título'], ['text', 'lead', 'Bajada'], ['list', 'steps', 'Pasos (hasta 4)', { add: 'Agregar paso', max: 4, fields: [['title', 'Título'], ['text', 'Detalle']] }]],
  historia: [['text', 'eyebrow', 'Etiqueta chica', 'Ej: Nuestra historia'], ['text', 'title', 'Título'], ['area', 'text', 'Texto (separá los párrafos con una línea en blanco)', 6], ['image', 'historia', 'Foto (opcional)'],
    ['note', 'Destacado opcional: una palabra con su significado, como «Sahten — buen provecho».'], ['text', 'badgeWord', 'Palabra'], ['text', 'badgeMeaning', 'Significado'], ['area', 'badgeQuote', 'Frase', 2]],
  banda: [['text', 'text', 'Texto de la cinta', 'Ej: PIZZA · DELIVERY · CATERING']],
  resenas: [['text', 'title', 'Título'], ['text', 'lead', 'Bajada', 'Ej: ★★★★★ en Google'], ['google'], ['text', 'reviewUrl', 'Enlace para dejar reseñas en Google', 'Pegá el enlace de Pedir reseñas o Google Maps'], ['text', 'reviewTitle', 'Título de la invitación'], ['area', 'reviewText', 'Texto de la invitación', 2], ['list', 'items', 'Reseñas (hasta 9)', { add: 'Agregar reseña', max: 9, fields: [['text', 'Lo que dijo el cliente', 'area'], ['author', 'Nombre'], ['source', 'Dónde (Google, Instagram…)']] }]],
  catering: [['text', 'eyebrow', 'Etiqueta chica'], ['text', 'title', 'Título'], ['area', 'text', 'Descripción', 4], ['text', 'cta', 'Texto del botón (abre WhatsApp)'],
    ['list', 'info', 'Datos (hasta 4)', { add: 'Agregar dato', max: 4, fields: [['label', 'Dato (ej. Zona)', 'sm'], ['value', 'Valor']] }]],
  delivery: [['text', 'title', 'Título'], ['area', 'hours', 'Horarios', 3], ['text', 'extra', 'Aclaración (opcional)'], ['note', 'Las zonas, el pedido mínimo y el envío gratis salen de Ajustes › Negocio › Tienda online y delivery.']],
  faq: [['text', 'title', 'Título'], ['list', 'items', 'Preguntas (hasta 12)', { add: 'Agregar pregunta', max: 12, fields: [['q', 'Pregunta'], ['a', 'Respuesta', 'area']] }]],
  contacto: [['text', 'instagram', 'Instagram (usuario)', 'tu_usuario'], ['text', 'note', 'Frase del pie (opcional)'], ['note', 'La dirección y el WhatsApp salen de Ajustes › Negocio › Tienda online y delivery y de Menú › Ajustes.']],
};
const _SB_ANCHOR = { hero: 's-hero', favoritos: 's-fav', menu: 's-menuhd', como: 's-how', historia: 's-about', resenas: 's-reviews', catering: 's-catering', delivery: 's-delivery', faq: 's-faq', contacto: 's-contact' };

function _sbSummary(id, m) {
  const n = a => (a || []).filter(x => x && Object.values(x).some(v => String(v || '').trim())).length;
  switch (id) {
    case 'hero': return m.title || 'Sin título (usa el nombre del negocio)';
    case 'favoritos': return `${_moProducts().filter(p => p.star).length} producto(s) con ⭐`;
    case 'menu': return 'Siempre visible';
    case 'como': return `${n(m.steps)} paso(s)`;
    case 'historia': return m.title || (m.text ? m.text.slice(0, 50) + '…' : 'Todavía vacío');
    case 'banda': return m.text || 'Todavía vacía';
    case 'resenas': return `${n(m.items)} reseña(s)`;
    case 'catering': return m.title || (m.text ? m.text.slice(0, 50) + '…' : 'Todavía vacío');
    case 'delivery': return m.hours ? m.hours.split('\n')[0] : 'Zonas y mínimo desde Tienda Online';
    case 'faq': return `${n(m.items)} pregunta(s)`;
    case 'contacto': return m.instagram ? '@' + m.instagram : 'Dirección y WhatsApp automáticos';
  }
  return '';
}

function _sbGet(S, path) { const [m, k] = path.split('.'); return S[m] ? S[m][k] : undefined; }
function _sbRenderField(S, id, f) {
  const [type, key, label, extra] = f; const m = S[id];
  if (type === 'logo') return `<div class="f"><b>Logo de la portada (opcional)</b><p>Podés usar un símbolo distinto al logo de navegación. Si no cargás uno, se usa el logo de la tienda.</p>${m.logo ? `<div style="background:var(--primary,#235328);padding:16px;border-radius:8px;margin-bottom:12px"><img src="${_esc(m.logo)}" alt="Logo de la portada" style="display:block;max-width:100%;width:240px;max-height:110px;object-fit:contain"></div>` : ''}<label class="btn" style="cursor:pointer">${m.logo ? 'Cambiar logo de portada' : 'Cargar logo de portada'}<input type="file" data-sb-logo data-sb-logo-for="hero" accept="image/svg+xml,image/png,image/jpeg,image/webp,.svg" hidden></label> ${m.logo ? '<button class="btn" data-sb-logo-remove="hero">Quitar logo de portada</button>' : ''}<label style="display:flex;gap:10px;margin-top:12px"><input type="checkbox" data-sb-hero-logo-color ${m.logoUseTextColor !== false ? 'checked' : ''}>Usar el color del texto de la portada</label></div>`;
  if (type === 'google') return `<div class="sb-google"><b>Traer reseñas de Google</b><small>Trae hasta 5 reseñas de tu ficha de Google y las deja acá para que las edites o borres. Cada tienda tiene su propio ID de lugar.</small>
      <label class="f">ID del lugar (Place ID)<input type="text" class="custom-input" data-sb="resenas.placeId" placeholder="ChIJ…" value="${_esc(m.placeId)}"></label>
      <label class="f">Clave de API de Google (queda solo en esta computadora)<input type="password" class="custom-input" autocomplete="off" data-sb-gkey value="${_esc(_sbKey.get())}"></label>
      <div><button class="btn" data-sb-google>Traer reseñas</button> <span class="sb-gmsg" id="sb-google-msg">${_esc(_sbUi.googleMsg)}</span></div>
      <small>Necesitás una clave de Google Maps Platform con «Places API (New)» activada. Google limita cuánto se puede guardar y pide indicar que vienen de Google: el sitio las muestra con la etiqueta «Google».</small></div>`;
  if (type === 'note') return `<div class="sb-note">${_esc(key)}</div>`;
  if (type === 'text') return `<label class="f">${_esc(label)}<input type="text" class="custom-input" data-sb="${id}.${key}" placeholder="${_esc(extra || '')}" value="${_esc(m[key])}"></label>`;
  if (type === 'area') return `<label class="f">${_esc(label)}<textarea class="custom-input" rows="${extra || 3}" style="resize:vertical" data-sb="${id}.${key}">${_esc(m[key])}</textarea></label>`;
  if (type === 'image') {
    return `<div class="f"><span>${_esc(label)}</span><div class="sb-img">${SAHTEN.photos.thumb('site_' + key, label, { size: 96 })}
      <div><button class="btn" data-photo-pick="site_${_esc(key)}">📷 Subir o cambiar foto</button><div style="font-size:11px;color:var(--muted);margin-top:6px">También podés arrastrar una imagen sobre la foto.</div></div></div></div>`;
  }
  if (type === 'list') {
    const items = m[key] || []; const o = extra;
    return `<div class="f"><span>${_esc(label)}</span>${items.map((it, i) => `<div class="sb-row"><div class="sb-in">${o.fields.map(([k, ph, kind]) => kind === 'area' ? `<textarea class="custom-input" rows="2" style="resize:vertical" placeholder="${_esc(ph)}" aria-label="${_esc(ph)}" data-sb-l="${id}.${key}" data-i="${i}" data-k="${k}">${_esc(it[k])}</textarea>` : `<input class="custom-input ${kind === 'sm' ? 'sm' : ''}" placeholder="${_esc(ph)}" aria-label="${_esc(ph)}" data-sb-l="${id}.${key}" data-i="${i}" data-k="${k}" value="${_esc(it[k])}">`).join('')}</div><button class="mo-iconbtn" data-sb-del="${id}.${key}" data-i="${i}" aria-label="Quitar">✕</button></div>`).join('')}
      <div><button class="btn" data-sb-add="${id}.${key}" ${items.length >= o.max ? 'disabled' : ''}>+ ${_esc(o.add)}</button></div></div>`;
  }
  return '';
}

function _sbRenderList() {
  const el = document.getElementById('sb-list'); if (!el) return;
  const S = _moSite(); const meta = Object.fromEntries(SAHTEN_SITE.SITE_MODULES.map(x => [x.id, x]));
  el.innerHTML = '<details class="sb-seo"><summary style="padding:16px;font-weight:700;cursor:pointer">Buscadores y enlaces compartidos</summary><div style="padding:16px">' + _SB_FIELDS.seo.map(f => _sbRenderField(S, 'seo', f)).join('') + '<p>Los cambios de título, descripción y dirección requieren volver a publicar la carpeta web para actualizar lo que reciben los buscadores.</p></div></details>' + S.order.map((id, idx) => {
    const x = meta[id]; const m = S[id]; const fixed = !!x.fixed; const on = fixed || m.on; const open = _sbUi.open === id;
    return `<section class="sb-mod ${on ? '' : 'off'} ${open ? 'open' : ''}" data-mod="${id}" draggable="true">
      <div class="sb-head">
        <span class="mo-grip" aria-hidden="true" title="Arrastrá para reordenar">⋮⋮</span>
        <button class="sb-title" data-sb-open="${id}" aria-expanded="${open}"><span class="sb-ic" aria-hidden="true">${x.icon}</span><span><b>${_esc(x.name)}</b><small>${_esc(_sbSummary(id, m))}</small></span></button>
        <button class="mo-iconbtn" data-sb-move="${id}" data-d="-1" aria-label="Subir ${_esc(x.name)}" ${idx === 0 ? 'disabled' : ''}>▲</button>
        <button class="mo-iconbtn" data-sb-move="${id}" data-d="1" aria-label="Bajar ${_esc(x.name)}" ${idx === S.order.length - 1 ? 'disabled' : ''}>▼</button>
        ${fixed ? '<span style="width:38px"></span>' : `<label class="mo-sw" title="${on ? 'Apagar' : 'Encender'} esta sección"><input type="checkbox" data-sb-on="${id}" ${on ? 'checked' : ''} aria-label="${_esc(x.name)} visible"><span></span></label>`}
      </div>
      ${open ? `<div class="sb-edit"><div class="sb-desc">${_esc(x.desc)}</div>${_SB_FIELDS[id].map(f => _sbRenderField(S, id, f)).join('')}</div>` : ''}
    </section>`;
  }).join('');
}

function _sbRenderTop() {
  const el = document.getElementById('sb-top'); if (!el) return; const S = _moSite();
  el.innerHTML = `<div class="sb-file"><button class="btn" data-sb-export>Exportar contenido</button><label class="btn" style="cursor:pointer">Importar contenido<input type="file" accept=".json,application/json" hidden data-sb-import></label></div><div class="f" style="padding:16px;border:1px solid var(--border);border-radius:12px;margin:12px 0"><b>Logo de la tienda</b><p style="font-size:14px">Se muestra en el encabezado y la portada de tu web. No cambia el logo de la aplicación.</p>${S.logo ? `<div style="background:var(--primary,#235328);padding:16px;border-radius:8px;margin-bottom:12px"><img src="${_esc(S.logo)}" alt="Logo de la tienda" style="display:block;max-width:100%;width:240px;max-height:110px;object-fit:contain"></div>` : '<p>Sin logo personalizado: se usa el kit de marca o el nombre del negocio.</p>'}<label class="btn" style="cursor:pointer">${S.logo ? 'Cambiar logo' : 'Cargar logo'}<input type="file" data-sb-logo accept="image/svg+xml,image/png,image/jpeg,image/webp,.svg" hidden></label> ${S.logo ? '<button class="btn" data-sb-logo-remove>Quitar logo</button>' : ''}<small style="display:block;margin-top:8px">SVG, PNG, JPG o WebP · hasta 2 MB. Recomendado: fondo transparente.</small><label style="display:flex;gap:10px;margin-top:12px"><input type="checkbox" data-sb-logo-color ${S.logoUseTextColor ? 'checked' : ''}>Usar el mismo color que el texto del encabezado</label></div><label class="sb-master"><span class="mo-sw"><input type="checkbox" data-sb-enabled ${S.enabled ? 'checked' : ''}><span></span></span>
    <span><b>${S.enabled ? 'Sitio completo activado' : 'Sitio apagado: se publica solo el menú'}</b><small>${S.enabled ? 'Se publica tu menú con las secciones encendidas.' : 'Encendelo para publicar portada, historia, reseñas y más.'}</small></span></label><label class="sb-master"><input type="checkbox" data-sb-order-page ${S.orderPage ? 'checked' : ''}><span><b>Abrir tienda en una página independiente</b><small>El botón «Pedir online» abre /pedir/. Podés enlazarlo desde tu propia web. En la vista previa se abre dentro del editor.</small></span></label>${S.enabled ? '' : '<p class="sb-offnote">La vista previa de la derecha muestra cómo quedaría el sitio. Mientras esté apagado, en la web publicada solo se ve el menú.</p>'}`;
}

function _sbSchedulePreview(delay = 300) { clearTimeout(_sbUi.timer); _sbUi.timer = setTimeout(_sbPreview, delay); }
function _sbPreview() {
  const fr = document.getElementById('sb-frame'); if (!fr) return;
  let html; try { html = SAHTEN.online.publish.previewHtml({ forceSite: true }); } catch (e) { fr.srcdoc = '<p style="font:14px sans-serif;padding:20px">La vista previa no está disponible: ' + _esc(e.message) + '</p>'; return; }
  try { _sbUi.scroll = fr.contentWindow ? fr.contentWindow.scrollY : 0; } catch (e) { _sbUi.scroll = 0; }
  const want = _sbUi.focus; _sbUi.focus = null; const keep = _sbUi.scroll;
  fr.onload = () => {   // la página dibuja su contenido un instante después de cargar: se espera a que esté lista
    let tries = 0;
    const go = () => { try { const w = fr.contentWindow, d = w.document;
      const a = want ? (d.getElementById(_SB_ANCHOR[want]) || (want === 'banda' ? d.querySelector('.band') : null)) : null;
      const ready = want ? !!a : d.querySelectorAll('#grid > *').length > 0;
      if (!ready && tries++ < 50) return setTimeout(go, 60);
      if (a) a.scrollIntoView({ behavior: 'instant', block: 'start' }); else w.scrollTo({ top: keep, behavior: 'instant' }); } catch (e) { /* */ } };
    go(); };
  fr.srcdoc = html;
}

function _sbRender() {
  const host = document.getElementById('mo-tab-site'); if (!host) return;
  host.innerHTML = `<div class="sb">
    <div class="sb-left"><div id="sb-top"></div><div id="sb-list"></div>
      <div class="sb-help">Las secciones se muestran en este orden, de arriba hacia abajo. Arrastrá ⋮⋮ o usá ▲▼ para moverlas.</div></div>
    <div class="sb-right"><div class="sb-tools"><div class="mo-chips" role="group" aria-label="Dispositivo">
        <button class="mo-chip ${_sbUi.device === 'desktop' ? 'on' : ''}" data-sb-dev="desktop">Escritorio</button><button class="mo-chip ${_sbUi.device === 'mobile' ? 'on' : ''}" data-sb-dev="mobile">Celular</button></div>
        <span style="flex:1"></span><button class="btn" data-mo="preview-ext">Abrir en el navegador</button></div>
      <div class="sb-frame ${_sbUi.device}"><iframe id="sb-frame" title="Vista previa del sitio" sandbox="allow-scripts allow-same-origin"></iframe></div></div>
  </div>`;
  _sbRenderTop(); _sbRenderList(); _sbBind(host); _sbPreview();
}

function _sbChanged({ list = false, top = false, preview = true } = {}) {
  _saveMenuConfig(); if (typeof _moRenderStatus === 'function') _moRenderStatus();
  if (list) _sbRenderList(); if (top) _sbRenderTop(); if (preview) _sbSchedulePreview();
}

function _sbImage(key, file) {
  if (!file) return; const fr = new FileReader();
  fr.onload = () => { const img = new Image(); img.onload = () => {
    const k = Math.min(1, 1600 / Math.max(img.width, img.height)); const c = document.createElement('canvas'); c.width = Math.round(img.width * k); c.height = Math.round(img.height * k);
    const ctx = c.getContext('2d'); ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, c.width, c.height); ctx.drawImage(img, 0, 0, c.width, c.height);
    SAHTEN_IMAGES['site_' + key] = c.toDataURL('image/jpeg', 0.82); if (typeof scheduleSave === 'function') scheduleSave(); _sbChanged({ list: true, preview: true }); };
    img.onerror = () => alert('No se pudo leer esa imagen.'); img.src = fr.result; };
  fr.readAsDataURL(file);
}

function _sbBind(host) {
  if (host.dataset.bound) return; host.dataset.bound = '1';
  host.addEventListener('click', e => {
    const t = e.target.closest('[data-sb-open],[data-sb-move],[data-sb-add],[data-sb-del],[data-sb-imgdel],[data-sb-dev],[data-sb-google],[data-sb-export],[data-sb-logo-remove]'); if (!t || !host.contains(t)) return;
    const S = _moSite();
    if (t.dataset.sbOpen) { _sbUi.open = _sbUi.open === t.dataset.sbOpen ? null : t.dataset.sbOpen; if (_sbUi.open) _sbUi.focus = _sbUi.open; _sbRenderList(); if (_sbUi.open) _sbSchedulePreview(0); }
    else if (t.dataset.sbMove) { const id = t.dataset.sbMove, i = S.order.indexOf(id), j = i + +t.dataset.d; if (j < 0 || j >= S.order.length) return; S.order.splice(i, 1); S.order.splice(j, 0, id); _sbChanged({ list: true }); }
    else if (t.dataset.sbAdd) { const [m, k] = t.dataset.sbAdd.split('.'); S[m][k].push({}); _sbChanged({ list: true }); }
    else if (t.dataset.sbDel) { const [m, k] = t.dataset.sbDel.split('.'); S[m][k].splice(+t.dataset.i, 1); _sbChanged({ list: true }); }
    else if (t.dataset.sbImgdel) { delete SAHTEN_IMAGES['site_' + t.dataset.sbImgdel]; if (typeof scheduleSave === 'function') scheduleSave(); _sbChanged({ list: true }); }
    else if (t.dataset.sbGoogle !== undefined) _sbGoogle();
    else if (t.dataset.sbExport !== undefined) _sbExport();
    else if (t.dataset.sbLogoRemove !== undefined) { if (t.dataset.sbLogoRemove === 'hero') S.hero.logo = ''; else S.logo = ''; _sbChanged({ top: true, list: true }); }
    else if (t.dataset.sbDev) { _sbUi.device = t.dataset.sbDev; host.querySelectorAll('[data-sb-dev]').forEach(b => b.classList.toggle('on', b.dataset.sbDev === _sbUi.device)); host.querySelector('.sb-frame').className = 'sb-frame ' + _sbUi.device; }
  });
  host.addEventListener('change', e => {
    const t = e.target; const S = _moSite();
    if (t.dataset.sbEnabled !== undefined) { S.enabled = t.checked; _sbChanged({ top: true }); }
    if (t.dataset.sbOrderPage !== undefined) { S.orderPage = t.checked; _sbChanged({ top: true }); }
    else if (t.dataset.sbLogo !== undefined && t.files && t.files[0]) { const config = MENU_CONFIG, target = t.dataset.sbLogoFor; SAHTEN_SITE.readStoreLogo(t.files[0]).then(logo => { if (MENU_CONFIG !== config) return; if (target === 'hero') _moSite().hero.logo = logo; else _moSite().logo = logo; _sbChanged({ top: true, list: true }); }).catch(err => alert(err.message)); }
    else if (t.dataset.sbLogoColor !== undefined) { S.logoUseTextColor = t.checked; _sbChanged({}); }
    else if (t.dataset.sbHeroLogoColor !== undefined) { S.hero.logoUseTextColor = t.checked; _sbChanged({}); }
    else if (t.dataset.sbOn) { S[t.dataset.sbOn].on = t.checked; _sbChanged({ list: true }); }
    else if (t.dataset.sbImg) _sbImage(t.dataset.sbImg, t.files && t.files[0]);
    else if (t.dataset.sbImport !== undefined) _sbImport(t.files && t.files[0]);
  });
  host.addEventListener('input', e => {
    const t = e.target; const S = _moSite();
    if (t.dataset.sbGkey !== undefined) { _sbKey.set(t.value.trim()); return; }
    if (t.dataset.sb) { const [m, k] = t.dataset.sb.split('.'); S[m][k] = t.value; const h = t.closest('.sb-mod'); const sm = h && h.querySelector('.sb-title small'); if (sm) sm.textContent = _sbSummary(m, S[m]); _sbChanged({}); }
    else if (t.dataset.sbL) { const [m, k] = t.dataset.sbL.split('.'); const L = S[m][k]; const i = +t.dataset.i; while (L.length <= i) L.push({}); L[i][t.dataset.k] = t.value; _sbChanged({}); }
  });
  // arrastrar y soltar secciones
  let drag = null;
  host.addEventListener('dragstart', e => { const h = e.target.closest && e.target.closest('.sb-mod'); if (!h || e.target.closest('input,textarea')) { e.preventDefault(); return; } drag = h.dataset.mod; e.dataTransfer.effectAllowed = 'move'; try { e.dataTransfer.setData('text/plain', drag); } catch (x) { /* */ } });
  host.addEventListener('dragover', e => { const h = e.target.closest && e.target.closest('.sb-mod'); if (!h || drag == null) return; e.preventDefault(); host.querySelectorAll('.dragover').forEach(x => x.classList.remove('dragover')); h.classList.add('dragover'); });
  host.addEventListener('drop', e => { const h = e.target.closest && e.target.closest('.sb-mod'); if (!h || drag == null) return; e.preventDefault(); const S = _moSite(); const from = S.order.indexOf(drag), to = S.order.indexOf(h.dataset.mod); drag = null; if (from < 0 || to < 0 || from === to) return; const [id] = S.order.splice(from, 1); S.order.splice(to, 0, id); _sbChanged({ list: true }); });
  host.addEventListener('dragend', () => { drag = null; host.querySelectorAll('.dragover').forEach(x => x.classList.remove('dragover')); });
}

async function _sbGoogle() {
  const S = _moSite(); const pid = SAHTEN_SITE.normalizePlaceId(S.resenas.placeId); const key = _sbKey.get();
  const say = t => { _sbUi.googleMsg = t; const m = document.getElementById('sb-google-msg'); if (m) m.textContent = t; };
  if (!pid || !key) return say('Completá el ID del lugar y la clave de API.');
  say('Buscando…');
  try {
    const r = await fetch('https://places.googleapis.com/v1/places/' + encodeURIComponent(pid) + '?languageCode=es', { headers: { 'X-Goog-Api-Key': key, 'X-Goog-FieldMask': 'displayName,rating,userRatingCount,reviews' } });
    if (!r.ok) throw new Error(r.status === 403 || r.status === 400 ? 'Google rechazó la clave: revisá que «Places API (New)» esté activada y que la clave sea válida.' : r.status === 404 ? 'No encontré ese lugar: revisá el ID.' : 'Google respondió con un error (' + r.status + ').');
    const { lead, items } = SAHTEN_SITE.reviewsFromGoogle(await r.json());
    if (!items.length) throw new Error('Google no devolvió reseñas con texto para ese lugar.');
    S.resenas.items = items; if (lead) S.resenas.lead = lead; S.resenas.on = true;
    _sbUi.googleMsg = `Listo: ${items.length} reseñas. Editalas o borrá las que no quieras mostrar.`; _sbChanged({ list: true });
  } catch (e) { say(e && e.message ? e.message : 'No se pudo conectar con Google.'); }
}

function _sbExport() {
  const txt = SAHTEN_SITE.exportSiteContent(_moSite()); const name = ((SAHTEN_PROJECT && SAHTEN_PROJECT.name) || 'sitio').replace(/[^\w-]+/g, '_');
  const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([txt], { type: 'application/json' })); a.download = 'sitio-' + name + '.json'; document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 2000);
}

function _sbImport(file) {
  if (!file) return; const fr = new FileReader();
  fr.onload = () => {
    let parsed; try { parsed = SAHTEN_SITE.parseSiteContent(String(fr.result)); } catch (e) { return alert(e.message); }
    const names = Object.fromEntries(SAHTEN_SITE.SITE_MODULES.map(x => [x.id, x.name]));
    const apply = () => { MENU_CONFIG.site = SAHTEN_SITE.applySiteContent(_moSite(), parsed); _sbChanged({ list: true, top: true }); };
    if (typeof showConfirm === 'function') showConfirm('Importar contenido del sitio', 'Se van a reemplazar estas secciones: ' + parsed.modules.map(id => names[id]).join(', ') + '. Las demás y las fotos no se tocan.', apply); else apply();
  };
  fr.readAsText(file);
}

// Foto del sitio cambiada (con el selector común de fotos): se guarda la configuración y se actualiza la vista previa.
window.addEventListener('sahten:photo', ev => { const k = ev.detail && ev.detail.key; if (k && k.indexOf('site_') === 0 && document.getElementById('sb-frame')) _sbChanged({ list: true }); });
