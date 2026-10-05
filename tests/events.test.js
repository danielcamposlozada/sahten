import { describe, it, expect, vi } from 'vitest';
import { afterRender, beforeRender, around, onPanelShow, onDataChanged, instrument } from '../src/events.js';

const win = () => ({ calls: [], showPanel(n) { this.calls.push('show:' + n); }, renderX() { this.calls.push('render'); return 42; }, recalcAll() { this.calls.push('recalc'); } });

describe('registro de módulos con eventos', () => {
  it('envuelve una sola vez y respeta el orden before → original → after', () => {
    const w = win();
    beforeRender('renderX', () => w.calls.push('before'));
    afterRender('renderX', () => w.calls.push('after1'));
    afterRender('renderX', () => w.calls.push('after2'));
    instrument(['renderX'], w);
    instrument(['renderX'], w);                         // idempotente
    expect(w.renderX()).toBe(42);                       // conserva el valor de retorno
    expect(w.calls).toEqual(['before', 'render', 'after1', 'after2']);
  });
  it('onPanelShow: ganchos del panel y de «*», después del showPanel original', () => {
    const w = win();
    onPanelShow('mostrador', n => w.calls.push('m:' + n));
    onPanelShow('*', n => w.calls.push('todos:' + n));
    instrument(['showPanel'], w);
    w.showPanel('mostrador'); w.showPanel('otro');
    expect(w.calls).toEqual(['show:mostrador', 'm:mostrador', 'todos:mostrador', 'show:otro', 'todos:otro']);
  });
  it('onDataChanged se dispara tras recalcAll', () => {
    const w = win(); const fn = vi.fn();
    const off = onDataChanged(fn);
    instrument(['recalcAll'], w);
    w.recalcAll(); expect(fn).toHaveBeenCalledTimes(1);
    off(); w.recalcAll(); expect(fn).toHaveBeenCalledTimes(1);
  });
  it('un gancho que falla no rompe la pantalla ni a los demás', () => {
    const w = win(); const err = vi.spyOn(console, 'error').mockImplementation(() => {});
    afterRender('renderY', () => { throw new Error('boom'); });
    afterRender('renderY', () => w.calls.push('sigue'));
    w.renderY = () => w.calls.push('y');
    instrument(['renderY'], w);
    expect(() => w.renderY()).not.toThrow();
    expect(w.calls).toEqual(['y', 'sigue']);
    err.mockRestore();
  });
  it('se puede quitar un gancho', () => {
    const w = win(); let n = 0;
    const off = afterRender('renderZ', () => { n++; });
    w.renderZ = () => {}; instrument(['renderZ'], w);
    w.renderZ(); off(); w.renderZ();
    expect(n).toBe(1);
  });
  it('around: puede reemplazar o delegar en la función original', () => {
    const w = { setTab(t) { return 'orig:' + t; } };
    around('setTab', (next, t) => t === 'delivery' ? 'mio' : next(t));
    instrument(['setTab'], w);
    expect(w.setTab('delivery')).toBe('mio');
    expect(w.setTab('pedido')).toBe('orig:pedido');
  });
});
