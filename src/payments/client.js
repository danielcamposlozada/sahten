import { SupabaseError } from '../online/supabase.js';

export function createPaymentClient({ online }) {
  async function call(method, body) {
    const client = online.controller.client, storeId = online.conn().storeId;
    if (!client || !online.controller.info().signedIn || !storeId) throw new SupabaseError('Conectá este negocio e iniciá sesión en Nube y usuarios.');
    const result = await client.raw('/functions/v1/sahten-payments/account' + (method === 'GET' ? '?store_id=' + encodeURIComponent(storeId) : ''), {
      method, token: await client.auth.token(), body: method === 'GET' ? undefined : { ...body, storeId },
    });
    return result;
  }
  return { load: () => call('GET'), save: fields => call('PUT', fields), disable: () => call('DELETE') };
}
