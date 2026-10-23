// Documento aislado dentro de la app: no depende de window.open ni de pop-ups.
const preparing = new WeakSet();
export function printDocument(html, w = window) {
  if (preparing.has(w)) return Promise.reject(new Error('Ya hay una impresión abierta. Cerrala antes de volver a imprimir.'));
  preparing.add(w);
  w.document.getElementById('sahten-print-frame')?.remove();
  return new Promise((resolve, reject) => {
    const frame = w.document.createElement('iframe');
    frame.id = 'sahten-print-frame';
    frame.title = 'Impresión de comanda';
    frame.setAttribute('aria-hidden', 'true');
    frame.style.cssText = 'position:fixed;left:-10000px;top:0;width:80mm;height:100vh;border:0;';
    let timer;
    const cleanup = () => { preparing.delete(w); w.clearTimeout(timer); frame.remove(); };
    frame.onload = async () => {
      frame.onload = null;
      w.clearTimeout(timer);
      try {
        const target = frame.contentWindow;
        const doc = target.document;
        await Promise.all(Array.from(doc.images, image => image.complete ? Promise.resolve() : new Promise(done => {
          image.addEventListener('load', done, { once: true });
          image.addEventListener('error', done, { once: true });
          w.setTimeout(done, 3000);
        })));
        target.addEventListener('afterprint', cleanup, { once: true });
        target.focus();
        target.print();
        // Si el motor no emite afterprint, la siguiente comanda reemplaza este documento.
        preparing.delete(w);
        resolve();
      } catch (e) { cleanup(); reject(e); }
    };
    timer = w.setTimeout(() => { cleanup(); reject(new Error('No se pudo preparar la comanda. Intentá imprimir de nuevo.')); }, 10000);
    frame.srcdoc = html;
    w.document.body.appendChild(frame);
  });
}
