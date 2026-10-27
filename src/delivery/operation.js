// Estado operativo independiente de las tarifas. Solo este booleano se publica automáticamente.
export function installDeliveryOperation(w) {
  const canEdit=()=>!w.SAHTEN.project.session.readOnly&&(!w.document.body.dataset.role||['owner','admin'].includes(w.document.body.dataset.role));
  const refresh=()=>{if(w.currentPanel==='mostrador'){w._renderCartExtras?.();w._renderCartTotals?.();}};
  function render(){
    const host=w.document.getElementById('delivery-service-control');if(!host)return;const hadFocus=host.contains(w.document.activeElement)&&w.document.activeElement.matches('input');
    const enabled=w._getTiendaConfig().deliveryEnabled!==false,connected=!!w.SAHTEN.online?.conn()?.storeId,q=w.SAHTEN.online?.deliveryPublisher?.info();
    const pending=!!q?.changes.delivery;
    const status=!connected?'Solo en este proyecto. Conectá la tienda para actualizar la web.':pending?q.state==='publicando'?'Actualizando la web…':q.error?'No llegó a la web. '+q.error:'Pendiente de actualizar en la web.':q?.state==='publicado'?'Estado confirmado en la web.':'La apertura se envía automáticamente a la tienda conectada.';
    host.innerHTML='<section class="card delivery-operation"><div class="card-body"><div class="delivery-operation-heading"><div><h3>Recepción de pedidos con delivery</h3><p data-delivery-state>'+ (enabled?'Habilitada · respeta el horario configurado':'Pausada · no se aceptan nuevos envíos')+'</p></div><label class="delivery-operation-toggle"><input type="checkbox" role="switch" aria-label="Habilitar delivery" '+(enabled?'checked':'')+' '+(canEdit()?'':'disabled')+'><span>'+(enabled?'Habilitado':'Pausado')+'</span></label></div><p>El retiro en local, los pedidos ya recibidos y los pagos ya iniciados siguen su curso. Pausar no cambia horarios, zonas, tarifas ni beneficios; permanece así hasta que lo reactives.</p><p class="delivery-operation-status" role="status" aria-live="polite"></p><button type="button" class="btn" data-delivery-retry '+(pending?'':'hidden')+' '+(canEdit()?'':'disabled')+'>Reintentar envío</button></div></section>';
    host.querySelector('[role=status]').textContent=status;
    host.querySelector('input').onchange=e=>set(e.target.checked);
    if(hadFocus)host.querySelector('input').focus({preventScroll:true});
    host.querySelector('[data-delivery-retry]').onclick=()=>w.SAHTEN.online.deliveryPublisher.flush().catch(()=>{});
  }
  function save(enabled){const cfg=w._getTiendaConfig();if((cfg.deliveryEnabled!==false)===enabled)return;cfg.deliveryEnabled=enabled;w._saveTiendaConfig(cfg);w.SAHTEN.project.markDirty();w.scheduleSave?.();refresh();}
  function set(enabled){if(!canEdit()||typeof enabled!=='boolean')return;save(enabled);w.dispatchEvent(new w.CustomEvent('sahten:delivery-state',{detail:{enabled}}));render();}
  function applyRemote(value){if(typeof value?.enabled!=='boolean')return;save(value.enabled);render();}
  return {render,set,applyRemote};
}
