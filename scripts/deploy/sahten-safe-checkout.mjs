#!/usr/bin/env node
// SAHTEN: actualización conservadora de portada y /pedir/ en Cloudflare Pages.
// Mantiene EXACTOS los otros 16 archivos del despliegue aprobado de 01/11.
// Lee el catálogo vigente de Supabase en modo público. No publica campañas.
import fs from 'node:fs/promises';
import path from 'node:path';
import { createServer } from 'vite';

const PINNED_URL='https://84a00719.sahten-menu.pages.dev';
const PUBLISHED_FILES=[
  '/apple-touch-icon.png',
  '/brand/sahten-comida-arabe-og-1200x630.png',
  '/brand/sahten-icon-192.png',
  '/brand/sahten-icon-512.png',
  '/brand/sahten-icon-maskable-512.png',
  '/catering/index.html',
  '/delivery-y-retiro/index.html',
  '/favicon.ico',
  '/favicon.svg',
  '/img/site_familia.jpg',
  '/img/site_historia.jpg',
  '/index.html',
  '/menu.json',
  '/menu/index.html',
  '/nuestra-historia/index.html',
  '/pedir/index.html',
  '/robots.txt',
  '/site.webmanifest',
  '/sitemap.xml'
];
const output=path.resolve(process.env.SAHTEN_DEPLOY_OUTPUT||'sahten-export');
const url=(rel)=>PINNED_URL+rel;
async function fetchResponse(address,opts){
  const res=await fetch(address,{...opts,signal:AbortSignal.timeout(25000)});
  if(!res.ok)throw new Error('Fetch failed ('+res.status+'): '+new URL(address).origin+new URL(address).pathname);
  return res;
}
async function download(rel){
  const res=await fetchResponse(url(rel));
  const data=Buffer.from(await res.arrayBuffer());
  if(!data.length)throw new Error('Empty source asset: '+rel);
  return data;
}
function check(menu,base){
  if(!base.supabase?.url || !base.supabase?.anonKey || !base.supabase?.storeId)
    throw new Error('Pinned menu missing Supabase public connection');
  if(base.products?.length!==38)throw new Error('Pinned menu has changed: requires human review');
  if(!base.site?.enabled || !base.site?.orderPage)throw new Error('Original site/page structure is not available');
  if(menu.products?.length!==38)throw new Error('Public product count mismatch: expected 38');
  const drinks=menu.products.filter(p=>p.category==='Bebidas');
  if(drinks.length!==11)throw new Error('Expected eleven published drinks');
  const price={2500:0,2000:0,1400:0};
  for(const d of drinks){if(!(Number(d.price) in price))throw new Error('Unexpected drink price: '+d.id);price[d.price]++;}
  if(price[2500]!==4 || price[2000]!==2 || price[1400]!==5)
    throw new Error('Drink price bands changed');
  const beforeIds=new Set(base.products.map(p=>p.id));
  const afterIds=new Set(menu.products.map(p=>p.id));
  for(const id of beforeIds)if(!afterIds.has(id))throw new Error('Previously listed product removed: '+id);
  if(menu.promotions?.enabled===true)throw new Error('Promotions must remain disabled');
  if(Number(menu.payments?.benefit?.percent)!==10)throw new Error('Base payment benefit changed');
  if(menu.delivery?.enabled===undefined)throw new Error('Delivery config missing');
}
async function latestMenu(base){
  const sb=base.supabase;
  const endpoint=sb.url.replace(/\/$/,'')+'/rest/v1/stores?select=id,menus(json)&slug=eq.'+encodeURIComponent(sb.slug||'sahten');
  const response=await fetchResponse(endpoint,{headers:{apikey:sb.anonKey,Authorization:'Bearer '+sb.anonKey,Accept:'application/json'}});
  const rows=await response.json();
  const first=rows?.[0];const row=Array.isArray(first?.menus)?first.menus[0]:first?.menus;
  if(!first?.id||!row?.json?.products)throw new Error('Live catalog unavailable: refusing stale deploy');
  return row.json;
}
async function main(){
  const oldAssets=new Map();
  // Download all original assets FIRST; fail before touching any production resource.
  for(const rel of PUBLISHED_FILES)oldAssets.set(rel,await download(rel));
  const base=JSON.parse(oldAssets.get('/menu.json').toString('utf8'));
  const live=await latestMenu(base);
  const vite=await createServer({server:{middlewareMode:true},appType:'custom',logLevel:'error'});
  let built;
  try{
    const [{buildIndexHtml},{publishedMenuWithLiveCatalog}]=await Promise.all([
      vite.ssrLoadModule('/src/online/publish.js'),vite.ssrLoadModule('/src/online/storefront.js')
    ]);
    const menu=publishedMenuWithLiveCatalog(base,live);
    menu.supabase={...base.supabase,storeId:base.supabase.storeId};
    menu.promotions={enabled:false};
    // Rutas locales que no existen en el paquete original nunca inventan fotos.
    for(const p of menu.products){
      const existed=base.products.some(b=>b.id===p.id && b.image===p.image);
      if(p.image && !/^https:\/\//.test(p.image) && !existed)p.image=null;
    }
    check(menu,base);
    if(menu.cartRecommendations?.enabled===true && (!Array.isArray(menu.cartRecommendations.complements)
      || !Array.isArray(menu.cartRecommendations.beverageContexts)))
      throw new Error('Recommendation policy malformed');
    const landing=buildIndexHtml(menu);
    const storefront=buildIndexHtml(menu,{storefront:true});
    if(!landing.includes('function serviceAvailable(')||
       !landing.includes('is-unavailable')||
       !storefront.includes('function syncServiceChoice('))
      throw new Error('Checkout availability fix is missing from output');
    if(!landing.includes('/*__MENU_JSON__*/')||!storefront.includes('/*__MENU_JSON__*/'))
      throw new Error('Menu fallback marker missing');
    if(landing.includes('/*__SHARED__*/')||storefront.includes('/*__SHARED__*/'))
      throw new Error('Unexpanded shared script placeholder');
    if(menu.promotions?.enabled)throw new Error('Promotions active');
    built={landing,storefront,menu};
  }finally{await vite.close();}
  await fs.rm(output,{recursive:true,force:true});
  for(const [rel,buf] of oldAssets){
    const target=path.join(output,rel.replace(/^\//,''));
    await fs.mkdir(path.dirname(target),{recursive:true});
    await fs.writeFile(target,buf);
  }
  await fs.writeFile(path.join(output,'index.html'),built.landing);
  await fs.writeFile(path.join(output,'pedir/index.html'),built.storefront);
  await fs.writeFile(path.join(output,'menu.json'),JSON.stringify(built.menu,null,1));
  const report={
    status:'ready-for-pages',
    inheritedDeployment:'84a00719-0196-48ab-b31f-b321b979398e',
    immutableFilesPreserved:PUBLISHED_FILES.filter(x=>!['/index.html','/pedir/index.html','/menu.json'].includes(x)),
    generated:['/index.html','/pedir/index.html','/menu.json'],
    products:built.menu.products.length,
    beverages:built.menu.products.filter(p=>p.category==='Bebidas').length,
    promotionsEnabled:built.menu.promotions.enabled,
    originalBrandingPreserved:true,
    checkoutAvailabilityFix:true
  };
  await fs.writeFile(path.join(output,'_deployment-report.json'),JSON.stringify(report,null,2));
  console.log(JSON.stringify(report,null,2));
}
main().catch(e=>{console.error(e.stack||String(e));process.exitCode=1;});
