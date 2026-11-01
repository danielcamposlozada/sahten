// Edge-only administrative coupon issuing. Public storefront never receives service_role.
const validUuid=s=>/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(s||'');
const headers={'Content-Type':'application/json','Cache-Control':'no-store',
  'Access-Control-Allow-Origin':'*','Access-Control-Allow-Headers':'authorization,apikey,content-type',
  'Access-Control-Allow-Methods':'POST,OPTIONS'};
const reply=(body,status=200)=>new Response(JSON.stringify(body),{status,headers});
async function digest(code){
  const hashed=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(code));
  return [...new Uint8Array(hashed)].map(n=>n.toString(16).padStart(2,'0')).join('');
}
function randomCode(){
  const chars='ABCDEFGHJKLMNPQRSTUVWXYZ23456789',bytes=crypto.getRandomValues(new Uint8Array(20));
  return 'SHT-'+[...bytes].map(n=>chars[n%chars.length]).join('');
}
function endOfDate(date){
  if(!/^\d{4}-\d{2}-\d{2}$/.test(date||''))throw new Error('Fecha límite inválida.');
  const d=new Date(date+'T23:59:59.999-03:00');
  if(!Number.isFinite(d.getTime())||d<=new Date())throw new Error('La fecha de vencimiento debe ser futura.');
  return d.toISOString();
}
export function createCouponHandler({url,serviceKey,anonKey,fetchImpl=fetch}) {
  async function request(path,{method='GET',body,token=serviceKey}={}){
    const res=await fetchImpl(url+path,{method,headers:{apikey:token===serviceKey?serviceKey:anonKey,
      Authorization:'Bearer '+token,'Content-Type':'application/json'},
      body:body===undefined?undefined:JSON.stringify(body),signal:AbortSignal.timeout(8000)});
    if(!res.ok)throw new Error('El servidor no pudo completar la operación.');
    return res.status===204?null:res.json();
  }
  async function manager(req,storeId){
    const token=(req.headers.get('authorization')||'').replace(/^Bearer /,'');
    if(!token||token===anonKey||token===serviceKey) return false;
    const user=await request('/auth/v1/user',{token}).catch(()=>null);
    if(!user?.id)return false;
    const store=(await request('/rest/v1/stores?select=id,owner,project_id&id=eq.'+storeId,{token}).catch(()=>[]))?.[0];
    if(!store)return false;
    if(store.owner===user.id)return true;
    if(!store.project_id)return false;
    return await request('/rest/v1/rpc/has_project_role',{method:'POST',token,body:{pid:store.project_id,roles:['owner','admin']}}).catch(()=>false)===true;
  }
  return async(req)=>{
    if(req.method==='OPTIONS')return new Response(null,{status:204,headers});
    if(req.method!=='POST')return reply({error:'method_not_allowed'},405);
    try{
      const data=await req.text();if(data.length>8000)return reply({error:'payload_too_large'},413);
      const body=JSON.parse(data),storeId=body.storeId;
      if(!validUuid(storeId))return reply({error:'invalid_store_id'},400);
      if(!await manager(req,storeId))return reply({error:'forbidden'},403);
      const route=new URL(req.url).pathname.split('/').filter(Boolean).at(-1);
      if(route!=='issue')return reply({error:'unknown_action'},404);
      const purpose=String(body.program||'');
      if(!['first_online','second_online','manual'].includes(purpose))return reply({error:'invalid_program'},400);
      const percent=Number(body.extraPercent),min=Number(body.minEligibleSubtotal||0);
      const max=body.maxExtraAmount==null?null:Number(body.maxExtraAmount);
      if(!Number.isFinite(percent)||percent<=0||percent>10||!Number.isFinite(min)||min<0||max!=null&&(!Number.isFinite(max)||max<0))
        return reply({error:'invalid_benefit'},400);
      const expiresAt=endOfDate(body.expiresOn);
      const products=Array.isArray(body.productIds)?body.productIds
        .filter(x=>typeof x==='string'&&/^[a-zA-Z0-9_-]{1,100}$/.test(x)).slice(0,100):[];
      if(!products.length)return reply({error:'missing_eligible_products'},400);
      const code=randomCode();
      const record=await request('/rest/v1/rpc/sahten_coupon_backend',{method:'POST',body:{action:'issue',args:{
        store_id:storeId,code_digest:await digest(code),program:purpose,name:String(body.name||'Beneficio SAHTEN').slice(0,100),
        eligible_product_ids:products,extra_percent:percent,min_eligible_subtotal:min,
        max_extra_amount:max,expires_at:expiresAt,channel:'online'
      }}});
      // Devolver código solamente a quien tiene permisos administrativos. No guardarlo ni registrarlo.
      return reply({id:record.id,code,expiresOn:record.expiresOn,program:purpose});
    }catch(e){
      return reply({error:e.message==='Fecha límite inválida.'||e.message==='La fecha de vencimiento debe ser futura.'?e.message:'coupon_server_error'},400);
    }
  };
}
