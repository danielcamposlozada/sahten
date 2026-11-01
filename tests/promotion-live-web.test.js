import {it,expect,vi} from 'vitest';
import {JSDOM} from 'jsdom';
import {buildIndexHtml} from '../src/online/publish.js';

it('una campaña pausada en vivo recalcula el carrito abierto sin perder los datos ni tocar el 10% de transferencia',async()=>{
  const now=Date.parse('2026-11-02T15:00:00-03:00');
  const menu={version:1,store:{name:'Sahten de prueba',currency:{symbol:'$',locale:'es-AR'}},
    config:{enabled:true,showPrices:true,categories:['Promociones']},
    products:[{id:'fatay3',name:'Promo Fatay',price:16850,category:'Promociones'}],
    delivery:{enabled:true},payments:{methods:{transferencia:true},benefit:{enabled:true,percent:10,channels:{online:true,mostrador:true}}},
    promotions:{enabled:true,version:1,paymentPercent:10,campaigns:[
      {id:'weekly-meals',name:'Platos semanales',kind:'public',enabled:true,
       extraPercent:5,channels:['online'],productIds:['fatay3'],schedule:{type:'weekly',weekdays:[1,2,3]}}],
      upsells:[]},site:null,
    supabase:{url:'https://server.test',storeId:'00000000-0000-4000-8000-000000000001',anonKey:'anon-test',slug:'test'}};
  let current=structuredClone(menu);
  const dom=new JSDOM(buildIndexHtml(menu),{url:'https://store.test/',runScripts:'dangerously',pretendToBeVisual:true,
    beforeParse(w){
      w.Date=class extends Date{constructor(...a){super(...(a.length?a:[now]));}static now(){return now;}};
      w.scrollTo=()=>{};
      w.fetch=async(url)=>{
        const u=String(url);
        if(u==='menu.json')return Response.json(menu);
        if(u.includes('/rest/v1/stores'))return Response.json([]);
        if(u.includes('/rest/v1/menus?'))return Response.json([{json:current}]);
        if(u.includes('/sahten-payments/config'))return Response.json({enabled:false});
        throw new Error('La prueba no debe iniciar pedidos ni otros requests: '+u);
      };
    }});
  try{
    const w=dom.window,d=w.document;
    await vi.waitFor(()=>expect(d.querySelector('[data-inc]')).not.toBeNull());
    d.querySelector('[data-inc]').click();
    w.openCart();d.querySelector('#cart-next').click();
    d.querySelector('[data-type=pickup]').click();
    expect(d.querySelector('[data-type=pickup]').getAttribute('aria-pressed')).toBe('true');
    const type=(id,value)=>{const input=d.getElementById(id);input.value=value;input.dispatchEvent(new w.Event('input',{bubbles:true}));};
    type('f-name','Cliente de prueba');type('f-phone','1123456789');
    const initial=d.querySelector('#send').textContent;
    expect(initial).toContain('14.322,5');
    current=structuredClone(menu);
    current.promotions.campaigns[0].enabled=false;
    w.dispatchEvent(new w.Event('focus'));
    await vi.waitFor(()=>expect(w.__menu().promotions.campaigns[0].enabled).toBe(false));
    expect(d.querySelector('#send').textContent).toContain('15.165');
    expect(d.getElementById('f-name').value).toBe('Cliente de prueba');
    expect(d.getElementById('f-phone').value).toBe('1123456789');
    expect(d.querySelector('[data-type=pickup]').getAttribute('aria-pressed')).toBe('true');
    expect(w.__menu().payments.benefit.percent).toBe(10);
  }finally{dom.window.close();}
});
