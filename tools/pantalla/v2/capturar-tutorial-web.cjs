// Captura el recorrido que narra la voz del tutorial de la web (sahten.online), en un celular de 390×800.
// NUNCA envía un pedido: se detiene antes de «Enviar pedido». Rechaza Analytics. Datos de ejemplo ficticios.
const { chromium, devices } = require('playwright');
const fs = require('fs'), path = require('path');
const OUT = path.join(__dirname, 'captura-web');
fs.mkdirSync(OUT, { recursive: true });
for (const f of fs.readdirSync(OUT)) fs.rmSync(path.join(OUT, f));
(async () => {
  const b = await chromium.launch(); const ctx = await b.newContext({ ...devices['iPhone 14'], viewport: { width: 390, height: 800 } }); const p = await ctx.newPage();
  await p.clock.install({ time: new Date('2026-11-26T22:30:00Z') }); // jueves 19:30 (local abierto)
  const shots = []; let n = 0;
  const shot = async (name, tap) => { const file = `${String(++n).padStart(2, '0')}-${name}.png`; await p.screenshot({ path: path.join(OUT, file) }); shots.push({ file, tap: tap || null }); };
  const center = async loc => { const bb = await loc.boundingBox(); return bb ? { x: bb.x + bb.width / 2, y: bb.y + bb.height / 2 } : null; };
  const reject = async () => { const r = p.getByRole('button', { name: /Rechazar/i }); if (await r.count()) await r.first().click().catch(() => {}); };
  // 1) Portada: el botón del encabezado se publica como «Pedir online» junto con este video.
  await p.goto('https://sahten.online/', { waitUntil: 'networkidle', timeout: 60000 }); await p.waitForTimeout(1500); await reject();
  await p.evaluate(() => { const a = document.querySelector('a[data-editorial-menu]'); if (a) a.innerHTML = 'Pedir online <span aria-hidden="true">↗</span>'; });
  const pedir = p.locator('a[data-editorial-menu]').first(); await p.waitForTimeout(400);
  const tp = await center(pedir); await shot('portada', tp);
  await p.goto('https://sahten.online/pedir/', { waitUntil: 'networkidle', timeout: 60000 }); await p.waitForTimeout(1200); await reject();
  await p.evaluate(() => { const a = document.querySelector('a[data-editorial-menu]'); if (a) a.innerHTML = 'Pedir online <span aria-hidden="true">↗</span>'; });
  await shot('carta');
  // 2) Una tabla para compartir
  const add = p.getByRole('button', { name: 'Agregar Tabla para Compartir' }).first(); await add.scrollIntoViewIfNeeded(); await p.evaluate(() => scrollBy(0, -160)); await p.waitForTimeout(500);
  const ta = await center(add); await shot('antes-agregar', ta); await add.click(); await p.waitForTimeout(900); await shot('agregado', ta);
  // 3) Revisá tu pedido y seguí con la entrega
  const cart = p.getByRole('button', { name: /Mi pedido/i }).first(); const tc = await center(cart);
  await shot('antes-carrito', tc); await cart.click(); await p.waitForTimeout(1100); await shot('carrito', tc);
  const cont = p.getByRole('button', { name: /Continuar con entrega y pago/i }).first(); const tk = await center(cont);
  await shot('antes-continuar', tk); await cont.click(); await p.waitForTimeout(1400); await shot('entrega', tk);
  // 4) Delivery o retiro, nombre y teléfono, pago con 10 %
  const retiro = p.getByRole('button', { name: /Retiro en local/i }).first(); const tr = await center(retiro);
  await shot('antes-retiro', tr); await retiro.click(); await p.waitForTimeout(800); await shot('retiro', tr);
  const nombre = p.getByLabel(/^Nombre/i).first(); await nombre.scrollIntoViewIfNeeded(); await p.evaluate(() => scrollBy(0, 120)); await p.waitForTimeout(400);
  const tn = await center(nombre); await shot('antes-nombre', tn); await nombre.click(); await nombre.pressSequentially('Lucía', { delay: 40 }); await p.waitForTimeout(300); await shot('nombre', tn);
  const tel = p.getByLabel(/Tel[eé]fono/i).first(); const tt = await center(tel); await tel.click(); await tel.pressSequentially('11 2345 6789', { delay: 30 }); await p.waitForTimeout(300); await shot('telefono', tt);
  await p.locator('body').click({ position: { x: 5, y: 300 } }).catch(() => {});
  const efe = p.getByRole('button', { name: /Efectivo/i }).or(p.getByRole('radio', { name: /Efectivo/i })).first();
  await efe.scrollIntoViewIfNeeded(); await p.evaluate(() => scrollBy(0, 60)); await p.waitForTimeout(500);
  const te = await center(efe); await shot('antes-efectivo', te); await efe.click(); await p.waitForTimeout(900); await shot('efectivo', te);
  // 5) Enviá tu pedido: solo se marca el botón; no se hace clic.
  const env = p.getByRole('button', { name: /Enviar pedido/i }).first(); const tv = await center(env); await shot('enviar', tv);
  fs.writeFileSync(path.join(OUT, 'pasos.json'), JSON.stringify({ viewport: { w: 390, h: 800 }, shots }, null, 1));
  console.log(shots.map(s => s.file + (s.tap ? '*' : '')).join(' '));
  await b.close();
})();
