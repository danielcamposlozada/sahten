import { createCouponHandler } from '../../../src/promotions/server.js';
const url=Deno.env.get('SUPABASE_URL');
const serviceKey=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
const anonKey=Deno.env.get('SUPABASE_ANON_KEY');
if(!url||!serviceKey||!anonKey)throw new Error('Configuración de backend incompleta.');
Deno.serve(createCouponHandler({url,serviceKey,anonKey}));
