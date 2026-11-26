// Captura el recorrido de compra en sahten.online (celular 390×800 a 2×) para los videos «Cómo comprar»
// (tele y web). Los scrolls y el tipeo se graban cuadro a cuadro (secuencias) para que se vean fluidos.
// NUNCA envía un pedido: se detiene antes de «Enviar pedido». Rechaza Analytics. Datos de ejemplo ficticios.
const { chromium, devices } = require('playwright');
const fs = require('fs'), path = require('path');
const OUT = path.join(__dirname, 'captura-web');
fs.rmSync(OUT, { recursive: true, force: true }); fs.mkdirSync(OUT, { recursive: true });
const ease = u => (u < .5 ? 4 * u * u * u : 1 - Math.pow(-2 * u + 2, 3) / 2);
(async () => {
  const b = await chromium.launch();
  const ctx = await b.newContext({ ...devices['iPhone 14'], viewport: { width: 390, height: 800 }, deviceScaleFactor: 2 });
  const p = await ctx.newPage();
  await p.clock.install({ time: new Date('2026-11-26T22:30:00Z') }); // jueves 19:30 (local abierto)
  const shots = []; let n = 0;
  const shot = async (name, tap) => { const file = `${String(++n).padStart(3, '0')}-${name}.png`; await p.screenshot({ path: path.join(OUT, file) }); shots.push({ file, name, tap: tap || null }); return file; };
  const center = async loc => { const bb = await loc.boundingBox(); return bb ? { x: bb.x + bb.width / 2, y: bb.y + bb.height / 2 } : null; };
  const reject = async () => { const r = p.getByRole('button', { name: /Rechazar/i }); if (await r.count()) await r.first().click().catch(() => {}); };
  const relabel = () => p.evaluate(() => { const a = document.querySelector('a[data-editorial-menu]'); if (a) a.innerHTML = 'Pedir online <span aria-hidden="true">↗</span>'; });
  const noSmooth = () => p.addStyleTag({ content: 'html,body,*{scroll-behavior:auto!important}' });
  // Secuencia de scroll suave (ventana o el contenedor desplazable del elemento), un cuadro por paso.
  async function scrollSeq(name, target, delta, frames = 40) {
    const info = await target.evaluate((el, delta) => {
      document.querySelectorAll('[data-scroll-box]').forEach(x => delete x.dataset.scrollBox);
      let s = el.parentElement; while (s && !(s.scrollHeight > s.clientHeight + 4 && /(auto|scroll)/.test(getComputedStyle(s).overflowY))) s = s.parentElement;
      const box = el.getBoundingClientRect();
      if (s) s.dataset.scrollBox = '1';
      const start = s ? s.scrollTop : scrollY, top = s ? box.top - s.getBoundingClientRect().top + s.scrollTop : box.top + scrollY;
      return { inner: !!s, start, end: Math.max(0, top - delta) };
    }, delta);
    const files = [];
    for (let i = 0; i <= frames; i++) {
      const y = info.start + (info.end - info.start) * ease(i / frames);
      await p.evaluate(([inner, y]) => { const s = document.querySelector('[data-scroll-box]'); if (inner && s) s.scrollTop = y; else window.scrollTo(0, y); }, [info.inner, y]);
      await p.waitForTimeout(25);
      files.push(await shot(name + '-' + String(i).padStart(2, '0')));
    }
    shots.push({ seq: name, files }); return files;
  }
  // Tipeo letra por letra
  async function typeSeq(name, input, text) {
    const files = [await shot(name + '-00')];
    await input.click();
    for (let i = 0; i < text.length; i++) { await input.press(text[i] === ' ' ? 'Space' : text[i]).catch(async () => input.type(text[i])); await p.waitForTimeout(40); files.push(await shot(name + '-' + String(i + 1).padStart(2, '0'))); }
    shots.push({ seq: name, files }); return files;
  }

  // 1) Portada (el botón del encabezado se publica como «Pedir online» junto con este video)
  await p.goto('https://sahten.online/', { waitUntil: 'networkidle', timeout: 60000 }); await noSmooth(); await p.waitForTimeout(1500); await reject(); await relabel();
  await shot('portada', await center(p.locator('a[data-editorial-menu]').first()));
  // 2) La carta: scroll fluido hasta la tabla para compartir
  await p.goto('https://sahten.online/pedir/', { waitUntil: 'networkidle', timeout: 60000 }); await noSmooth(); await p.waitForTimeout(1200); await reject(); await relabel();
  await shot('carta');
  const add = p.getByRole('button', { name: 'Agregar Tabla para Compartir' }).first();
  await scrollSeq('scroll-carta', add, 560, 48);
  const ta = await center(add); await shot('antes-agregar', ta); await add.click(); await p.waitForTimeout(900); await shot('agregado', ta);
  // 3) Revisá tu pedido y seguí con la entrega
  const cart = p.getByRole('button', { name: /Mi pedido/i }).first(); const tc = await center(cart);
  await cart.click(); await p.waitForTimeout(1100); await shot('carrito', tc);
  const cont = p.getByRole('button', { name: /Continuar con entrega y pago/i }).first(); const tk = await center(cont);
  await shot('antes-continuar', tk); await cont.click(); await p.waitForTimeout(1400); await shot('entrega', tk);
  // 4) Retiro, nombre y teléfono, pago con 10 %
  const retiro = p.getByRole('button', { name: /Retiro en local/i }).first(); const tr = await center(retiro);
  await shot('antes-retiro', tr); await retiro.click(); await p.waitForTimeout(800); await shot('retiro', tr);
  const nombre = p.getByLabel(/^Nombre/i).first();
  await scrollSeq('scroll-datos', nombre, 300, 30);
  const tn = await center(nombre); shots.push({ tapAt: 'nombre', tap: tn });
  await typeSeq('nombre', nombre, 'Lucía');
  const tel = p.getByLabel(/Tel[eé]fono/i).first(); const tt = await center(tel); shots.push({ tapAt: 'telefono', tap: tt });
  await typeSeq('telefono', tel, '11 2345 6789');
  await p.evaluate(() => document.activeElement && document.activeElement.blur());
  const efe = p.getByRole('button', { name: /Efectivo/i }).or(p.getByRole('radio', { name: /Efectivo/i })).first();
  await scrollSeq('scroll-pago', efe, 330, 30);
  const te = await center(efe); await shot('pago', te);
  // 5) Enviá tu pedido: solo se marca el botón; NO se hace clic.
  const env = p.getByRole('button', { name: /Enviar pedido/i }).first(); await shot('enviar', await center(env));
  fs.writeFileSync(path.join(OUT, 'pasos.json'), JSON.stringify({ viewport: { w: 390, h: 800, dpr: 2 }, shots }, null, 1));
  console.log(shots.filter(s => s.seq).map(s => s.seq + ':' + s.files.length).join(' '), '·', shots.filter(s => s.file).length, 'cuadros');
  await b.close();
})();
