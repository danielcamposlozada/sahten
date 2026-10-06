// ═══════════════════════════════════════════════════════════
// Interfaz del proyecto: menú de archivo, indicador de guardado, bienvenida y Ajustes › Archivo y respaldo
// ═══════════════════════════════════════════════════════════
import { project } from './app.js';
import { ago, indicatorText } from './indicator.js';

const w = window, d = document;
const esc = s => String(s ?? '').replace(/[&<>"']/g, m => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' }[m]));
const session = project.session;

// ── Indicador de guardado ────────────────────────────────
function paintIndicator() {
  const i = session.info();
  const txt = indicatorText(i);
  ['autosave-badge', 'autosave-badge-mobile'].forEach(id => {
    const el = d.getElementById(id); if (!el) return;
    el.textContent = id.endsWith('mobile') ? txt.slice(0, 1) : txt;
    el.title = i.status === 'error' ? (i.error || '') : (i.canAutosave ? '' : 'Este navegador no guarda en el archivo: usá «Guardar» para descargar una copia.');
    el.style.opacity = i.status === 'saved' ? '0.6' : '1';
    el.style.color = i.status === 'error' ? 'var(--red)' : '';
  });
  const nm = d.getElementById('proj-menu-name'); if (nm) nm.textContent = i.name || 'Sin proyecto';
  ['autosave-badge', 'autosave-badge-mobile'].forEach(id => { const el = d.getElementById(id); if (!el) return; const act = ['unsaved', 'error'].includes(i.status); el.style.cursor = act ? 'pointer' : ''; el.onclick = act ? () => project.save() : null; });
}

// ── Menú de archivo (reemplaza el selector de proyectos) ─
function renderMenu() {
  const btn = d.getElementById('workspace-switcher-btn'), menu = d.getElementById('workspace-menu');
  if (!btn || !menu) return;
  const i = session.info();
  btn.innerHTML = `<span class="workspace-switcher-dot"></span><span class="ws-name" id="proj-menu-name">${esc(i.name || 'Sin proyecto')}</span>
    <svg class="workspace-switcher-icon" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="6 9 12 15 18 9"/></svg>`;
  const act = (fn, label, hint = '') => `<button class="workspace-action-btn" onclick="SAHTEN.projectUi.run('${fn}')">${label}${hint ? `<span style="margin-left:auto;font-size:11px;color:var(--muted)">${hint}</span>` : ''}</button>`;
  menu.innerHTML = `
    <div class="workspace-menu-header">Proyecto${i.hasFile ? '' : ' · sin archivo'}</div>
    <div class="workspace-actions" style="border-top:0">
      ${act('switch', 'Cambiar de proyecto…')}
      ${act('open', 'Abrir un archivo…')}
      ${act('new', 'Nuevo proyecto…')}
      ${act('importJson', 'Importar copia (.json)…')}
      ${i.status !== 'closed' ? act('save', 'Guardar', i.canAutosave ? 'automático' : '') + act('saveAs', 'Guardar como…') + act('duplicate', 'Duplicar…') + act('exportCopy', 'Exportar copia…') + act('rename', 'Renombrar…') : ''}
    </div>`;
}

// ── Pantalla de proyectos (tipo perfiles) y bienvenida de la primera vez ──────────────
const AV_COLORS = [[18, 55, 32], [28, 80, 42], [205, 55, 40], [340, 50, 42], [265, 40, 46], [165, 45, 33], [8, 62, 44], [45, 70, 40]];
function avatarStyle(id) { let h = 2166136261; for (const c of String(id)) { h ^= c.charCodeAt(0); h = Math.imul(h, 16777619) >>> 0; } h ^= h >>> 15; h = Math.imul(h, 2246822519) >>> 0; h = (h ^ (h >>> 13)) >>> 0; const [a, s, l] = AV_COLORS[h % AV_COLORS.length]; return `background:hsl(${a} ${s}% ${l}%)`; }
function when(iso) {
  const t = new Date(iso); if (isNaN(t)) return '';
  const days = Math.floor((Date.now() - t.getTime()) / 86400000);
  return days <= 0 ? 'Abierto hoy' : days === 1 ? 'Abierto ayer' : days < 30 ? `Abierto hace ${days} días` : 'Abierto el ' + t.toLocaleDateString('es-AR');
}

/** Primera vez (todavía no hay proyectos): solo dos caminos claros. */
export function showWelcome() {
  d.getElementById('proj-welcome')?.remove();
  const canPick = project.adapter.canAutosave;
  const ov = d.createElement('div'); ov.id = 'proj-welcome'; ov.className = 'sw-ov';
  ov.innerHTML = `<div class="sw-box"><div class="sw-head"><div class="sw-title">Bienvenido a Sahten</div><div class="sw-sub">Costos, precios y pedidos de tu negocio, en un solo lugar.</div></div>
    <div class="sw-body">
      <button class="sw-card" onclick="SAHTEN.projectUi.run('new',true)"><b>Crear mi negocio</b><span>Unas preguntas cortas y listo.</span></button>
      <button class="sw-card" onclick="SAHTEN.projectUi.run('demo',true)"><b>Explorar con un ejemplo</b><span>Una pizzería de muestra, con un recorrido guiado.</span></button>
      <div class="pj-links"><button class="sw-link" onclick="SAHTEN.projectUi.run('open',true)">Abrir un archivo…</button><span aria-hidden="true">·</span><button class="sw-link" onclick="SAHTEN.projectUi.run('importJson',true)">Importar una copia (.json)</button></div>
      ${canPick ? '' : `<div class="sw-note">Este navegador no puede guardar directamente en el archivo: vas a descargar el .sahten con «Guardar». Para guardado automático usá Chrome, Edge o la app de escritorio.</div>`}
    </div></div>`;
  d.body.appendChild(ov);
}

/** Elegir negocio: una tarjeta por proyecto. «Administrar» muestra el tacho para eliminar. */
export function showProjects({ manage = false } = {}) {
  d.getElementById('proj-welcome')?.remove();
  const recents = session.recents();
  if (!recents.length && !session.isOpen) return showWelcome();
  const cur = session.info().id;
  const ov = d.createElement('div'); ov.id = 'proj-welcome'; ov.className = 'sw-ov pj-ov'; ov.dataset.manage = manage ? '1' : '';
  const card = (r, i) => `<div class="pj-card" role="button" tabindex="0" data-open="${esc(r.id)}" aria-label="Abrir ${esc(r.name)}">
      <span class="pj-av" style="${avatarStyle(r.id)}">${esc((r.name || '?').trim().charAt(0).toUpperCase())}</span>
      <span class="pj-name">${esc(r.name)}</span><span class="pj-sub">${when(r.openedAt)}</span>
      ${r.id === cur ? '<span class="pj-badge on">Abierto ahora</span>' : i === 0 ? '<span class="pj-badge">Último</span>' : ''}
      ${manage ? `<button class="pj-del" data-del="${esc(r.id)}" data-name="${esc(r.name)}" aria-label="Eliminar ${esc(r.name)}" title="Eliminar">🗑</button>` : ''}
    </div>`;
  ov.innerHTML = `<div class="pj-box">
      ${session.isOpen ? '<button class="pj-x" data-close aria-label="Cerrar">✕</button>' : ''}
      <div class="pj-title">${manage ? 'Administrar proyectos' : '¿Qué negocio vas a gestionar?'}</div>
      <div class="pj-grid">
        ${recents.map(card).join('')}
        ${manage ? '' : `<div class="pj-card pj-new" role="button" tabindex="0" data-act="new"><span class="pj-av plus">+</span><span class="pj-name">Nuevo proyecto</span><span class="pj-sub">Crear un negocio</span></div>`}
      </div>
      <div class="pj-foot">
        <button class="sw-btn" data-manage="${manage ? '' : '1'}">${manage ? 'Listo' : 'Administrar'}</button>
        ${manage ? '' : `<div class="pj-links"><button class="sw-link" data-act="open">Abrir un archivo…</button><span aria-hidden="true">·</span><button class="sw-link" data-act="importJson">Importar una copia (.json)</button><span aria-hidden="true">·</span><button class="sw-link" data-act="demo">Ver el ejemplo</button></div>`}
      </div>
    </div>`;
  ov.addEventListener('click', async e => {
    const t = e.target.closest('[data-del],[data-open],[data-act],[data-manage],[data-close]'); if (!t) return;
    if (t.dataset.del !== undefined) return askRemove(t.dataset.del, t.dataset.name);
    if (t.dataset.close !== undefined) return ov.remove();
    if (t.dataset.manage !== undefined) return showProjects({ manage: !!t.dataset.manage });
    if (manage) return;
    if (t.dataset.open) { const ok = await openFromGrid(t.dataset.open); if (!ok) showProjects(); return; }
    if (t.dataset.act) { ov.remove(); await actions[t.dataset.act](); if (!session.isOpen) showProjects(); }
  });
  ov.addEventListener('keydown', e => { if ((e.key === 'Enter' || e.key === ' ') && e.target.matches('.pj-card')) { e.preventDefault(); e.target.click(); } if (e.key === 'Escape' && session.isOpen) ov.remove(); });
  d.body.appendChild(ov);
  const first = ov.querySelector('.pj-card'); first && first.focus();
}
async function openFromGrid(id) {
  if (id === session.info().id && session.isOpen) { closeWelcome(); return true; }
  closeWelcome();
  try { await session.openRecent(id); return true; } catch (e) { w.alert(e && e.message ? e.message : String(e)); return false; }
}

// Eliminar: «Quitar de la lista» (el archivo queda) o «Borrar también el archivo» (solo escritorio; pide escribir el nombre)
function askRemove(id, name) {
  const canDelete = session.canDeleteFiles;
  const m = d.createElement('div'); m.className = 'pj-modal';
  m.innerHTML = `<div class="pj-dlg" role="dialog" aria-modal="true" aria-label="Eliminar ${esc(name)}">
      <div class="pj-dlg-t">Eliminar «${esc(name)}»</div>
      <div class="pj-dlg-p"><b>Quitar de la lista</b>: el archivo .sahten queda en tu carpeta y lo podés volver a abrir cuando quieras.${canDelete ? '<br><br><b>Borrar también el archivo</b>: se elimina el proyecto y sus respaldos del disco. No se puede deshacer.' : '<br><br>Este navegador no puede borrar archivos: si querés eliminarlo del todo, borralo desde tu carpeta.'}</div>
      <div class="pj-dlg-b"><button class="sw-btn" data-r="cancel">Cancelar</button><button class="sw-btn" data-r="list">Quitar de la lista</button>${canDelete ? '<button class="sw-btn pri" style="background:#c0392b;border-color:#c0392b" data-r="file">Borrar el archivo…</button>' : ''}</div></div>`;
  m.addEventListener('click', async e => {
    const r = e.target.closest('[data-r]'); if (!r && e.target !== m) return; const k = r && r.dataset.r;
    if (!k || k === 'cancel') return m.remove();
    let opts = {};
    if (k === 'file') {
      const typed = await w.sahtenAsk(`Para borrar el archivo escribí el nombre del proyecto:\n${name}`, '', { confirmLabel: 'Borrar' });
      if (typed == null) return;
      if (typed.trim().toLowerCase() !== String(name).trim().toLowerCase()) return w.alert('El nombre no coincide: no se borró nada.');
      opts = { deleteFile: true };
    }
    m.remove();
    await project.removeProject(id, opts);
    showProjects({ manage: true });
  });
  d.body.appendChild(m);
}

/** Al abrir la app: entra directo al último proyecto; si no se puede (el navegador pide permiso, falta el archivo), muestra la pantalla de proyectos. */
export async function startup() {
  const last = session.recents()[0];
  if (!last) return showWelcome();
  try { await session.openRecent(last.id); d.getElementById('proj-welcome')?.remove(); }
  catch (e) { console.warn('No se pudo abrir el último proyecto', e); showProjects(); }
}
const closeWelcome = () => d.getElementById('proj-welcome')?.remove();

// ── Ajustes › Archivo y respaldo ─────────────────────────
export async function renderBackupPanel() {
  const host = d.getElementById('aj-tab-backup'); if (!host) return;
  const i = session.info();
  if (i.status === 'closed') { host.innerHTML = '<div class="card"><div class="card-body">Abrí un proyecto para ver sus respaldos.</div></div>'; return; }
  const b = await session.backups(); const loc = project.location();
  const when = k => k ? new Date(k).toLocaleDateString('es-AR') : '';
  host.innerHTML = `
    <div class="card" style="margin-top:0"><div class="card-header"><div class="card-title">💾 Archivo del proyecto</div></div><div class="card-body">
      <div class="backup-row"><div><div class="backup-row-title">${esc(i.name)}</div>
        <div class="backup-row-desc">${i.hasFile ? 'Se guarda solo en el archivo a los 2 segundos de cada cambio.' : 'Todavía no tiene archivo en disco: elegí dónde guardarlo con «Cambiar ubicación…».'} ${i.savedAt ? 'Último guardado: ' + i.savedAt.toLocaleString('es-AR') + '.' : ''}</div></div>
        <div style="display:flex;gap:8px;flex-wrap:wrap;justify-content:flex-end"><button class="btn btn-primary" onclick="SAHTEN.projectUi.run('save')">Guardar ahora</button><button class="btn" onclick="SAHTEN.projectUi.run('exportCopy')">Exportar copia…</button></div></div>
      <div class="backup-divider"></div>
      <div class="backup-row"><div><div class="backup-row-title">Dónde está guardado</div>
        <div class="backup-row-desc" id="proj-path" style="word-break:break-all;font-family:'DM Mono',monospace;font-size:12px">${i.path ? esc(i.path) : i.fileName ? esc(i.fileName) + ' <span style="font-family:inherit">(el navegador no muestra la carpeta; está donde lo elegiste)</span>' : 'Sin archivo todavía'}</div></div>
        <div style="display:flex;gap:8px;flex-wrap:wrap;justify-content:flex-end">${loc.desktop && i.path ? '<button class="btn" onclick="SAHTEN.projectUi.run(\'reveal\')">Mostrar en carpeta</button>' : ''}<button class="btn" onclick="SAHTEN.projectUi.run('changeLocation')">Cambiar ubicación…</button></div></div>
      ${loc.desktop ? `<div class="backup-divider"></div><div class="backup-row"><div><div class="backup-row-title">Carpeta de proyectos</div><div class="backup-row-desc">Donde se proponen los proyectos nuevos. Los respaldos quedan junto a cada proyecto.<br><span id="proj-dir" style="font-family:'DM Mono',monospace;font-size:12px;word-break:break-all">${esc(loc.projectsDir || 'Sin definir')}</span></div></div><button class="btn" onclick="SAHTEN.projectUi.run('chooseDir')">Cambiar carpeta…</button></div>` : ''}
    </div></div>
    <div class="card"><div class="card-header"><div class="card-title">📥 Importar datos</div></div><div class="card-body">
      <div class="backup-row"><div><div class="backup-row-title">Importar una copia de seguridad (.json) como proyecto nuevo</div><div class="backup-row-desc">Para recuperar un negocio de Sahten v2/v3. Se convierte al formato .sahten y elegís dónde guardarlo; el proyecto actual no se toca.</div></div><button class="btn" onclick="SAHTEN.projectUi.run('importJson')">Importar .json…</button></div>
      <div class="backup-divider"></div>
      <div class="backup-row"><div><div class="backup-row-title">Reemplazar los datos de este proyecto</div><div class="backup-row-desc">Carga el contenido de otro archivo (.json o .sahten) dentro de este proyecto, que conserva su archivo y su lugar. Antes se guarda un respaldo para deshacerlo.</div></div><button class="btn" onclick="SAHTEN.projectUi.run('replace')">Reemplazar…</button></div>
    </div></div>
    <div class="card"><div class="card-header"><div class="card-title">📁 Proyectos</div></div><div class="card-body"><div class="backup-row"><div><div class="backup-row-title">Cambiar o eliminar proyectos</div><div class="backup-row-desc">Ver todos tus negocios, abrir otro o eliminar los que ya no uses (podés quitarlos de la lista o borrar también el archivo).</div></div><div style="display:flex;gap:8px;flex-wrap:wrap;justify-content:flex-end"><button class="btn" onclick="SAHTEN.projectUi.showProjects()">Cambiar de proyecto</button><button class="btn" onclick="SAHTEN.projectUi.showProjects({manage:true})">Administrar</button></div></div></div></div>
    <div class="card"><div class="card-header"><div class="card-title">🧭 Tour guiado</div></div><div class="card-body"><div class="backup-row"><div><div class="backup-row-title">Recorrido por la app</div><div class="backup-row-desc">Te explica en un minuto qué hace cada sección y cómo se conectan. Podés verlo cuando quieras, con tus datos o con el ejemplo.</div></div><button class="btn" onclick="sahtenTour.start()">Ver el tour</button></div></div></div>
    ${w.SAHTEN.desktop ? `<div class="card"><div class="card-header"><div class="card-title">⬆ Actualizaciones</div></div><div class="card-body"><div class="backup-row"><div><div class="backup-row-title">Buscar una versión nueva</div><div class="backup-row-desc">Sahten se actualiza desde las versiones publicadas en GitHub. Tus proyectos no se tocan.</div></div><button class="btn" onclick="SAHTEN.desktop.checkForUpdates()">Buscar actualizaciones</button></div></div></div>` : ''}
    <div class="card"><div class="card-header"><div class="card-title">🛟 Respaldos</div></div><div class="card-body">
      <div class="backup-row"><div><div class="backup-row-title">Respaldo de ayer</div>
        <div class="backup-row-desc">${b.daily ? 'Copia automática del ' + b.daily.date + ' (se hace al abrir el proyecto por primera vez en el día; se guarda en la misma carpeta que el proyecto y se conservan las de los últimos 14 días).' : 'Todavía no hay una copia diaria.'}</div></div>
        <button class="btn" ${b.daily ? '' : 'disabled'} onclick="SAHTEN.projectUi.restore('daily')">Restaurar respaldo de ayer</button></div>
      <div class="backup-divider"></div>
      <div class="backup-row"><div><div class="backup-row-title">Última estrategia</div>
        <div class="backup-row-desc">${b.preStrategy ? 'Hay una copia de cómo estaba el proyecto antes de aplicar la última estrategia o importar datos.' : 'No hay estrategias para deshacer.'}</div></div>
        <button class="btn" ${b.preStrategy ? '' : 'disabled'} onclick="SAHTEN.projectUi.restore('preStrategy')">Deshacer última estrategia</button></div>
      ${b.preRestore ? `<div class="backup-divider"></div><div class="backup-row"><div><div class="backup-row-title">Antes de la última restauración</div><div class="backup-row-desc">Si restauraste algo y te arrepentís, acá está lo que tenías.</div></div><button class="btn" onclick="SAHTEN.projectUi.restore('preRestore')">Volver a eso</button></div>` : ''}
    </div></div>`;
}

const LABEL = { daily: 'Restaurar respaldo de ayer', preStrategy: 'Deshacer última estrategia', preRestore: 'Volver a lo anterior a la restauración' };
async function restore(kind) {
  try {
    const text = await session.readBackup(kind); if (!text) { w.alert('No hay respaldo para restaurar.'); return; }
    const { migrate } = await import('./schema.js');
    const other = migrate(text).file, cur = project.collect();
    const lines = project.describeDiff(project.summarizeDiff(cur, other));
    const el = d.getElementById('confirm-text'); if (el) el.style.whiteSpace = 'pre-line';
    w.showConfirm(LABEL[kind], 'Se restaura el proyecto como estaba. Lo de hoy queda guardado por si te arrepentís.\n\nCambios al restaurar:\n' + lines.join('\n'), async () => {
      try { await session.restoreBackup(kind); w._posToast && w._posToast('Respaldo restaurado'); renderBackupPanel(); w.esRenderBanner && w.esRenderBanner(); } catch (e) { w.alert(e.message); }
    }, null, 'Restaurar', 'Cancelar');
  } catch (e) { w.alert(e.message); }
}

const actions = {
  switch: async () => showProjects(),
  open: () => project.open(), new: async () => { const n = await w.sahtenAsk('Nombre del negocio:', 'Mi negocio'); if (n) await project.newProject(n.trim()); },
  save: () => project.save(), saveAs: () => project.saveAs(), duplicate: () => project.duplicate(),
  exportCopy: () => project.exportCopy(), rename: () => project.rename(), demo: () => project.openDemo(),
  importJson: () => project.importJson(), replace: () => project.replaceFromFile(), changeLocation: () => project.changeLocation(),
  reveal: () => project.reveal(), chooseDir: async () => { await project.chooseProjectsDir(); },
};

export function mountProjectUi() {
  // botón y menú en la barra superior (ocupan el lugar del selector de proyectos)
  if (!d.getElementById('ws-switcher-wrap')) {
    const wrap = d.createElement('div'); wrap.id = 'ws-switcher-wrap'; wrap.style.cssText = 'position:relative;display:inline-flex;align-items:center;';
    const btn = d.createElement('button'); btn.className = 'workspace-switcher'; btn.id = 'workspace-switcher-btn';
    btn.onclick = e => { e.stopPropagation(); d.getElementById('workspace-menu').classList.toggle('open'); };
    const menu = d.createElement('div'); menu.className = 'workspace-menu'; menu.id = 'workspace-menu'; menu.onclick = e => e.stopPropagation();
    wrap.append(btn, menu);
    const anchor = d.getElementById('tutorial-trigger') || d.getElementById('page-title');
    if (anchor) anchor.insertAdjacentElement('afterend', wrap);
    d.addEventListener('click', e => { const m = d.getElementById('workspace-menu'); if (m && m.classList.contains('open') && !wrap.contains(e.target)) m.classList.remove('open'); });
  }
  renderMenu(); paintIndicator();
  session.onChange(() => { paintIndicator(); renderMenu(); if (d.getElementById('aj-tab-backup')?.offsetParent) renderBackupPanel(); });
  setInterval(paintIndicator, 1000);
  w.addEventListener('beforeunload', e => { if (session.isDirty()) { e.preventDefault(); e.returnValue = ''; } });
  d.addEventListener('visibilitychange', () => { if (d.visibilityState === 'hidden' && session.info().status === 'dirty' && session.info().canAutosave) session.saveNow().catch(() => {}); });
}

export const projectUi = {
  mount: mountProjectUi, showWelcome, showProjects, startup, renderBackupPanel, restore, ago, indicatorText,
  async run(name, fromWelcome) {
    d.getElementById('workspace-menu')?.classList.remove('open');
    if (fromWelcome) closeWelcome();
    await actions[name]();
    if (fromWelcome && !session.isOpen) showWelcome();
  },
  async openRecent(id, fromWelcome) {
    d.getElementById('workspace-menu')?.classList.remove('open');
    if (fromWelcome) closeWelcome();
    await project.openRecent(id);
    if (fromWelcome && !session.isOpen) showWelcome();
  },
};
