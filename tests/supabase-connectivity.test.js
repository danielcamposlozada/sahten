import { describe, it, expect, vi } from 'vitest';
import { checkSupabaseConnectivity } from '../scripts/check-supabase-connectivity.mjs';
const env={SUPABASE_URL:'https://example.supabase.co',SUPABASE_ANON_KEY:'sb_publishable_example'};
const jwt=role=>'head.'+Buffer.from(JSON.stringify({role})).toString('base64url')+'.sig';
describe('Diagnóstico Supabase de solo lectura',()=>{
 it('distingue configuración ausente de caída del servicio y rechaza claves administrativas',async()=>{
  const fetch=vi.fn();
  await expect(checkSupabaseConnectivity({},fetch)).rejects.toThrow('No se consultó Supabase');
  await expect(checkSupabaseConnectivity({...env,SUPABASE_ANON_KEY:jwt('service_role')},fetch)).rejects.toThrow('administrativas');
  await expect(checkSupabaseConnectivity({...env,SUPABASE_URL:'http://localhost'},fetch)).rejects.toThrow('HTTPS');
  expect(fetch).not.toHaveBeenCalled();
 });
 it('no recupera registros ni sigue redirecciones con credenciales',async()=>{
  const cancel=vi.fn();const fetch=vi.fn(async()=>({status:200,body:{cancel}}));
  expect(await checkSupabaseConnectivity(env,fetch)).toEqual({ok:true,status:200});
  expect(fetch).toHaveBeenCalledWith('https://example.supabase.co/rest/v1/stores?select=id&limit=0',expect.objectContaining({redirect:'error'}));
  expect(cancel).toHaveBeenCalledOnce();
  expect(fetch.mock.calls[0][1].headers.Authorization).toBeUndefined();
 });
 it('reintenta fallos temporales pero no errores de permisos',async()=>{
  const fetch=vi.fn().mockRejectedValueOnce(new Error('private network details'))
   .mockResolvedValueOnce({status:503}).mockResolvedValueOnce({status:200});
  await expect(checkSupabaseConnectivity(env,fetch)).resolves.toMatchObject({ok:true});
  expect(fetch).toHaveBeenCalledTimes(3);
  const denied=vi.fn(async()=>({status:403}));
  await expect(checkSupabaseConnectivity({...env,SUPABASE_ANON_KEY:jwt('anon')},denied)).rejects.toThrow('permisos');
  expect(denied).toHaveBeenCalledOnce();
 });
});
