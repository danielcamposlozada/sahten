import {describe,it,expect} from 'vitest';
import {activeCampaigns,quotePromotions,scheduleMatches} from '../src/core/promotions.js';
import {selectTicketAdvertisement} from '../src/core/ticket-advertising.js';
const campaigns=[
  {id:'central-tables',kind:'public',enabled:true,priority:9,channels:['online','mostrador'],schedule:{type:'central_weekends'},
    advertising:{enabled:true,message:'Tablas centrales',placement:['ticket']}},
  ...['postres-extra-online-nov26','postres-mamul-extra-nov26','fatay-adicional-moderado-nov26','falafel-mix-moderado-nov26']
    .map((id,i)=>({id,kind:'public',enabled:true,priority:34+i,channels:['online'],schedule:null,
      productIds:['baklava'],extraPercent:2,maxUnits:1,minMarginPct:40,advertising:{
        enabled:true,placement:['ticket','cart','checkout'],message:'Próxima compra online: '+id}}))
];
const config={enabled:true,ticket:{enabled:true,advertise:true},paymentPercent:10,campaigns};
describe('Ticket de cliente y campañas publicadas sin calendario',()=>{
  it('interpreta calendario null como siempre activo, sin activar reglas inválidas',()=>{
    const when=new Date('2026-11-02T16:30:00Z');
    expect(scheduleMatches(null,when)).toBe(true);
    expect(scheduleMatches({},when)).toBe(false);
    expect(activeCampaigns(config,when,'online')).toHaveLength(4);
  });
  it('cotiza descuento publicado sin romper el checkout y conserva el margen verificado',()=>{
    const quote=quotePromotions({lines:[{productId:'baklava',qty:1,unitPrice:7350}],
      method:'transferencia',channel:'online',config,trustedCosts:{baklava:3536.19},
      now:new Date('2026-11-02T16:30:00Z')});
    expect(quote.appliedPromotionIds.length).toBeGreaterThan(0);
    expect(quote.discount).toBe(882);
    const unverified=quotePromotions({lines:[{productId:'baklava',qty:1,unitPrice:7350}],
      method:'transferencia',channel:'online',config,trustedCosts:{},
      now:new Date('2026-11-02T16:30:00Z')});
    expect(unverified.discount).toBe(735);
  });
  it('rota anuncios según número de pedido sin bloquear campañas ya aprovechadas',()=>{
    const when=new Date('2026-11-02T16:30:00Z');
    const a=selectTicketAdvertisement(config,{channel:'online',now:when,rotationKey:0});
    const b=selectTicketAdvertisement(config,{channel:'online',now:when,rotationKey:1});
    expect(a.kind).toBe('campaign');
    expect(a.headline).toMatch(/Próxima compra online/);
    expect(a.campaignId).not.toEqual(b.campaignId);
    const reused=selectTicketAdvertisement(config,{channel:'online',now:when,rotationKey:0,
      appliedPromotionIds:[a.campaignId]});
    expect(reused.campaignId).toEqual(a.campaignId);
    expect(reused.repeatPurchase).toBe(true);
  });
  it('no muestra promoción si ticket deshabilitado, ni inventa cupones',()=>{
    expect(selectTicketAdvertisement({...config,ticket:{enabled:false}},{})).toBeNull();
    expect(selectTicketAdvertisement({enabled:true,ticket:{enabled:true},campaigns:[]},{})).toBeNull();
  });
});
