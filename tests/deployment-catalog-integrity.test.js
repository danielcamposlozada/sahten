import {it,expect} from 'vitest';
import {assertCatalogPreserved,catalogFingerprint} from '../scripts/deploy/catalog-integrity.mjs';
const live=()=>({products:[{id:'plato',price:12000,image:'https://example.com/plato.jpg'}],
 config:{enabled:true},payments:{benefit:{percent:10}},delivery:{enabled:true},
 promotions:{enabled:true,campaigns:[{id:'weekly',enabled:true},{id:'dessert',enabled:false}]}});
it('acepta cambios de cantidad del catálogo vigente sin alterar sus datos ni promociones pausadas',()=>{
 const source=live();source.products.push({id:'bebida',price:2000});
 expect(assertCatalogPreserved({...structuredClone(source),site:{title:'Portada conservada'}},source)).toBe(true);
});
it.each(['products','payments','promotions','delivery','config'])('rechaza cambios de %s al empaquetar',key=>{
 const source=live(),result=structuredClone(source);result[key]=null;
 expect(()=>assertCatalogPreserved(result,source)).toThrow('commercial catalog');
});
it('detecta cambios simultáneos de precio y no depende del orden de claves',()=>{
 const source=live(),other=structuredClone(source);
 expect(catalogFingerprint({...source,products:[{price:12000,id:'plato',image:'https://example.com/plato.jpg'}]})).toBe(catalogFingerprint(source));
 other.products[0].price=14000;expect(catalogFingerprint(other)).not.toBe(catalogFingerprint(source));
});
it('no publica un catálogo vacío, IDs duplicados ni importes inválidos',()=>{
 for(const products of [[],[{id:'p',price:NaN}],[{id:'p',price:10},{id:'p',price:10}]]){
  const source={...live(),products};expect(()=>assertCatalogPreserved(source,source)).toThrow();
 }
});
