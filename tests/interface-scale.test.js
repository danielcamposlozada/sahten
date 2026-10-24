import { expect, it, vi } from 'vitest';
import { JSDOM } from 'jsdom';
import { installInterfaceScale } from '../src/ui/interface-scale.js';
it('recuerda la escala por equipo y aplica zoom nativo sin transformar el documento de impresión', async () => {
  const w = new JSDOM('<input data-interface-scale><p id="interface-scale-status"></p><iframe id="sahten-print-frame"></iframe>',{url:'http://localhost'}).window;
  w.localStorage.setItem('sahten-interface-scale','85'); const zoom=vi.fn(async()=>{});
  const scale=installInterfaceScale(w,zoom); await scale.ready;
  expect(zoom).toHaveBeenLastCalledWith(.85);
  await scale.set(90); expect(w.localStorage.getItem('sahten-interface-scale')).toBe('90');
  expect(w.document.getElementById('sahten-print-frame').style.zoom).toBeUndefined();
  expect(w.document.documentElement.style.transform).toBe('');
  await scale.set(100); expect(zoom).toHaveBeenLastCalledWith(1);
  w.close();
});
it('conserva escala anterior cuando falla el motor y limita valores fuera de rango', async()=>{
  const w=new JSDOM('<p id="interface-scale-status"></p>',{url:'http://localhost'}).window;
  const zoom=vi.fn(async()=>{}),scale=installInterfaceScale(w,zoom); await scale.ready;
  zoom.mockRejectedValueOnce(Error()); await scale.set(80); expect(scale.value()).toBe(100); expect(w.localStorage.getItem('sahten-interface-scale')).toBeNull();
  await scale.set(200); expect(scale.value()).toBe(125); await scale.set(50); expect(scale.value()).toBe(80);w.close();
});
