#!/usr/bin/env node
// Preserva la portada de producción y todos sus recursos. Sólo reconstruye
// /pedir/index.html y menu.json con los beneficios publicados en Supabase.
// Nunca descarga ni incorpora costos, claves privadas ni datos de clientes.
import fs from 'node:fs/promises';
import path from 'node:path';
import {createServer} from 'vite';
import {INDEXNOW_KEY} from './indexnow.mjs';
import {assertCatalogPreserved,catalogFingerprint} from './catalog-integrity.mjs';
import {buildEditorialHome,accurateEditorialMenu,editorialAssetVersion,editorialSitemap} from './editorial-home.mjs';
import {localDateParts,scheduleMatches,activeCampaigns} from '../../src/core/promotions.js';
import {salesPaused} from '../../src/core/sales-availability.js';
import {editorialBenefitEnabled,editorialCampaignMarkup,editorialLoyaltyMarkup} from '../../src/online/editorial-state.js';

const SOURCE_DEPLOYMENT_ID='d8187a55-c873-4c4b-b52e-de23aa7f924d';
const PINNED_URL='https://d8187a55.sahten-menu.pages.dev';
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
function check(menu,base,live){
 if(base.site?.enabled!==true||base.site?.orderPage!==true)throw new Error('Pinned storefront structure missing');
 assertCatalogPreserved(menu,live);
 if(base.supabase?.storeId!==menu.supabase?.storeId)throw new Error('Unexpected public Supabase store identity');
 if(menu.products.some(p=>p.image&&!/^https:\/\//.test(p.image)))throw new Error('Unexpected local image reference');
 if(!menu.payments?.methods||menu.delivery?.enabled===undefined)throw new Error('Missing live checkout configuration');
}
async function run(){
 const assets=new Map();
 for(const rel of FILES){const buf=await snapshot(rel);if(!buf.length)throw Error('Empty asset '+rel);assets.set(rel,buf);}
 const base=JSON.parse(assets.get('/menu.json').toString('utf8'));
 const live=await liveMenu(base);
 const vite=await createServer({server:{middlewareMode:true},appType:'custom',logLevel:'error'});
 let storefront,menu,homepage,menuPage,descriptions;
 try{
  const [{buildIndexHtml},{publishedMenuWithLiveCatalog},seo,{serviceHoursPageScript},{buildSitePages}]=await Promise.all([
   vite.ssrLoadModule('/src/online/publish.js'),
   vite.ssrLoadModule('/src/online/storefront.js'),
   vite.ssrLoadModule('/src/online/seo.js'),vite.ssrLoadModule('/src/online/serviceHoursPage.js'),vite.ssrLoadModule('/src/online/pages.js')
  ]);
  menu=accurateEditorialMenu(publishedMenuWithLiveCatalog(base,live));
  menu.supabase={...base.supabase,storeId:base.supabase.storeId};
  check(menu,base,live);
  storefront=buildIndexHtml(menu,{storefront:true}).replace('</head>','<link rel="stylesheet" href="editorial/checkout.css?v='+encodeURIComponent(editorialAssetVersion)+'"></head>').replace('</body>','<script defer src="editorial/checkout-runtime.js?v='+encodeURIComponent(editorialAssetVersion)+'"></script></body>');
  menuPage=buildSitePages(menu).find(p=>p.path==='menu/index.html')?.data;
  if(!menuPage)throw Error('Missing indexable menu');
  descriptions=menu.products.filter(p=>seo.publicProductDescription(menu,p)).length;
  if(descriptions!==menu.products.length)throw Error('A published product has no description');
  homepage=await buildEditorialHome(menu,{seoHead:seo.renderSeoHead(menu),hoursScript:serviceHoursPageScript(menu),openingHours:seo.seoServiceHoursText(menu,'opening')});
  for(const required of ['function fatayUpgradePanel()','function couponSection()',
      'function serviceAvailable(','function cartBenefit(','function applyCoupon()',
      'createStorefrontUpsells','data-upsell-consult','upsell-offer']){
   if(!storefront.includes(required))throw new Error('Missing checkout logic '+required);
  }
  if(storefront.includes('/*__SHARED__*/')||storefront.includes('/*__MENU_JSON__*/null'))
   throw new Error('Unexpanded build marker');
 }finally{await vite.close();}
 // Una edición del catálogo durante el armado exige generar otra vez el paquete.
 if(catalogFingerprint(await liveMenu(base))!==catalogFingerprint(live))throw new Error('Live catalog changed during packaging; retry with the new revision');
 await fs.rm(output,{recursive:true,force:true});
 for(const [rel,content] of assets){
  const target=path.join(output,rel.slice(1));
  await fs.mkdir(path.dirname(target),{recursive:true});
  await fs.writeFile(target,content);
 }
 // La portada aprobada reemplaza la maqueta y usa solo el catálogo vigente.
 await fs.cp('media/sahten-editorial',path.join(output,'editorial'),{recursive:true});
 await fs.rm(path.join(output,'editorial','home-approved.html'));
 await fs.rm(path.join(output,'editorial','home-runtime.js'));
 const state=await fs.readFile('src/online/editorial-state.js','utf8');
 const runtime=await fs.readFile('media/sahten-editorial/home-runtime.js','utf8');
 const helpers="const PROMOTIONS_TZ='America/Argentina/Buenos_Aires';\n"+[localDateParts,scheduleMatches,activeCampaigns,salesPaused].map(f=>f.toString()).join('\n');
 await fs.writeFile(path.join(output,'editorial','home.js'),helpers+'\n'+state.replace(/^import[^\n]*\n/gm,'').replace(/^export\s+/gm,'')+'\n'+runtime);
 await fs.writeFile(path.join(output,INDEXNOW_KEY+'.txt'),INDEXNOW_KEY);
 await fs.writeFile(path.join(output,'index.html'),homepage);
 await fs.writeFile(path.join(output,'sitemap.xml'),editorialSitemap(assets.get('/sitemap.xml').toString('utf8'),menu.site.seo.url));
 await fs.writeFile(path.join(output,'pedir/index.html'),storefront);
 await fs.writeFile(path.join(output,'menu/index.html'),menuPage);
 await fs.writeFile(path.join(output,'menu.json'),JSON.stringify(menu,null,1));
 const report={
  status:'ready-for-safe-checkout-review',sourceDeploymentId:SOURCE_DEPLOYMENT_ID,
  preserved:FILES.filter(f=>!['/index.html','/pedir/index.html','/menu.json','/menu/index.html','/sitemap.xml'].includes(f)),
  generated:['/index.html','/pedir/index.html','/menu.json','/menu/index.html','/sitemap.xml'],descriptions,
  products:menu.products.length,remotePhotos:menu.products.filter(p=>p.image?.startsWith('https://')).length,
  beverages:menu.products.filter(p=>p.category==='Bebidas').length,
  campaigns:(menu.promotions?.campaigns||[]).map(p=>({id:p.id,enabled:p.enabled===true})),
  commercialFingerprint:catalogFingerprint(menu),sourceCatalogFingerprint:catalogFingerprint(live),
  catalogPreserved:true,reviewedUpsellClient:true,
  hiddenFourIncluded:menu.products.some(p=>p.id==='p1779570052552'),
  fullPriceRecommendations:menu.cartRecommendations?.enabled===true,
  defaultCashBenefit:menu.payments.benefit.percent,
  homepageLayoutPreserved:false,approvedEditorialDesign:true,
  homepageCatalogGuarded:true,editorialAssets:'editorial/',videos:4
 };
 await fs.writeFile(path.join(output,'_deployment-report.json'),JSON.stringify(report,null,2));
 console.log(JSON.stringify(report,null,2));
}
run().catch(err=>{console.error(err.stack||String(err));process.exitCode=1;});
