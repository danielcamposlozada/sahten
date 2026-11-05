(function(){
 function enhance(){
  var brand=document.querySelector('#snav .nav-brand');
  if(brand&&!brand.querySelector('[data-editorial-logo]'))brand.innerHTML='<img data-editorial-logo src="editorial/logo-verde-crema-naranja.svg" alt="SAHTEN Gastronomía Árabe" width="128" height="61">';
  var notice=document.querySelector('#catalog-benefit>.catalog-benefit');
  if(!notice)return;
  if(notice.dataset.benefitPercent==='10'&&!notice.querySelector('img')){
   var image=document.createElement('img');image.className='checkout-benefit-image';image.src='editorial/banner-tortas.webp';image.alt='Dulces de Sahten para compartir';image.loading='lazy';notice.classList.add('has-editorial-benefit');notice.appendChild(image);
  }
 }
 new MutationObserver(enhance).observe(document.getElementById('s-nav'),{childList:true,subtree:true});
 new MutationObserver(enhance).observe(document.getElementById('catalog-benefit'),{childList:true,subtree:true});
 enhance();
})();
