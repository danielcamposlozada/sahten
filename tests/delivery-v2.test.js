import {it,expect} from 'vitest';
import {sahtenDeliveryPolicy,sahtenOpeningHours,prepareDeliveryConfig,SAHTEN_CENTER} from '../src/delivery/preset.js';
import {deliveryQuote,deliverySnapshot,haversineKm} from '../src/core/delivery.js';
import {circlePoints,toPolygon,validateDeliveryPolicy} from '../src/delivery/geometry.js';
import {deliveryIncentiveHtml} from '../src/delivery/incentive.js';
import {quoteOrder} from '../src/payments/core.js';
import {emptyFile,migrate,serialize} from '../src/project/schema.js';
const policy=()=>({...sahtenDeliveryPolicy(),hours:{...sahtenDeliveryPolicy().hours,enabled:false},active:true,promotionsEnabled:true});
const point=km=>({lat:circlePoints(SAHTEN_CENTER,km)[0][0],lng:circlePoints(SAHTEN_CENTER,km)[0][1]});
const route=(km,d)=>({provider:'deterministic-test-fixture',origin:{...SAHTEN_CENTER},destination:d,distanceMeters:km*1000,validatedAt:'2026-10-24T12:00:00Z'});
const quote=(km,sub,p=policy(),dest=point(Math.max(0,km-.1)))=>deliveryQuote(p,dest,sub,{route:route(km,dest)});
it('prepara las cinco zonas y la excepcional, sin activarlas ni cambiar otros negocios o historiales',()=>{
 const cfg={address:SAHTEN_CENTER.address,zones:[{id:'vieja',baseCost:1500}],paymentBenefit:{enabled:true}};
 const a=prepareDeliveryConfig(cfg),b=prepareDeliveryConfig(a);
 expect(a.deliveryV2.zones.map(z=>z.baseCost)).toEqual([2190,2990,3990,5490,6990,9000]);expect(a.deliveryV2.active).toBe(false);expect(a.deliveryV2.promotionsEnabled).toBe(false);expect(b).toBe(a);expect(a.zones).toEqual(cfg.zones);
 expect(a.openingHours).toEqual(sahtenOpeningHours());expect(a.openingHours.weekly[1][0]).toEqual({start:'12:00',end:'15:30'});
 const custom={...a,openingHours:{...a.openingHours,enabled:false}};expect(prepareDeliveryConfig(custom)).toBe(custom);expect(prepareDeliveryConfig(custom).openingHours.enabled).toBe(false);
 const another={address:'Otro local'};expect(prepareDeliveryConfig(another)).toBe(another);expect(another.openingHours).toBeUndefined();
 expect(prepareDeliveryConfig({},'sahten').openingHours).toEqual(sahtenOpeningHours());
 const f=emptyFile('Sahten');f.online.tiendaConfig=cfg;f.sales.orders=[{total:100,shipping:50}];const m=migrate(serialize(f)).file;expect(m.online.tiendaConfig.deliveryV2).toBeTruthy();expect(m.sales.orders).toEqual(f.sales.orders);expect(migrate(serialize(m)).file).toEqual(m);
});
it.each([[1,15000,2190],[1,25000,0],[3,20000,2990],[3,35000,0],[4.5,20000,3990],[4.5,35000,1990],[4.5,50000,0],[6,55000,2750],[6,80000,0],[7.5,40000,6990],[7.5,80000,3500]])('recorrido %s km, subtotal %s, envío %s',(km,sub,cost)=>{expect(quote(km,sub)).toMatchObject({ok:true,cost});});
it('no inventa ruta y exige autorización entre 8 y 8,5; no permite más de 8,5 aunque esté autorizado',()=>{
 const p=policy(),d=point(7.7);expect(deliveryQuote(p,d,90000).status).toBe('route_unverified');
 expect(deliveryQuote(p,d,90000,{route:route(8,d)})).toMatchObject({ok:true});
 const r=route(8.2,d);expect(deliveryQuote(p,d,90000,{route:r})).toMatchObject({ok:false,status:'authorization_required',cost:9000});
 const authorization={approved:true,revision:p.revision,destination:d,actor:'owner',reason:'Reparto autorizado'};
 expect(deliveryQuote(p,d,90000,{route:r,authorization})).toMatchObject({ok:true});
 expect(deliveryQuote(p,d,90000,{route:route(8.51,d),authorization})).toMatchObject({ok:false,out:true});
 expect(deliveryQuote(p,d,90000,{route:{...r,destination:point(1)}}).status).toBe('route_unverified');
});
it('la zona por calle establece un piso y la excepción necesita responsable, motivo y misma revisión',()=>{
 const p=policy(),d=point(2.5),r=route(4.5,d),q=deliveryQuote(p,d,40000,{route:r});
 expect(q.geographicZone.name).toBe('Zona 2');expect(q.effectiveZone.name).toBe('Zona 3');expect(q.cost).toBe(1990);
 const auth={approved:true,revision:p.revision,destination:d,actor:'owner',reason:'Acceso comprobado',tariffFloorException:true};
 expect(deliveryQuote(p,d,40000,{route:r,authorization:auth}).cost).toBe(0);
 expect(deliveryQuote(p,d,40000,{route:r,authorization:{...auth,revision:'vieja'}}).cost).toBe(1990);
});
it('aplica mínimos y pausas; cambiar polígonos no elude la protección operativa',()=>{
 const p=policy();expect(quote(6,20000,p)).toMatchObject({ok:false,belowMin:true,minOrder:30000});p.zones[3].enabled=false;expect(quote(6,90000,p).status).toBe('paused');
 p.zones[0]=toPolygon(p.center,p.zones[0]);expect(validateDeliveryPolicy(p).errors).toEqual([]);
 const d=point(1);expect(deliveryQuote(p,d,90000,{route:route(9,d)}).out).toBe(true);
});
it('detecta superposiciones, cruces y huecos; conserva tarifas al convertir un solo anillo',()=>{
 const p=policy(),before=JSON.stringify(p.zones.slice(1));p.zones[0]=toPolygon(p.center,p.zones[0]);expect(p.zones[0].baseCost).toBe(2190);expect(JSON.stringify(p.zones.slice(1))).toBe(before);expect(validateDeliveryPolicy(p).errors).toEqual([]);
 p.zones[1].innerRadiusKm=1;expect(validateDeliveryPolicy(p).errors.join()).toContain('superponen');p.zones[1].innerRadiusKm=2.5;expect(validateDeliveryPolicy(p).warnings.join()).toContain('sin cobertura');
 p.zones[0].points=[[0,0],[1,1],[0,1],[1,0]];expect(validateDeliveryPolicy(p).errors.length).toBeGreaterThan(0);
});
it('barra real: 57 %, 80 %, gratis y último descuento sin inventar objetivos',()=>{
 const first=quote(4.5,20000);expect(first.progress).toBeCloseTo(57.14,1);expect(deliveryIncentiveHtml(first)).toContain('role="progressbar"');expect(deliveryIncentiveHtml(first,{pos:true})).toContain('Informale al cliente');
 const second=quote(4.5,40000);expect(second).toMatchObject({cost:1990,savings:2000,progress:80,nextBenefit:{remaining:10000,cost:0}});
 const free=quote(4.5,50000);expect(free.progress).toBe(100);expect(free.nextBenefit).toBeNull();expect(deliveryIncentiveHtml(free)).toContain('gratis desbloqueado');
 const last=quote(7.5,80000);expect(last.cost).toBe(3500);expect(last.nextBenefit).toBeNull();expect(deliveryIncentiveHtml(last)).not.toContain('conseguí envío gratis');
});
it('los umbrales usan subtotal neto, mantiene el 10 % y registra ahorro sin duplicarlo como gasto',()=>{
 const p=policy(),d=point(4),r=route(4.5,d),menu={products:[{id:'p',name:'Prueba',price:40000}],config:{},delivery:{deliveryV2:p},store:{currency:{symbol:'$',locale:'es-AR'}},payments:{methods:{efectivo:true,mercadopago:true},benefit:{enabled:true,percent:10,channels:{online:true,mostrador:true}}}};
 const input={source:'delivery',lat:d.lat,lng:d.lng,address:'Dirección de prueba',customerName:'Cliente',customerPhone:'12345678',paymentMethod:'efectivo',items:[{id:'p',qty:1}]};
 const o=quoteOrder(menu,input,{route:r,allowOtherPayments:true});expect(o).toMatchObject({subtotal:40000,discount:4000,shipping:1990,total:37990,deliverySnapshot:{netSubtotal:36000,discount:2000}});
 p.stackWithPayment=false;expect(quoteOrder(menu,input,{route:r,allowOtherPayments:true}).shipping).toBe(3990);
 expect(o.deliverySnapshot.discount).toBe(2000);p.zones[2].baseCost=9999;expect(o.deliverySnapshot.baseCost).toBe(3990);
 const pickup=quoteOrder(menu,{...input,source:'pickup'},{allowOtherPayments:true});expect(pickup.shipping).toBe(0);expect(pickup.deliverySnapshot).toBeUndefined();
});
