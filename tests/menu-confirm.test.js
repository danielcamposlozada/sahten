import { describe, it, expect } from 'vitest';
import { publishMenuConfirmed } from '../src/online/menuConfirm.js';

function fake({ local = 52, remote = 52, answers = [true, true] } = {}) {
  const log = { confirms: [], alerts: [], synced: [] };
  const online = { controller: {
    previewMenu: async () => ({ local, remote, name: 'Sahten', slug: 'sahten' }),
    syncMenu: async o => { log.synced.push(o); return local; },
  } };
  const w = {
    sahtenConfirm: async (msg, o) => { log.confirms.push({ msg, o }); return answers.shift() ?? false; },
    sahtenAlert: async m => { log.alerts.push(m); },
  };
  return { online, w, log };
}

describe('publicar el menú: siempre doble confirmación', () => {
  it('pide dos confirmaciones y recién después publica', async () => {
    const { online, w, log } = fake();
    expect(await publishMenuConfirmed(online, w)).toBe(52);
    expect(log.confirms).toHaveLength(2);
    expect(log.confirms[1].o.danger).toBe(true);
    expect(log.synced).toEqual([{ force: true }]);
  });
  it('cancelar la primera o la segunda no publica nada', async () => {
    for (const answers of [[false], [true, false]]) {
      const { online, w, log } = fake({ answers: [...answers] });
      expect(await publishMenuConfirmed(online, w)).toBeNull();
      expect(log.synced).toHaveLength(0);
    }
  });
  it('avisa cuando el menú nuevo tiene menos productos que el publicado', async () => {
    const { online, w, log } = fake({ local: 3, remote: 52 });
    await publishMenuConfirmed(online, w);
    expect(log.confirms[0].msg).toContain('52'); expect(log.confirms[1].msg).toContain('MENOS');
  });
  it('un proyecto sin productos no llega a preguntar: muestra el motivo', async () => {
    const { online, w, log } = fake({ local: 0, remote: 52 });
    expect(await publishMenuConfirmed(online, w)).toBeNull();
    expect(log.confirms).toHaveLength(0); expect(log.alerts[0]).toContain('no tiene productos'); expect(log.synced).toHaveLength(0);
  });
});
