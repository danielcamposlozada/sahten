import { describe,it,expect } from 'vitest';
import { quoteOrder } from '../src/payments/core.js';
import { selectTicketAdvertisement } from '../src/core/ticket-advertising.js';
import { initialPromotionConfig } from '../src/core/promotions.js';
import { buildReceipt } from '../src/ui/receipt-template.js';
import { receiptProfile } from '../src/ui/receipt-paper.js';
import { promotionReport } from '../src/core/promotions-report.js';
const at='2026-11-02T15:00:00-03:00';
const menu=()=>({products:[{id:'p1779467294622',name:'Promo Fatay (3U)',price:16850}],store:{currency:{symbol:'$',locale:'es-AR'}},
  config:{enabled:true,showPrices:true},payments:{methods:{transferencia:true,mercadopago:true},benefit:{enabled:true,percent:10,channels:{online:true,mostrador:true}}},
  delivery:{enabled:true},promotions:{...initialPromotionConfig(),enabled:true,checkoutProFeePercent:8}});
const input=(method)=>({source:'pickup',customerName:'Prueba',customerPhone:'1133335555',paymentMethod:method,
  items:[{productId:'p1779467294622',qty:1}],notes:'Sin salsa'});
describe('integración v1: orden y ticket',()=>{
  it('calcula un beneficio promocional único en el servidor (sin confiar en descuentos del navegador)',()=>{
    const o=quoteOrder(menu(),{...input('transferencia'),total:1,discountAmount:100000},{allowOtherPayments:true,now:Date.parse(at),
      trustedCosts:{p1779467294622:6775},validateCustomer:false});
    expect(o.total).toBe(14322.5);
    expect(o.promotionSnapshot.version).toBe(1);
    expect(o.promotionSnapshot.appliedPromotionIds).toEqual(['weekly-meals']);
    expect(o.promotionSnapshot.lines[0].paymentDiscount).toBe(1685);
    expect(o.promotionSnapshot.lines[0].promotionDiscount).toBe(842.5);
  });
  it('mantiene la ruta de cálculo anterior cuando el motor está apagado',()=>{
    const m=menu();m.promotions.enabled=false;
    const o=quoteOrder(m,input('transferencia'),{allowOtherPayments:true,now:Date.parse(at),validateCustomer:false});
    expect(o.total).toBe(15165);expect(o.promotionSnapshot).toBeUndefined();
  });
  it('el motor no imprime segunda comanda y deja Google Reviews primero',()=>{
    const cfg=initialPromotionConfig();cfg.enabled=true;cfg.ticket.enabled=true;cfg.campaigns[0].advertising.enabled=true;
    const snapshot=selectTicketAdvertisement(cfg,{now:new Date(at),channel:'mostrador'});
    const html=buildReceipt({num:55,source:'pickup',createdAt:at,customerName:'Cliente',items:[{qty:1,name:'Fatay',lineTotal:16850}],
      subtotal:16850,discountAmount:1685,total:15165,notes:'Para llevar',
      promotionTicketSnapshot:snapshot},{paper:receiptProfile(58),reviewHtml:'<div class="receipt-review">GOOGLE REVIEWS QR</div>'});
    expect(html).toContain('ORDEN #0055');expect(html).toContain('Para llevar');
    expect(html.indexOf('GOOGLE REVIEWS QR')).toBeLessThan(html.indexOf('<section class="receipt-promo">'));
    expect(html.match(/<body>/g)).toHaveLength(1);
  });
  it('reimprimir utiliza la misma instantánea de publicidad; no genera un cupón',()=>{
    const o={num:9,createdAt:at,items:[],source:'pickup',subtotal:100,total:100,
      promotionTicketSnapshot:{kind:'coupon',code:'SHT-ABCDEF',label:'Válido hasta el 14/11/2026',headline:'Tu próxima compra'}};
    expect(buildReceipt(o,{paper:receiptProfile(58)})).toContain('SHT-ABCDEF');
    expect(buildReceipt(o,{paper:receiptProfile(58)})).toContain('SHT-ABCDEF');
  });
  it('resultados calculados sólo sobre snapshots no cancelados',()=>{
    const valid={status:'entregado',promotionSnapshot:{version:1,subtotal:10000,discount:1500,netSubtotal:8500,
      appliedPromotionIds:['campaign'],lines:[{appliedPromotionId:'campaign',qty:1,net:8500,promotionDiscount:500}]}};
    const r=promotionReport([valid,{...valid,status:'cancelado'}]);
    expect(r.orders).toBe(1);expect(r.promotedOrders).toBe(1);
    expect(r.byPromotion.campaign.discount).toBe(500);
  });
});
