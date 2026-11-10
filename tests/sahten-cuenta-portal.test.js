import {describe,it,expect,vi} from 'vitest';
import {readFileSync} from 'node:fs';
import {JSDOM} from 'jsdom';
const html=readFileSync('workers/sahten-cuenta/index.html','utf8');
const js=readFileSync('workers/sahten-cuenta/app.js','utf8');
const API='https://dtnbokdrxojdcvguuidk.supabase.co';
const tick=()=>new Promise(r=>setTimeout(r,25));
function setup({url='https://sahten.online/cuenta/',responses={}}={}){
 const dom=new JSDOM(html,{url,runScripts:'outside-only'});
 const calls=[];
 dom.window.fetch=vi.fn(async(address,options={})=>{
  const data=options.body?JSON.parse(options.body):null;
  calls.push({url:address,data,headers:options.headers,method:options.method});
  const found=Object.entries(responses).find(([path])=>String(address).includes(path));
  const response=found?.[1]||{};
  return {ok:response.status?response.status<400:true,status:response.status||200,json:async()=>response.body||{}};
 });
 dom.window.eval(js);
 return {dom,w:dom.window,d:dom.window.document,calls};
}
function submit(w,id){
 const event=new w.Event('submit',{bubbles:true,cancelable:true});
 w.document.getElementById(id).dispatchEvent(event);
}
describe('Portal de cuenta de Sahten en Cloudflare',()=>{
 it('no carga recursos remotos y no indexa ni revela el origen de tokens',()=>{
  expect(html).toContain('name="robots" content="noindex,nofollow,noarchive"');
  expect(html).toContain('src="/cuenta/app.js"');
  expect(html).not.toContain('google-analytics');
  expect(html).toContain('Recuperar contraseña');
 });
 it('solicita recuperación con redirect_to a sahten.online/cuenta, no localhost',async()=>{
  const a=setup();
  a.d.getElementById('email').value='dueño@example.com';
  submit(a.w,'request-form');await tick();
  expect(a.calls).toHaveLength(1);
  expect(a.calls[0].url).toBe(API+'/auth/v1/recover?redirect_to=https%3A%2F%2Fsahten.online%2Fcuenta%2F');
  expect(a.calls[0].data).toEqual({email:'dueño@example.com'});
  expect(a.d.getElementById('status').textContent).toMatch(/Si el correo corresponde/);
  a.w.close();
 });
 it('no da de alta usuarios durante el acceso temporal',async()=>{
  const a=setup();
  a.d.getElementById('tab-login').click();
  a.d.getElementById('email').value='trabajo@example.com';
  submit(a.w,'request-form');await tick();
  expect(a.calls[0].url).toContain('/auth/v1/otp?redirect_to=');
  expect(a.calls[0].data).toEqual({email:'trabajo@example.com',create_user:false});
  a.w.close();
 });
 it('consume enlace original que redirige a localhost sin visitar localhost',async()=>{
  const a=setup({responses:{
    '/auth/v1/verify':{body:{access_token:'VALID',refresh_token:'REF',user:{id:'member'}}},
    '/auth/v1/user':{body:{id:'member'}}
  }});
  a.d.getElementById('original-link').value=API+'/auth/v1/verify?token_hash=UNICO&type=recovery&redirect_to=http%3A%2F%2Flocalhost%3A3000';
  submit(a.w,'verify-form');await tick();
  expect(a.calls.map(c=>c.url)).toEqual([API+'/auth/v1/verify']);
  expect(a.calls[0].data).toEqual({type:'recovery',token_hash:'UNICO'});
  expect(a.d.getElementById('password-form').classList.contains('hidden')).toBe(false);
  a.d.getElementById('password').value='nueva-pass-frase-segura';
  a.d.getElementById('confirm-password').value='nueva-pass-frase-segura';
  submit(a.w,'password-form');await tick();
  expect(a.calls[1].url).toBe(API+'/auth/v1/user');
  expect(a.calls[1].method).toBe('PUT');
  expect(a.calls[1].headers.Authorization).toBe('Bearer VALID');
  expect(a.calls[1].data).toEqual({password:'nueva-pass-frase-segura'});
  expect(a.d.getElementById('complete').textContent).toContain('Contraseña actualizada');
  a.w.close();
 });
 it('rechaza enlaces falsos, de otros proyectos y de login para reset sin enviar tokens',async()=>{
  const a=setup();
  for(const link of [
   'https://evil.example/auth/v1/verify?token=SECRET&type=recovery',
   API+'/auth/v1/verify?token=SECRET&type=magiclink',
   'http://localhost:3000/#access_token=SECRET'
  ]){
    a.d.getElementById('original-link').value=link;
    submit(a.w,'verify-form');await tick();
    expect(a.d.getElementById('status').dataset.kind).toBe('error');
  }
  expect(a.calls).toHaveLength(0);
  a.w.close();
 });
 it('abre el formulario tras recibir un callback de recuperación y borra tokens de la URL',async()=>{
  const a=setup({url:'https://sahten.online/cuenta/#access_token=VALID&refresh_token=REF&type=recovery',responses:{
    '/auth/v1/user':{body:{id:'u1'}}
  }});
  await tick();
  expect(a.w.location.hash).toBe('');
  expect(a.calls).toHaveLength(1);
  expect(a.calls[0].headers.Authorization).toBe('Bearer VALID');
  expect(a.d.getElementById('password-form').classList.contains('hidden')).toBe(false);
  a.w.close();
 });
 it('un login de enlace confirmado nunca promete iniciar sesión en la app automáticamente',async()=>{
  const a=setup({url:'https://sahten.online/cuenta/#access_token=VALID&refresh_token=REF&type=magiclink',responses:{
    '/auth/v1/user':{body:{id:'u1'}}
  }});
  await tick();
  expect(a.d.getElementById('complete-message').textContent).toContain('no se copia a la aplicación');
  expect(a.w.location.hash).toBe('');
  a.w.close();
 });
});
