import { haversineKm, validDeliveryPoint } from '../core/delivery.js';

/** Sugerencias de calle/altura argentinas. Caché solo en memoria, sin nombres ni teléfonos. */
export function createAddressSuggestions({fetchImpl=fetch,now=()=>Date.now()}={}) {
  const base='https://apis.datos.gob.ar/georef/api/v2.0/',regions=new Map(),cache=new Map();let departments;
  const normalized=s=>String(s||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/\s+/g,' ').trim();
  async function get(path,signal){
    const controller=new AbortController(),abort=()=>controller.abort(),timer=setTimeout(abort,6000);if(signal?.aborted)abort();else signal?.addEventListener('abort',abort,{once:true});
    try{const r=await fetchImpl(base+path,{signal:controller.signal});if(!r.ok)throw new Error(r.status===429?'El buscador está ocupado. Esperá un momento.':'No pudimos consultar las sugerencias. Probá Buscar de otra forma.');return await r.json();}finally{clearTimeout(timer);signal?.removeEventListener('abort',abort);}
  }
  async function region(center){
    const id=center.lat+':'+center.lng;if(regions.has(id))return regions.get(id);
    const task=(async()=>{
      departments??=get('departamentos?max=1000&campos=id,centroide').then(j=>j.departamentos||[]).catch(e=>{departments=null;throw e;});
      const [location,all]=await Promise.all([get('ubicacion?lat='+center.lat+'&lon='+center.lng),departments]);
      const home=location.ubicacion?.departamento?.id;if(!home)return [];
      const nearby=all.filter(d=>validDeliveryPoint({lat:d.centroide?.lat,lng:d.centroide?.lon})).map(d=>({id:d.id,km:haversineKm(center.lat,center.lng,d.centroide.lat,d.centroide.lon)})).filter(d=>d.km<=35).sort((a,b)=>a.km-b.km).slice(0,15);
      return [...new Set([home,...nearby.map(d=>d.id)])];
    })();if(regions.size>30)regions.clear();regions.set(id,task);task.catch(()=>regions.delete(id));return task;
  }
  return async function suggest(query,center,{signal}={}){
    query=String(query||'').trim();if(query.length<4||!/[a-záéíóúñ]{2}/i.test(query)||!/\d/.test(query)||!validDeliveryPoint(center))return [];
    const k=center.lat+':'+center.lng+':'+normalized(query),old=cache.get(k);if(old&&old.until>now())return old.rows;
    const ids=await region(center);if(signal?.aborted)throw new DOMException('Búsqueda reemplazada','AbortError');if(!ids.length)return [];
    const parts=query.split(','),street=parts.shift().trim(),u=new URL(base+'direcciones');u.searchParams.set('direccion',street);u.searchParams.set('departamento',ids.join(','));u.searchParams.set('max','30');if(parts[0]?.trim())u.searchParams.set('localidad',parts[0].trim());
    const j=await get(u.href.slice(base.length),signal),terms=normalized(street.replace(/\d+/g,' ')).split(' ').filter(t=>t.length>2);
    const rows=(j.direcciones||[]).filter(d=>Number(d.altura?.valor)>0&&typeof d.ubicacion?.lat==='number'&&typeof d.ubicacion?.lon==='number'&&validDeliveryPoint({lat:d.ubicacion.lat,lng:d.ubicacion.lon})&&typeof d.nomenclatura==='string').map(d=>({display_name:d.nomenclatura,lat:String(d.ubicacion.lat),lon:String(d.ubicacion.lon),provider:'georef',score:terms.filter(t=>normalized(d.calle?.nombre).includes(t)).length,km:haversineKm(center.lat,center.lng,d.ubicacion.lat,d.ubicacion.lon)})).sort((a,b)=>b.score-a.score||a.km-b.km).slice(0,5).map(({score,km,...row})=>row);
    if(cache.size>=150)cache.clear();cache.set(k,{until:now()+5*60000,rows});return rows;
  };
}
