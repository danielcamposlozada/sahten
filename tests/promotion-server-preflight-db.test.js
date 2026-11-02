import {beforeAll,afterAll,describe,it,expect} from 'vitest';
import {PGlite} from '@electric-sql/pglite';
import fs from 'node:fs';
const read=p=>fs.readFileSync(new URL('../'+p,import.meta.url),'utf8');
const owner='00000000-0000-4000-8000-000000000001';
const stranger='00000000-0000-4000-8000-000000000002';
const source={
  products:[
    {id:'baklava',name:'Baklava',price:7350},
    {id:'fatay',name:'Fatay',price:5850},
    {id:'torta',name:'Torta',price:8200},
    {id:'fatay4',name:'Cuatro Fatay',price:18500}
  ],
  promotions:{enabled:true,paymentPercent:10,campaigns:[],upsells:[]},
  site:{name:'Sin cambios de web'},cartRecommendations:{complements:[]}
};
let db,sid,other;
const upsell={id:'baklava-up',name:'Baklava complementaria',kind:'upsell',
  productIds:['baklava'],triggerProductIds:['fatay'],enabled:true,
  extraPercent:5,maxUnits:1};
const coupon={id:'cupon-prueba',name:'Cupón de prueba',enabled:true,
  extraPercent:5,validDays:14,minEligibleSubtotal:10000,
  eligibleProductIds:['baklava'],channel:'online'};
async function as(role,fn,user=owner){
  await db.exec(`reset role;select set_config('request.jwt.claim.sub','${role==='authenticated'?user:''}',false);set role ${role}`);
  try{return await fn();}finally{await db.exec('reset role')}
}
const verify=(type,draft,store=sid)=>db.query('select public.verify_promotion_draft($1,$2,$3) result',[store,type,draft]).then(r=>r.rows[0].result);
const menu=()=>db.query('select json from public.menus where store_id=$1',[sid]).then(r=>r.rows[0].json);
beforeAll(async()=>{
  db=new PGlite();
  await db.exec(read('tests/fixtures/supabase-prelude.sql'));
  await db.exec(read('supabase/schema.sql'));
  await db.query("insert into auth.users(id,email) values($1,'owner@test.invalid'),($2,'other@test.invalid')",[owner,stranger]);
  sid=(await db.query("insert into public.stores(slug,name,owner) values('verify-sahten','Sahten',$1) returning id",[owner])).rows[0].id;
  other=(await db.query("insert into public.stores(slug,name,owner) values('verify-other','Otro',$1) returning id",[stranger])).rows[0].id;
  await db.query('insert into public.menus(store_id,json) values($1,$2),($3,$2)',[sid,source,other]);
  await db.exec("create or replace function public.sahten_promotion_costs(sid uuid,channel text) returns jsonb language sql stable as $$ select '{\"baklava\":3536.19,\"fatay\":3580.54,\"torta\":3942.75,\"fatay4\":7600}'::jsonb $$;");
  await db.exec(read('supabase/migrations/20261102143000_verify_promotion_draft_readonly.sql'));
},60000);
afterAll(async()=>db?.close());
describe('In-app promotion preflight in read-only production server',()=>{
  it('revokes anon and rejects unauthorized store owners',async()=>{
    await expect(as('anon',()=>verify('upsells',upsell))).rejects.toThrow(/permission denied/);
    await expect(as('authenticated',()=>verify('upsells',upsell,other))).rejects.toThrow(/forbidden/);
    await expect(as('authenticated',()=>verify('upsells',upsell,sid),stranger)).rejects.toThrow(/forbidden/);
  });
  it('calculates exact costs and estimated 40% margin with normal discount, without publishing',async()=>{
    const before=await menu();
    const result=await as('authenticated',()=>verify('upsells',upsell));
    expect(result).toMatchObject({id:'baklava-up',type:'upsells',source:'server',
      canPublish:false,canActivate:false,paymentBasePercent:10,totalPercent:15});
    expect(result.products[0]).toMatchObject({id:'baklava',price:7350,baseCost:3536.19,estimatedMarginPct:43.4});
    expect(result.checks.find(x=>x.id==='margin').ok).toBe(true);
    expect(result.checks.find(x=>x.id==='additional').ok).toBe(false);
    expect(result.checks.find(x=>x.id==='checkout').ok).toBe(false);
    expect(await menu()).toEqual(before);
  });
  it('detects missing items, invalid margins and over-limit discounts',async()=>{
    const missing=await as('authenticated',()=>verify('upsells',{...upsell,productIds:['no_such_sku']}));
    expect(missing.checks.find(x=>x.id==='products').ok).toBe(false);
    const tooLow=await as('authenticated',()=>verify('upsells',{...upsell,extraPercent:10}));
    expect(tooLow.products[0].estimatedMarginPct).toBe(39.9);
    expect(tooLow.checks.find(x=>x.id==='margin').ok).toBe(false);
    const excessive=await as('authenticated',()=>verify('upsells',{...upsell,extraPercent:15}));
    expect(excessive.checks.find(x=>x.id==='terms').ok).toBe(false);
  });
  it('checks upgrades against two published distinct products',async()=>{
    const upgrade=await as('authenticated',()=>verify('productUpgrades',{
      id:'fatay-fourth',name:'Cuarta Fatay',extraPercent:5,
      triggerProductId:'fatay',replacementProductId:'fatay4'}));
    expect(upgrade.products[0].id).toBe('fatay4');
    expect(upgrade.checks.find(x=>x.id==='triggers').ok).toBe(true);
    expect(upgrade.canPublish).toBe(false);
    const invalid=await as('authenticated',()=>verify('productUpgrades',{
      id:'fatay-fourth',name:'Cuarta Fatay',extraPercent:5,
      triggerProductId:'fatay',replacementProductId:'fatay'}));
    expect(invalid.checks.find(x=>x.id==='triggers').ok).toBe(false);
  });
  it('checks coupon program economics but never issues/redeems a code',async()=>{
    const before=await menu();
    const good=await as('authenticated',()=>verify('couponPrograms',coupon));
    expect(good.products[0].id).toBe('baklava');
    expect(good.checks.find(x=>x.id==='terms').ok).toBe(true);
    expect(good.checks.find(x=>x.id==='checkout').ok).toBe(false);
    const unbounded=await as('authenticated',()=>verify('couponPrograms',{...coupon,eligibleProductIds:[]}));
    expect(unbounded.checks.find(x=>x.id==='products').ok).toBe(false);
    const pos=await as('authenticated',()=>verify('couponPrograms',{...coupon,channel:'mostrador'}));
    expect(pos.checks.find(x=>x.id==='terms').ok).toBe(false);
    expect(await menu()).toEqual(before);
  });
});
