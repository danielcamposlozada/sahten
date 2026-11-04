import {describe,it,expect} from 'vitest';
import {mergeOrderHistory,preserveLocalSales,recoveredOrderCount} from '../src/online/order-preservation.js';
import {structuralHash} from '../src/online/sync.js';
import {hourlyBackup,listHourlies,BACKUP_HOURS} from '../src/project/backups.js';
import {emptyFile} from '../src/project/schema.js';
import {selectTicketAdvertisement} from '../src/core/ticket-advertising.js';
import {buildReceipt,buildKitchenReceipt} from '../src/ui/receipt-template.js';
import {receiptProfile} from '../src/ui/receipt-paper.js';

describe('Pedidos a prueba de sincronizaciones destructivas',()=>{
 it('si un servidor más viejo devuelve menos pedidos, conserva todos sin duplicarlos',()=>{
   const local={sales:{orders:[{id:'pos-1',createdAt:'2026-11-01T10:00:00Z',total:25000},
      {id:'web-r2',remoteId:'r2',createdAt:'2026-11-01T11:00:00Z',status:'en_preparacion',remoteStatusPending:'preparando'}],
      customers:[{id:'customer-1',name:'Local'}]}};
   const cloud={sales:{orders:[{id:'web-r2',remoteId:'r2',createdAt:'2026-11-01T11:00:00Z',status:'pendiente'},
      {id:'web-r3',remoteId:'r3',createdAt:'2026-11-01T12:00:00Z'}],customers:[]}};
   const merged=preserveLocalSales(local,cloud);
   expect(merged.sales.orders).toHaveLength(3);
   expect(merged.sales.orders.map(o=>o.id)).toEqual(expect.arrayContaining(['pos-1','web-r2','web-r3']));
   expect(merged.sales.orders.find(o=>o.remoteId==='r2').status).toBe('en_preparacion');
   expect(merged.sales.customers).toHaveLength(1);
   expect(recoveredOrderCount(local,cloud)).toBe(1);
   expect(mergeOrderHistory(merged.sales.orders,cloud.sales.orders)).toHaveLength(3);
 });
 it('no confunde un conflicto sólo de ventas con diferencias de catálogo',()=>{
   const a=emptyFile();const b=emptyFile();
   a.sales.orders=[{id:'local-1'}];b.sales.orders=[{id:'web-2'}];
   expect(structuralHash(a)).toBe(structuralHash(b));
   b.catalog.productos.push({id:'other',price:123});
   expect(structuralHash(a)).not.toBe(structuralHash(b));
 });
 it('crea backups horarios distintos de los 14 diarios y retiene 48 horas',async()=>{
   const data=new Map();
   const store={list:async key=>[...data.keys()],put:async(_key,n,text)=>data.set(n,text),remove:async(_key,n)=>data.delete(n)};
   const initial=new Date(2026,10,1,0,10,0);
   for(let i=0;i<BACKUP_HOURS+4;i++){
     const current=new Date(initial.getTime()+i*3600000);
     await hourlyBackup(store,'project','SAHTEN','snapshot '+i,current);
     expect((await hourlyBackup(store,'project','SAHTEN','duplicate',current)).written).toBe(false);
   }
   const history=await listHourlies(store,'project');
   expect(history.length).toBe(BACKUP_HOURS);
   expect(history[0].hour).toBe('2026-11-03T03');
 });
});

describe('Cuatro piezas publicitarias reales y acceso online',()=>{
 const date=new Date('2026-11-02T16:00:00Z');
 const campaigns=[
   {id:'weekly',kind:'public',enabled:true,channels:['online'],schedule:{type:'weekly',weekdays:[1,2,3]},advertising:{enabled:true,placement:['ticket'],message:'Platos seleccionados'}},
   {id:'always',kind:'public',enabled:true,channels:['online'],schedule:null,advertising:{enabled:true,placement:['ticket'],message:'12% en Baklava'}},
   {id:'special',kind:'public',enabled:true,channels:['online'],schedule:{type:'central_weekends'},advertising:{enabled:true,placement:['ticket'],message:'Tablas centrales',advanceDays:14}}
 ];
 const config={enabled:true,ticket:{enabled:true,advertise:true},campaigns};
 const render=snapshot=>buildReceipt({num:123,items:[],createdAt:date.toISOString(),source:'pickup',subtotal:0,total:0,promotionTicketSnapshot:snapshot},
   {paper:receiptProfile(58),reviewHtml:'<section id="google-review">Google Reviews</section>'});
 it('imprime formato A (semanal), B (descuento), D (especial) y C sólo si el backend emitió el cupón',()=>{
   const a=selectTicketAdvertisement(config,{channel:'online',now:date,rotationKey:0});
   const b=selectTicketAdvertisement(config,{channel:'online',now:date,rotationKey:1});
   const d=selectTicketAdvertisement(config,{channel:'online',now:date,rotationKey:2});
   expect(new Set([a.layout,b.layout,d.layout])).toEqual(new Set(['A','B','D']));
   for(const s of [a,b,d])expect(render(s)).toContain('receipt-promo--'+s.layout);
   const coupon=selectTicketAdvertisement(config,{channel:'online',now:date,coupon:{
     id:'real',status:'available',code:'SHT-A1',expiresOn:'2026-11-20',headline:'Cupón emitido'
   }});
   expect(render(coupon)).toContain('receipt-promo--C');
   expect(render(coupon)).toContain('SHT-A1');
 });
 it('la pastilla es anterior a Google, y no aparece en la comanda',()=>{
   const html=render(null);
   expect(html).toContain('receipt-online-invite');
   expect(html).toContain('sahten.online');
   expect(html.indexOf('receipt-online-invite">')).toBeLessThan(html.indexOf('id="google-review"'));
   const kitchen=buildKitchenReceipt({num:123,items:[],createdAt:date.toISOString(),source:'pickup'},
     {paper:receiptProfile(58)});
   expect(kitchen).not.toContain('receipt-online-invite');
   expect(kitchen).not.toContain('receipt-promo');
 });
});
