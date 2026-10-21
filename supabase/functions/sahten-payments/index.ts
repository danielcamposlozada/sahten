import { paymentHandler } from '../../../src/payments/repository.js';

const url = Deno.env.get('SUPABASE_URL');
const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
const anonKey = Deno.env.get('SUPABASE_ANON_KEY');
if (!url || !serviceKey || !anonKey) throw new Error('Falta la configuración del servidor de pagos.');
Deno.serve(paymentHandler({ url, serviceKey, anonKey }));
