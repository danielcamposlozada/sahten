import assert from 'node:assert/strict';
import {JSDOM} from 'jsdom';

const sections=[['menu/','Carta'],['nuestra-historia/','Nuestra historia'],['catering/','Catering'],['#local','Encontranos']];
const categoryOrder=['sandwich','platos principales','picadas','entradas','ensaladas','promos','postres','bebidas'];

function linkMarkup(root,page) {
  return sections.map(([path,label])=>{
    const current=path===page+'/'||(page==='pedir'&&path==='menu/');
    return '<a href="'+root+path+'"'+(current?' aria-current="'+(page==='pedir'?'location':'page')+'"':'')+'>'+label+'</a>';
  }).join('');
}

function headerMarkup(root,page) {
  const links=linkMarkup(root,page);
  const action=page==='pedir'
    ? '<button type="button" class="sahten-shell-action pedido" data-editorial-cart>Mi pedido (0)</button>'
    : '<a class="sahten-shell-action" href="'+root+'pedir/">Pedir online <span aria-hidden="true">↗</span></a>';
  return '<header id="snav" class="sahten-shell"><div class="sahten-shell-inner">'
    +'<a href="'+root+'" class="sahten-shell-logo" aria-label="Sahten · Inicio"><img src="'+root+'editorial/logo-verde-crema-naranja.svg" width="128" height="61" alt=""></a>'
    +'<nav class="sahten-shell-links" aria-label="Navegación principal">'+links+'</nav>'
    +'<details class="sahten-shell-menu"><summary>Secciones</summary><nav aria-label="Navegación principal">'+links+'</nav></details>'
    +action+'</div></header>';
}

function seoSignature(d) {
  return {
    title:d.title,
    meta:[...d.querySelectorAll('head meta[content],head link[rel=canonical]')].map(e=>e.outerHTML),
    schema:[...d.querySelectorAll('script[type="application/ld+json"]')].map(e=>JSON.parse(e.textContent)),
    h1:[...d.querySelectorAll('h1:not(#h-title)')].map(e=>e.textContent),
  };
}

function orderReadOnlyMenu(d,root) {
  const main=d.querySelector('main'), categories=[...main.querySelectorAll('section:has(ul.items)')];
  const rank=section=>{
    const name=section.querySelector('h2').textContent.trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'');
    const index=categoryOrder.indexOf(name);
    return index<0?categoryOrder.length:index;
  };
  categories.sort((a,b)=>rank(a)-rank(b));
  if(!categories.length)return;
  const first=main.querySelector('section:has(ul.items)');
  const actions=d.createElement('div');actions.className='sahten-menu-intro';
  actions.innerHTML='<a class="cta" href="'+root+'pedir/">Pedir online <span aria-hidden="true">↗</span></a><nav class="sahten-category-jumps" aria-label="Categorías de la carta"></nav>';
  const categoryLinks=actions.querySelector('nav');
  first.before(actions);
  categories.forEach((section,i)=>{
    section.id='carta-categoria-'+(i+1);
    const a=d.createElement('a');a.href='#'+section.id;a.textContent=section.querySelector('h2').textContent;categoryLinks.append(a);
  });
  actions.after(...categories);
}

function refineInformationalPage(d,page,root) {
  const main=d.querySelector('main');
  if(page==='menu'){orderReadOnlyMenu(d,root);return;}
  if(page==='delivery-y-retiro'){
    const calendars=[...main.querySelectorAll(':scope > [data-service-hours-block]')];
    if(calendars.length===2){
      const group=d.createElement('div');group.className='sahten-calendars';calendars[0].before(group);group.append(...calendars);
    }
  }
  if(page==='catering'){
    const img=d.createElement('img');img.className='sahten-catering-photo';
    img.src=root+'editorial/catering-mesa.webp';img.alt='Mesa de Sahten para compartir en un evento';
    img.width=815;img.height=1080;img.decoding='async';
    main.querySelector('h1').after(img);
    const inquiry=main.querySelector('a[href^="https://wa.me/"]')?.cloneNode(true);
    if(inquiry){inquiry.textContent='Consultar por catering';img.after(inquiry);}
  }
  if(page==='nuestra-historia'){
    const photos=main.querySelector('.story-photos'),first=main.querySelector('h1 + p');
    if(photos&&first)first.after(photos);
  }
}

/** Solo la edición Sahten; no se integra en la plantilla general de la app. */
export function applyEditorialShell(html,{page,homeFooter,version,hoursScript=''}) {
  const dom=new JSDOM(html),d=dom.window.document;
  try{
    const before=seoSignature(d),order=page==='pedir',home=page==='home',root=home||order?'./':'../';
    d.body.dataset.editorialShell=page;
    const header=order?d.getElementById('s-nav'):d.querySelector('body > header');
    assert.ok(header,'Falta el espacio de cabecera para '+page);
    if(order)header.innerHTML=headerMarkup(root,page);else header.outerHTML=headerMarkup(root,page);
    const footer=home?d.querySelector('footer'):new JSDOM(homeFooter).window.document.querySelector('footer');
    assert.ok(footer,'Falta el pie editorial');
    const commonFooter=home?footer:d.importNode(footer,true);
    if(!home)footer.ownerDocument.defaultView.close();
    commonFooter.classList.add('sahten-footer');
    if(!home)commonFooter.querySelectorAll('[href],[src]').forEach(el=>{
      for(const attr of ['href','src']){
        const value=el.getAttribute(attr);
        if(value&&!/^(?:[a-z][a-z0-9+.-]*:|\/\/|\/)/i.test(value))el.setAttribute(attr,root+value);
      }
    });
    const footerLinks=commonFooter.querySelector('.footer-main nav');
    if(footerLinks)footerLinks.innerHTML=linkMarkup(root,page)+'<a href="'+root+'#ayuda">Cómo comprar</a><a href="'+root+'delivery-y-retiro/">Delivery y retiro</a>';
    if(order){
      const rest=d.getElementById('s-rest');rest.append(commonFooter);
      d.getElementById('foot').hidden=true;
      d.getElementById('oback').hidden=true;
      const h=d.getElementById('h-title'),fallback=d.createElement('p');fallback.id=h.id;fallback.textContent=h.textContent;h.replaceWith(fallback);
      d.getElementById('cats').after(d.getElementById('catalog-benefit'));
      d.body.insertAdjacentHTML('beforeend',hoursScript);
    }else if(!home){
      d.querySelector('footer').replaceWith(commonFooter);
      refineInformationalPage(d,page,root);
    }
    const asset=root+'editorial/';
    const file=path=>asset+path+'?v='+encodeURIComponent(version);
    if(!home&&!order)d.head.insertAdjacentHTML('beforeend','<link rel="stylesheet" href="'+file('editorial-pages.css')+'">');
    d.head.insertAdjacentHTML('beforeend','<link rel="stylesheet" href="'+file('editorial-shell.css')+'">');
    d.body.insertAdjacentHTML('beforeend','<script defer src="'+file('editorial-shell.js')+'"></script>');
    assert.deepEqual(seoSignature(d),before,'Cambió el SEO de '+page+' al aplicar la cabecera común');
    return dom.serialize();
  }finally{dom.window.close();}
}
