import { deliveryConfiguration, applyDeliveryConfiguration, deliveryConfigurationFingerprint } from '../core/delivery-configuration.js';

const copy=value=>JSON.parse(JSON.stringify(value));
export function installDeliveryConfiguration(w) {
  let context='',revision=null,remote=null;
  const identity=()=>JSON.stringify([w.SAHTEN.project.session.id,w.SAHTEN.online?.conn()?.url,w.SAHTEN.online?.conn()?.storeId]);
  const ensure=()=>{const next=identity();if(next!==context){context=next;revision=w._getTiendaConfig?.().deliveryConfigurationRevision??null;remote=null;}};
  const canEdit=()=>!w.SAHTEN.project.session.readOnly&&(!w.document.body.dataset.role||['owner','admin'].includes(w.document.body.dataset.role));
  function persist(cfg) {
    w._saveTiendaConfig(cfg);if(!w.SAHTEN.project.session.readOnly){w.SAHTEN.project.markDirty();w.scheduleSave?.();}
    if(w.currentPanel==='mostrador'){const dest=w.mostradorDeliveryValue?.();if(dest){dest.quoteId=null;dest.authorization=null;dest.routeError='';}w._renderCartExtras?.();w._renderCartTotals?.();if(dest?.lat!=null&&cfg.deliveryV2?.active)w.SAHTEN.delivery.refreshPos().catch(()=>{});}
  }
  function save(cfg,baseRevision) {
    ensure();if(!canEdit())return false;
    const old=w._getTiendaConfig(),configuration=deliveryConfiguration(cfg),requestId=w.crypto.randomUUID();
    const next=applyDeliveryConfiguration(old,configuration,{revision:requestId,effectiveAt:new Date().toISOString()});
    const parentRevision=old.deliveryConfigurationRequestId??null;next.deliveryConfigurationRequestId=requestId;
    persist(next);
    w.dispatchEvent(new w.CustomEvent('sahten:delivery-configuration',{detail:{value:{configuration,revision:baseRevision===undefined?revision:baseRevision,requestId,parentRevision}}}));
    refreshStatus();return true;
  }
  function ack(value,row) {
    ensure();revision=row.revision;remote=copy(row);
    let cfg=w._getTiendaConfig();
    if(deliveryConfigurationFingerprint(deliveryConfiguration(cfg))===deliveryConfigurationFingerprint(value.configuration))cfg=applyDeliveryConfiguration(cfg,row.configuration,{revision:row.revision,effectiveAt:row.updatedAt});
    cfg.deliveryConfigurationRevision=row.revision;persist(cfg);w.SAHTEN.delivery.admin.configurationChanged?.();refreshStatus();
  }
  function applyRemote(row,before,force=false) {
    ensure();if(!row?.configuration)return;const cfg=w._getTiendaConfig();if(before&&cfg.deliveryConfigurationRevision!==before.deliveryConfigurationRevision)return;const previousRevision=revision;revision=row.revision??null;remote=copy(row);
    const pending=!!w.SAHTEN.online?.configurationPublisher?.info().changes.configuration;
    const unchanged=!before||deliveryConfigurationFingerprint(deliveryConfiguration(cfg))===deliveryConfigurationFingerprint(deliveryConfiguration(before));
    // No reemplazar al instalar la actualización una configuración local todavía sin publicar.
    const known=!canEdit()||cfg.deliveryConfigurationRevision!==undefined&&cfg.deliveryConfigurationRevision===previousRevision || cfg.deliveryV2?.revision===row.revision;
    if(force||!pending&&unchanged&&known&&row.revision!==cfg.deliveryConfigurationRevision){
      const next=applyDeliveryConfiguration(cfg,row.configuration,{revision:row.revision,effectiveAt:row.updatedAt});next.deliveryConfigurationRevision=row.revision;next.deliveryConfigurationRequestId=row.revision;persist(next);w.SAHTEN.delivery.admin.configurationChanged?.();
    }
    refreshStatus();
  }
  async function reload() {
    if(!canEdit())return;w.SAHTEN.online.configurationPublisher.discard('configuration');
    const row=await w.SAHTEN.online.controller.readDeliveryConfiguration();if(row)applyRemote(row,null,true);
    w.SAHTEN.delivery.admin.mount();
  }
  function status() {
    ensure();const q=w.SAHTEN.online?.configurationPublisher?.info(),connected=!!w.SAHTEN.online?.conn()?.storeId;
    return !connected?'Guardado solo en este proyecto. Conectá la tienda para aplicarlo en la web.':q?.pending?q.state==='publicando'?'Aplicando mínimos, tarifas y cobertura en la web…':q.error?'Guardado local; pendiente de aplicar: '+q.error:'Guardado local; pendiente de enviar a la web.':(q?.state==='publicado'||remote&&w._getTiendaConfig().deliveryConfigurationRevision===remote.revision)?'Configuración confirmada en la web. No hace falta subir archivos.':remote&&w._getTiendaConfig().deliveryConfigurationRevision!==remote.revision?'Hay una configuración en la web y ajustes locales sin vincular. Podés cargar la configuración de la web antes de editar, o guardar para aplicar la local.':'Al guardar se aplican mínimos, tarifas y cobertura en la tienda conectada. No publica precios ni otros cambios del catálogo.';
  }
  function refreshStatus() {
    const q=w.SAHTEN.online?.configurationPublisher?.info();
    w.document.querySelectorAll('[data-delivery-config-status]').forEach(el=>el.textContent=status());
    w.document.querySelectorAll('[data-delivery-config-retry]').forEach(el=>el.hidden=!q?.pending);
    w.document.querySelectorAll('[data-delivery-config-reload]').forEach(el=>el.hidden=!(q?.pending&&q.state==='error'||remote&&!q?.pending&&w._getTiendaConfig().deliveryConfigurationRevision!==remote.revision));
    w.document.querySelectorAll('[data-action="save"], [data-delivery-config-save]').forEach(el=>{if(el.closest('#delivery-admin')||el.hasAttribute('data-delivery-config-save'))el.disabled=!canEdit()||q?.state==='publicando';});
  }
  function mountLegacy() {
    const host=w.document.getElementById('delivery-config-legacy-control');if(!host)return;
    host.innerHTML='<button type="button" class="btn btn-accent" data-delivery-config-save>Guardar y aplicar en la web</button><p role="status" aria-live="polite" data-delivery-config-status></p><button type="button" class="btn" data-delivery-config-retry hidden>Reintentar</button><button type="button" class="btn" data-delivery-config-reload hidden>Usar configuración de la web</button>';
    host.onclick=e=>{if(e.target.closest('[data-delivery-config-save]'))save(w._getTiendaConfig());else if(e.target.closest('[data-delivery-config-retry]'))w.SAHTEN.online.configurationPublisher.flush().catch(()=>{});else if(e.target.closest('[data-delivery-config-reload]'))reload().catch(err=>w.alert(err.message));};refreshStatus();
  }
  return {save,ack,applyRemote,reload,refreshStatus,mountLegacy,revision:()=>{ensure();return revision;},remote:()=>remote};
}
