import { describe, it, expect, vi } from 'vitest';
import { JSDOM } from 'jsdom';
import { printDocument } from '../src/ui/print.js';

describe('impresión aislada sin pop-ups', () => {
  it('el documento usa el ancho del papel seleccionado en vez de abrirse siempre a 80 mm', async () => {
    const w = new JSDOM('<body></body>').window;
    const p = printDocument('comanda', w, { paperWidthMm: 58 });
    const frame = w.document.querySelector('iframe');
    expect(frame.style.width).toBe('58mm');
    frame.contentWindow.focus = () => {}; frame.contentWindow.print = () => {};
    frame.dispatchEvent(new w.Event('load')); await p; w.close();
  });
  it('imprime el documento completo y limpia al cerrar el diálogo', async () => {
    const w = new JSDOM('<body><main>App y carrito</main></body>').window;
    const html = '<html><head><style>@page {margin:3mm}</style></head><body>ORDEN #0042</body></html>';
    const promise = printDocument(html, w);
    const frame = w.document.querySelector('iframe');
    expect(frame.srcdoc).toBe(html);
    frame.contentWindow.focus = vi.fn(); frame.contentWindow.print = vi.fn();
    const target = frame.contentWindow;
    frame.dispatchEvent(new w.Event('load'));
    await promise;
    expect(target.print).toHaveBeenCalledTimes(1);
    expect(w.document.querySelector('main').textContent).toBe('App y carrito');
    target.dispatchEvent(new target.Event('afterprint'));
    expect(w.document.querySelector('iframe')).toBeNull();
    w.close();
  });
  it('evita duplicados mientras prepara y permite reintentar después de un error', async () => {
    const w = new JSDOM('<body></body>').window;
    const first = printDocument('orden', w);
    const duplicate = expect(printDocument('duplicada', w)).rejects.toThrow('Ya hay una impresión');
    const frame = w.document.querySelector('iframe');
    frame.contentWindow.focus = () => {};
    frame.contentWindow.print = () => { throw new Error('Impresora no disponible'); };
    const check = expect(first).rejects.toThrow('Impresora no disponible');
    frame.dispatchEvent(new w.Event('load')); await check; await duplicate;
    expect(w.document.querySelector('iframe')).toBeNull();
    w.close();
  });
});
