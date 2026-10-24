import { it, expect } from 'vitest';
import { JSDOM } from 'jsdom';
import { buildPublishFiles, buildIndexHtml } from '../src/online/publish.js';
import { storefrontHref, publishedMenuWithLiveCatalog } from '../src/online/storefront.js';
import { normalizeSite, buildSite, exportSiteContent, parseSiteContent, applySiteContent } from '../src/online/site.js';

const fixture = () => ({
  store: { name: 'Local de prueba', address: 'Calle 123' },
  config: { categories: ['Árabe / entradas'] }, payments: { methods: { efectivo: true } }, delivery: {},
  products: [{ id: 'p', name: 'Fatay', category: 'Árabe / entradas', price: 100, star: true, image: 'img/p.jpg' }],
  site: { enabled: true, orderPage: true, seo: { url: 'https://local.example/tienda' }, images: {}, order: ['hero', 'favoritos', 'menu'], hero: { title: 'Nuestra cocina', cta: 'Pedir online', highlights: [] }, favoritos: { title: 'Favoritos' } },
});
async function render(menu, options = {}, url = 'https://local.example/tienda/', storage = {}) {
  const dom = new JSDOM(buildIndexHtml(menu, options), { url, runScripts: 'dangerously', beforeParse(w) {
    w.scrollTo = () => {}; w.fetch = async () => ({ ok: false });for(const [k,v] of Object.entries(storage))w.sessionStorage.setItem(k,v);
  } });
  await new Promise(r => setTimeout(r, 50)); return dom;
}
it('la opción se conserva al exportar e importar, sin encender el sitio ni cambiar proyectos anteriores', () => {
  const s = normalizeSite({ enabled: true, orderPage: true });
  const parsed = parseSiteContent(exportSiteContent(s));
  expect(applySiteContent({}, parsed)).toMatchObject({ enabled: false, orderPage: true });
  expect(buildSite(s).orderPage).toBe(true);
  expect(buildSite({ enabled: true }).orderPage).toBeUndefined();
  expect(normalizeSite({}).orderPage).toBe(false);
  expect(applySiteContent(s, parseSiteContent('{"format":"sahten-sitio","site":{}}')).orderPage).toBe(true);
});
it('genera tienda con base de recursos correcta, canonical propio y sin duplicar la carta SEO en el sitemap', async () => {
  const files = await buildPublishFiles(fixture());
  const doc = new JSDOM(files.find(f => f.path === 'pedir/index.html').data, { url: 'https://local.example/tienda/pedir/' }).window.document;
  expect(doc.body.hasAttribute('data-storefront')).toBe(true);
  expect(new URL('menu.json', doc.baseURI).href).toBe('https://local.example/tienda/menu.json');
  expect(new URL('img/p.jpg', doc.baseURI).href).toBe('https://local.example/tienda/img/p.jpg');
  expect(doc.querySelector('link[rel=canonical]').href).toBe('https://local.example/tienda/pedir/');
  expect(doc.querySelector('meta[name=robots]').content).toBe('noindex,follow');
  expect(doc.querySelector('#faq-schema')).toBeNull();
  const info = new JSDOM(files.find(f => f.path === 'menu/index.html').data).window.document;
  expect(info.querySelector('a.cta').getAttribute('href')).toBe('../pedir/');
  expect(files.find(f => f.path === 'sitemap.xml').data).not.toContain('/pedir/');
  const old = fixture(); old.site.orderPage = false;
  expect((await buildPublishFiles(old)).some(f => f.path === 'pedir/index.html')).toBe(false);
});
it('mantiene parámetros de retorno de pago, modo de pruebas, negocio y categoría codificada', () => {
  const href = storefrontHref(fixture(), 'https://local.example/tienda/', '?store=local&mp_test=1&mp_checkout=abc&payment_id=123', 'Árabe / entradas');
  const url = new URL(href);
  expect(url.pathname).toBe('/tienda/pedir/');
  expect(url.searchParams.get('mp_checkout')).toBe('abc');
  expect(url.searchParams.get('payment_id')).toBe('123');
  expect(url.searchParams.get('mp_test')).toBe('1');
  expect(url.searchParams.get('store')).toBe('local');
  expect(decodeURIComponent(url.hash)).toBe('#pedido/Árabe / entradas');
});
it('actualiza precios y productos desde la nube conservando diseño y datos de identidad publicados', () => {
  const base = fixture(), live = { ...fixture(), products: [{ id: 'nuevo', price: 200 }], site: { enabled: false }, store: { name: 'Anterior', address: 'Anterior', whatsapp: '123' } };
  const merged = publishedMenuWithLiveCatalog(base, live);
  expect(merged.products).toEqual(live.products);
  expect(merged.site).toEqual(base.site);
  expect(merged.store).toEqual({ ...base.store, whatsapp: '123' });
  expect(live.site.enabled).toBe(false);
  base.site.orderPage = false;
  expect(publishedMenuWithLiveCatalog(base, live)).toBe(live);
});
it('la portada enlaza a la tienda desde hero, favoritos, categorías y navegación, sin carrito separado', async () => {
  const dom = await render(fixture(), {}, 'https://local.example/tienda/?mp_test=1');
  const d = dom.window.document;
  for (const selector of ['#s-hero .btn1', '#s-fav .add', '#s-menuhd .ctile', '#s-menuhd .pedir-cta', '#snav .pedido']) {
    const link = d.querySelector(selector);
    expect(new URL(link.href).pathname).toBe('/tienda/pedir/');
    expect(new URL(link.href).searchParams.get('mp_test')).toBe('1');
  }
  expect(d.querySelector('#s-fav [data-inc]')).toBeNull();
  dom.window.close();
});
it('la tienda abre la categoría elegida y conserva el carrito y las opciones retiro/delivery', async () => {
  const dom = await render(fixture(), { storefront: true }, 'https://local.example/tienda/pedir/#pedido/' + encodeURIComponent('Árabe / entradas'));
  const d = dom.window.document;
  expect(d.querySelector('#s-hero')).toBeNull();
  expect(d.querySelector('.cat.on').textContent).toBe('Árabe / entradas');
  expect(d.querySelector('#oback a').href).toBe('https://local.example/tienda/');
  d.querySelector('#grid [data-inc]').click();
  expect(d.querySelector('#bar-n').textContent).toBe('1 producto');
  d.querySelector('#bar button').click();
  expect(d.querySelector('#sheet').textContent).toContain('Retiro');
  expect(d.querySelector('#sheet').textContent).toContain('Delivery');
  dom.window.close();
});
it('la vista previa mantiene el recorrido dentro del editor, sin salir al hosting', async () => {
  const dom = await render(fixture(), { preview: true });
  expect(dom.window.document.querySelector('#s-hero .btn1').getAttribute('href')).toBe('#pedido');
  expect(dom.window.document.querySelector('#s-fav [data-inc]')).not.toBeNull();
  dom.window.close();
});
it.each(['https://local.example/pedir/','https://local.example/tienda/pedir/'])('la tienda mantiene identidad, retorno a secciones y carrito en %s',async url=>{
  const menu=fixture();menu.site.logo='data:image/png;base64,iVBORw0KGgo=';
  menu.site.order.push('historia','contacto');menu.site.historia={title:'Historia',text:'Nuestra cocina'};menu.site.contacto={};
  const dom=await render(menu,{storefront:true},url),d=dom.window.document,home=new URL('../',url).href;
  expect(d.querySelector('#snav .nav-brand').href).toBe(home);
  expect(d.querySelector('#snav .brand-mark')).not.toBeNull();
  expect(d.querySelector('#snav a[aria-current=page]').textContent).toBe('Menú');
  expect([...d.querySelectorAll('#snav a')].some(a=>a.href===home+'#s-about')).toBe(true);
  expect(d.querySelector('#s-hero')).toBeNull();expect(d.querySelector('#s-about')).toBeNull();
  d.querySelector('#grid [data-inc]').click();expect(d.querySelector('#snav .pedido').textContent).toBe('Mi pedido (1)');
  d.querySelector('#snav .pedido').click();expect(d.querySelector('#ov').classList.contains('on')).toBe(true);dom.window.close();
});
it('el menú simple conserva catálogo al apagar el sitio completo',async()=>{
  const menu=fixture();menu.site.enabled=false;
  const dom=await render(menu,{storefront:true},'https://local.example/pedir/');
  expect(dom.window.document.querySelector('#snav')).toBeNull();expect(dom.window.document.querySelector('#grid [data-inc]')).not.toBeNull();dom.window.close();
});

it('conserva cantidades al volver de otra sección, usa precios actuales y no comparte el carrito entre negocios',async()=>{
 const m=fixture(),dom=await render(m,{storefront:true},'https://local.example/tienda/pedir/');
 dom.window.document.querySelector('#grid [data-inc]').click();
 const key=dom.window.sessionStorage.key(0),storage={[key]:dom.window.sessionStorage.getItem(key)};dom.window.close();
 expect(JSON.stringify(storage)).not.toMatch(/customerName|unitPrice|phone/);
 m.products[0].price=200;const back=await render(m,{storefront:true},'https://local.example/tienda/pedir/',storage);
 expect(back.window.document.querySelector('#snav .pedido').textContent).toBe('Mi pedido (1)');expect(back.window.document.querySelector('#bar-t').textContent).toBe('$200');back.window.close();
 const other=await render(m,{storefront:true},'https://local.example/otro/pedir/',storage);expect(other.window.document.querySelector('#snav .pedido').textContent).toBe('Mi pedido (0)');other.window.close();
});
it('descarta carrito vencido o cantidades inválidas',async()=>{
 const key='sahten-cart:/tienda/:Local de prueba';
 for(const saved of [{at:Date.now()-86400001,items:{p:2}},{at:Date.now(),items:{p:-1}}]){
  const dom=await render(fixture(),{storefront:true},'https://local.example/tienda/pedir/',{[key]:JSON.stringify(saved)});
  expect(dom.window.document.querySelector('#snav .pedido').textContent).toBe('Mi pedido (0)');dom.window.close();
 }
});

it.each([true,false])('el pie configurado se conserva al comprar, independiente=%s, sin duplicar IDs ni mostrar la portada',async standalone=>{
 const m=fixture();m.site.orderPage=standalone;m.site.order=['contacto','hero','menu'];
 m.site.contacto={creditText:'Crédito de prueba',creditUrl:'https://example.com/'};
 const dom=await render(m,{storefront:standalone},'https://local.example/tienda/'+(standalone?'pedir/':'')+'#pedido'),d=dom.window.document;
 const footer=d.querySelector('#s-rest .sfoot');expect(footer).not.toBeNull();
 expect(d.querySelectorAll('#s-contact')).toHaveLength(1);
 expect(footer.textContent).toContain('Calle 123');expect(footer.querySelector('.by a').href).toBe('https://example.com/');
 expect(footer.querySelector('a[href="menu/"]').href).toBe('https://local.example/tienda/menu/');
 expect(d.querySelector('#foot').textContent).toBe('');
 d.querySelector('#grid [data-inc]').click();expect(d.body.classList.contains('has-cart')).toBe(true);
 d.querySelector('#grid [data-dec]').click();expect(d.body.classList.contains('has-cart')).toBe(false);
 if(standalone){d.querySelector('#cats button:last-child').click();d.querySelector('#grid [data-inc]').click();expect(new URL(dom.window.location.href).pathname).toBe('/tienda/pedir/');expect(d.querySelector('#s-contact a[href="menu/"]').href).toBe('https://local.example/tienda/menu/');}
 if(!standalone){dom.window.location.hash='';await new Promise(r=>setTimeout(r,20));expect(d.querySelectorAll('#s-contact')).toHaveLength(1);expect(d.querySelector('#s-top .sfoot')).not.toBeNull();}
 dom.window.close();
});
it('respeta la sección contacto apagada y mantiene el pie simple sin inventar un crédito',async()=>{
 const m=fixture(),dom=await render(m,{storefront:true},'https://local.example/tienda/pedir/');
 expect(dom.window.document.querySelector('.sfoot')).toBeNull();expect(dom.window.document.querySelector('#foot').textContent).toContain('Calle 123');dom.window.close();
});
