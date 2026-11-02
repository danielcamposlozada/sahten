// Importación selectiva: toma solo propuestas de la nube, preserva los demás datos locales.
const clone=value=>JSON.parse(JSON.stringify(value));
export function mergeCloudPromotions(local,remote){
  if(!local||typeof local!=='object'||!local.project||!local.catalog||!local.sales)throw new Error('local_project_invalid');
  const promos=remote?.promotions;
  if(!promos||typeof promos!=='object'||Array.isArray(promos)||promos.version!==1
    ||!Array.isArray(promos.campaigns)||!Array.isArray(promos.upsells))throw new Error('remote_promotions_invalid');
  // Nunca confiar en flags activos para el primer lanzamiento de nuevos descuentos.
  const safe=clone(promos);
  safe.enabled=false;
  safe.ticket={...(safe.ticket||{}),enabled:false};
  for(const key of ['campaigns','upsells','crossSells','productUpgrades'])
    if(Array.isArray(safe[key]))safe[key]=safe[key].map(x=>({...x,enabled:false}));
  if(safe.couponPrograms&&typeof safe.couponPrograms==='object')
    for(const v of Object.values(safe.couponPrograms))if(v&&typeof v==='object')v.enabled=false;
  const result={...clone(local),promotions:safe};
  return result;
}
