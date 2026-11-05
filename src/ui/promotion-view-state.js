// Preserve reading position across live refreshes; never preserve stale form values.
export function capturePromotionView(root) {
  const active=root.ownerDocument.activeElement;
  return {
    details:[...root.querySelectorAll('details')].map(el=>({open:el.open,key:el.dataset.viewKey||el.id||el.className})),
    scroll:[root,...root.querySelectorAll('*')].filter(el=>el.scrollTop||el.scrollLeft)
      .map(el=>({id:el.id,top:el.scrollTop,left:el.scrollLeft})).filter(el=>el.id),
    focus:root.contains(active)&&active.id?active.id:null,
    selection:active&&typeof active.selectionStart==='number'?[active.selectionStart,active.selectionEnd]:null
  };
}
export function restorePromotionView(root,state,{restoreFocus=false}={}) {
  if(!state)return;
  [...root.querySelectorAll('details')].forEach((el,i)=>{
    const saved=state.details[i];
    if(saved&&saved.key===(el.dataset.viewKey||el.id||el.className))el.open=saved.open;
  });
  if(restoreFocus&&state.focus){
    const el=root.ownerDocument.getElementById(state.focus);
    if(root.contains(el)){
      el.focus({preventScroll:true});
      if(state.selection&&typeof el.setSelectionRange==='function'){
        try{el.setSelectionRange(...state.selection);}catch{}
      }
    }
  }
  for(const item of state.scroll){
    const el=root.ownerDocument.getElementById(item.id);
    if(el&&(el===root||root.contains(el))){el.scrollTop=item.top;el.scrollLeft=item.left;}
  }
}
