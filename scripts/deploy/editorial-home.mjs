import fs from 'node:fs/promises';
import {JSDOM} from 'jsdom';

const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export function accurateEditorialMenu(source){
 const menu=structuredClone(source);
 const faq=menu.site?.faq?.items||[];
 for(const item of faq){
  if(/zonas.*delivery/i.test(item.q))item.a='Validá tu dirección en la tienda para consultar la cobertura disponible. La entrega depende del recorrido y del horario vigente.';
  if(/mínimo.*delivery/i.test(item.q))item.a='El mínimo y el costo de envío dependen de tu dirección y del recorrido. La tienda calcula ambos antes de confirmar el pedido.';
  if(/envío.*costo/i.test(item.q))item.a='La tienda muestra el importe y los beneficios de envío disponibles al validar tu dirección. El envío no participa del descuento por medio de pago.';
 }
 return menu;
}
export async function buildEditorialHome(menu,{seoHead,hoursScript,openingHours='',now=new Date()}={}){
 const prototype=await fs.readFile('media/sahten-editorial/home-approved.html','utf8');
 const dom=new JSDOM(prototype),d=dom.window.document;
 const S=menu.site,asset='editorial/',products=menu.products||[];
 const byId=id=>products.find(p=>p.id===id&&!p.retired&&!p.upsellOnly);
 d.head.innerHTML='<meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>'+esc(S.seo?.title||menu.store.name)+'</title>'+seoHead+'<link rel="stylesheet" href="editorial/design.css"><link rel="stylesheet" href="editorial/production.css"><link rel="stylesheet" href="editorial/maplibre-gl.css">';
 d.body.dataset.editorial='sahten-c-3';
 d.querySelectorAll('script').forEach(x=>x.remove());
 d.querySelectorAll('a').forEach(a=>{
  const href=a.getAttribute('href')||'';
  if(href.includes('carta-combinada.html')){
   const category=new URL(href,'https://preview.invalid/').searchParams.get('categoria');
   a.href='pedir/'+(category?'#pedido/'+encodeURIComponent(category):'');
  }
  if(href.includes('tipografia/'))a.href='./';
 });
 d.querySelectorAll('.brand img,.footer-brand img').forEach(img=>{img.src=asset+'logo-verde-crema-naranja.svg';img.alt='SAHTEN Gastronomía Árabe';});
 d.querySelector('.arabic').src=asset+'caligrafia.svg';
 const hero=byId('tabla_celebrar')||products.find(p=>p.image&&!p.retired&&!p.upsellOnly);
 const heroImg=d.querySelector('.hero-image>img');heroImg.src=hero?.image||S.images.hero;heroImg.alt=hero?.name||'Platos de Sahten';heroImg.setAttribute('fetchpriority','high');
 const banner=d.querySelector('.combo-beneficio');banner.dataset.paymentBenefit='';
 banner.querySelector('.combo-foto').innerHTML='<div class="benefit-photos"><img src="editorial/banner-tortas.webp" alt="Dulces en una mesa de Sahten" width="810" height="1080" loading="lazy"><img src="editorial/banner-plato.webp" alt="Platos de Sahten para compartir" width="849" height="1080" loading="lazy" hidden></div><button type="button" class="photo-rotation" aria-pressed="false">Pausar fotos</button>';
 const benefit=menu.payments?.benefit;
 banner.hidden=!(benefit?.enabled&&Number(benefit.percent)===10&&benefit.channels?.online!==false&&(menu.payments.methods?.efectivo||menu.payments.methods?.transferencia));
 const menuSection=d.querySelector('#menu');
 menuSection.querySelector('.categories').innerHTML='<a href="pedir/">Todos</a>'+[...new Set(products.filter(p=>!p.upsellOnly&&!p.retired).map(p=>p.category).filter(Boolean))].map(c=>'<a href="pedir/#pedido/'+encodeURIComponent(c)+'">'+esc(c)+'</a>').join('');
 const picks=['shawarma_carne','hummus','fatay'].map(byId).filter(Boolean);
 menuSection.querySelector('.food-grid').innerHTML=picks.map(p=>'<a class="food-card" data-home-product="'+esc(p.id)+'" href="pedir/#pedido/'+encodeURIComponent(p.category||'')+'"><div class="food-image"><img src="'+esc(p.image)+'" width="800" height="600" loading="lazy" alt="'+esc(p.name)+'"></div><div class="food-meta"><div><small>'+esc(p.category)+'</small><h3>'+esc(p.name)+'</h3></div><span aria-hidden="true">↗</span></div></a>').join('');
 const story=d.querySelector('.story-copy');story.querySelectorAll('p:not(.eyebrow)').forEach(p=>p.remove());
 const link=story.querySelector('a');link.href='nuestra-historia/';
 for(const para of String(S.historia?.text||'').split(/\n\s*\n/)){const p=d.createElement('p');p.textContent=para;story.insertBefore(p,link);}
 const group=d.querySelector('.group img'),sitto=d.querySelector('.sitto img');group.src=S.images.historia;sitto.src=S.images.familia;
 group.alt=S.historia.imageAlt;sitto.alt=S.historia.familyAlt;
 d.querySelector('.group figcaption').textContent=S.historia.imageCaption;
 d.querySelector('.sitto figcaption').textContent=S.historia.familyCaption;
 const videos=[['celebrar','Tabla para Celebrar','tabla_celebrar'],['compartir','Tabla para Compartir',null],['supermix','Shawarma Supermix','p1779299917243'],['tutorial','Cómo comprar en Sahten',null]];
 const posters=[...d.querySelectorAll('.reel-poster'),d.querySelector('.tutorial-poster')];
 videos.forEach(([id,name,product],i)=>{
  const host=posters[i];host.innerHTML='<video controls playsinline preload="none" poster="editorial/'+id+'.jpg" aria-label="'+esc(name)+'" width="540" height="960"><source src="editorial/'+id+'.mp4" type="video/mp4">Tu navegador no puede reproducir el video. <a href="editorial/'+id+'.mp4">Abrir video</a></video>';
  if(i<3){const a=host.closest('article').querySelector('.text-link');a.href='pedir/#pedido/'+encodeURIComponent(i===2?'Sandwich':'Picadas');}
 });
 d.querySelector('.vida-mini-photo img').src=hero?.image||S.images.hero;
 d.querySelector('.vida-catering').insertAdjacentHTML('afterbegin','<img class="catering-photo" src="editorial/catering-mesa.webp" width="815" height="1080" loading="lazy" alt="Mesa de Sahten para compartir en un evento">');
 d.querySelector('.vida-catering>a').href='https://wa.me/'+String(menu.store.whatsapp).replace(/\D/g,'')+'?text='+encodeURIComponent('Hola, quiero consultar por catering');
 const reviews=d.querySelector('.reviews');
 const quote=reviews.querySelector('blockquote');quote.innerHTML=(S.resenas.items||[]).map(r=>'<div class="review-quote">“'+esc(r.text)+'”<cite>'+esc(r.author)+' · '+esc(r.source)+'</cite></div>').join('');
 const reviewLink=reviews.querySelector('.review-call a');reviewLink.href=S.resenas.reviewUrl;reviewLink.target='_blank';reviewLink.rel='noopener noreferrer';
 d.querySelector('.faq>div').innerHTML=S.faq.items.map(f=>'<details><summary>'+esc(f.q)+' <span aria-hidden="true">+</span></summary><p>'+esc(f.a)+'</p></details>').join('');
 const footerContact=d.querySelector('.footer-contact');
 footerContact.insertAdjacentHTML('beforeend','<details class="opening-hours"><summary>Horarios de apertura y retiro</summary><p data-service-hours="opening" style="white-space:pre-line"></p></details><a href="delivery-y-retiro/">Horarios de delivery y cobertura ↗</a>');
 d.querySelector('.credit').innerHTML=esc(S.contacto.creditText)+' <a href="https://noamdan.com/" target="_blank" rel="noopener">noamdan.com ↗</a>';
 for(const [selector,id] of [['#inicio','s-hero'],['#menu','s-menuhd'],['#historia','s-about'],['#ayuda','s-how'],['.reviews','s-reviews'],['.vida-catering','s-catering'],['#local','s-delivery'],['.faq','s-faq'],['#contacto','s-contact']]){
  const target=d.querySelector(selector);target.insertAdjacentHTML('beforebegin','<span class="anchor-alias" id="'+id+'" aria-hidden="true"></span>');
 }
 const localHours=d.createElement('details');localHours.className='local-opening';localHours.innerHTML='<summary>Horarios de apertura y retiro</summary><p data-service-hours="opening" style="white-space:pre-line"></p><p><a href="delivery-y-retiro/">Consultar delivery y condiciones vigentes ↗</a></p>';
 d.querySelector('.vida-copy').appendChild(localHours);
 d.querySelectorAll('[data-service-hours="opening"]').forEach(el=>el.textContent=openingHours);
 d.querySelectorAll('img:not(.hero-image>img)').forEach(img=>img.loading='lazy');
 const campaign=d.createElement('section');campaign.id='live-public-promos';campaign.className='public-promos';campaign.setAttribute('aria-label','Promociones vigentes');banner.after(campaign);
 const clientData={supabase:menu.supabase,config:menu.config,promotions:menu.promotions,payments:{methods:menu.payments?.methods,benefit:menu.payments?.benefit},products:products.map(({id,name,image,category,retired,upsellOnly,salesAvailability})=>({id,name,image,category,retired,upsellOnly,salesAvailability}))};
 const script=d.createElement('script');script.type='application/json';script.id='editorial-menu';script.textContent=JSON.stringify(clientData).replace(/</g,'\\u003c');d.body.appendChild(script);
 const enhancement=d.createElement('script');enhancement.src='editorial/home.js';enhancement.defer=true;d.body.appendChild(enhancement);
 d.body.insertAdjacentHTML('beforeend',hoursScript||'');
 for(const video of videos){
  const [id,name]=video,ld=d.createElement('script');ld.type='application/ld+json';ld.textContent=JSON.stringify({'@context':'https://schema.org','@type':'VideoObject',name,description:id==='tutorial'?'Cómo elegir productos, revisar el pedido y continuar con entrega y pago en Sahten.':'Un vistazo a '+name+' en la cocina de Sahten.',thumbnailUrl:['https://sahten.online/editorial/'+id+'.jpg'],contentUrl:'https://sahten.online/editorial/'+id+'.mp4',uploadDate:now.toISOString()});d.head.appendChild(ld);
 }
 const result=dom.serialize();dom.window.close();
 if(result.includes('carta-combinada.html')||result.includes('../conceptos/')||result.includes('Vista conceptual')||result.includes('noindex'))throw new Error('Prototype reference remains in production home');
 return result;
}
