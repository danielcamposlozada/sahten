import { createPaymentService } from './service.js';
import { createDeliveryRepository } from '../delivery/repository.js';

/** Las claves de servicio solo existen en el proceso de Edge Functions. */
export function paymentHandler({ url, serviceKey, anonKey, fetchImpl = fetch }) {
  async function request(path, { method = 'GET', body, token = serviceKey } = {}) {
    const r = await fetchImpl(url + path, { method, headers: { apikey: token === serviceKey ? serviceKey : anonKey, Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' }, body: body === undefined ? undefined : JSON.stringify(body), signal: AbortSignal.timeout(8000) });
    let data; try { data = await r.json(); } catch { data = null; }
    if (!r.ok) { const e = new Error('database_error'); e.code = ['checkout_conflict','checkout_expired','checkout_busy'].includes(data?.message) ? data.message : 'database_error'; throw e; }
    return data;
  }
  const repo = {
    run: (action, args) => request('/rest/v1/rpc/sahten_mp_backend', { method: 'POST', body: { action, args } }),
    async menu(storeId) { const rows = await request('/rest/v1/menus?select=json&store_id=eq.' + storeId); return rows?.[0]?.json; },
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
