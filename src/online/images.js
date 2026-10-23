// Fotos locales en el .sahten; archivos versionados por contenido en Storage.
// Se publican las URL solo después de que terminaron TODAS las subidas.
import { SupabaseError } from './supabase.js';
import { categoryPhotoKey } from './menuJson.js';
import { optimizePhoto } from '../ui/optimize-photo.js';

const TYPES = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' };
const MAX_BYTES = 5 * 1024 * 1024;
const clone = v => JSON.parse(JSON.stringify(v));
export const PHOTO_BUCKET = 'sahten-photos';

export function decodePhoto(value) {
  const m = /^data:(image\/(?:jpeg|png|webp));base64,([A-Za-z0-9+/]*={0,2})$/.exec(value || '');
  if (!m || !m[2]) throw new SupabaseError('La foto no tiene un formato válido. Volvé a cargarla como JPG, PNG o WebP.');
  let bin; try { bin = atob(m[2]); } catch { throw new SupabaseError('No se pudo leer la foto. Volvé a cargarla.'); }
  if (bin.length > MAX_BYTES) throw new SupabaseError('La foto supera los 5 MB. Cargá una versión más chica.');
  return { bytes: Uint8Array.from(bin, c => c.charCodeAt(0)), type: m[1] };
}

const digest = async bytes => Array.from(new Uint8Array(await globalThis.crypto.subtle.digest('SHA-256', bytes)), b => b.toString(16).padStart(2, '0')).join('');
const dataUrl = (bytes, type) => {
  let bin = ''; for (const b of bytes) bin += String.fromCharCode(b);
  return 'data:' + type + ';base64,' + btoa(bin);
};

export function createImageStore(client, { optimize = optimizePhoto } = {}) {
  const uploaded = new Map();
  const webCopies = new Map();
  const prefix = client.url + '/storage/v1/object/public/' + PHOTO_BUCKET + '/';
  function parse(value) {
    if (typeof value !== 'string' || !value.startsWith(prefix)) return null;
    const path = value.slice(prefix.length);
    const m = /^([a-zA-Z0-9_-]+)\/([a-f0-9]{64})\.(jpg|png|webp)$/.exec(path);
    return m ? { path, hash: m[2], type: Object.keys(TYPES).find(t => TYPES[t] === m[3]) } : null;
  }
  async function upload(images, storeId, { web = false, onProgress = () => {} } = {}) {
    if (!/^[a-zA-Z0-9_-]+$/.test(storeId || '')) throw new SupabaseError('Conectá la tienda antes de subir fotos.');
    const result = {};
    const entries = Object.entries(images || {}).filter(([, value]) => value);
    let completed = 0;
    const report = () => onProgress({ detail: web ? 'Optimizando y subiendo fotos' : 'Subiendo fotos', completed, total: entries.length });
    for (const [key, value] of entries) {
      report();
      if (!value) continue;
      const remote = parse(value);
      const sameStore = remote && remote.path.startsWith(storeId + '/');
      if (sameStore && !web) { result[key] = value; completed++; report(); continue; }
      let local = value;
      if (sameStore) {
        if (webCopies.has(value + ':' + /^site_/.test(key))) { result[key] = webCopies.get(value + ':' + /^site_/.test(key)); completed++; report(); continue; }
        const bytes = await client.storage.download(remote.path);
        if (bytes.length > MAX_BYTES || await digest(bytes) !== remote.hash) throw new SupabaseError('No se pudo verificar la foto antes de publicarla. Reintentá la sincronización.');
        local = dataUrl(bytes, remote.type);
      }
      decodePhoto(local);
      const optimized = web ? await optimize(local, /^site_/.test(key) ? { maxDim: 1600, maxBytes: 350 * 1024 } : { maxDim: 800, maxBytes: 180 * 1024 }) : local;
      const { bytes, type } = decodePhoto(optimized);
      const path = storeId + '/' + await digest(bytes) + '.' + TYPES[type];
      if (!uploaded.has(path)) {
        const task = client.storage.upload(path, bytes, type).catch(e => {
          uploaded.delete(path);
          if (!e.offline) e.message = 'No se pudo subir la foto. Revisá los permisos y la configuración de fotos en Supabase. ' + e.message;
          throw e;
        });
        uploaded.set(path, task);
      }
      await uploaded.get(path);
      result[key] = prefix + path;
      if (sameStore && web) webCopies.set(value + ':' + /^site_/.test(key), result[key]);
      completed++; report();
    }
    return result;
  }
  async function restore(file, localImages = {}, onProgress = () => {}) {
    if (!file.cloudImagesVersion) return { ...file, images: clone(localImages) }; // archivos anteriores: nunca borrar fotos locales
    const images = {};
    const entries = Object.entries(file.images || {}); let completed = 0;
    const report = () => onProgress({ detail: 'Descargando fotos', completed, total: entries.length });
    for (const [key, value] of entries) {
      report();
      const ref = parse(value);
      if (!ref) throw new SupabaseError('La dirección de una foto de la nube no es válida.');
      if (localImages[key]) {
        const local = decodePhoto(localImages[key]);
        if (local.type === ref.type && await digest(local.bytes) === ref.hash) { images[key] = localImages[key]; completed++; report(); continue; }
      }
      const bytes = await client.storage.download(ref.path);
      if (bytes.length > MAX_BYTES || await digest(bytes) !== ref.hash) throw new SupabaseError('No se pudo verificar la foto descargada. Reintentá la sincronización.');
      images[key] = dataUrl(bytes, ref.type);
      completed++; report();
    }
    return { ...file, images };
  }
  return { upload, restore, isPublicPhoto(value, storeId) { return !!parse(value)?.path.startsWith(storeId + '/'); }, async prepare(file, storeId, onProgress) { return { ...file, cloudImagesVersion: 1, images: await upload(file.images, storeId, { onProgress }) }; } };
}

/** Cambia solo las referencias a fotos que el menú efectivamente muestra. */
export async function menuWithCloudImages(menu, images, imageStore, storeId, onProgress) {
  const m = clone(menu), needed = {};
  const refs = [];
  for (const p of m.products) if (p.image) refs.push([p, 'image', p.id]);
  for (const cat of Object.keys(m.config?.categoryImages || {})) refs.push([m.config.categoryImages, cat, categoryPhotoKey(cat)]);
  for (const k of ['hero', 'historia']) if (m.site?.images?.[k]) refs.push([m.site.images, k, 'site_' + k]);
  for (const [obj, field, key] of refs) {
    if (images[key]) needed[key] = images[key];
    else if (imageStore.isPublicPhoto(obj[field], storeId)) needed[key] = obj[field];
    else throw new SupabaseError('Falta una foto del menú en este equipo. Abrí el proyecto desde la nube o volvé a cargarla antes de publicar. El menú publicado se conserva.', { code: 'missing_photo' });
  }
  const urls = await imageStore.upload(needed, storeId, { web: true, onProgress });
  for (const [obj, field, key] of refs) obj[field] = urls[key] || null;
  return m;
}
