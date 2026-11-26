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
import { web } from './guion-comprar.mjs';

const require = createRequire(import.meta.url);
const { chromium } = require('playwright');
const DIR = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(DIR, '../../..');
const story = process.argv.includes('--story'); // versión Instagram Stories (zonas seguras)
const OUT = path.resolve(DIR, story ? '../out/story' : '../out/web');
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
const script = story ? { ...web, safe: true } : web;

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
  for (const t of [1.5, 4.6, 7.3, 8.9, 10.6, 15.6, 17.5, 18.5, 20.0, 21.0, 24.8, 28.0]) { await page.evaluate(t => window.frame(t), t); await stage.screenshot({ path: path.join(OUT, `tutorial-t${String(t).replace('.', '_')}.jpg`), type: 'jpeg', quality: 82 }); }
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
  execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-i', silent, '-i', AUDIO, '-map', '0:v', '-map', '1:a', '-c:v', 'copy', '-c:a', 'copy', '-shortest', '-movflags', '+faststart', path.join(OUT, story ? 'tutorial-story-1080x1920.mp4' : 'tutorial-1080x1920.mp4')]);
  if (story) { fs.rmSync(silent); console.log('✓ tutorial story', total.toFixed(2) + ' s'); await browser.close(); process.exit(0); }
  execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-i', silent, '-i', AUDIO, '-map', '0:v', '-map', '1:a', '-vf', 'scale=540:960:flags=lanczos', '-c:v', 'libx264', '-profile:v', 'high', '-preset', 'slow', '-crf', '23', '-pix_fmt', 'yuv420p', '-c:a', 'copy', '-shortest', '-movflags', '+faststart', path.join(OUT, 'tutorial.mp4')]);
  execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-ss', '3.4', '-i', silent, '-frames:v', '1', '-vf', 'scale=540:960:flags=lanczos', '-q:v', '3', path.join(OUT, 'tutorial.jpg')]);
  fs.rmSync(silent);
  console.log('✓ tutorial web', total.toFixed(2) + ' s');
}
await browser.close();
