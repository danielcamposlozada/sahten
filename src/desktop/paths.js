// Rutas de Windows y de macOS/Linux sin depender de Node.
export const basename = p => String(p).split(/[\\/]/).pop();
export const dirname = p => { const i = Math.max(String(p).lastIndexOf('/'), String(p).lastIndexOf('\\')); return i < 0 ? '' : String(p).slice(0, i); };
export const joinPath = (dir, name) => (dir.includes('\\') && !dir.includes('/') ? dir + '\\' + name : dir + '/' + name);
export const stripExt = n => String(n).replace(/\.sahten$/i, '');
