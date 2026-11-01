// QA visual real: renderiza la app Vite con el proyecto de demo y datos 100% ficticios.
// No hace llamadas a Supabase ni a sahten.online. Requiere Playwright + Chromium.
import fs from 'node:fs/promises';
import path from 'node:path';
import { chromium } from 'playwright';
const origin=process.env.SAHTEN_QA_URL||'http://127.0.0.1:4173';
const out='qa/rentabilidad';
await fs.mkdir(out,{recursive:true});
const demo=await fs.readFile('src/project/demo.sahten.json','utf8');
const browser=await chromium.launch({headless:true});
const errors=[];
const page=await browser.newPage({viewport:{width:1440,height:900},deviceScaleFactor:1});
page.on('pageerror',err=>errors.push(String(err)));
await page.goto(origin,{waitUntil:'domcontentloaded'});
await page.waitForFunction(()=>window.SAHTEN_READY===true,{timeout:60000});
await page.evaluate(async (raw)=>{
  window.document.getElementById('proj-welcome')?.remove();
  await window.SAHTEN.project.session.openText(raw,null,'SAHTEN · Datos ilustrativos.sahten');
  const w=window;
  const date=new Date();
  const month=new Intl.DateTimeFormat('en-CA',{timeZone:'America/Argentina/Buenos_Aires',year:'numeric',month:'2-digit'}).format(date).replace(/\//g,'-');
  w.SAHTEN_PROJECT.localProfitGoals={...(w.SAHTEN_PROJECT.localProfitGoals||{}),[month]:120000};
  const sample=[
    {id:'qa-rent-1',origin:'mostrador',status:'retirado',createdAt:date.toISOString()},
    {id:'qa-rent-2',origin:'menu-online',status:'entregado',createdAt:date.toISOString()}
  ];
  w.SAHTEN_ORDERS.push(...sample);
  w.SAHTEN_SALE_COSTS['qa-rent-1']={basis:'at-sale',channel:'mostrador',
    items:[{productId:w.PRODUCTS[0]?.id||'demo1',qty:4,revenue:72000,variable:17000,fixed:9000,commission:0}]};
  w.SAHTEN_SALE_COSTS['qa-rent-2']={basis:'published-quote',channel:'mostrador',
    items:[{productId:w.PRODUCTS[1]?.id||'demo2',qty:3,revenue:50000,variable:15500,fixed:7800,commission:1250}]};
  w.showPanel('rentabilidad');
  w.SAHTEN.localProfit.renderModule();
},demo);
await page.waitForSelector('#panel-rentabilidad.active #rentabilidad-goal-card .local-profit-progress',{timeout:30000});
const stamp=await page.evaluate(()=>{
  const el=document.createElement('div');
  el.textContent='CAPTURA REAL DE LA APP · DATOS FICTICIOS DE PRUEBA';
  Object.assign(el.style,{position:'fixed',right:'16px',bottom:'12px',background:'#f8e9b0',color:'#2d2d2d',
    padding:'7px 12px',fontSize:'11px',fontWeight:'800',borderRadius:'8px',zIndex:'999999',
    boxShadow:'0 2px 12px #0002'});
  document.body.appendChild(el);return el.textContent;
});
await page.screenshot({path:path.join(out,'01-escritorio-resumen.png'),fullPage:true});
await page.locator('[data-local-tab="metas"]').click();
await page.waitForSelector('#rentabilidad-goals-card .local-month-history');
await page.locator('#rentabilidad-goals-card .local-month-history > summary').click();
await page.screenshot({path:path.join(out,'02-escritorio-historial.png'),fullPage:true});
await page.locator('[data-local-tab="productos"]').click();
await page.screenshot({path:path.join(out,'03-escritorio-productos.png'),fullPage:true});
await page.setViewportSize({width:390,height:844});
await page.locator('[data-local-tab="resumen"]').click();
await page.screenshot({path:path.join(out,'04-movil-resumen.png'),fullPage:true});
const summary=await page.evaluate(()=>({
 appVersion:window.SAHTEN_VERSION,
 activePanel:window.currentPanel,
 tabs:[...document.querySelectorAll('#panel-rentabilidad [data-local-tab]')].map(e=>e.dataset.localTab),
 profitText:document.querySelector('#rentabilidad-goal-card .local-profit-numbers')?.innerText,
 marker:document.body.innerText.includes('DATOS FICTICIOS DE PRUEBA')
}));
await fs.writeFile(path.join(out,'qa-summary.json'),JSON.stringify({summary,errors,stamp},null,2));
await browser.close();
if(errors.length) throw new Error('Browser errors: '+errors.slice(0,5).join('; '));
console.log('Capturas reales generadas:',summary);
