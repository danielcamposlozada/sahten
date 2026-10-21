// Colores opacos de marca: el texto se elige por contraste, no por el nombre de la paleta.
export function luminance(hex) {
  let value = String(hex || '').replace(/^#/, '');
  if (/^[\da-f]{3}$/i.test(value)) value = value.split('').map(c => c + c).join('');
  if (!/^[\da-f]{6}$/i.test(value)) return null;
  const rgb = [0, 2, 4].map(i => parseInt(value.slice(i, i + 2), 16) / 255)
    .map(c => c <= .04045 ? c / 12.92 : ((c + .055) / 1.055) ** 2.4);
  return rgb[0] * .2126 + rgb[1] * .7152 + rgb[2] * .0722;
}

export function contrastRatio(a, b) {
  const x = luminance(a), y = luminance(b);
  return x == null || y == null ? 1 : (Math.max(x, y) + .05) / (Math.min(x, y) + .05);
}

export function contrastText(background) {
  if (contrastRatio('#1c1c1e', background) >= 4.5) return '#1c1c1e';
  return contrastRatio('#ffffff', background) >= 4.5 ? '#ffffff' : '#000000';
}
