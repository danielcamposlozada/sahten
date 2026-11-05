import {PaymentError} from './core.js';
import { createPaymentService } from './service.js';
import { createDeliveryRepository } from '../delivery/repository.js';

/** Las claves de servicio solo existen en el proceso de Edge Functions. */
export function paymentHandler({ url, serviceKey, anonKey, fetchImpl = fetch }) {
  async function request(path, { method = 'GET', body, token = serviceKey } = {}) {
    const r = await fetchImpl(url + path, { method, headers: { apikey: token === serviceKey ? serviceKey : anonKey, Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' }, body: body === undefined ? undefined : JSON.stringify(body), signal: AbortSignal.timeout(8000) });
    let data; try { data = await r.json(); } catch { data = null; }
    if (!r.ok) { if(/^coupon_/.test(data?.message||''))throw new PaymentError('El cupón no está disponible o tiene un pago pendiente. Revisá el estado de la compra anterior.',409,data.message); const e = new Error('database_error'); e.code = ['checkout_conflict','checkout_expired','checkout_busy'].includes(data?.message) ? data.message : 'database_error'; throw e; }
    return data;
  }
  const repo = {
    findCheckout:(sid,rid,hash)=>request('/rest/v1/rpc/sahten_mp_checkout_request',{method:'POST',body:{p_store_id:sid,p_request_id:rid,p_proof_hash:hash}}),
    lookupCoupon:(sid,digest,phone,rid)=>request('/rest/v1/rpc/sahten_customer_coupon_lookup',{method:'POST',body:{p_store_id:sid,p_digest:digest,p_phone:phone,p_request_id:rid}}),
    releaseCoupon:(id,hash)=>request('/rest/v1/rpc/sahten_mp_release_coupon',{method:'POST',body:{p_checkout_id:id,p_proof_hash:hash}}),
    run: (action, args) => request('/rest/v1/rpc/sahten_mp_backend', { method: 'POST', body: { action, args } }),
    async menu(storeId) { const rows = await request('/rest/v1/menus?select=json&store_id=eq.' + storeId); return rows?.[0]?.json; },
    async promotionCosts(storeId,channel='mostrador') { return await request('/rest/v1/rpc/sahten_promotion_costs',{method:'POST',body:{sid:storeId,channel}}); },
    async canManage(storeId, user) {
      const rows = await request('/rest/v1/stores?select=id,owner,project_id&id=eq.' + storeId, { token: user.token });
      const store = rows?.[0]; if (!store) return false;
      if (store.owner === user.id) return true;
      if (!store.project_id) return false;
      return await request('/rest/v1/rpc/has_project_role', { method: 'POST', token: user.token, body: { pid: store.project_id, roles: ['owner', 'admin'] } }) === true;
    },
  };
  async function authenticate(req) {
    const h = req.headers.get('authorization') || '', token = h.startsWith('Bearer ') ? h.slice(7) : '';
    if (!token || token === anonKey || token === serviceKey) return null;
    try { const user = await request('/auth/v1/user', { token }); return user?.id ? { id: user.id, token } : null; } catch { return null; }
  }
  async function originKey(req) {
    const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(serviceKey), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
    const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown';
    return [...new Uint8Array(await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(ip)))].map(b => b.toString(16).padStart(2, '0')).join('');
  }
  const delivery = createDeliveryRepository({url,serviceKey,anonKey,fetchImpl});
  return createPaymentService({ repo, authenticate, originKey, fetchImpl, endpoint: url + '/functions/v1/sahten-payments', resolveDelivery:delivery.resolveDelivery });
}
