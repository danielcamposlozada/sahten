// Captura la tienda real de sahten.online en un iPhone 14 emulado para el video «Cómo comprar».
// Solo navega y arma un carrito local: NUNCA confirma un pedido ni inicia un pago. Rechaza Analytics.
const { chromium, devices } = require('playwright');
const fs = require('fs'), path = require('path');
const OUT = path.join(__dirname, 'captura');
(async () => {
  const b = await chromium.launch(); const ctx = await b.newContext({ ...devices['iPhone 14'], viewport: { width: 390, height: 800 } }); const p = await ctx.newPage();
  // Horario de atención simulado (jueves 19:30 de Argentina) para que la tienda muestre las opciones activas.
  await p.clock.install({ time: new Date('2026-11-26T22:30:00Z') });
  const shots = []; let n = 0;
  const shot = async (name, tap) => { const file = `${String(++n).padStart(2, '0')}-${name}.png`; await p.screenshot({ path: path.join(OUT, file) }); shots.push({ file, tap: tap || null, scrollY: await p.evaluate(() => scrollY) }); };
  const center = async loc => { const bb = await loc.boundingBox(); return bb ? { x: bb.x + bb.width / 2, y: bb.y + bb.height / 2 } : null; };
  await p.goto('https://sahten.online/pedir/', { waitUntil: 'networkidle', timeout: 60000 }); await p.waitForTimeout(2000);
  const rej = p.getByRole('button', { name: /Rechazar/i }); if (await rej.count()) await rej.first().click();
  await p.waitForTimeout(500); await shot('carta');
  await p.evaluate(() => scrollTo(0, 640)); await p.waitForTimeout(800); await shot('lista');
  const add1 = p.getByRole('button', { name: 'Agregar Shawarma de Carne' }).first(); await add1.scrollIntoViewIfNeeded(); await p.waitForTimeout(400);
  const t1 = await center(add1); await shot('antes-agregar', t1); await add1.click(); await p.waitForTimeout(900); await shot('agregado', t1);
  const add2 = p.getByRole('button', { name: 'Agregar Hummus' }).first(); await add2.scrollIntoViewIfNeeded(); await p.waitForTimeout(400);
  const t2 = await center(add2); await shot('antes-agregar-2', t2); await add2.click(); await p.waitForTimeout(900); await shot('agregado-2', t2);
  const cart = p.getByRole('button', { name: /Mi pedido/i }).first(); const tc = await center(cart);
  await shot('antes-carrito', tc); await cart.click(); await p.waitForTimeout(1200); await shot('carrito', tc);
  // Paso 3: continuar a entrega y pago (sin confirmar).
  const cont = p.getByRole('button', { name: /Continuar|entrega y pago|Siguiente/i }).first();
  if (await cont.count()) { const tk = await center(cont); await shot('antes-continuar', tk); await cont.click(); await p.waitForTimeout(1500); await shot('entrega-pago', tk);
    const retiro = p.getByRole('button', { name: /Retiro en local/i }).first();
    if (await retiro.count()) { const tr = await center(retiro); await shot('antes-retiro', tr); await retiro.click(); await p.waitForTimeout(900); await shot('retiro', tr); }
    const efectivo = p.getByRole('button', { name: /^Efectivo/i }).or(p.getByRole('radio', { name: /Efectivo/i })).first();
    if (await efectivo.count()) { await efectivo.scrollIntoViewIfNeeded(); await p.waitForTimeout(500); const te = await center(efectivo); await shot('antes-efectivo', te); await efectivo.click(); await p.waitForTimeout(900); await shot('efectivo', te); }
  }
  const texts = await p.evaluate(() => [...document.querySelectorAll('button,label,h2,h3')].map(e => e.textContent.trim()).filter(Boolean).slice(0, 60));
  fs.writeFileSync(path.join(OUT, 'pasos.json'), JSON.stringify({ viewport: { w: 390, h: 800, dpr: 3 }, shots, texts }, null, 1));
  console.log(shots.map(s => s.file).join(' '));
  await b.close();
})();
