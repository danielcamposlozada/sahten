import {describe,it,expect} from 'vitest';
import {ticketAdvertisingHistory,ticketCustomerKeys} from '../src/core/ticket-advertising-history.js';
import {selectTicketAdvertisement} from '../src/core/ticket-advertising.js';
import {buildReceipt} from '../src/ui/receipt-template.js';
import {receiptProfile} from '../src/ui/receipt-paper.js';

const now=new Date('2026-11-02T17:00:00Z');
const mk=(id,at,person='11 4444 5555',campaign='postres')=>({
  id,createdAt:at,customerPhone:person,customerName:'Cliente',
  promotionTicketSnapshot:{kind:'campaign',campaignId:campaign,selectedAt:at}
});
const offer=(id,channels=['online'])=>({
  id,name:id,kind:'public',enabled:true,priority:10,channels,
  schedule:null,advertising:{enabled:true,placement:['ticket'],message:'12% en '+id}
});
const config={enabled:true,ticket:{enabled:true,advertise:true},
  campaigns:[offer('postres'),offer('falafel'),offer('fatay')]};
const select=(order,records,rotationKey=2)=>selectTicketAdvertisement(config,{
  now,channel:'any',rotationKey,appliedPromotionIds:['postres'],
  ...ticketAdvertisingHistory(order,records,{now})
});
describe('Frecuencia de publicidad en tickets de cliente',()=>{
  it('permite publicitar una oferta usada en la compra SI no se anunció antes',()=>{
    const order={id:'new',customerPhone:'1144445555'};
    const output=select(order,[]);
    expect(output).toMatchObject({campaignId:'postres',repeatPurchase:true});
  });
  it('si el mismo cliente recibió una promoción hace 89 días la excluye, pero conserva otras',()=>{
    const order={id:'new',customerPhone:'+54 9 11 4444-5555'};
    const before=new Date(now.getTime()-89*86400000).toISOString();
    const hist=ticketAdvertisingHistory(order,[mk('old',before)],{now});
    expect(hist.identityKnown).toBe(true);
    expect(hist.recentAdvertisements).toHaveLength(1);
    expect(hist.recentAdvertisements[0].campaignId).toBe('postres');
    const result=select(order,[mk('old',before)]);
    expect(result.campaignId).toBe('falafel');
  });
  it('pasados 91 días la misma campaña vuelve a ser elegible',()=>{
    const order={id:'new',customerPhone:'1144445555'};
    const past=new Date(now.getTime()-91*86400000).toISOString();
    expect(select(order,[mk('old',past)]).campaignId).toBe('postres');
  });
  it('otra persona puede recibir la misma oferta aunque un cliente ya la haya visto',()=>{
    const past=new Date(now.getTime()-2*86400000).toISOString();
    expect(select({id:'new',customerPhone:'1166667777'},[mk('old',past)]).campaignId).toBe('postres');
  });
  it('si conoce email o customerId protege a la persona incluso cuando cambia el teléfono',()=>{
    const existing=mk('old',new Date(now.getTime()-10*86400000).toISOString(),'');
    existing.customerEmail='CLIENTE@EXAMPLE.COM';
    existing.customerId='client-39';
    const next={id:'next',customerEmail:'cliente@example.com',customerPhone:'',customerId:null};
    expect(ticketAdvertisingHistory(next,[existing],{now}).recentAdvertisements).toHaveLength(1);
    expect(ticketCustomerKeys({customerName:'Consumidor final'})).toHaveLength(0);
  });
  it('nunca vuelve a anunciar la misma oferta al mismo cliente si ya vio todas, sin ocultar el descuento',()=>{
    const records=['postres','falafel','fatay'].map((id,i)=>mk(
      'prior-'+i,new Date(now.getTime()-(i+1)*86400000).toISOString(),
      '1144445555',id));
    const fresh={id:'current',customerPhone:'1144445555'};
    const ad=select(fresh,records);
    expect(ad).toBeNull();
    const receipt=buildReceipt({
      id:'current',num:12,createdAt:now.toISOString(),source:'pickup',
      customerPhone:fresh.customerPhone,items:[],subtotal:10000,
      discountAmount:1000,total:9000,paymentDiscount:{percent:10},promotionTicketSnapshot:ad
    },{paper:receiptProfile(58)});
    expect(receipt).toContain('Dto. 10 %');
    expect(receipt).not.toContain('class="receipt-promo receipt-promo--B"');
  });
  it('sin identidad confiable evita repetir la última publicidad del negocio, sin fingir que reconoce personas',()=>{
    const records=[
      mk('one',new Date(now.getTime()-3600000).toISOString(),'', 'postres'),
      mk('two',new Date(now.getTime()-7200000).toISOString(),'', 'falafel')
    ];
    const order={id:'anonymous',customerName:'Consumidor final',customerPhone:''};
    const history=ticketAdvertisingHistory(order,records,{now});
    expect(history.identityKnown).toBe(false);
    expect(new Set(history.avoidCampaignIds)).toEqual(new Set(['postres','falafel']));
    expect(select(order,records).campaignId).toBe('fatay');
  });
  it('no autoexcluye el ticket propio al reimprimirlo',()=>{
    const current=mk('current',now.toISOString(),'1144445555');
    const history=ticketAdvertisingHistory(current,[current],{now});
    expect(history.recentAdvertisements).toHaveLength(0);
  });
});
