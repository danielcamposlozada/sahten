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
  const recents = session.recents().filter(r => r.id !== i.id).slice(0, 5);
  const act = (fn, label, hint = '') => `<button class="workspace-action-btn" onclick="SAHTEN.projectUi.run('${fn}')">${label}${hint ? `<span style="margin-left:auto;font-size:11px;color:var(--muted)">${hint}</span>` : ''}</button>`;
  menu.innerHTML = `
    <div class="workspace-menu-header">Proyecto${i.hasFile ? '' : ' · sin archivo'}</div>
    <div class="workspace-actions" style="border-top:0">
      ${act('open', 'Abrir…')}
      ${act('new', 'Nuevo proyecto…')}
      ${act('importJson', 'Importar copia (.json)…')}
      ${i.status !== 'closed' ? act('save', 'Guardar', i.canAutosave ? 'automático' : '') + act('saveAs', 'Guardar como…') + act('duplicate', 'Duplicar…') + act('exportCopy', 'Exportar copia…') + act('rename', 'Renombrar…') : ''}
    </div>
    ${recents.length ? `<div class="workspace-menu-header">Recientes</div><div class="workspace-list">${recents.map(r => `
      <div class="workspace-item"><div class="workspace-item-name" style="cursor:pointer" onclick="SAHTEN.projectUi.openRecent('${r.id}')">${esc(r.name)}<div class="workspace-item-meta">${new Date(r.openedAt).toLocaleDateString('es-AR')}</div></div></div>`).join('')}</div>` : ''}`;
}

// ── Bienvenida ───────────────────────────────────────────
export function showWelcome() {
  d.getElementById('proj-welcome')?.remove();
  const recents = session.recents().slice(0, 5);
  const canPick = project.adapter.canAutosave;
  const ov = d.createElement('div'); ov.id = 'proj-welcome'; ov.className = 'sw-ov';
  ov.innerHTML = `<div class="sw-box"><div class="sw-head"><div class="sw-title">Sahten</div><div class="sw-sub">Cada negocio es un archivo <b>.sahten</b>. Abrí uno, creá uno nuevo o recorré la app con un ejemplo.</div></div>
    <div class="sw-body">
      <button class="sw-card" onclick="SAHTEN.projectUi.run('open',true)"><b>Abrir proyecto…</b><span>Elegí un archivo .sahten (o una copia de seguridad .json de versiones anteriores).</span></button>
      <button class="sw-card" onclick="SAHTEN.projectUi.run('new',true)"><b>Nuevo proyecto</b><span>Te pido dónde guardarlo y armamos el negocio con unas preguntas cortas.</span></button>
      <button class="sw-card" onclick="SAHTEN.projectUi.run('importJson',true)"><b>Importar copia de seguridad (.json)</b><span>Recuperá todo tu negocio desde un archivo de Sahten v2/v3: se convierte en un proyecto nuevo y elegís dónde guardarlo.</span></button>
      <button class="sw-card" onclick="SAHTEN.projectUi.run('demo',true)"><b>Explorar con datos de ejemplo</b><span>Una pizzería de muestra con recetas, gastos y canales. Después podés guardarlo como tuyo.</span></button>
      ${recents.length ? `<div class="sw-lbl" style="margin:6px 0 0">Recientes</div>${recents.map(r => `<button class="sw-card" style="padding:10px 14px" onclick="SAHTEN.projectUi.openRecent('${r.id}',true)"><b style="font-size:14px">${esc(r.name)}</b><span>Abierto el ${new Date(r.openedAt).toLocaleDateString('es-AR')}</span></button>`).join('')}` : ''}
      ${canPick ? '' : `<div class="sw-note">Este navegador no puede guardar directamente en el archivo. Vas a trabajar y descargar el .sahten con «Guardar». Para guardado automático usá Chrome o Edge, o la app de escritorio.</div>`}
    </div></div>`;
  d.body.appendChild(ov);
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
  mount: mountProjectUi, showWelcome, renderBackupPanel, restore, ago, indicatorText,
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
