// Video «Cómo comprar en la web»: capturas reales de sahten.online (capturar-web.cjs) dentro de un celular 3D.
//   node tools/pantalla/v2/capturar-web.cjs   → vuelve a capturar la tienda (no confirma pedidos)
//   node tools/pantalla/v2/render-howto.mjs [--stills]
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
const PACE = 1.75; // reloj más lento para poder leer (decisión del dueño, 26/11)
const FPS = 30, stills = process.argv.includes('--stills');

const qr = execFileSync('python3', ['-I', '-c', `
import qrcode, qrcode.image.svg, sys, io
img = qrcode.make(sys.argv[1], image_factory=qrcode.image.svg.SvgPathImage, box_size=10, border=1, error_correction=qrcode.constants.ERROR_CORRECT_M)
b = io.BytesIO(); img.save(b); sys.stdout.write(b.getvalue().decode())`, 'https://sahten.online/pedir/?utm_source=local&utm_medium=pantalla&utm_campaign=como-comprar']).toString()
  .replace(/<\?xml[^>]*>/, '').replace(/fill="#000000"|style="fill:#000000;?[^"]*"/g, 'fill="#183d23"');
const cut = id => pathToFileURL(path.resolve(DIR, '../fotos', id + '.jpg')).href; // foto entera en círculo (sin recortes)
const assets = { qr, logo: fs.readFileSync(path.join(ROOT, 'media/sahten-editorial/logo-verde-crema-naranja.svg'), 'utf8'), cutouts: { shawarma_carne: cut('shawarma_carne'), hummus: cut('hummus') } };
const pasos = JSON.parse(fs.readFileSync(path.join(DIR, 'captura/pasos.json'), 'utf8'));
const data = { shots: pasos.shots, base: pathToFileURL(path.join(DIR, 'captura')).href + '/' };

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
  for (const t of [2.2, 4.4, 5.6, 7.4, 9.7, 12.6, 14.3, 15.9, 19]) { await page.evaluate(t => window.frame(t), t); await stage.screenshot({ path: path.join(OUT, `08-como-comprar-t${String(t).replace('.', '_')}.jpg`), type: 'jpeg', quality: 82 }); }
} else {
  const file = path.join(OUT, '08-como-comprar.mp4');
  const ff = spawn('ffmpeg', ['-y', '-loglevel', 'error', '-f', 'image2pipe', '-framerate', String(FPS), '-c:v', 'mjpeg', '-i', '-', '-c:v', 'libx264', '-preset', 'medium', '-crf', '20', '-pix_fmt', 'yuv420p', '-r', String(FPS), '-movflags', '+faststart', file], { stdio: ['pipe', 'inherit', 'inherit'] });
  const done = new Promise((res, rej) => ff.on('close', c => (c ? rej(new Error('ffmpeg ' + c)) : res())));
  for (let f = 0, n = Math.round(total * FPS * PACE); f < n; f++) {
    await page.evaluate(t => window.frame(t), f / (FPS * PACE));
    const buf = await stage.screenshot({ type: 'jpeg', quality: 92 });
    if (!ff.stdin.write(buf)) await new Promise(r => ff.stdin.once('drain', r));
  }
  ff.stdin.end(); await done; console.log('✓ 08-como-comprar', total.toFixed(1) + ' s');
}
await browser.close();
