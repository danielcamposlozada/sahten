import {it,expect,vi} from 'vitest';
import {JSDOM} from 'jsdom';
import {readFileSync} from 'node:fs';

it('conserva condiciones abiertas y posición al actualizar beneficios de la portada',async()=>{
 const menu={products:[],config:{enabled:true},supabase:{url:'https://test.invalid',anonKey:'demo',storeId:'test'}};
 const dom=new JSDOM('<script id="editorial-menu" type="application/json">'+JSON.stringify(menu)+'</script><section id="live-public-promos"></section>',{url:'https://test.invalid/',runScripts:'outside-only'});
 const w=dom.window;let name='Beneficio',revision=0;
 try{
  w.matchMedia=()=>({matches:true});
  w.editorialBenefitEnabled=()=>false;
  w.editorialCampaignMarkup=()=>'<article data-public-promotion="uno"><h2>'+name+'</h2><details><summary>Condiciones</summary><p>Detalles</p></details></article>';
  w.editorialLoyaltyMarkup=()=>'';w.salesPaused=()=>false;
  w.fetch=async url=>({ok:true,json:async()=>String(url).includes('/rpc/')?[]:[{json:{products:[],config:{enabled:true},payments:{},promotions:{},revision}}]});
  w.eval(readFileSync(new URL('../media/sahten-editorial/home-runtime.js',import.meta.url),'utf8'));
  const host=w.document.getElementById('live-public-promos');
  await vi.waitFor(()=>expect(host.querySelector('details')).not.toBeNull());
  host.querySelector('details').open=true;
  host.querySelector('.home-promos-list').scrollLeft=42;
  name='Beneficio actualizado';revision++;
  w.dispatchEvent(new w.Event('focus'));
  await vi.waitFor(()=>expect(host.textContent).toContain('Beneficio actualizado'));
  expect(host.querySelector('details').open).toBe(true);
  expect(host.querySelector('.home-promos-list').scrollLeft).toBe(42);
 }finally{w.close();}
});
