import { deliveryHours } from '../core/delivery.js';
import { PaymentError, fail, validUuid, siteUrl, quoteOrder, buildPreference, checkoutUrl, sha256, verifyWebhook, verifiedPayment, cents } from './core.js';

const uuid = value => { if (!validUuid(value)) fail('Identificador no válido.'); return value; };
const proof = value => { if (!/^[a-f0-9]{64}$/.test(value || '')) fail('La sesión de compra no es válida.'); return value; };
const publicAccount = a => a ? { connected: true, mode: a.mode, accountLabel: a.account_label, siteUrl: a.site_url } : { connected: false };
const publicCheckout = c => ({ id: c.id, mode: c.mode, paymentStatus: c.payment_status, total: c.order.total, currency: 'ARS', checkoutUrl: ['pending','rejected'].includes(c.payment_status) ? c.checkout_url : null });

/** Inyectable para probar cuentas, importes, permisos y notificaciones sin hacer cobros. */
export function createPaymentService({ repo, authenticate, fetchImpl = fetch, endpoint, now = () => Date.now(), originKey = async () => 'unknown', resolveDelivery = async () => ({}) }) {
  const headers = { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization,apikey,content-type', 'Access-Control-Allow-Methods': 'GET,POST,PUT,DELETE,OPTIONS', 'Cache-Control': 'no-store', 'Referrer-Policy': 'no-referrer' };
  const response = (body, status = 200) => new Response(JSON.stringify(body), { status, headers });
  async function mp(path, token, options = {}) {
    let r;
    try { r = await fetchImpl('https://api.mercadopago.com' + path, { ...options, headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json', ...options.headers }, signal: AbortSignal.timeout(8000) }); }
    catch { fail('Mercado Pago no respondió. Podés reintentar sin duplicar el pedido.', 502, 'provider_unavailable'); }
    if (!r.ok) fail(r.status === 401 || r.status === 403 ? 'Mercado Pago rechazó la credencial. Revisá el Access Token.' : 'No se pudo completar la consulta con Mercado Pago.', r.status === 401 || r.status === 403 ? 400 : 502, 'provider_error');
    return r.json();
  }
  async function admin(req, storeId) {
    const user = await authenticate(req); if (!user?.id) fail('Iniciá sesión para configurar Mercado Pago.', 401);
    if (!await repo.canManage(storeId, user)) fail('Solo el dueño o administrador de este negocio puede configurar Mercado Pago.', 403);
  }
  function checkOrigin(req, account) {
    const origin = req.headers.get('origin');
    if (!origin || origin !== new URL(account.site_url).origin) fail('La compra debe iniciarse desde la web de este negocio.', 403);
  }
  async function limited(bucket, max) { if (!await repo.run('limit', { bucket, max })) fail('Hubo demasiados intentos. Esperá unos minutos y volvé a probar.', 429, 'rate_limited'); }
  async function ownedCheckout(body) {
    const c = await repo.run('checkout', { id: uuid(body.id) });
    if (!c || c.proof_hash !== await sha256(proof(body.proof))) fail('No se encontró esta compra.', 404);
    return c;
  }
  async function reconcile(paymentId, account, expected = null) {
    if (!/^\d{1,30}$/.test(String(paymentId))) fail('Identificador de pago no válido.');
    const p = await mp('/v1/payments/' + paymentId, account.credentials.accessToken);
    if (!validUuid(p.external_reference)) fail('El pago no corresponde a un pedido de esta tienda.', 409);
    const c = expected || await repo.run('checkout', { id: p.external_reference });
    if (!c || c.store_id !== account.store_id || c.account_id !== account.id) fail('El pago no corresponde a esta tienda.', 409);
    const verified = verifiedPayment(p, c, account);
    await repo.run('payment', { ...verified, checkout_id: c.id });
  }
  return async req => {
    if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers });
    try {
      const url = new URL(req.url), route = url.pathname.replace(/\/$/, '').split('/').at(-1);
      if (route === 'config' && req.method === 'GET') {
        const a = await repo.run('account', { store_id: uuid(url.searchParams.get('store_id')) });
        return response({ enabled: !!a && (a.mode === 'production' || url.searchParams.get('test') === '1'), mode: a?.mode || null });
      }
      if (route === 'account' && req.method === 'GET') {
        const sid = uuid(url.searchParams.get('store_id')); await admin(req, sid);
        return response({ ...publicAccount(await repo.run('account', { store_id: sid })), webhookUrl: endpoint + '/webhook?store_id=' + sid });
      }
      // Limitar antes de deserializar: no registrar cuerpos ni errores del proveedor (pueden contener credenciales).
      if (Number(req.headers.get('content-length') || 0) > 20000) fail('Solicitud demasiado grande.', 413);
      const raw = await req.text(); if (raw.length > 20000) fail('Solicitud demasiado grande.', 413);
      let body; try { body = raw ? JSON.parse(raw) : {}; } catch { fail('La solicitud no es válida.'); }
      if (route === 'account' && ['PUT', 'DELETE'].includes(req.method)) {
        const sid = uuid(body.storeId); await admin(req, sid);
        if (req.method === 'DELETE') { await repo.run('disable_account', { store_id: sid }); return response({ connected: false }); }
        const mode = body.mode; if (!['test', 'production'].includes(mode)) fail('Elegí pruebas o producción.');
        const token = String(body.accessToken || '').trim(), secret = String(body.webhookSecret || '').trim();
        if (!/^[A-Za-z0-9_-]{20,500}$/.test(token) || secret.length < 16 || secret.length > 500) fail('Completá el Access Token y la clave secreta de Webhooks.');
        const site = siteUrl(body.siteUrl), seller = await mp('/users/me', token);
        if (!seller.id || seller.site_id !== 'MLA') fail('Conectá una cuenta de Mercado Pago de Argentina.');
        const testSeller = Array.isArray(seller.tags) && seller.tags.includes('test_user');
        if (mode === 'test' && !testSeller) fail('Para Pruebas, usá el Access Token de una cuenta vendedora de prueba. La cuenta real solo se conecta en Producción.');
        if (mode === 'production' && (testSeller || token.startsWith('TEST-'))) fail('Producción necesita las credenciales de la cuenta real de este negocio.');
        const a = await repo.run('save_account', { store_id: sid, mode, site_url: site, account_id: String(seller.id), account_label: String(seller.nickname || 'Cuenta verificada').slice(0,100), credentials: { accessToken: token, webhookSecret: secret } });
        return response({ ...publicAccount(a), webhookUrl: endpoint + '/webhook?store_id=' + sid });
      }
      if (route === 'checkout' && req.method === 'POST') {
        const sid = uuid(body.storeId), requestId = uuid(body.requestId), hash = await sha256(proof(body.proof));
        const active = await repo.run('account', { store_id: sid }); if (!active) fail('Este negocio todavía no habilitó Mercado Pago.', 409, 'not_configured');
        checkOrigin(req, active);
        await limited('store:' + sid, 120); await limited('buyer:' + sid + ':' + await originKey(req), 20);
        const menu=await repo.menu(sid);
        if(body.order?.source==='delivery'&&menu.delivery?.enabled===false)fail('El delivery está pausado por el local. Podés elegir retiro.',409,'service_paused');
        if(body.order?.source==='delivery'&&menu.delivery?.deliveryV2?.active){const h=deliveryHours(menu.delivery.deliveryV2.hours,now());if(!h.open)fail('El delivery está fuera de horario. Volvé durante el horario de atención.',409,h.valid?'closed':'hours_invalid');}
        const delivery=menu.delivery?.deliveryV2?.active&&body.order?.source==='delivery'?await resolveDelivery(sid,menu,body.order):{};
        const order = quoteOrder(menu, body.order || {},{...delivery,now:now()});
        if (cents(body.order?.total) !== cents(order.total)) fail('El precio o el envío cambió. Actualizá el menú antes de pagar.', 409, 'menu_changed');
        const c = await repo.run('reserve', { store_id: sid, account_id: active.id, request_id: requestId, proof_hash: hash, quote_hash: await sha256(JSON.stringify({...order,...(order.deliverySnapshot?{deliverySnapshot:{...order.deliverySnapshot,validatedAt:undefined,hours:order.deliverySnapshot.hours?{...order.deliverySnapshot.hours,checkedAt:undefined}:null}}:{})})), order });
        if (c.checkout_url || c.payment_status === 'paid') return response(publicCheckout(c));
        const a = await repo.run('secrets', { account_id: c.account_id });
        try {
          let preference = null;
          if (c.attempts > 1) {
            const found = await mp('/checkout/preferences/search?external_reference=' + c.id, a.credentials.accessToken);
            preference = (found.elements || found.results || []).find(p => p.external_reference === c.id);
            if (preference?.id) preference = await mp('/checkout/preferences/' + encodeURIComponent(preference.id), a.credentials.accessToken);
          }
          if (!preference) preference = await mp('/checkout/preferences', a.credentials.accessToken, { method: 'POST', body: JSON.stringify(buildPreference(c, a, endpoint, now())) });
          const target = checkoutUrl(preference);
          await repo.run('preference', { id: c.id, preference_id: String(preference.id), checkout_url: target });
          return response(publicCheckout({ ...c, checkout_url: target }));
        } catch (e) {
          // Un timeout puede haber creado la preferencia: la siguiente reserva busca antes de crear otra.
          await repo.run('release', { id: c.id }); throw e;
        }
      }
      if (route === 'status' && req.method === 'POST') {
        let c = await ownedCheckout(body); await limited('status:' + c.id, 120);
        if (body.paymentId) {
          const a = await repo.run('secrets', { account_id: c.account_id });
          await reconcile(body.paymentId, a, c);
          c = await repo.run('checkout', { id: c.id });
        }
        return response(publicCheckout(c));
      }
      if (route === 'webhook' && req.method === 'POST') {
        const sid = uuid(url.searchParams.get('store_id')), id = url.searchParams.get('data.id');
        const accounts = await repo.run('webhook_accounts', { store_id: sid });
        const signed = [];
        for (const candidate of accounts) if (await verifyWebhook(req, candidate.credentials.webhookSecret, now())) signed.push(candidate);
        if (!signed.length) fail('Firma de notificación no válida.', 401);
        if (String(body.data?.id) !== id) fail('Identificador de notificación inconsistente.');
        if (body.type !== 'payment') return response({ received: true });
        // Si la misma aplicación se volvió a conectar, puede compartir firma con una versión anterior.
        let p, providerError;
        for (const candidate of signed) {
          try { p = await mp('/v1/payments/' + id, candidate.credentials.accessToken); break; }
          catch (e) { providerError = e; }
        }
        if (!p) throw providerError;
        if (!validUuid(p.external_reference)) return response({ received: true });
        const c = await repo.run('checkout', { id: p.external_reference });
        if (!c || c.store_id !== sid) return response({ received: true });
        const source = accounts.find(account => account.id === c.account_id);
        if (!source || !await verifyWebhook(req, source.credentials.webhookSecret, now())) fail('La notificación no corresponde a esta conexión.', 401);
        const verified = verifiedPayment(p, c, source);
        await repo.run('payment', { ...verified, checkout_id: c.id });
        return response({ received: true });
      }
      return response({ message: 'Ruta no disponible.' }, 404);
    } catch (e) {
      if (e instanceof PaymentError) return response({ message: e.message, code: e.code }, e.status);
      const code = String(e.code || '');
      if (['checkout_conflict','checkout_expired','checkout_busy'].includes(code)) return response({ code, message: { checkout_conflict: 'Cambió el pedido. Iniciá una compra nueva.', checkout_expired: 'Venció esta compra. Volvé al menú para reintentar.', checkout_busy: 'Estamos preparando el pago. Esperá unos segundos y reintentá.' }[code] }, 409);
      return response({ message: 'No se pudo completar la operación. Reintentá en un momento.', code: 'server_error' }, 500);
    }
  };
}
