import { describe, it, expect } from 'vitest';
import { selectTicketAdvertisement } from '../src/core/ticket-advertising.js';
import { buildReceipt, buildKitchenReceipt } from '../src/ui/receipt-template.js';
import { receiptProfile } from '../src/ui/receipt-paper.js';

const weekly = { id:'weekly-meals',name:'Platos lunes a miércoles',kind:'public',
  enabled:true,priority:20,channels:['online','mostrador'],
  schedule:{type:'weekly',weekdays:[1,2,3]},
  advertising:{enabled:true,placement:['ticket'],advanceDays:4,message:'Hasta 15% en platos seleccionados'} };
const tables = { id:'central-tables',name:'Tablas centrales',kind:'public',
  enabled:true,priority:30,channels:['online','mostrador'],
  schedule:{type:'central_weekends'},
  advertising:{enabled:true,placement:['ticket'],advanceDays:4,message:'Hasta 15% en tablas'} };
const always = Array.from({length:4},(_,i)=>({
  id:'always-'+i,name:'Oferta online '+i,kind:'public',enabled:true,
  priority:40+i,channels:['online'],schedule:null,
  advertising:{enabled:true,placement:['ticket'],message:'Oferta online '+i+' con 12%'} }));
const config = campaigns => ({enabled:true,ticket:{enabled:true,advertise:true},campaigns});

describe('Publicidad de campañas públicas en el ticket de cliente',()=>{
  it('una campaña semanal usada también invita a volver durante los días vigentes',()=>{
    const now=new Date('2026-11-02T16:30:00Z'); // lunes en Buenos Aires
    const result=selectTicketAdvertisement(config([weekly]),{
      now,channel:'online',excludedPromotionIds:['weekly-meals'],rotationKey:30});
    expect(result).toMatchObject({
      kind:'campaign',audience:'general',campaignId:'weekly-meals',
      repeatPurchase:true
    });
    const html=buildReceipt({num:30,createdAt:now.toISOString(),source:'pickup',
      items:[],subtotal:100,total:100,promotionTicketSnapshot:result},
      {paper:receiptProfile(58)});
    expect(result.startsOn).toBeUndefined();
    expect(html).toContain('VOLVÉ A APROVECHAR');
    expect(html).toContain('Web y mostrador');
    expect(html).not.toContain('PARA TU PRÓXIMA COMPRA');
    const kitchen=buildKitchenReceipt({num:30,createdAt:now.toISOString(),source:'pickup',items:[]},
      {paper:receiptProfile(58)});
    expect(kitchen).not.toContain('receipt-promo');
  });
  it('una tabla usada puede invitar a repetir mientras la promoción siga vigente',()=>{
    const current=new Date('2026-11-13T16:00:00Z'); // segundo viernes
    const result=selectTicketAdvertisement(config([tables]),{
      now:current,channel:'online',excludedPromotionIds:['central-tables'],rotationKey:10});
    expect(result).toMatchObject({campaignId:'central-tables',repeatPurchase:true});
    expect(result.startsOn).toBeUndefined();
  });
  it('una promoción permanente usada puede volver a anunciarse sin aplicar un descuento nuevo',()=>{
    const ad=selectTicketAdvertisement(config([always[0]]),{
      now:new Date('2026-11-02T16:30:00Z'),channel:'online',
      excludedPromotionIds:['always-0'],rotationKey:1
    });
    expect(ad).toMatchObject({campaignId:'always-0',repeatPurchase:true,layout:'B'});
    expect(ad.terms).toContain('Solo online');
  });
  it('rota las campañas semanales y de tablas próximas junto con las permanentes',()=>{
    const day=new Date('2026-11-09T16:30:00Z'); // lunes, cuatro días antes del segundo viernes
    const promotions=config([weekly,tables,...always]);
    const output=Array.from({length:6},(_,i)=>selectTicketAdvertisement(promotions,{
      now:day,channel:'online',rotationKey:i
    }));
    expect(new Set(output.map(o=>o.campaignId)).size).toBe(6);
    expect(output.map(o=>o.campaignId)).toContain('weekly-meals');
    const coming=output.find(o=>o.campaignId==='central-tables');
    expect(coming.startsOn).toBe('2026-11-13');
    expect(coming.audience).toBe('general');
  });
  it('admite ofertas de mostrador y web aunque el pedido original sea de otro canal',()=>{
    const counter={...always[0],id:'counter',channels:['mostrador']};
    const web={...always[0],id:'web',channels:['online']};
    const both={...always[0],id:'both',channels:['online','mostrador']};
    const variants=Array.from({length:3},(_,i)=>selectTicketAdvertisement(config([counter,web,both]),{
      now:new Date('2026-11-02T16:30:00Z'),channel:'any',rotationKey:i,
      appliedPromotionIds:['counter','web','both']
    }));
    expect(new Set(variants.map(x=>x.campaignId)).size).toBe(3);
    expect(variants.find(x=>x.campaignId==='counter').terms).toContain('Solo mostrador');
    expect(variants.find(x=>x.campaignId==='web').terms).toContain('Solo online');
    expect(variants.find(x=>x.campaignId==='both').terms).toContain('Web y mostrador');
    expect(variants.every(x=>x.repeatPurchase)).toBe(true);
  });
  it('si todavía no comenzó la promoción, anuncia fecha de próxima aplicación',()=>{
    const ad=selectTicketAdvertisement(config([tables]),{
      now:new Date('2026-11-12T16:00:00Z'),channel:'any',rotationKey:5
    });
    expect(ad).toMatchObject({campaignId:'central-tables',startsOn:'2026-11-13'});
  });
  it('no inventa anuncios si el servidor los deshabilitó',()=>{
    const off=config([weekly]);off.ticket.enabled=false;
    expect(selectTicketAdvertisement(off,{now:new Date('2026-11-02T16:30:00Z')})).toBeNull();
  });
});
