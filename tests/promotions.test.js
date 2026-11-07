import { describe, it, expect } from 'vitest';
import { initialPromotionConfig, quotePromotions, localDateParts, scheduleMatches, expiryLabel, FOUR_FATAY_ID } from '../src/core/promotions.js';
const cfg=()=>{const c={...initialPromotionConfig(),enabled:true};c.campaigns[0].enabled=true;c.campaigns[0].productIds=['p1779467294622','sandwich_falafel','shawarma_pollo'];c.campaigns[1].enabled=true;c.campaigns[1].productIds=['tabla_celebrar'];c.upsells[0].enabled=true;c.upsells[0].productIds=['baklava'];c.upsells[0].triggerProductIds=['p1779467294622'];c.upsells[0].suppressIfPresent=['tabla_celebrar'];return c;};
const line=(productId,unitPrice,qty=1)=>({productId,unitPrice,qty});
const at=(s)=>new Date(s+'T15:00:00-03:00');
describe('SAHTEN motor promociones (TZ Buenos Aires)',()=>{
  it('no habilita descuentos comerciales nuevos por defecto',()=>{
    const r=quotePromotions({config:initialPromotionConfig(),lines:[line('p1779467294622',16850)],method:'transferencia',now:at('2026-11-02')});
    expect(r.netSubtotal).toBe(15165);expect(r.appliedPromotionIds).toEqual([]);
  });
  it('de lunes a miércoles 5% checkout/15% transferencia',()=>{
    const order={config:cfg(),lines:[line('p1779467294622',16850)],now:at('2026-11-02')};
    expect(quotePromotions({...order,method:'mercadopago'}).netSubtotal).toBe(16850);
    expect(quotePromotions({...order,method:'mercadopago'}).appliedPromotionIds).toEqual([]);
    expect(quotePromotions({...order,method:'transferencia'}).netSubtotal).toBe(14322.5);
  });
  it('Mercado Pago y medios no habilitados nunca reciben campañas, cupones ni upsells',()=>{
    const c=cfg(),reward={id:'coupon-private',status:'available',expiresOn:'2026-11-14',extraPercent:10,productIds:['p1779467294622']};
    for(const method of ['mercadopago','tarjeta','']){
      const q=quotePromotions({config:c,lines:[line('p1779467294622',16850),line('baklava',7350)],method,coupon:reward,now:at('2026-11-02')});
      expect(q.netSubtotal).toBe(24200);
      expect(q.appliedPromotionIds).toEqual([]);
      expect(q.couponId).toBe(null);
    }
  });
  it('ninguna campaña ni cupón supera 20% total con 10% habitual',()=>{
    const c=cfg();c.campaigns[0].extraPercent=30;
    const r=quotePromotions({config:c,lines:[line('p1779467294622',16850)],method:'transferencia',now:at('2026-11-02')});
    expect(r.netSubtotal).toBe(13480);
    expect(r.lines[0].promotionDiscount).toBe(1685);
  });
  it('los fines de semana centrales son 2° y 3° viernes y sábado, no domingo',()=>{
    for(const d of ['2026-11-13','2026-11-14','2026-11-20','2026-11-21'])
      expect(scheduleMatches({type:'central_weekends'},at(d))).toBe(true);
    for(const d of ['2026-11-06','2026-11-07','2026-11-15','2026-11-27'])
      expect(scheduleMatches({type:'central_weekends'},at(d))).toBe(false);
  });
  it('desactiva campañas fuera de vigencia y por fecha excluida',()=>{
    expect(scheduleMatches({type:'weekly',weekdays:[1,2,3],excludedDates:['2026-11-02']},at('2026-11-02'))).toBe(false);
  });
  it('no suma campaña pública y cupón personal en la misma línea',()=>{
    const reward={id:'second',status:'available',name:'Segunda compra',channel:'online',expiresOn:'2026-11-14',customerId:'c1',
      productIds:['p1779467294622'],minEligibleSubtotal:10000,extraPercent:10,maxExtraAmount:4000};
    const r=quotePromotions({config:cfg(),lines:[line('p1779467294622',16850)],method:'transferencia',channel:'online',customerId:'c1',coupon:reward,now:at('2026-11-02')});
    expect(r.netSubtotal).toBe(13480);expect(r.couponId).toBe('second');expect(r.appliedPromotionIds).toEqual(['second']);
  });
  it('no permite usar cupones vencidos ni de otro cliente',()=>{
    const c={id:'first',status:'available',expiresOn:'2026-11-01',customerId:'c1',productIds:['p1779467294622'],extraPercent:10};
    expect(quotePromotions({config:cfg(),lines:[line('p1779467294622',16850)],now:at('2026-11-02'),coupon:c,customerId:'c1'}).couponId).toBe(null);
    expect(quotePromotions({config:cfg(),lines:[line('p1779467294622',16850)],now:at('2026-11-01'),coupon:c,customerId:'c2'}).couponId).toBe(null);
  });
  it('sólo la primera Baklava ofrecida recibe beneficio adicional',()=>{
    const r=quotePromotions({config:cfg(),lines:[line('p1779467294622',16850),line('baklava',7350,2)],method:'transferencia',now:at('2026-11-02')});
    const b=r.lines.find(l=>l.productId==='baklava');
    expect(b.paymentDiscount).toBe(1470);expect(b.promotionDiscount).toBe(735);
  });
  it('no ofrece Baklava duplicada con Tabla para Celebrar',()=>{
    const r=quotePromotions({config:cfg(),lines:[line('tabla_celebrar',38550),line('baklava',7350)],method:'transferencia',now:at('2026-11-13')});
    expect(r.lines.find(l=>l.productId==='baklava').promotionDiscount).toBe(0);
  });
  it('cuarta fatay sólo 10% permanente (sin campaña ni cupón)',()=>{
    const c={id:'X',status:'available',expiresOn:'2026-12-31',extraPercent:50,productIds:[FOUR_FATAY_ID]};
    const r=quotePromotions({config:cfg(),lines:[line(FOUR_FATAY_ID,18500)],method:'transferencia',coupon:c,now:at('2026-11-02')});
    expect(r.netSubtotal).toBe(16650);expect(r.lines[0].appliedPromotionId).toBe(null);
  });
  it('controla costo, margen, comisión y umbral, pero conserva el 10% habitual',()=>{
    const c={...cfg(),minMarginPct:40};
    const r=quotePromotions({config:c,lines:[line('shawarma_pollo',16000)],trustedCosts:{shawarma_pollo:9500},commissionPercent:8,method:'mercadopago',now:at('2026-11-02')});
    expect(r.lines[0].appliedPromotionId).toBe(null);expect(r.netSubtotal).toBe(16000);
  });
  it('si un cupón alcanza su tope se recupera la campaña pública compatible en la siguiente línea',()=>{
    const coupon={id:'second',status:'available',expiresOn:'2026-11-14',extraPercent:10,maxExtraAmount:1000,
      productIds:['p1779467294622','sandwich_falafel']};
    const r=quotePromotions({config:cfg(),now:at('2026-11-02'),method:'transferencia',
      lines:[line('p1779467294622',16850),line('sandwich_falafel',15800)],coupon});
    expect(r.lines[0].appliedPromotionId).toBe('second');
    expect(r.lines[0].promotionDiscount).toBe(1000);
    expect(r.lines[1].appliedPromotionId).toBe('weekly-meals');
    expect(r.lines[1].promotionDiscount).toBe(790);
  });
  it('rechaza ofertas que llevan el neto a cero aunque el costo declarado sea cero',()=>{
    const p=cfg();p.campaigns[0].extraPercent=100;p.paymentPercent=0;
    const r=quotePromotions({config:p,lines:[line('p1779467294622',16850)],
      trustedCosts:{p1779467294622:0},method:'mercadopago',now:at('2026-11-02')});
    expect(r.netSubtotal).toBe(16850);
    expect(r.appliedPromotionIds).toEqual([]);
  });
  it('expone fecha límite clara al cliente',()=>{
    expect(expiryLabel('2026-11-14')).toBe('Válido hasta el 14/11/2026');
  });
  it('usa la revisión del servidor solo en cupones web y para el precio que se revisó',()=>{
    const input={config:{enabled:true,requireVerifiedCosts:true,minMarginPct:40,paymentPercent:10},
      lines:[line('verified',10000,2),line('quoted',10000,2)],
      trustedCosts:{verified:5600},method:'transferencia',now:at('2026-11-07')};
    const coupon={id:'first',program:'first_online',channel:'online',status:'available',expiresOn:'2026-11-30',
      productIds:['verified','quoted'],totalPercent:15,minEligibleSubtotal:30000,
      mercadopago:{enabled:true,totalPercent:5,minEligibleSubtotal:0},
      coverageApproval:{verified:{price:10000,cashPercent:15,mpPercent:5,mpFeePercent:10},
        quoted:{price:10000,cashPercent:15,mpPercent:5,mpFeePercent:10}}};
    const quote=quotePromotions({...input,coupon});
    expect(quote.lines.map(l=>l.discount)).toEqual([3000,3000]);
    expect(quotePromotions({...input,method:'mercadopago',commissionPercent:10,coupon}).lines.map(l=>l.discount)).toEqual([1000,1000]);
    expect(quotePromotions({...input,method:'mercadopago',commissionPercent:11,coupon}).couponId).toBeNull();
    expect(quotePromotions({...input,coupon:{...coupon,program:'manual'}}).couponId).toBeNull();
    expect(quotePromotions({...input,coupon,lines:[line('verified',9900,4)]}).couponId).toBeNull();
    expect(quotePromotions({...input,coupon,lines:[line('quoted',10000,2)]}).couponId).toBeNull();
    const second={...coupon,program:'second_online',totalPercent:20,minEligibleSubtotal:40000,maxExtraAmount:4000,
      coverageApproval:Object.fromEntries(Object.entries(coupon.coverageApproval).map(([id,row])=>[id,{...row,cashPercent:20}]))};
    expect(quotePromotions({...input,coupon:second}).discount).toBe(8000);
  });
});
