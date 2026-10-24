import { deliveryHandler } from '../../../src/delivery/repository.js';
const url=Deno.env.get('SUPABASE_URL'),serviceKey=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY'),anonKey=Deno.env.get('SUPABASE_ANON_KEY');
if(!url||!serviceKey||!anonKey)throw new Error('Falta la configuración de delivery.');
Deno.serve(deliveryHandler({url,serviceKey,anonKey}));
