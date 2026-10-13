import { describe, it, expect } from 'vitest';
import { buildPublishFiles } from '../src/online/publish.js';
import { categoryPhotoKey } from '../src/online/menuJson.js';

describe('fotos de categoría al publicar', () => {
  it('la clave no lleva tildes ni símbolos y es estable', () => {
    expect(categoryPhotoKey('Sándwiches & Wraps')).toBe('cat_sandwiches_wraps');
    expect(categoryPhotoKey('  Bebidas ')).toBe('cat_bebidas');
    expect(categoryPhotoKey('')).toBe('');
  });
  it('se genera un archivo por categoría con foto (y solo esas)', async () => {
    const menu = { products: [], config: { categoryImages: { 'Sándwiches': 'img/cat_sandwiches.jpg', 'Bebidas': 'img/cat_bebidas.jpg' } }, site: null, store: {}, delivery: {}, payments: {} };
    const files = await buildPublishFiles(menu, { cat_sandwiches: 'data:image/jpeg;base64,AAAA' }, async () => new Uint8Array([1]));
    expect(files.map(f => f.path)).toEqual(expect.arrayContaining(['index.html', 'menu.json', 'img/cat_sandwiches.jpg']));
    expect(files.some(f => f.path === 'img/cat_bebidas.jpg')).toBe(false);
  });
});
