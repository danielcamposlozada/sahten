import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
const html = fs.readFileSync(new URL('../src/online/web/index.html', import.meta.url), 'utf8');

describe('web publicada: barra de navegación y de categorías', () => {
  it('la barra del sitio es pegajosa de verdad (su contenedor no la encierra)', () => {
    expect(html).toMatch(/#s-nav\{display:contents\}/);
  });
  it('la altura de la barra sale de una sola fuente (--navh medida con JS), sin valor fijo en el body', () => {
    expect(html).not.toMatch(/\.has-site\{--navh/);
    expect(html).toMatch(/setProperty\('--navh'/); expect(html).toMatch(/ResizeObserver/);
    expect(html).toMatch(/\.has-site \.cats\{top:calc\(var\(--navh,56px\) - 1px\)\}/);
  });
});
