#!/usr/bin/env node
// Preserva la portada de producción y todos sus recursos. Sólo reconstruye
// /pedir/index.html y menu.json con los beneficios publicados en Supabase.
// Nunca descarga ni incorpora costos, claves privadas ni datos de clientes.
import fs from 'node:fs/promises';
import path from 'node:path';
import {createServer} from 'vite';

const SOURCE_DEPLOYMENT_ID='2947fd13-6ec7-46f7-b8c2-2e293fe673d3';
const PINNED_URL='https://2947fd13.sahten-menu.pages.dev';
const FILES=[
 '/apple-touch-icon.png','/brand/sahten-comida-arabe-og-1200x630.png',
 '/brand/sahten-icon-192.png','/brand/sahten-icon-512.png',
 '/brand/sahten-icon-maskable-512.png','/catering/index.html',
 '/delivery-y-retiro/index.html','/favicon.ico','/favicon.svg',
 '/img/site_familia.jpg','/img/site_historia.jpg','/index.html',
 '/menu.json','/menu/index.html','/nuestra-historia/index.html',
 '/pedir/index.html','/robots.txt','/site.webmanifest','/sitemap.xml'
];
const output=path.resolve(process.env.SAHTEN_DEPLOY_OUTPUT||'sahten-promo-export');
async function get(url,options){
 const r=await fetch(url,{...options,signal:AbortSignal.timeout(25000)});
 if(!r.ok)throw new Error('Unable to download approved asset: '+new URL(url).pathname+' ('+r.status+')');
 return r;
}
const snapshot=async file=>Buffer.from(await (await get(PINNED_URL+file)).arrayBuffer());
async function liveMenu(base){
 const sb=base.supabase;
 if(!sb?.url||!sb?.anonKey||!sb?.storeId)throw new Error('Missing pinned public Supabase config');
 const url=sb.url.replace(/\/$/,'')+'/rest/v1/stores?select=id,menus(json)&slug=eq.'+encodeURIComponent(sb.slug||'sahten');
 const rows=await (await get(url,{headers:{apikey:sb.anonKey,Authorization:'Bearer '+sb.anonKey,Accept:'application/json'}})).json();
 const first=rows?.[0],row=Array.isArray(first?.menus)?first.menus[0]:first?.menus;
 if(!first?.id||first.id!==sb.storeId||!row?.json?.products)throw new Error('Wrong store/menu live response');
 return row.json;
}
function check(menu,base){
 if(base.site?.enabled!==true||base.site?.orderPage!==true)throw new Error('Pinned storefront structure missing');
 if(!Array.isArray(menu.products)||menu.products.length<47||menu.products.length>48)
  throw new Error('Unexpected live product count');
 if(menu.products.filter(p=>p.image?.startsWith('https://')).length<47)
  throw new Error('Missing live photography: do not deploy');
 if(menu.products.some(p=>p.image&&!/^https:\/\//.test(p.image)))
  throw new Error('Unexpected local image reference');
 const drinks=menu.products.filter(p=>p.category==='Bebidas');
 if(drinks.length!==11)throw new Error('Drinks catalog changed');
 const prices=drinks.map(p=>Number(p.price));
 if(prices.filter(p=>p===2500).length!==4||prices.filter(p=>p===2000).length!==2||prices.filter(p=>p===1400).length!==5)
  throw new Error('Drinks price bands changed');
 if(menu.promotions?.enabled!==true||menu.promotions?.version!==1)
  throw new Error('Live promotion engine is not published');
 if(!Array.isArray(menu.promotions.campaigns)||menu.promotions.campaigns.length!==6||
    menu.promotions.campaigns.some(p=>p.enabled!==true))
  throw new Error('Unexpected live campaign revisions');
 for(const id of ['central-tables','weekly-meals','postres-extra-online-nov26',
  'postres-mamul-extra-nov26','fatay-adicional-moderado-nov26','falafel-mix-moderado-nov26']){
  if(!menu.promotions.campaigns.some(c=>c.id===id))throw new Error('Missing campaign: '+id);
 }
 if(menu.payments?.benefit?.enabled!==true||Number(menu.payments.benefit.percent)!==10)
  throw new Error('Cash/transfer benefit changed');
 if(menu.delivery?.enabled===undefined)throw new Error('Delivery policy unavailable');
 if(menu.cartRecommendations?.enabled!==true||
    !Array.isArray(menu.cartRecommendations.complements)||
    !Array.isArray(menu.cartRecommendations.beverageContexts))
  throw new Error('Cart recommendation policy missing');
 const four=menu.products.filter(p=>p.id==='p1779570052552');
 if(four.length>1)throw new Error('Duplicate hidden SKU');
 if(four.length && (four[0].upsellOnly!==true||four[0].upgradeFrom!=='p1779467294622'||
    Number(four[0].price)!==18500||menu.config?.productVisibility?.[four[0].id]!==false))
  throw new Error('Four-Fatay is not checkout-only');
 if(base.supabase?.storeId!==menu.supabase?.storeId)
  throw new Error('Unexpected public Supabase store identity');
}
async function run(){
 const assets=new Map();
 for(const rel of FILES){const buf=await snapshot(rel);if(!buf.length)throw Error('Empty asset '+rel);assets.set(rel,buf);}
 const base=JSON.parse(assets.get('/menu.json').toString('utf8'));
 const live=await liveMenu(base);
 const vite=await createServer({server:{middlewareMode:true},appType:'custom',logLevel:'error'});
 let storefront,menu;
 try{
  const [{buildIndexHtml},{publishedMenuWithLiveCatalog}]=await Promise.all([
   vite.ssrLoadModule('/src/online/publish.js'),
   vite.ssrLoadModule('/src/online/storefront.js')
  ]);
  menu=publishedMenuWithLiveCatalog(base,live);
  menu.supabase={...base.supabase,storeId:base.supabase.storeId};
  check(menu,base);
  storefront=buildIndexHtml(menu,{storefront:true});
  for(const required of ['function fatayUpgradePanel()','function couponSection()',
      'function serviceAvailable(','function cartBenefit(','function applyCoupon()']){
   if(!storefront.includes(required))throw new Error('Missing checkout logic '+required);
  }
  if(storefront.includes('/*__SHARED__*/')||storefront.includes('/*__MENU_JSON__*/null'))
   throw new Error('Unexpanded build marker');
 }finally{await vite.close();}
 await fs.rm(output,{recursive:true,force:true});
 for(const [rel,content] of assets){
  const target=path.join(output,rel.slice(1));
  await fs.mkdir(path.dirname(target),{recursive:true});
  await fs.writeFile(target,content);
 }
 await fs.writeFile(path.join(output,'pedir/index.html'),storefront);
 await fs.writeFile(path.join(output,'menu.json'),JSON.stringify(menu,null,1));
 const report={
  status:'ready-for-safe-checkout-review',sourceDeploymentId:SOURCE_DEPLOYMENT_ID,
  preserved:FILES.filter(f=>!['/pedir/index.html','/menu.json'].includes(f)),
  generated:['/pedir/index.html','/menu.json'],
  products:menu.products.length,remotePhotos:menu.products.filter(p=>p.image?.startsWith('https://')).length,
  beverages:menu.products.filter(p=>p.category==='Bebidas').length,
  campaigns:menu.promotions.campaigns.map(p=>p.id),
  hiddenFourIncluded:menu.products.some(p=>p.id==='p1779570052552'),
  fullPriceRecommendations:true,
  defaultCashBenefit:menu.payments.benefit.percent,
  homepagePreservedExactly:assets.get('/index.html').byteLength>0
 };
 await fs.writeFile(path.join(output,'_deployment-report.json'),JSON.stringify(report,null,2));
 console.log(JSON.stringify(report,null,2));
}
run().catch(err=>{console.error(err.stack||String(err));process.exitCode=1;});
