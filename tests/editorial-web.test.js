import {it,expect} from 'vitest';
import {JSDOM} from 'jsdom';
import fs from 'node:fs/promises';
import {accurateEditorialMenu,buildEditorialHome} from '../scripts/deploy/editorial-home.mjs';
import {editorialBenefitEnabled,editorialCampaignMarkup} from '../src/online/editorial-state.js';
const menu=()=>({store:{name:'Sahten',whatsapp:'5491123937295'},config:{enabled:true},products:[{id:'fatay',name:'Fatay',category:'Entradas',price:5850,image:'https://example.com/fatay.jpg'},{id:'hidden',upsellOnly:true,name:'Interno',category:'Entradas',image:'https://example.com/hidden.jpg'}],payments:{bank:{cbu:'do-not-embed-bank'},methods:{efectivo:true,transferencia:true},benefit:{enabled:true,percent:10,channels:{online:true}}},promotions:{enabled:true,campaigns:[{id:'week',kind:'public',enabled:true,name:'Platos seleccionados',channels:['online'],schedule:{type:'weekly',weekdays:[3]},productIds:['fatay'],advertising:{enabled:true,placement:['menu'],message:'Hasta 15% con efectivo o transferencia'}}]},site:{seo:{title:'Sahten'},historia:{text:'Recetas de nuestra familia.',imageAlt:'Familia',familyAlt:'Sitto',imageCaption:'Familia',familyCaption:'Sitto'},images:{hero:'https://example.com/hero.jpg',historia:'img/site_historia.jpg',familia:'img/site_familia.jpg'},resenas:{reviewUrl:'https://search.google.com/local/writereview?placeid=TEST',items:[{text:'Muy rico',author:'Cliente',source:'Google'}]},contacto:{creditText:'Diseñado por Noamdan'},faq:{items:[{q:'¿Cuál es el pedido mínimo para delivery?',a:'Antes $100'},{q:'¿El envío tiene costo?',a:'Antes gratis'},{q:'¿Qué es el fatay?',a:'Una empanada triangular.'}]}}});
it('muestra el beneficio solo cuando está comercialmente habilitado, con medio de pago y canal válidos',()=>{
 const m=menu();expect(editorialBenefitEnabled(m)).toBe(true);
 for(const change of [x=>x.payments.benefit.enabled=false,x=>x.payments.benefit.percent=15,x=>x.payments.benefit.channels.online=false,x=>x.payments.methods={},x=>x.config.enabled=false]){const m=menu();change(m);expect(editorialBenefitEnabled(m)).toBe(false);}
});
it('los anuncios respetan calendario de Argentina, pausas, stock y canal',()=>{
 const m=menu(),wed=new Date('2026-11-04T21:00:00Z');
 expect(editorialCampaignMarkup(m,wed)).toContain('Hasta 15%');
 expect(editorialCampaignMarkup(m,new Date('2026-11-05T21:00:00Z'))).toBe('');
 m.promotions.campaigns[0].enabled=false;expect(editorialCampaignMarkup(m,wed)).toBe('');
 m.promotions.campaigns[0].enabled=true;m.products[0].salesAvailability={paused:true};expect(editorialCampaignMarkup(m,wed)).toBe('');
});
it('publica la home elegida con videos reales, FAQs completas y enlaces reales, sin copiar pedidos ni datos bancarios',async()=>{
 const source=menu(),m=accurateEditorialMenu(source),html=await buildEditorialHome(m,{seoHead:'<link rel="canonical" href="https://sahten.online/">',openingHours:'Lun: 12:00 a 15:30',now:new Date('2026-11-04T21:00:00Z')}),dom=new JSDOM(html),d=dom.window.document;
 expect(d.querySelectorAll('video')).toHaveLength(4);
 expect([...d.querySelectorAll('video')].every(v=>v.hasAttribute('controls')&&v.preload==='none'&&!v.autoplay)).toBe(true);
 expect(d.querySelectorAll('.faq details')).toHaveLength(3);
 expect(d.querySelector('.faq').textContent).not.toContain('Antes $100');
 expect(d.querySelector('.faq').textContent).toContain('Una empanada triangular');
 expect(d.querySelector('.categories').textContent).not.toContain('Interno');
 expect(d.querySelectorAll('.benefit-photos img')).toHaveLength(2);
 expect(d.querySelector('.catering-photo').src).toContain('catering-mesa.webp');
 expect(d.querySelector('.story').textContent).toContain('Recetas de nuestra familia');
 expect(d.querySelector('.review-call a').href).toContain('writereview');
 for(const id of ['s-about','s-how','s-reviews','s-catering','s-faq','s-contact'])expect(d.getElementById(id)).not.toBeNull();
 expect(html).not.toContain('do-not-embed-bank');expect(html).not.toContain('noindex');expect(html).not.toContain('carta-combinada.html');expect(html).not.toContain('Vista conceptual');
 expect(source.site.faq.items[0].a).toBe('Antes $100');
 expect(d.querySelector('[data-service-hours="opening"]').textContent).toContain('12:00');
 dom.window.close();
});
it('la carta toma el beneficio confirmado por su motor y no necesita exponer el carrito',async()=>{
 const code=await fs.readFile('media/sahten-editorial/checkout-runtime.js','utf8');
 const dom=new JSDOM('<div id="s-nav"><nav id="snav"><a class="nav-brand">Marca</a></nav></div><div id="catalog-benefit"><div class="catalog-benefit" data-benefit-percent="10">Beneficio</div></div>',{runScripts:'dangerously'});
 dom.window.eval(code);await new Promise(r=>setTimeout(r,0));
 expect(dom.window.MENU).toBeUndefined();
 expect(dom.window.document.querySelector('.checkout-benefit-image')).not.toBeNull();
 dom.window.document.getElementById('catalog-benefit').innerHTML='<div class="catalog-benefit" data-benefit-percent="15">Otro beneficio</div>';
 await new Promise(r=>setTimeout(r,0));
 expect(dom.window.document.querySelector('.checkout-benefit-image')).toBeNull();
 dom.window.close();
});
