#!/usr/bin/env node
// Aislado de sahten-menu Pages: solo sirve /cuenta/ y /cuenta/app.js.
// Construir: node scripts/deploy/build-sahten-cuenta.mjs
import fs from 'node:fs/promises';
import path from 'node:path';
import {createHash} from 'node:crypto';
const ROOT=path.resolve('workers/sahten-cuenta');
const html=await fs.readFile(path.join(ROOT,'index.html'),'utf8');
const app=await fs.readFile(path.join(ROOT,'app.js'),'utf8');
for(const field of ['id="otp"','id="password-form"','/cuenta/app.js']){
  if(!html.includes(field)&&!app.includes(field))throw new Error('Portal incompleto: '+field);
}
if(!app.includes("create_user:false") || !app.includes("redirect_to=") || !app.includes("accessToken = null"))
  throw new Error('Faltan controles de sesión segura o de URL de retorno');
const headers={
  'Cache-Control':'no-store, max-age=0',
  'Referrer-Policy':'no-referrer',
  'X-Content-Type-Options':'nosniff',
  'X-Frame-Options':'DENY',
  'X-Robots-Tag':'noindex, nofollow, noarchive',
  'Permissions-Policy':'camera=(), microphone=(), geolocation=()',
  'Strict-Transport-Security':'max-age=31536000',
  'Content-Security-Policy':"default-src 'none'; script-src 'self'; style-src 'unsafe-inline'; connect-src https://dtnbokdrxojdcvguuidk.supabase.co; img-src 'self' data:; font-src 'none'; object-src 'none'; frame-ancestors 'none'; base-uri 'none'; form-action 'self'; upgrade-insecure-requests"
};
const code=[
  '// Sahten /cuenta. No guarda tokens ni intercepta ninguna otra ruta.',
  'const HTML='+JSON.stringify(html)+';',
  'const APP='+JSON.stringify(app)+';',
  'const HEADERS='+JSON.stringify(headers)+';',
  "export default {async fetch(request) {",
  "  const url=new URL(request.url);",
  "  if(request.method!=='GET'&&request.method!=='HEAD')return new Response('Method not allowed',{status:405,headers:{Allow:'GET, HEAD'}});",
  "  if(!['sahten.online','www.sahten.online'].includes(url.hostname))return new Response('Not found',{status:404});",
  "  if(url.protocol!=='https:')return Response.redirect('https://'+url.hostname+url.pathname,308);",
  "  const script=url.pathname==='/cuenta/app.js';",
  "  const page=url.pathname==='/cuenta'||url.pathname==='/cuenta/';",
  "  if(!script&&!page)return new Response('Not found',{status:404});",
  "  const content=script?APP:HTML;",
  "  return new Response(request.method==='HEAD'?null:content,{status:200,headers:{...HEADERS,'Content-Type':script?'application/javascript; charset=utf-8':'text/html; charset=utf-8'}});",
  "}};"
].join('\n');
const output=path.resolve('.sahten-cuenta-deploy');
await fs.mkdir(output,{recursive:true});
await fs.writeFile(path.join(output,'worker.mjs'),code);
const report={
  name:'sahten-cuenta',
  routes:['sahten.online/cuenta','sahten.online/cuenta/*','www.sahten.online/cuenta','www.sahten.online/cuenta/*'],
  htmlBytes:Buffer.byteLength(html),jsBytes:Buffer.byteLength(app),
  sha256:createHash('sha256').update(code).digest('hex'),
  doesNotModify:'sahten-menu Pages deployment or checkout',
};
await fs.writeFile(path.join(output,'report.json'),JSON.stringify(report,null,2));
console.log(report);
