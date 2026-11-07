(function(){
  const header=document.querySelector('.sahten-shell');
  if(!header)return;
  const menu=header.querySelector('.sahten-shell-menu');
  header.querySelector('[data-editorial-cart]')?.addEventListener('click',()=>window.openCart?.());
  const cart=header.querySelector('[data-editorial-cart-storage]');
  if(cart){
    const badge=cart.querySelector('[data-editorial-cart-count]');
    const updateCart=()=>{
      let count=0;
      try { count=parseStorefrontCart(sessionStorage.getItem(cart.dataset.editorialCartStorage))?.count??0; }
      catch { /* almacenamiento no disponible */ }
      badge.textContent=count||'';
      badge.hidden=!count;
      cart.setAttribute('aria-label',storefrontCartLabel(count));
    };
    updateCart();
    window.addEventListener('pageshow',updateCart);
  }
  menu?.querySelector('nav')?.addEventListener('click',e=>{if(e.target.closest('a'))menu.open=false;});
  document.addEventListener('click',e=>{if(menu?.open&&!menu.contains(e.target))menu.open=false;});
  document.addEventListener('keydown',e=>{
    if(e.key==='Escape'&&menu?.open){menu.open=false;menu.querySelector('summary')?.focus();}
  });
})();
