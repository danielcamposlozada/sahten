import soundUrl from '../assets/audio/darbuka-palmas.mp3?inline';

/** Audio incluido en la app: sin conexión, sin campanas y sin cortar avisos consecutivos. */
export function installNotificationSound(w = window) {
  let context, loading, playing, pending = false;

  function prepare() {
    const AudioContext = w.AudioContext || w.webkitAudioContext;
    if (!AudioContext) return Promise.resolve(null);
    if (!context || context.state === 'closed') {
      context = new AudioContext();
      loading = null;
    }
    if (!loading) {
      const ctx = context;
      loading = w.fetch(soundUrl).then(response => {
        if (!response.ok) throw new Error('Audio no disponible');
        return response.arrayBuffer();
      }).then(bytes => ctx.decodeAudioData(bytes)).catch(() => {
        loading = null; // Una carga fallida se puede reintentar en el próximo aviso.
        return null;
      });
    }
    return loading;
  }

  // Abrir el contexto dentro del gesto permite avisos posteriores también en WebKit.
  function unlock() {
    try {
      prepare();
      if (context && context.state !== 'running') Promise.resolve(context.resume()).catch(() => {});
    } catch { /* El aviso visual sigue disponible si el equipo no permite audio. */ }
  }
  w.document.addEventListener('pointerdown', unlock, { passive: true });
  w.document.addEventListener('keydown', unlock);

  async function play() {
    if (playing || pending) return false; // Una ráfaga no superpone ni reinicia el ritmo.
    pending = true;
    try {
      const ready = prepare();
      if (!context) return false;
      if (context.state !== 'running') await context.resume();
      const buffer = await ready;
      if (!buffer || context.state !== 'running') return false;
      const source = context.createBufferSource();
      source.buffer = buffer;
      source.loop = false;
      source.connect(context.destination);
      source.onended = () => {
        source.disconnect();
        if (playing === source) playing = null;
      };
      source.start();
      playing = source;
      return true;
    } catch {
      return false; // No impedir el pedido ni producir otra notificación por un fallo de audio.
    } finally {
      pending = false;
    }
  }

  return { play };
}
