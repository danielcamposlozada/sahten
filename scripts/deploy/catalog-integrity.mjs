import {createHash} from 'node:crypto';

const canonical=value=>Array.isArray(value)?value.map(canonical):value&&typeof value==='object'
 ?Object.fromEntries(Object.keys(value).sort().map(key=>[key,canonical(value[key])])):value;
export function catalogFingerprint(menu){
 const commercial=Object.fromEntries(['products','config','payments','promotions','delivery','cartRecommendations']
  .map(key=>[key,menu[key]??null]));
 return createHash('sha256').update(JSON.stringify(canonical(commercial))).digest('hex');
}
export function assertCatalogPreserved(menu,live){
 if(!Array.isArray(live?.products)||!live.products.length)throw new Error('Live catalog is empty');
 const ids=live.products.map(p=>p.id);
 if(ids.some(id=>typeof id!=='string'||!id)||new Set(ids).size!==ids.length)
  throw new Error('Invalid or duplicate published product');
 if(live.products.some(p=>typeof p.price!=='number'||!Number.isFinite(p.price)||p.price<0))
  throw new Error('Invalid published price');
 if(catalogFingerprint(menu)!==catalogFingerprint(live))
  throw new Error('Package changes the live commercial catalog');
 return true;
}
