// Video «Tenemos delivery»: mapa real (OpenFreeMap), ruta real (OSRM, en ruta.json) y moto.
//   node tools/pantalla/v2/render-delivery.mjs            → out/09-delivery.mp4
//   node tools/pantalla/v2/render-delivery.mjs --stills   → cuadros de control
import fs from 'node:fs';
import path from 'node:path';
import { spawn, execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { fileURLToPath, pathToFileURL } from 'node:url';

const require = createRequire(import.meta.url);
const { chromium } = require('playwright');
const DIR = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(DIR, '../../..');
const OUT = path.resolve(DIR, '../out');
const PACE = 1.5; // reloj más lento para poder leer (decisión del dueño, 26/11)
const FPS = 30, stills = process.argv.includes('--stills');
const BARRIOS = ['Vicente López', 'Olivos', 'Florida', 'La Lucila', 'Martínez', 'Núñez', 'Belgrano']; // confirmados por el dueño (26/11)

const qr = execFileSync('python3', ['-I', '-c', `
import qrcode, qrcode.image.svg, sys, io
img = qrcode.make(sys.argv[1], image_factory=qrcode.image.svg.SvgPathImage, box_size=10, border=1, error_correction=qrcode.constants.ERROR_CORRECT_M)
b = io.BytesIO(); img.save(b); sys.stdout.write(b.getvalue().decode())`, 'https://sahten.online/?utm_source=local&utm_medium=pantalla&utm_campaign=delivery']).toString()
  .replace(/<\?xml[^>]*>/, '').replace(/fill="#000000"|style="fill:#000000;?[^"]*"/g, 'fill="#183d23"');
const assets = { qr, logo: fs.readFileSync(path.join(ROOT, 'media/sahten-editorial/logo-verde-crema-naranja.svg'), 'utf8') };
const route = JSON.parse(fs.readFileSync(path.join(DIR, 'ruta.json'), 'utf8'));

fs.mkdirSync(OUT, { recursive: true });
const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--allow-file-access-from-files'] });
const page = await browser.newPage({ viewport: { width: 1080, height: 1920 }, deviceScaleFactor: 1 });
const url = pathToFileURL(path.join(DIR, 'delivery.html')).href;

// 1) Ubicar los barrios con las etiquetas del propio mapa.
await page.goto(url);
await page.evaluate(([a, d]) => window.init(a, d), [assets, { route, barrios: [] }]);
// Plano general del cierre de información: carga las teselas donde están todos los barrios.
for (const t of [15.2, 16, 17]) await page.evaluate(t => window.frame(t), t);
const found = await page.evaluate(names => window.findPlaces(names), BARRIOS);
const missing = BARRIOS.filter(n => !found[n]);
if (missing.length) throw new Error('No encontré en el mapa: ' + missing.join(', '));
const barrios = BARRIOS.map(name => ({ name, c: found[name] }));

// 2) Construir el video con los barrios ubicados y precargar las teselas del recorrido de cámara.
await page.goto(url);
const total = await page.evaluate(([a, d]) => window.init(a, d), [assets, { route, barrios }]);
for (let t = 0; t < total; t += .5) await page.evaluate(t => window.frame(t), t);
const stage = await page.$('#stage');

if (stills) {
  for (const t of [2.4, 5.6, 8, 10.5, 12.9, 16.2, 19.5]) { await page.evaluate(t => window.frame(t), t); await stage.screenshot({ path: path.join(OUT, `09-delivery-t${String(t).replace('.', '_')}.jpg`), type: 'jpeg', quality: 82 }); }
  console.log(JSON.stringify({ total, barrios }));
} else {
  const file = path.join(OUT, '09-delivery.mp4');
  const ff = spawn('ffmpeg', ['-y', '-loglevel', 'error', '-f', 'image2pipe', '-framerate', String(FPS), '-c:v', 'mjpeg', '-i', '-', '-c:v', 'libx264', '-preset', 'medium', '-crf', '20', '-pix_fmt', 'yuv420p', '-r', String(FPS), '-movflags', '+faststart', file], { stdio: ['pipe', 'inherit', 'inherit'] });
  const done = new Promise((res, rej) => ff.on('close', c => (c ? rej(new Error('ffmpeg ' + c)) : res())));
  const frames = Math.round(total * FPS * PACE), t0 = Date.now();
  for (let f = 0; f < frames; f++) {
    await page.evaluate(t => window.frame(t), f / (FPS * PACE));
    const buf = await stage.screenshot({ type: 'jpeg', quality: 92 });
    if (!ff.stdin.write(buf)) await new Promise(r => ff.stdin.once('drain', r));
    if (f % 90 === 0) console.log(`cuadro ${f}/${frames} · ${Math.round((Date.now() - t0) / 1000)} s`);
  }
  ff.stdin.end(); await done;
  console.log('✓ 09-delivery', total.toFixed(1) + ' s', Math.round((Date.now() - t0) / 1000) + ' s de render');
}
await browser.close();
