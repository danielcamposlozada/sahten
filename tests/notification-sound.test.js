import { describe, it, expect, vi } from 'vitest';
import { installNotificationSound } from '../src/ui/notification-sound.js';

function player({ state = 'running' } = {}) {
  const document = new EventTarget();
  const sources = [];
  const buffer = { duration: 3 };
  const ctx = {
    state, destination: {},
    resume: vi.fn(async () => { ctx.state = 'running'; }),
    decodeAudioData: vi.fn(async () => buffer),
    createBufferSource: vi.fn(() => {
      const source = { connect: vi.fn(), disconnect: vi.fn(), start: vi.fn() };
      sources.push(source);
      return source;
    }),
  };
  const w = {
    document,
    AudioContext: vi.fn(function () { return ctx; }),
    fetch: vi.fn(async () => ({ ok: true, arrayBuffer: async () => new ArrayBuffer(8) })),
  };
  return { w, ctx, sources, sound: installNotificationSound(w) };
}

describe('aviso acústico de pedidos', () => {
  it('usa audio incluido, lo prepara al interactuar y permite avisos posteriores sin repetir la carga', async () => {
    const { w, ctx, sources, sound } = player({ state: 'suspended' });
    expect(w.AudioContext).not.toHaveBeenCalled();
    w.document.dispatchEvent(new Event('pointerdown'));
    expect(w.AudioContext).toHaveBeenCalledTimes(1);
    expect(ctx.resume).toHaveBeenCalledTimes(1);
    expect(await sound.play()).toBe(true);
    expect(w.fetch.mock.calls[0][0]).toMatch(/^data:audio\/mpeg;base64,/);
    expect(sources[0].buffer.duration).toBe(3);
    expect(sources[0].loop).toBe(false);
    sources[0].onended();
    expect(await sound.play()).toBe(true);
    expect(w.fetch).toHaveBeenCalledTimes(1);
    expect(ctx.decodeAudioData).toHaveBeenCalledTimes(1);
  });

  it('los pedidos simultáneos no superponen ni cortan los tres segundos del aviso', async () => {
    const { sources, sound } = player();
    const first = sound.play();
    expect(await sound.play()).toBe(false);
    expect(await first).toBe(true);
    expect(await sound.play()).toBe(false);
    expect(sources).toHaveLength(1);
    expect(sources[0].start).toHaveBeenCalledTimes(1);
    sources[0].onended();
    expect(sources[0].disconnect).toHaveBeenCalledTimes(1);
    expect(await sound.play()).toBe(true);
    expect(sources).toHaveLength(2);
  });

  it('si el navegador bloquea audio, el siguiente gesto permite volver a reproducir sin fallar el pedido', async () => {
    const { w, ctx, sound } = player({ state: 'suspended' });
    ctx.resume.mockRejectedValueOnce(new Error('NotAllowedError'));
    expect(await sound.play()).toBe(false);
    w.document.dispatchEvent(new Event('keydown'));
    expect(await sound.play()).toBe(true);
  });

  it('una carga fallida se puede reintentar y la ausencia de audio no lanza errores', async () => {
    const { w, sound } = player();
    w.fetch.mockResolvedValueOnce({ ok: false });
    expect(await sound.play()).toBe(false);
    expect(await sound.play()).toBe(true);
    expect(await installNotificationSound({ document: new EventTarget() }).play()).toBe(false);
  });
});
