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
  it('no vuelve a destacar una edición semanal aplicada, pero anuncia la semana SIGUIENTE como campaña general',()=>{
    const now=new Date('2026-11-02T16:30:00Z'); // lunes en Buenos Aires
    const result=selectTicketAdvertisement(config([weekly]),{
      now,channel:'online',excludedPromotionIds:['weekly-meals'],rotationKey:30});
    expect(result).toMatchObject({
      kind:'campaign',audience:'general',campaignId:'weekly-meals',
      startsOn:'2026-11-09',repeatEdition:true
    });
    const html=buildReceipt({num:30,createdAt:now.toISOString(),source:'pickup',
      items:[],subtotal:100,total:100,promotionTicketSnapshot:result},
      {paper:receiptProfile(58)});
    expect(html).toContain('PRÓXIMA EDICIÓN · CAMPAÑA GENERAL');
    expect(html).toContain('Desde 09/11');
    expect(html).not.toContain('PARA TU PRÓXIMA COMPRA');
    const kitchen=buildKitchenReceipt({num:30,createdAt:now.toISOString(),source:'pickup',items:[]},
      {paper:receiptProfile(58)});
    expect(kitchen).not.toContain('receipt-promo');
  });
  it('una tabla ya usada solo puede anunciarse para el siguiente fin de semana, nunca el mismo',()=>{
    const current=new Date('2026-11-13T16:00:00Z'); // segundo viernes
    const result=selectTicketAdvertisement(config([tables]),{
      now:current,channel:'online',excludedPromotionIds:['central-tables'],rotationKey:10});
    expect(result).toMatchObject({campaignId:'central-tables',startsOn:'2026-11-20',repeatEdition:true});
  });
  it('una promoción permanente aplicada no vuelve a imprimirse como beneficio nuevo',()=>{
    expect(selectTicketAdvertisement(config([always[0]]),{
      now:new Date('2026-11-02T16:30:00Z'),channel:'online',
      excludedPromotionIds:['always-0'],rotationKey:1
    })).toBeNull();
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
  it('no inventa anuncios si el servidor los deshabilitó',()=>{
    const off=config([weekly]);off.ticket.enabled=false;
    expect(selectTicketAdvertisement(off,{now:new Date('2026-11-02T16:30:00Z')})).toBeNull();
  });
});
