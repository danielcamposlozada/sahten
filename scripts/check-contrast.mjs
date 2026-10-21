import fs from 'node:fs';
import { contrastRatio, contrastText } from '../src/ui/contrast.js';

const source = fs.readFileSync(new URL('../src/legacy/sahten-enhancements.js', import.meta.url), 'utf8');
const palettes = source.slice(source.indexOf('const PALETTES'), source.indexOf('const DEFAULT_CUST'));
const colors = [...palettes.matchAll(/(?:primary|accent)(?:Light)?:\s*'(#[\da-f]{6})'/gi)].map(m => m[1]);
if (colors.length < 32) throw new Error('No se encontraron todas las paletas de marca.');
// También cubre los grises de transición, donde elegir siempre blanco u oscuro falla.
for (let n = 0; n <= 255; n++) colors.push('#' + n.toString(16).padStart(2, '0').repeat(3));
for (const background of colors) {
  const foreground = contrastText(background), ratio = contrastRatio(foreground, background);
  if (ratio < 4.5) throw new Error(`${foreground} sobre ${background}: ${ratio.toFixed(2)}:1`);
}
console.log(`Contraste de texto de marca: ${colors.length} pares cumplen 4,5:1.`);
console.log(`Naranja actual: ${contrastText('#F28C00')} sobre #F28C00 = ${contrastRatio(contrastText('#F28C00'), '#F28C00').toFixed(2)}:1.`);
