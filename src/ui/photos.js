// Fotos: una sola forma de cargarlas, la misma en toda la app.
//   Cualquier elemento con  data-photo="<clave>"  se convierte en un botón de foto: clic = elegir archivo, o arrastrar y soltar una imagen encima.
//   Claves: id del producto (foto del producto), cat_<categoría> (foto de la categoría), site_hero / site_historia / site_familia (sitio web).
//   photoThumb(clave, nombre)  →  HTML de la miniatura (con la foto si hay, o «+ Foto»); lo dibujan Menú, Menú Online, Receta y Costo Receta.
//   Al guardar o quitar se avisa con el evento «sahten:photo» ({ key }) y todas las miniaturas de esa clave se actualizan solas.
import { categoryPhotoKey } from '../online/menuJson.js';
export { categoryPhotoKey };
const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

const ICON = '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/></svg>';

export function installPhotos(w = window) {
  const d = w.document;
  const images = () => (w.SAHTEN_IMAGES = w.SAHTEN_IMAGES || {});
  const get = key => images()[key] || null;

  /** Imagen de archivo → JPEG achicado (fondo blanco para PNG con transparencia). */
  function resize(file, maxDim = 800, quality = 0.84) {
    return new Promise((resolve, reject) => {
      const fr = new w.FileReader();
      fr.onerror = () => reject(new Error('No se pudo leer esa imagen.'));
      fr.onload = () => {
        const img = new w.Image();
        img.onerror = () => reject(new Error('Ese archivo no es una imagen que se pueda usar (probá con JPG o PNG).'));
        img.onload = () => {
          const k = Math.min(1, maxDim / Math.max(img.width, img.height)); const c = d.createElement('canvas');
          c.width = Math.max(1, Math.round(img.width * k)); c.height = Math.max(1, Math.round(img.height * k));
          const ctx = c.getContext('2d'); ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, c.width, c.height); ctx.drawImage(img, 0, 0, c.width, c.height);
          resolve(c.toDataURL('image/jpeg', quality));
        };
        img.src = String(fr.result);
      };
      fr.readAsDataURL(file);
    });
  }

  const dirty = () => { try { if (w.SAHTEN && w.SAHTEN.project) w.SAHTEN.project.markDirty(); else if (typeof w.scheduleSave === 'function') w.scheduleSave(); } catch (e) { /* */ } };
  const toast = (m, o) => { try { if (typeof w.sahtenToast === 'function') w.sahtenToast(m, o); } catch (e) { /* */ } };

  /** Pinta (o actualiza) todas las miniaturas de una clave. */
  function refresh(key) {
    d.querySelectorAll('[data-photo]').forEach(el => {
      if (el.dataset.photo !== key) return;
      const has = !!get(key); el.classList.toggle('has', has);
      el.innerHTML = has ? `<img src="${esc(get(key))}" alt="">` : thumbInner(el.dataset.photoLabel || '');
      el.setAttribute('aria-label', (has ? 'Cambiar la foto de ' : 'Agregar foto a ') + (el.dataset.photoLabel || 'este elemento'));
      const del = el.parentElement && Array.from(el.parentElement.querySelectorAll('[data-photo-del]')).find(x => x.dataset.photoDel === key);
      if (del) del.hidden = !has;
    });
    try { w.dispatchEvent(new w.CustomEvent('sahten:photo', { detail: { key } })); } catch (e) { /* */ }
  }

  const requests = new Map();
  const projectId = () => w.SAHTEN?.project?.session?.id;
  const readOnly = () => w.SAHTEN?.project?.session?.readOnly || w.document.body.classList.contains('role-readonly');

  /** Guarda un archivo como foto de `key`. */
  async function set(key, file, opts = {}) {
    if (!key || !file || readOnly()) return false;
    const pid = projectId(), request = {}; requests.set(key, request);
    if (!/^image\//.test(file.type || '')) { toast('Elegí un archivo de imagen (JPG, PNG o WebP).', { kind: 'error' }); return false; }
    try { const value = await resize(file, opts.maxDim || (/^site_/.test(key) ? 1600 : 800));
      if (pid !== projectId() || requests.get(key) !== request || readOnly()) return false;
      images()[key] = value;
    } catch (e) { toast(e.message, { kind: 'error' }); return false; }
    dirty(); refresh(key); toast('Foto guardada'); return true;
  }

  /** Abre el selector de archivos para `key`. */
  function pick(key, opts = {}) {
    return new Promise(resolve => {
      const input = d.createElement('input'); input.type = 'file'; input.accept = 'image/*'; input.hidden = true; d.body.appendChild(input);
      input.addEventListener('change', async () => { const f = input.files && input.files[0]; input.remove(); resolve(f ? await set(key, f, opts) : false); });
      input.addEventListener('cancel', () => { input.remove(); resolve(false); });
      input.click();
    });
  }

  async function remove(key, label = '') {
    if (!get(key) || readOnly()) return false;
    const pid = projectId();
    const ok = typeof w.sahtenConfirm === 'function' ? await w.sahtenConfirm('¿Quitar la foto' + (label ? ' de «' + label + '»' : '') + '?', { okLabel: 'Quitar', danger: true }) : true;
    if (!ok || pid !== projectId() || readOnly()) return false;
    requests.set(key, {});
    delete images()[key]; dirty(); refresh(key); return true;
  }

  function thumbInner(label) { return `<span class="ph-empty">${ICON}<span>Foto</span></span>`; }

  /** HTML de la miniatura de una clave. `size`: lado en px (44 por defecto). `del`: agrega el botón de quitar. */
  function thumb(key, label = '', { size = 44, del = true, cls = '' } = {}) {
    const has = !!get(key); const k = esc(key); const l = esc(label);
    return `<span class="ph-wrap ${cls}"><button type="button" class="ph-thumb${has ? ' has' : ''}" data-photo="${k}" data-photo-label="${l}" style="--ph:${+size || 44}px" aria-label="${has ? 'Cambiar la foto de ' : 'Agregar foto a '}${l || 'este elemento'}" title="${has ? 'Cambiar foto (o arrastrá una imagen acá)' : 'Agregar foto (o arrastrá una imagen acá)'}">${has ? `<img src="${esc(get(key))}" alt="">` : thumbInner(label)}</button>${del ? `<button type="button" class="ph-del" data-photo-del="${k}" data-photo-label="${l}" aria-label="Quitar la foto de ${l || 'este elemento'}" title="Quitar foto" ${has ? '' : 'hidden'}>×</button>` : ''}</span>`;
  }

  // Un solo juego de eventos para toda la app (los paneles se redibujan, los eventos quedan).
  d.addEventListener('click', e => {
    const pk = e.target.closest && e.target.closest('[data-photo-pick]');   // botón de texto («Subir foto»): solo abre el selector
    if (pk) { e.preventDefault(); e.stopPropagation(); pick(pk.dataset.photoPick); return; }
    const t = e.target.closest && e.target.closest('[data-photo]'); const x = e.target.closest && e.target.closest('[data-photo-del]');
    if (x) { e.preventDefault(); e.stopPropagation(); remove(x.dataset.photoDel, x.dataset.photoLabel); return; }
    if (t) { e.preventDefault(); e.stopPropagation(); pick(t.dataset.photo); }
  }, true);
  let over = null; const clear = () => { if (over) { over.classList.remove('ph-drop'); over = null; } };
  d.addEventListener('dragover', e => {
    const t = e.target.closest && e.target.closest('[data-photo]');
    if (!t || !e.dataTransfer || !Array.from(e.dataTransfer.types || []).includes('Files')) return clear();
    e.preventDefault(); e.dataTransfer.dropEffect = 'copy'; if (over !== t) { clear(); over = t; t.classList.add('ph-drop'); }
  });
  d.addEventListener('dragleave', e => { if (over && !over.contains(e.relatedTarget)) clear(); });
  d.addEventListener('drop', e => {
    const t = e.target.closest && e.target.closest('[data-photo]'); clear();
    const f = t && e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files[0]; if (!f) return;
    e.preventDefault(); set(t.dataset.photo, f);
  });

  const api = { thumb, pick, set, remove, get, refresh, categoryKey: categoryPhotoKey };
  w.SAHTEN = w.SAHTEN || {}; w.SAHTEN.photos = api;
  return api;
}
