// Importación selectiva: toma solo propuestas de la nube, preserva los demás datos locales.
const clone=value=>JSON.parse(JSON.stringify(value));
export function mergeCloudPromotions(local,remote){
  if(!local||typeof local!=='object'||!local.project||!local.catalog||!local.sales)throw new Error('local_project_invalid');
  const promos=remote?.promotions;
  if(!promos||typeof promos!=='object'||Array.isArray(promos)||promos.version!==1
    ||!Array.isArray(promos.campaigns)||!Array.isArray(promos.upsells))throw new Error('remote_promotions_invalid');
  // Respeta exactamente los flags remotos: importar borradores NO activa la tienda.
  // La activación pública depende de una publicación y de su verificación en Edge.
  const result={...clone(local),promotions:clone(promos)};
  return result;
}
