(function(){
 'use strict';
 var menu=JSON.parse(document.getElementById('editorial-menu').textContent),busy=false,programs=[];
 var benefit=document.querySelector('[data-payment-benefit]'),ads=document.getElementById('live-public-promos'),promoContent='';
 function update(){
  if(benefit)benefit.hidden=!editorialBenefitEnabled(menu);
  if(ads){
   var html=editorialCampaignMarkup(menu,new Date())+editorialLoyaltyMarkup(menu,programs);
   if(promoContent!==html){
    var list=ads.querySelector('.home-promos-list'),scroll=list?list.scrollLeft:0;
    var open=[...ads.querySelectorAll('[data-public-promotion]')].filter(function(el){return el.querySelector('details[open]')}).map(function(el){return el.dataset.publicPromotion});
    ads.innerHTML=html?'<div class="home-promos-heading"><div><p class="combo-kicker">PARA DISFRUTAR MÁS</p><h2>Beneficios para vos</h2><p>Conocé las opciones disponibles para tu pedido.</p></div><span>Deslizá para ver más →</span></div><div class="home-promos-list" tabindex="0" aria-label="Beneficios disponibles; desplazate para ver más">'+html+'</div>':'';
    list=ads.querySelector('.home-promos-list');if(list)list.scrollLeft=scroll;
    ads.querySelectorAll('[data-public-promotion]').forEach(function(el){if(open.includes(el.dataset.publicPromotion)&&el.querySelector('details'))el.querySelector('details').open=true;});
    promoContent=html;
   }
   ads.hidden=!html;
  }
  document.querySelectorAll('[data-home-product]').forEach(function(a){
   var p=menu.products.find(function(p){return p.id===a.dataset.homeProduct&&!p.retired&&!p.upsellOnly});
   a.hidden=!p;if(!p)return;
   a.classList.toggle('product-paused',salesPaused(p));
   a.querySelector('h3').textContent=p.name+(salesPaused(p)?' · No disponible':'');
   var image=a.querySelector('img');if(p.image&&image.getAttribute('src')!==p.image)image.src=p.image;
  });
 }
 async function refresh(){
  if(busy||document.visibilityState==='hidden'||!menu.supabase?.url)return;
  busy=true;var abort=new AbortController(),timer=setTimeout(function(){abort.abort();},8000);
  try{var s=menu.supabase,r=await fetch(s.url+'/rest/v1/menus?select=json&store_id=eq.'+encodeURIComponent(s.storeId),{headers:{apikey:s.anonKey,Authorization:'Bearer '+s.anonKey},signal:abort.signal});
   if(!r.ok)throw Error('catalog');var rows=await r.json(),live=rows?.[0]?.json;
   if(Array.isArray(live?.products)){menu.products=live.products;menu.payments=live.payments;menu.promotions=live.promotions;menu.config=live.config;update();}
   try{var coupons=await fetch(s.url+'/rest/v1/rpc/get_public_loyalty_programs',{method:'POST',headers:{apikey:s.anonKey,Authorization:'Bearer '+s.anonKey,'Content-Type':'application/json'},body:JSON.stringify({p_store_id:s.storeId}),signal:abort.signal});programs=coupons.ok?await coupons.json():[];}catch(e){programs=[];}update();
  }catch(e){/* La copia publicada permanece disponible; el checkout valida al confirmar. */}
  finally{clearTimeout(timer);busy=false;}
 }
 update();refresh();setInterval(refresh,10000);window.addEventListener('focus',refresh);document.addEventListener('visibilitychange',refresh);
 document.querySelectorAll('video').forEach(function(video){video.addEventListener('play',function(){document.querySelectorAll('video').forEach(function(other){if(other!==video)other.pause();});});});
 document.querySelectorAll('.mobile-menu a').forEach(function(a){a.addEventListener('click',function(){a.closest('details').open=false;});});
 document.addEventListener('keydown',function(e){if(e.key==='Escape')document.querySelectorAll('.mobile-menu[open]').forEach(function(el){el.open=false;el.querySelector('summary').focus();});});
 var photos=Array.from(document.querySelectorAll('.benefit-photos img')),reduced=window.matchMedia('(prefers-reduced-motion: reduce)').matches,paused=reduced,photo=0,rotation=document.querySelector('.photo-rotation');
 if(rotation){rotation.textContent=reduced?'Otra foto':'Pausar fotos';rotation.setAttribute('aria-pressed',String(paused));rotation.addEventListener('click',function(){if(reduced){photos[photo].hidden=true;photo=1-photo;photos[photo].hidden=false;return;}paused=!paused;rotation.textContent=paused?'Continuar fotos':'Pausar fotos';rotation.setAttribute('aria-pressed',String(paused));});}
 setInterval(function(){if(paused||document.visibilityState==='hidden'||benefit?.hidden||photos.length!==2)return;photos[photo].hidden=true;photo=1-photo;photos[photo].hidden=false;},7000);
 if(!reduced&&'IntersectionObserver' in window){var reveal=new IntersectionObserver(function(entries){entries.forEach(function(entry){if(!entry.isIntersecting)return;reveal.unobserve(entry.target);if(entry.target.animate)entry.target.animate([{opacity:.65,transform:'translateY(12px)'},{opacity:1,transform:'translateY(0)'}],{duration:window.innerWidth<760?210:300,easing:'cubic-bezier(0,0,.2,1)'});});},{threshold:.12});document.querySelectorAll('.section-heading,.family-pictures,.tutorial-copy,.vida-copy').forEach(function(el){reveal.observe(el);});}
 var mapEl=document.getElementById('mapa-barrio'),message=document.querySelector('.map-message'),button=document.querySelector('.map-control'),started=false;
 async function startMap(){
  if(started)return;started=true;
  try{
   var loader=document.createElement('script');loader.src='editorial/maplibre-gl.js';
   await new Promise(function(resolve,reject){loader.onload=resolve;loader.onerror=reject;document.head.appendChild(loader);});
   var response=await fetch('editorial/map-style.json');if(!response.ok)throw Error('map style');
   var map=new maplibregl.Map({container:mapEl,style:await response.json(),center:[-58.4817855,-34.5263561],zoom:15.9,interactive:false,attributionControl:false});
   new ResizeObserver(function(){map.resize();}).observe(mapEl);
   var marker=document.createElement('div');marker.className='vida-marker';marker.innerHTML='<span aria-hidden="true"></span><strong>SAHTEN</strong>';
   new maplibregl.Marker({element:marker}).setLngLat([-58.4817855,-34.5263561]).addTo(map);
   var timeout=setTimeout(function(){if(!map.loaded())message.textContent='El mapa está demorando. Podés usar Cómo llegar para abrir Google Maps.';},12000);
   map.on('load',function(){clearTimeout(timeout);message.hidden=true;document.body.dataset.mapStatus='loaded';});
   map.on('error',function(){if(document.body.dataset.mapStatus!=='loaded')message.textContent='No pudimos cargar el mapa. Usá Cómo llegar para abrirlo.';});
   button.addEventListener('click',function(){var active=button.getAttribute('aria-pressed')!=='true';button.setAttribute('aria-pressed',String(active));for(var h of ['dragPan','touchZoomRotate','doubleClickZoom','keyboard'])map[h][active?'enable':'disable']();map.scrollZoom.disable();button.textContent=active?'Dejar de explorar −':'Explorar el mapa ＋';});
  }catch(e){message.textContent='No pudimos cargar el mapa. Usá Cómo llegar para abrirlo.';button.hidden=true;}
 }
 if(mapEl){if('IntersectionObserver' in window){var observer=new IntersectionObserver(function(entries){if(entries.some(function(x){return x.isIntersecting;})){observer.disconnect();startMap();}},{rootMargin:'300px'});observer.observe(mapEl);}else startMap();}
})();
