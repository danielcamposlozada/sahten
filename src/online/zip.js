// ZIP mínimo (sin compresión, método «store»): alcanza para subir la carpeta publicada a cualquier hosting.
let TABLE = null;
function crc32(bytes) {
  if (!TABLE) { TABLE = new Uint32Array(256); for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1; TABLE[n] = c >>> 0; } }
  let c = 0xFFFFFFFF;
  for (let i = 0; i < bytes.length; i++) c = TABLE[(c ^ bytes[i]) & 0xFF] ^ (c >>> 8);
  return (c ^ 0xFFFFFFFF) >>> 0;
}
const enc = s => new TextEncoder().encode(s);

/** files: [{ path, data: string | Uint8Array }] → Uint8Array con el .zip */
export function createZip(files, date = new Date()) {
  const dosTime = (date.getHours() << 11) | (date.getMinutes() << 5) | (date.getSeconds() >> 1);
  const dosDate = ((date.getFullYear() - 1980) << 9) | ((date.getMonth() + 1) << 5) | date.getDate();
  const chunks = [], central = []; let offset = 0;
  const u16 = (v, n) => { v.push(n & 255, (n >> 8) & 255); }, u32 = (v, n) => { v.push(n & 255, (n >> 8) & 255, (n >> 16) & 255, (n >>> 24) & 255); };
  files.forEach(f => {
    const name = enc(f.path), data = typeof f.data === 'string' ? enc(f.data) : f.data, crc = crc32(data);
    const h = []; u32(h, 0x04034b50); u16(h, 20); u16(h, 0x0800); u16(h, 0); u16(h, dosTime); u16(h, dosDate); u32(h, crc); u32(h, data.length); u32(h, data.length); u16(h, name.length); u16(h, 0);
    chunks.push(Uint8Array.from(h), name, data);
    const c = []; u32(c, 0x02014b50); u16(c, 20); u16(c, 20); u16(c, 0x0800); u16(c, 0); u16(c, dosTime); u16(c, dosDate); u32(c, crc); u32(c, data.length); u32(c, data.length); u16(c, name.length); u16(c, 0); u16(c, 0); u16(c, 0); u16(c, 0); u32(c, 0); u32(c, offset);
    central.push(Uint8Array.from(c), name);
    offset += h.length + name.length + data.length;
  });
  const cdSize = central.reduce((a, b) => a + b.length, 0);
  const end = []; u32(end, 0x06054b50); u16(end, 0); u16(end, 0); u16(end, files.length); u16(end, files.length); u32(end, cdSize); u32(end, offset); u16(end, 0);
  const all = [...chunks, ...central, Uint8Array.from(end)];
  const out = new Uint8Array(all.reduce((a, b) => a + b.length, 0)); let p = 0; all.forEach(b => { out.set(b, p); p += b.length; });
  return out;
}
export { crc32 };
