import {describe,it,expect} from 'vitest';
import {readFileSync} from 'node:fs';
const load=name=>readFileSync(new URL('../docs/receipt-previews/'+name,import.meta.url),'utf8');
const htmls=['58mm-campaign-demo.html','80mm-coupon-demo.html'];
describe('Vistas 58/80 mm: ni ahorro doble ni cupones ficticios',()=>{
 for(const name of htmls){
  it(name+' usa 25% TOTAL (10% habitual + 15% adicional), sin simular campaña activa',()=>{
   const x=load(name);
   expect(x).toContain('MUESTRA - NO VÁLIDO');
   expect(x).toContain('$60.600');
   expect(x).toContain('−$6.060');
   expect(x).toContain('−$877,50');
   expect(x).toContain('$53.662,50');
   expect(x).toContain('Fatay · 25 % TOTAL');
   expect(x).not.toContain('−$1.170');
   expect(x).not.toContain('$53.370');
  });
 }
 it('80mm jamás usa token canjeable y lo distingue visualmente',()=>{
  const x=load('80mm-coupon-demo.html');
  expect(x).toContain('DEMO-NO-CANJEABLE');
  expect(x).toContain('MUESTRA - NO VÁLIDO');
 });
 it('58mm no promete fecha de una campaña desactivada',()=>{
  const x=load('58mm-campaign-demo.html');
  expect(x).not.toContain('07/11/2026');
  expect(x).toContain('Descubrí más en sahten.online.');
 });
});
