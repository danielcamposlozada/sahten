import { seoServiceSchedule, seoValidServiceWeek, seoServiceHoursText, seoServiceSchema } from './seo.js';

const json = value => JSON.stringify(value).replace(/</g, '\\u003c');
/** Las páginas informativas solo descargan los calendarios públicos, nunca el catálogo completo. */
export function serviceHoursPageScript(menu) {
  const s = menu.supabase;
  if (!s?.url || !s?.storeId || !s?.anonKey) return '';
  const config = {url:s.url,storeId:s.storeId,anonKey:s.anonKey};
  const snapshot = {store:{openingHours:menu.store?.openingHours},delivery:{hours:menu.delivery?.hours??menu.delivery?.deliveryV2?.hours},site:{delivery:{hours:menu.site?.delivery?.hours}}};
  const helpers = [seoServiceSchedule,seoValidServiceWeek,seoServiceHoursText,seoServiceSchema].map(fn=>fn.toString()).join('\n');
  return `<script>\n(function(){\n${helpers}\nvar cfg=${json(config)}, menu=${json(snapshot)}, busy=false;
function refresh(){
 if(busy||document.visibilityState==='hidden')return;
 busy=true;var controller=new AbortController(),timer=setTimeout(function(){controller.abort();},8000);
 var select='opening:json->store->openingHours,delivery:json->delivery->hours,legacy:json->delivery->deliveryV2->hours';
 fetch(cfg.url+'/rest/v1/menus?select='+encodeURIComponent(select)+'&store_id=eq.'+encodeURIComponent(cfg.storeId),{headers:{apikey:cfg.anonKey,Authorization:'Bearer '+cfg.anonKey},signal:controller.signal}).then(function(r){if(!r.ok)throw Error('hours');return r.json();}).then(function(rows){
  var row=rows&&rows[0];if(!row)return;
  if(row.opening!=null)menu.store.openingHours=row.opening;
  if(row.delivery||row.legacy)menu.delivery.hours=row.delivery||row.legacy;
  document.querySelectorAll('[data-service-hours]').forEach(function(el){var text=seoServiceHoursText(menu,el.dataset.serviceHours);el.textContent=text;var block=el.closest('[data-service-hours-block]');if(block)block.hidden=!text;});
  var tag=document.getElementById('restaurant-schema');if(tag&&menu.store.openingHours){var data=JSON.parse(tag.textContent);delete data.openingHours;delete data.specialOpeningHoursSpecification;Object.assign(data,seoServiceSchema(menu));tag.textContent=JSON.stringify(data);}
 }).catch(function(){/* Conserva la copia publicada al perder conexión. */}).finally(function(){clearTimeout(timer);busy=false;});
}
refresh();setInterval(refresh,10000);window.addEventListener('focus',refresh);document.addEventListener('visibilitychange',refresh);
})();\n</script>`;
}
