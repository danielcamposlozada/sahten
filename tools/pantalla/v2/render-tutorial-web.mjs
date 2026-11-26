// Tutorial de la WEB (sahten.online): imágenes nuevas (celular 3D + tienda actual) sincronizadas con la
// voz ORIGINAL de media/sahten-editorial/tutorial.mp4. El audio se copia intacto (voz y música).
//   node tools/pantalla/v2/capturar-tutorial-web.cjs   → capturas (no envía pedidos)
//   node tools/pantalla/v2/render-tutorial-web.mjs [--stills]
// Salidas: out/web/tutorial-1080x1920.mp4 (con audio), out/web/tutorial.mp4 (540×960) y out/web/tutorial.jpg
import fs from 'node:fs';
import path from 'node:path';
import { spawn, execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { fileURLToPath, pathToFileURL } from 'node:url';

const require = createRequire(import.meta.url);
const { chromium } = require('playwright');
const DIR = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(DIR, '../../..');
const OUT = path.resolve(DIR, '../out/web');
const AUDIO = path.join(ROOT, 'media/sahten-editorial/tutorial.mp4'); // audio original, sin modificar
const FPS = 30, stills = process.argv.includes('--stills');

// Guion: tiempos (s) tomados de la transcripción de la voz original.
//  0,0–2,6 «De la cocina de nuestra familia a tu mesa»
//  2,6–6,3 «Entrá en sahten.online y tocá Pedir online»
//  6,3–10,0 «Elegí tus platos · hoy, una tabla para compartir»
// 10,0–12,9 «Revisá tu pedido y seguí con la entrega»
// 12,9–16,3 «Elegí la opción que prefieras: delivery o retiro en tienda»
// 16,9–18,9 «Sumá tu nombre y tu teléfono»
// 19,4–23,1 «Pagando en efectivo o transferencia tenés un 10 % de descuento»
// 23,1–25,7 «Te escribimos por WhatsApp para confirmar tu pedido»
// 25,7–29,4 «Sahten, gastronomía árabe, te esperamos en sahten.online»
const script = {
  total: 31.12, outro: 'web', bumper: false, rise: [2.3, 3.1], exitAt: 24.75,
  hook: { kicker: 'De la cocina de nuestra familia', l1: 'a tu', l1b: 'mesa', ital: 'así de fácil', a: .15, b: 2.65 },
  steps: [
    { n: '01', t: 'Entrá a sahten.online', a: 2.6, b: 6.3 },
    { n: '02', t: 'Elegí tus platos', a: 6.3, b: 10.0 },
    { n: '03', t: 'Revisá tu pedido', a: 10.0, b: 12.9 },
    { n: '04', t: 'Elegí delivery o retiro', a: 12.9, b: 23.1 },
    { n: '05', t: 'Enviá tu pedido', a: 23.1, b: 24.9 },
  ],
  subs: [
    { text: 'y tocá «Pedir online»', a: 3.6, b: 6.3, top: 375 },
    { text: 'Hoy, una tabla para compartir', a: 7.8, b: 10.0, top: 375 },
    { text: 'y seguí con la entrega', a: 10.9, b: 12.9, top: 375 },
    { text: 'Sumá tu nombre y tu teléfono', a: 16.9, b: 19.35, top: 375 },
    { text: '10 % de descuento con efectivo o transferencia', a: 19.4, b: 23.1, top: 375 },
  ],
  plan: [[0, '01-portada'], [5.2, '02-carta'], [6.6, '03-antes-agregar'], [8.9, '04-agregado'], [9.7, '05-antes-carrito'], [10.6, '06-carrito'],
    [11.9, '07-antes-continuar'], [12.6, '08-entrega'], [14.0, '09-antes-retiro'], [15.6, '10-retiro'], [16.8, '11-antes-nombre'],
    [17.6, '12-nombre'], [18.5, '13-telefono'], [19.5, '14-antes-efectivo'], [23.0, '16-enviar']],
  taps: [[4.75, '01-portada'], [8.75, '03-antes-agregar', 'tabla_compartir'], [10.45, '05-antes-carrito'], [12.45, '07-antes-continuar'],
    [15.45, '09-antes-retiro'], [17.45, '11-antes-nombre'], [18.35, '13-telefono'], [21.0, '14-antes-efectivo'], [24.0, '16-enviar']],
  listo: { a: 24.25, b: 25.8 },
};

const photo = id => pathToFileURL(path.resolve(DIR, '../fotos', id + '.jpg')).href;
const assets = { qr: '', logo: fs.readFileSync(path.join(ROOT, 'media/sahten-editorial/logo-verde-crema-naranja.svg'), 'utf8'), cutouts: { tabla_compartir: photo('tabla_compartir') } };
const pasos = JSON.parse(fs.readFileSync(path.join(DIR, 'captura-web/pasos.json'), 'utf8'));
const data = { shots: pasos.shots, base: pathToFileURL(path.join(DIR, 'captura-web')).href + '/', script };

fs.mkdirSync(OUT, { recursive: true });
const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--allow-file-access-from-files'] });
const page = await browser.newPage({ viewport: { width: 1080, height: 1920 }, deviceScaleFactor: 1 });
page.on('pageerror', e => console.error('error en la página:', e.message));
await page.goto(pathToFileURL(path.join(DIR, 'howto3d.html')).href);
await page.waitForFunction(() => window.__loaded, null, { timeout: 30000 });
const total = await page.evaluate(([a, d]) => window.build(a, d), [assets, data]);
await page.evaluate(() => window.ready());
const stage = await page.$('#stage');
if (stills) {
  for (const t of [1.5, 4.6, 8.6, 10.6, 15.5, 18.2, 21.0, 24.8, 28.0]) { await page.evaluate(t => window.frame(t), t); await stage.screenshot({ path: path.join(OUT, `tutorial-t${String(t).replace('.', '_')}.jpg`), type: 'jpeg', quality: 82 }); }
} else {
  const silent = path.join(OUT, 'tutorial-sin-audio.mp4');
  const ff = spawn('ffmpeg', ['-y', '-loglevel', 'error', '-f', 'image2pipe', '-framerate', String(FPS), '-c:v', 'mjpeg', '-i', '-', '-c:v', 'libx264', '-preset', 'medium', '-crf', '18', '-pix_fmt', 'yuv420p', '-r', String(FPS), silent], { stdio: ['pipe', 'inherit', 'inherit'] });
  const done = new Promise((res, rej) => ff.on('close', c => (c ? rej(new Error('ffmpeg ' + c)) : res())));
  for (let f = 0, n = Math.round(total * FPS); f < n; f++) {
    await page.evaluate(t => window.frame(t), f / FPS);
    const buf = await stage.screenshot({ type: 'jpeg', quality: 92 });
    if (!ff.stdin.write(buf)) await new Promise(r => ff.stdin.once('drain', r));
  }
  ff.stdin.end(); await done;
  // Audio original copiado tal cual (-c:a copy): misma voz, misma música, mismos tiempos.
  execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-i', silent, '-i', AUDIO, '-map', '0:v', '-map', '1:a', '-c:v', 'copy', '-c:a', 'copy', '-shortest', '-movflags', '+faststart', path.join(OUT, 'tutorial-1080x1920.mp4')]);
  execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-i', silent, '-i', AUDIO, '-map', '0:v', '-map', '1:a', '-vf', 'scale=540:960:flags=lanczos', '-c:v', 'libx264', '-profile:v', 'high', '-preset', 'slow', '-crf', '23', '-pix_fmt', 'yuv420p', '-c:a', 'copy', '-shortest', '-movflags', '+faststart', path.join(OUT, 'tutorial.mp4')]);
  execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-ss', '3.4', '-i', silent, '-frames:v', '1', '-vf', 'scale=540:960:flags=lanczos', '-q:v', '3', path.join(OUT, 'tutorial.jpg')]);
  fs.rmSync(silent);
  console.log('✓ tutorial web', total.toFixed(2) + ' s');
}
await browser.close();
