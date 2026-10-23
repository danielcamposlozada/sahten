import { it, expect } from 'vitest';
import { JSDOM } from 'jsdom';
import { createTransferProgress } from '../src/online/progress.js';
import { createOnlineUi } from '../src/online/ui.js';
import { createImageStore } from '../src/online/images.js';

it('muestra barra indeterminada para datos y avance real de fotos; error y finalización detienen la barra', () => {
  const w = new JSDOM('<div id="panel-nube"><div id="nube-progress"></div><button data-cloud-action>Sincronizar</button></div>').window;
  const progress = createTransferProgress(), ui = createOnlineUi({ online: { progress }, w });
  progress.onChange(() => ui.renderProgress());
  const task = progress.start('Descargando proyecto');
  expect(w.document.querySelector('progress').hasAttribute('value')).toBe(false);
  expect(w.document.querySelector('button').disabled).toBe(true);
  task.update({ detail: 'Descargando fotos', completed: 2, total: 8 });
  expect(w.document.querySelector('progress').value).toBe(2);
  expect(w.document.querySelector('progress').max).toBe(8);
  expect(w.document.querySelector('[role=status]').textContent).toContain('2 de 8 fotos');
  task.update({ detail: 'Guardando datos' });
  expect(w.document.querySelector('progress').hasAttribute('value')).toBe(false);
  task.fail(new Error('Sin conexión. Volvé a intentar.'));
  expect(w.document.querySelector('progress')).toBeNull();
  expect(w.document.querySelector('button').disabled).toBe(false);
  expect(w.document.body.textContent).toContain('Sin conexión');
  const next = progress.start('Reintentando'); next.finish();
  expect(w.document.body.textContent).toContain('Completado.');
});

it('una operación que termina no oculta otra operación todavía activa', () => {
  const p = createTransferProgress(); const a = p.start('Proyecto'), b = p.start('Menú');
  b.finish(); expect(p.info()).toMatchObject({ title: 'Proyecto', active: true });
  a.finish(); expect(p.info().active).toBe(false);
});

it('cuenta una foto solo después de que terminó la transferencia', async () => {
  let finish; const counts = [];
  const store = createImageStore({ url: 'https://x.supabase.co', storage: { upload: () => new Promise(r => { finish = r; }) } });
  const work = store.upload({ p: 'data:image/png;base64,AQID' }, 'store', { onProgress: p => counts.push(p.completed) });
  await new Promise(r => setTimeout(r, 10));
  expect(counts).toEqual([0]); finish(); await work; expect(counts).toEqual([0, 1]);
});
