// Renderiza los videos de la pantalla del local (1080 × 1920, 30 fps, H.264, loop exacto).
//   node tools/pantalla/render.mjs                 → todos los videos + loop completo
//   node tools/pantalla/render.mjs --only 05-los-mas-pedidos
//   node tools/pantalla/render.mjs --stills        → solo cuadros de control (rápido)
// Lee el menú PUBLICADO de Sahten (datos públicos, clave publicable de la app). No escribe nada.
import fs from 'node:fs';
import path from 'node:path';
import { spawn, execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { VIDEOS, PACE } from './videos.mjs';

const require = createRequire(import.meta.url);
const { chromium } = require('playwright');
const DIR = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(DIR, '../..');
const OUT = path.join(DIR, 'out');
const PHOTOS = path.join(DIR, 'fotos');
const URL_ = 'https://dtnbokdrxojdcvguuidk.supabase.co';
const KEY = 'sb_publishable_LxMRld0m1DZKH2uOiBGZAQ_zsGiBQmR'; // pública: la misma que trae la app (src/online/cloudConfig.js)
const args = process.argv.slice(2);
const only = args.includes('--only') ? args[args.indexOf('--only') + 1] : null;
const stills = args.includes('--stills');
const FPS = Number(args.includes('--fps') ? args[args.indexOf('--fps') + 1] : 30);

async function rest(p, body) {
  const r = await fetch(URL_ + p, { method: body ? 'POST' : 'GET', headers: { apikey: KEY, Authorization: 'Bearer ' + KEY, 'Content-Type': 'application/json' }, body: body ? JSON.stringify(body) : undefined });
  if (!r.ok) throw new Error(p + ' → HTTP ' + r.status);
  return r.json();
}

const [{ store_id: storeId, json: menu }] = await rest('/rest/v1/menus?select=store_id,json&json->store->>slug=eq.sahten');
const loyalty = await rest('/rest/v1/rpc/get_public_loyalty_programs', { p_store_id: storeId });
const registry = JSON.parse(fs.readFileSync(path.join(ROOT, 'media/sahten-editorial/product-descriptions.json'), 'utf8')).products;
const byId = Object.fromEntries(menu.products.map(p => [p.id, p]));

function checkRequires(v) {
  const r = v.requires || {};
  if (r.paymentBenefit) { const b = menu.payments?.benefit; if (!(b?.enabled && Number(b.percent) === r.paymentBenefit && b.channels?.mostrador !== false)) throw new Error(v.id + ': el beneficio de pago publicado ya no es ' + r.paymentBenefit + ' %'); }
  if (r.campaign) { const c = (menu.promotions?.campaigns || []).find(x => x.id === r.campaign); if (!(menu.promotions?.enabled && c?.enabled && c.channels?.includes('mostrador'))) throw new Error(v.id + ': la campaña ' + r.campaign + ' no está publicada para el local'); }
  if (r.loyalty) for (const id of r.loyalty) if (!loyalty.some(p => p.id === id)) throw new Error(v.id + ': el programa ' + id + ' no está publicado');
}

async function photoFor(id) {
  const file = path.join(PHOTOS, id + '.jpg');
  const p = byId[id];
  if (p?.image && /^https:\/\//.test(p.image)) {
    const r = await fetch(p.image); if (r.ok) fs.writeFileSync(file, Buffer.from(await r.arrayBuffer()));
  }
  if (!fs.existsSync(file)) throw new Error('Falta la foto de ' + id + ' (tools/pantalla/fotos/' + id + '.jpg)');
  return pathToFileURL(file).href;
}

async function catalogFor(v) {
  const ids = new Set(v.scenes.flatMap(s => [s.product, ...(s.items || []), ...(s.photos || []), ...(s.products || [])]).filter(Boolean));
  const out = {};
  for (const id of ids) {
    const p = byId[id], scene = v.scenes.find(s => s.product === id || s.items?.includes(id));
    if (!p && !scene?.allowUnpublished && !VIDEOS.some(x => x.scenes.some(s => s.product === id && s.allowUnpublished))) throw new Error(v.id + ': ' + id + ' no está en el menú publicado');
    if (p?.salesAvailability?.paused || p?.retired) throw new Error(v.id + ': ' + (p.name || id) + ' está pausado');
    out[id] = { id, name: registry[id]?.name || p?.name || id, description: registry[id]?.description || '', price: p ? Number(p.price) : null, photo: await photoFor(id), cutout: fs.existsSync(path.join(DIR, 'recortes', id + '.png')) ? pathToFileURL(path.join(DIR, 'recortes', id + '.png')).href : null };
    if (v.scenes.some(s => (s.items?.includes(id) || s.products?.includes(id) && s.type === 'orbit' || (s.product === id && s.price !== false))) && !(out[id].price > 0)) throw new Error(v.id + ': ' + id + ' no tiene precio publicado');
  }
  return out;
}

function assets() {
  const qrUrl = VIDEOS.flatMap(v => v.scenes).find(s => s.type === 'qr')?.url || 'https://sahten.online/';
  const qr = execFileSync('python3', ['-I', '-c', `
import qrcode, qrcode.image.svg, sys, io
img = qrcode.make(sys.argv[1], image_factory=qrcode.image.svg.SvgPathImage, box_size=10, border=1, error_correction=qrcode.constants.ERROR_CORRECT_M)
b = io.BytesIO(); img.save(b); sys.stdout.write(b.getvalue().decode())`, qrUrl]).toString()
    .replace(/<\?xml[^>]*>/, '').replace(/fill="#000000"|style="fill:#000000;?[^"]*"/g, 'fill="#183d23"');
  const ed = f => fs.readFileSync(path.join(ROOT, 'media/sahten-editorial', f), 'utf8');
  return {
    logo: ed('logo-verde-crema-naranja.svg'), calligraphy: ed('caligrafia.svg'), qr,
    photos: { 'banner-tortas': pathToFileURL(path.join(ROOT, 'media/sahten-editorial/banner-tortas.webp')).href, 'banner-plato': pathToFileURL(path.join(ROOT, 'media/sahten-editorial/banner-plato.webp')).href },
  };
}

function ffmpeg(file) {
  const p = spawn('ffmpeg', ['-y', '-loglevel', 'error', '-f', 'image2pipe', '-framerate', String(FPS), '-c:v', 'mjpeg', '-i', '-', '-c:v', 'libx264', '-preset', 'medium', '-crf', '20', '-pix_fmt', 'yuv420p', '-r', String(FPS), '-movflags', '+faststart', file], { stdio: ['pipe', 'inherit', 'inherit'] });
  const done = new Promise((res, rej) => p.on('close', c => (c ? rej(new Error('ffmpeg ' + c)) : res())));
  return { write: buf => new Promise(r => (p.stdin.write(buf) ? r() : p.stdin.once('drain', r))), end: () => (p.stdin.end(), done) };
}

fs.mkdirSync(OUT, { recursive: true });
const A = assets();
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1080, height: 1920 }, deviceScaleFactor: 1 });
const report = [];
for (const v of VIDEOS.filter(v => !only || v.id === only)) {
  checkRequires(v);
  const catalog = await catalogFor(v);
  await page.goto(pathToFileURL(path.join(DIR, 'stage.html')).href);
  await page.evaluate(a => { window.ASSETS = a; }, A);
  const total = await page.evaluate(([video, cat]) => window.build(video, cat).total, [v, catalog]);
  await page.evaluate(() => window.ready());
  const frames = Math.round(total * FPS * PACE);
  const stage = await page.$('#stage');
  if (stills) {
    let t = .9; const marks = v.scenes.map(s => { const m = t + Math.min(s.dur - .2, 1.8); t += s.dur; return m; });
    for (const [i, m] of marks.entries()) { await page.evaluate(x => window.seek(x), m); await stage.screenshot({ path: path.join(OUT, `${v.id}-s${i + 1}.jpg`), type: 'jpeg', quality: 80 }); }
    report.push({ id: v.id, seconds: +total.toFixed(2), stills: marks.length });
    continue;
  }
  const file = path.join(OUT, v.id + '.mp4'), enc = ffmpeg(file);
  const t0 = Date.now();
  for (let f = 0; f < frames; f++) { // [0, total): el último cuadro no repite el primero → loop sin salto
    await page.evaluate(x => window.seek(x), f / (FPS * PACE));
    await enc.write(await stage.screenshot({ type: 'jpeg', quality: 92 }));
  }
  await enc.end();
  report.push({ id: v.id, seconds: +(total * PACE).toFixed(2), frames, renderSeconds: Math.round((Date.now() - t0) / 1000) });
  console.log('✓', v.id, (total * PACE).toFixed(1) + ' s');
}
await browser.close();
if (!stills && !only) {
  const list = path.join(OUT, 'lista.txt');
  fs.writeFileSync(list, VIDEOS.map(v => `file '${v.id}.mp4'`).join('\n'));
  execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-f', 'concat', '-safe', '0', '-i', list, '-c', 'copy', '-movflags', '+faststart', path.join(OUT, '00-loop-completo.mp4')]);
  fs.rmSync(list);
}
fs.writeFileSync(path.join(OUT, 'informe.json'), JSON.stringify({ generatedAt: new Date().toISOString(), menuGeneratedAt: menu.generatedAt, videos: report }, null, 2));
console.log(JSON.stringify(report));
