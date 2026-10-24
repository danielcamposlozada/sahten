import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
const html = fs.readFileSync(new URL('../src/online/web/index.html', import.meta.url), 'utf8');

it('el pie de la vista de pedido no queda oculto y reserva espacio para la barra de carrito',()=>{expect(html).not.toContain('.has-site.view-order #s-rest{display:none}');expect(html).toContain('.has-site.view-order.has-cart #s-rest .sfoot{padding-bottom:calc(100px');});

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
