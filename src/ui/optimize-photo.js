/** Copia liviana para la web; conserva el original si el navegador no puede mejorarla. */
export async function optimizePhoto(value, { maxDim = 800, maxBytes = 180 * 1024, w = globalThis } = {}) {
  if (!w.Image || !w.document || !/^data:image\/(jpeg|png|webp);base64,/.test(value || '')) return value;
  try {
    const img = await new Promise((resolve, reject) => {
      const image = new w.Image();
      const timer = w.setTimeout(() => reject(new Error('Tiempo de imagen agotado')), 15000);
      image.onload = () => { w.clearTimeout(timer); resolve(image); };
      image.onerror = () => { w.clearTimeout(timer); reject(new Error('Imagen inválida')); };
      image.src = value;
    });
    const ratio = Math.min(1, maxDim / Math.max(img.width, img.height));
    const canvas = w.document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(img.width * ratio));
    canvas.height = Math.max(1, Math.round(img.height * ratio));
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    let best = value;
    for (const quality of [0.8, 0.7, 0.6]) {
      let candidate = canvas.toDataURL('image/webp', quality);
      if (!candidate.startsWith('data:image/webp;')) candidate = canvas.toDataURL('image/jpeg', quality);
      if (candidate.length < best.length) best = candidate;
      if (best.length * 0.75 <= maxBytes) break;
    }
    return best;
  } catch { return value; }
}
