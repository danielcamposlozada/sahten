import { it, expect } from 'vitest';
import { optimizePhoto } from '../src/ui/optimize-photo.js';

it('reduce dimensiones sin ampliarlas y elige una copia más liviana, con alternativa JPEG', async () => {
  const original = 'data:image/png;base64,' + 'AAAA'.repeat(1000);
  const canvas = { getContext: () => ({ fillRect() {}, drawImage() {} }), toDataURL: (type, q) => type === 'image/webp' ? 'data:image/png;base64,' + 'AAAA'.repeat(1200) : 'data:image/jpeg;base64,' + 'AAAA'.repeat(q > 0.7 ? 300 : 100) };
  const w = { setTimeout, clearTimeout, document: { createElement: () => canvas }, Image: class { width = 2400; height = 1200; set src(v) { this.onload(); } } };
  const out = await optimizePhoto(original, { w, maxBytes: 400 });
  expect([canvas.width, canvas.height]).toEqual([800, 400]);
  expect(out).toMatch(/^data:image\/jpeg/); expect(out.length).toBeLessThan(original.length);
  w.Image = class { width = 100; height = 50; set src(v) { this.onload(); } };
  await optimizePhoto(original, { w }); expect([canvas.width, canvas.height]).toEqual([100, 50]);
});

it('si la conversión falla conserva el original sin borrar la foto', async () => {
  const original = 'data:image/jpeg;base64,AQID';
  const w = { setTimeout, clearTimeout, document: {}, Image: class { set src(v) { this.onerror(); } } };
  expect(await optimizePhoto(original, { w })).toBe(original);
});
