import { salesPaused } from '../core/sales-availability.js';
import { deliveryDetails, cashChangeQuote, cashOrderFields } from '../core/order-details.js';
import { shippingFor, deliverySnapshot } from '../core/delivery.js';
import { paymentDiscountQuote } from '../core/payment-benefit.js';
import { quotePromotions } from '../core/promotions.js';
import { selectTicketAdvertisement } from '../core/ticket-advertising.js';
import { serviceHoursStatus, serviceHoursMessage } from '../core/service-hours.js';

export class PaymentError extends Error {
  constructor(message, status = 400, code = 'invalid_request') { super(message); this.status = status; this.code = code; }
}
export const fail = (message, status = 400, code) => { throw new PaymentError(message, status, code); };
export const cents = value => {
  const n = Number(value);
  if (!Number.isFinite(n) || n < 0 || n > 100000000) fail('Importe fuera de rango.');
  return Math.round(n * 100);
};
const text = (v, max) => String(v ?? '').trim().slice(0, max);
export const validUuid = s => /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(s || '');
export function siteUrl(value) {
  let u; try { u = new URL(value); } catch { fail('Indicá la dirección HTTPS de la tienda.'); }
  if (u.protocol !== 'https:' || u.username || u.password || u.search || u.hash) fail('La tienda necesita una URL HTTPS sin parámetros.');
  return u.href.replace(/\/$/, '');
}

/** El navegador aporta identificadores y cantidades; los importes siempre vienen del menú. */
export function quoteOrder(menu, input, {route=null,authorization=null,allowOtherPayments=false,validateCustomer=true,requireCustomer=true,salesChannel='online',commercialDiscount=null,allowedMethods=[],trustedCoupon=null,verifiedCustomerId=null,trustedCosts={},now=Date.now()}={}) {
  if (!menu?.products?.length || menu.config?.enabled === false || menu.config?.showPrices === false) fail('La tienda no recibe compras online.', 409);
  const method=allowOtherPayments?input.paymentMethod:'mercadopago';
  if (allowOtherPayments ? !menu.payments?.methods?.[method]&&!allowedMethods.includes(method) : menu.payments?.methods?.mercadopago === false) fail('Este negocio no acepta ese medio de pago en este menú.', 409, 'not_configured');
  const currency = menu.store?.currency;
  if (currency && ((currency.symbol && currency.symbol !== '$') || (currency.locale && currency.locale !== 'es-AR') || (currency.code && currency.code !== 'ARS'))) fail('Esta conexión permite cobros en pesos argentinos.', 409);
  if (!Array.isArray(input.items) || !input.items.length || input.items.length > 100) fail('Revisá los productos del pedido.');
  const quantities = new Map();
  for (const item of input.items) {
    const id = text(item.productId || item.id, 150), qty = Number(item.qty);
    if (!id || !Number.isInteger(qty) || qty < 1 || qty > 99) fail('Cantidad de producto no válida.');
    quantities.set(id, (quantities.get(id) || 0) + qty);
    if (quantities.get(id) > 99) fail('Demasiadas unidades del mismo producto.');
  }
  const items = [...quantities].map(([id, qty]) => {
    const p = menu.products.find(p => p.id === id);
    if (!p || p.recetaOnly || salesPaused(p,now) || menu.config?.hiddenProducts?.includes(id) || menu.config?.hiddenCategories?.includes(p.category)) fail('Un producto ya no está disponible. Actualizá el menú.', 409, 'menu_changed');
    const price = cents(p.price); if (!price) fail('Un producto no tiene precio de venta.', 409);
    return { productId: id, name: text(p.name, 200), qty, unitPrice: price / 100, lineTotal: price * qty / 100, ...(p.priceRevision ? { priceRevision: text(p.priceRevision, 100) } : {}) };
  });
  const sub = items.reduce((n, i) => n + cents(i.lineTotal), 0);
  const source = input.source;
  if (!['pickup', 'delivery'].includes(source)) fail('Elegí retiro o delivery.');
  if (source === 'pickup' && validateCustomer && salesChannel !== 'mostrador') {
    const opening = serviceHoursStatus(menu, 'pickup', now);
    if (!opening.open) fail(serviceHoursMessage(opening), 409, opening.valid ? 'pickup_closed' : 'opening_hours_invalid');
  }
  const name = text(input.customerName, 100), phone = text(input.customerPhone, 40);
  if (validateCustomer && requireCustomer && (name.length < 2 || phone.replace(/\D/g, '').length < 7)) fail('Completá nombre y teléfono.');
  const paymentPolicy=menu.payments?.benefit||{};
  const paymentAllowed=paymentPolicy.enabled===true && paymentPolicy.channels?.[salesChannel]!==false;
  const promotion=menu.promotions?.enabled===true ? quotePromotions({
    lines:items,method,channel:salesChannel,now:new Date(now),
    config:{...menu.promotions,minMarginPct:40,requireVerifiedCosts:true,paymentPercent:paymentAllowed?paymentPolicy.percent:0},
    // Sólo se acepta una recompensa verificada por el servidor; se ignora input.coupon.
    coupon:trustedCoupon,customerId:verifiedCustomerId,trustedCosts,
    commissionPercent:method==='mercadopago'?Math.max(0,Number(menu.promotions.checkoutProFeePercent)||10):0,
  }) : null;
  const oldBenefit=promotion?null:paymentDiscountQuote(sub/100,method,paymentPolicy,salesChannel,commercialDiscount);
  const hasPaymentBenefit=paymentAllowed&&['efectivo','transferencia'].includes(method);
  const benefit=promotion
    ? {amount:promotion.discount,label:promotion.discount?'Promociones y beneficios':'',
        paymentDiscount:promotion.lines.every(l=>l.promotionDiscount===0)&&hasPaymentBenefit
          ? paymentDiscountQuote(sub/100,method,paymentPolicy,salesChannel).paymentDiscount:null}
    : oldBenefit;
  let shipping = 0, zoneName = '', lat = null, lng = null, address = 'Retiro en local', shippingQuote=null;
  if (source === 'delivery') {
    if (menu.delivery?.enabled === false) fail('El delivery está pausado por el local. Podés elegir retiro.',409,'service_paused');
    lat = Number(input.lat); lng = Number(input.lng); address = text(input.address, 300);
    if (input.lat == null || input.lng == null || !Number.isFinite(lat) || !Number.isFinite(lng) || Math.abs(lat) > 90 || Math.abs(lng) > 180 || address.length < 5) fail('Seleccioná una dirección de entrega válida.');
    const modern=menu.delivery?.deliveryV2?.active;
    const ship = shippingFor(menu.delivery, lat, lng, sub/100-(modern?benefit.amount:0),{route,authorization,now,hasPaymentDiscount:promotion?hasPaymentBenefit:!!benefit.paymentDiscount});
    if (!ship.ok && validateCustomer) fail(ship.belowMin ? 'No se alcanza el pedido mínimo de delivery.' : ship.status==='closed'?'El delivery está fuera de horario. Volvé durante el horario de atención.':ship.status==='hours_invalid'?'El horario de delivery necesita revisión del local.':ship.status==='authorization_required'?'La entrega requiere autorización del local.':ship.status==='route_unverified'?'No se pudo validar la ruta por calles.':'La dirección está fuera de cobertura o no está habilitada para entrega.',409,ship.status||'invalid_delivery');
    shippingQuote=ship;
    shipping = cents(ship.cost); zoneName = text(ship.zone?.name, 100);
  }
  const total = sub - cents(benefit.amount) + shipping;
  if (!Number.isSafeInteger(total) || total < 1 || total > 10000000000) fail('Total fuera de rango.');
  const cash = cashChangeQuote(total / 100, input.cashTendered, method);
  if (validateCustomer && !cash.valid) fail('El efectivo indicado no alcanza el total del pedido.');
  return { ...deliveryDetails(input, source), ...cashOrderFields(total / 100, input.cashTendered, method), source, customerName: name, customerPhone: phone, customerEmail: text(input.customerEmail, 150), address, lat, lng, zoneName,
    paymentMethod: method, items, subtotal: sub / 100, shipping: shipping / 100, discount: benefit.amount, ...(benefit.amount?{discountAmount:benefit.amount,discountName:benefit.label,paymentDiscount:benefit.paymentDiscount}:{}), ...(promotion?{promotionSnapshot:promotion,promotionTicketSnapshot:selectTicketAdvertisement(menu.promotions,{now:new Date(now),channel:salesChannel})}:{}), total: total / 100, notes: text(input.notes, 1000),
    ...(shippingQuote?.version===2?{deliverySnapshot:deliverySnapshot(shippingQuote,route,authorization),...(validateCustomer?{}:{shippingQuote})}:{}) };
}

/** Desglosa exactamente el total del checkout en importes válidos para Mercado Pago.
 * No crea rebajas: usa ÚNICAMENTE el pedido ya recotizado por el servidor.
 * Los redondeos de centavos se distribuyen sin alterar el total ni los SKU. */
export function paymentPreferenceItems(order) {
  if (!Array.isArray(order?.items) || !order.items.length) fail('El pedido no tiene productos válidos.',409,'payment_mismatch');
  const source=order.items.map(item=>{
    const qty=Number(item.qty);
    if(!Number.isSafeInteger(qty)||qty<1||qty>99)fail('Cantidad de pago inválida.',409,'payment_mismatch');
    const unit=cents(item.unitPrice);
    if(unit<=0)fail('Precio de pago inválido.',409,'payment_mismatch');
    return {id:String(item.productId),name:String(item.name),qty,base:unit*qty};
  });
  const gross=source.reduce((n,l)=>n+l.base,0);
  if(gross!==cents(order.subtotal))fail('El subtotal del pedido cambió.',409,'payment_mismatch');
  const reduction=cents(order.discount||0);
  if(reduction>gross)fail('El descuento del pedido no es válido.',409,'payment_mismatch');
  const snapshot=order.promotionSnapshot;
  let net;
  if(snapshot) {
    if(!Array.isArray(snapshot.lines)||snapshot.lines.length!==source.length||
      cents(snapshot.subtotal)!==gross||cents(snapshot.discount)!==reduction||
      cents(snapshot.netSubtotal)!==gross-reduction)
      fail('Las promociones del pedido no coinciden con el cobro.',409,'payment_mismatch');
    const map=new Map();
    for(const line of snapshot.lines) {
      if(map.has(line.productId))fail('Líneas de promoción duplicadas.',409,'payment_mismatch');
      map.set(line.productId,line);
    }
    net=source.map(l=>{
      const q=map.get(l.id);
      if(!q||Number(q.qty)!==l.qty||cents(q.base)!==l.base||
        cents(q.net)+cents(q.discount)!==l.base)
        fail('Línea de descuento inválida.',409,'payment_mismatch');
      return cents(q.net);
    });
  } else {
    // Beneficios no asignados a SKU: distribuirlos proporcionalmente entre
    // productos, con resto en centavos y criterio estable por índice.
    const portions=source.map((l,index)=>{
      const exact=l.base*reduction/gross;
      return {index,discount:Math.floor(exact),fraction:exact-Math.floor(exact)};
    });
    let left=reduction-portions.reduce((n,x)=>n+x.discount,0);
    for(const p of [...portions].sort((a,b)=>b.fraction-a.fraction||a.index-b.index)) {
      if(left--<=0)break;
      p.discount+=1;
    }
    net=source.map((l,index)=>l.base-portions[index].discount);
  }
  if(net.reduce((n,x)=>n+x,0)!==gross-reduction)
    fail('Los descuentos no cierran con el pedido.',409,'payment_mismatch');
  const result=[];
  for(let i=0;i<source.length;i++){
    const item=source[i],amount=net[i];
    if(amount<0||amount>item.base)fail('Importe de producto inválido.',409,'payment_mismatch');
    const floor=Math.floor(amount/item.qty),remainder=amount%item.qty;
    // Mercado Pago requiere unit_price decimal. Dos grupos como máximo por SKU
    // representan el mismo producto, con diferencias de a lo sumo 1 centavo.
    for(const [quantity,unitCents] of [[remainder,floor+1],[item.qty-remainder,floor]]) {
      if(!quantity||!unitCents)continue; // unidades bonificadas a precio cero
      result.push({id:item.id,title:item.name,currency_id:'ARS',quantity,unit_price:unitCents/100});
    }
  }
  const shipping=cents(order.shipping||0);
  if(shipping)result.push({id:'shipping',title:'Envío',currency_id:'ARS',quantity:1,unit_price:shipping/100});
  const charged=result.reduce((n,l)=>n+cents(l.unit_price)*l.quantity,0);
  if(!result.length||charged!==cents(order.total)||charged!==gross-reduction+shipping)
    fail('El cobro no coincide con el total del pedido.',409,'payment_mismatch');
  return result;
}

export function buildPreference(checkout, account, endpoint, now = Date.now()) {
  const base = siteUrl(account.site_url);
  const back = new URL(base); back.searchParams.set('mp_checkout', checkout.id);
  const notification = new URL(endpoint + '/webhook'); notification.searchParams.set('store_id', checkout.store_id);
  const order = checkout.order;
  const items = paymentPreferenceItems(order);
  return { items, external_reference: checkout.id, metadata: { sahten_store_id: checkout.store_id, sahten_checkout_id: checkout.id },
    back_urls: { success: back.href, pending: back.href, failure: back.href }, auto_return: 'approved', notification_url: notification.href,
    expires: true, expiration_date_from: new Date(now).toISOString(), expiration_date_to: new Date(now + 30 * 60000).toISOString(),
    // Evita tickets de pago diferido para comida preparada al momento. No captura datos de tarjeta en Sahten.
    payment_methods: { excluded_payment_types: [{ id: 'ticket' }, { id: 'atm' }] } };
}
export function checkoutUrl(preference) {
  // Checkout Pro usa init_point también con vendedores de prueba.
  const value = preference.init_point;
  let u; try { u = new URL(value); } catch { fail('Mercado Pago no devolvió un checkout válido.', 502); }
  if (u.protocol !== 'https:' || !/^(?:(?:www|sandbox)\.)?mercadopago\.com(?:\.ar)?$/.test(u.hostname)) fail('Dirección de checkout no válida.', 502);
  return u.href;
}
export async function sha256(value) {
  return [...new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value)))].map(b => b.toString(16).padStart(2, '0')).join('');
}

/** Firma de Payments API: data.id se toma de la query firmada, nunca del estado informado por el cliente. */
export async function verifyWebhook(request, secret, now = Date.now()) {
  const id = new URL(request.url).searchParams.get('data.id');
  const reqId = request.headers.get('x-request-id') || '';
  const signature = request.headers.get('x-signature') || '';
  const parts = signature.split(',').map(v => v.trim().split('='));
  const ts = parts.find(([k]) => k === 'ts')?.[1];
  const hashes = parts.filter(([k]) => k === 'v1').map(([, v]) => v);
  if (!id || !/^[a-zA-Z0-9_-]{1,100}$/.test(id) || !reqId || reqId.length > 200 || !/^\d{10,13}$/.test(ts || '') || !secret) return false;
  const stamp = Number(ts) * (ts.length <= 10 ? 1000 : 1);
  if (Math.abs(now - stamp) > 10 * 60000) return false;
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['verify']);
  const data = new TextEncoder().encode(`id:${id.toLowerCase()};request-id:${reqId};ts:${ts};`);
  for (const hash of hashes) {
    if (!/^[a-f0-9]{64}$/i.test(hash || '')) continue;
    const bytes = Uint8Array.from(hash.match(/../g), h => parseInt(h, 16));
    if (await crypto.subtle.verify('HMAC', key, bytes, data)) return true;
  }
  return false;
}

export function verifiedPayment(payment, checkout, account) {
  if (String(payment.external_reference) !== checkout.id || String(payment.collector_id) !== String(account.account_id) || payment.currency_id !== 'ARS') fail('El pago no corresponde a esta compra.', 409, 'payment_mismatch');
  // Las cuentas ficticias actuales usan APP_USR y pueden informar live_mode=true.
  // El alta ya verificó test_user; el modo guardado impide crear ventas reales.
  const testUserApi = account.mode === 'test' && account.credentials?.accessToken?.startsWith('APP_USR-');
  if (typeof payment.live_mode !== 'boolean' || (account.mode === 'production' ? !payment.live_mode : payment.live_mode && !testUserApi)) fail('El pago y la conexión usan ambientes distintos.', 409, 'payment_environment_mismatch');
  if (payment.metadata?.sahten_store_id && payment.metadata.sahten_store_id !== checkout.store_id) fail('El pago pertenece a otra tienda.', 409);
  const amount = cents(payment.transaction_amount), refunded = payment.status === 'refunded' ? amount : cents(payment.transaction_amount_refunded || 0);
  if (amount < 1 || amount > cents(checkout.order.total) || refunded > amount || !/^\d+$/.test(String(payment.id))) fail('El importe del pago no coincide.', 409, 'payment_mismatch');
  const statuses = ['approved', 'pending', 'in_process', 'in_mediation', 'rejected', 'cancelled', 'refunded', 'charged_back'];
  if (!statuses.includes(payment.status)) fail('Estado de pago desconocido.', 409);
  const updated = Date.parse(payment.date_last_updated); if (!Number.isFinite(updated)) fail('El pago no informa su fecha de actualización.', 409);
  return { id: String(payment.id), status: payment.status, amount_cents: amount, refunded_cents: refunded, updated_at: new Date(updated).toISOString() };
}
