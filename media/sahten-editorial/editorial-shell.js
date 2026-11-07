(function(){
  const header=document.querySelector('.sahten-shell');
  if(!header)return;
  const menu=header.querySelector('.sahten-shell-menu');
  header.querySelector('[data-editorial-cart]')?.addEventListener('click',()=>window.openCart?.());
  menu?.querySelector('nav')?.addEventListener('click',e=>{if(e.target.closest('a'))menu.open=false;});
  document.addEventListener('click',e=>{if(menu?.open&&!menu.contains(e.target))menu.open=false;});
  document.addEventListener('keydown',e=>{
    if(e.key==='Escape'&&menu?.open){menu.open=false;menu.querySelector('summary')?.focus();}
  });
})();
