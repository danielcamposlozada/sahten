import {it,expect} from 'vitest';
import {demoState} from './helpers.js';
import {buildMenuJson} from '../src/online/menuJson.js';

it('publica recomendaciones de lista sin habilitar descuentos ni revelar costos',()=>{
  const state=demoState();
  const base=buildMenuJson(state);
  expect(base.products.length).toBeGreaterThan(1);
  const [first,second]=base.products.map(p=>p.id);
  const m=buildMenuJson(state,{promotions:{
    enabled:false,
    cartRecommendationPolicy:{enabled:true,complements:[
      {id:'postre',name:'¿Algo de postre?',priority:50,
        productId:second,triggerProductIds:[first,'private-missing'],
        suppressIfPresent:['private-missing'],supplierSecret:'do-not-publish',
        cost:999999,customerId:'private-user'},
      {id:'unknown',name:'No existe',productId:'unknown-product',triggerProductIds:[first]}
    ]},
    beverageUpsellPolicy:{enabled:false,contexts:[
      {id:'drink',name:'Bebida',options:[first],triggerProductIds:[second]}]}
  }});
  expect(m.promotions).toEqual({enabled:false});
  expect(m.cartRecommendations.enabled).toBe(true);
  expect(m.cartRecommendations.beverageContexts).toEqual([]);
  expect(m.cartRecommendations.complements).toEqual([{
    id:'postre',name:'¿Algo de postre?',priority:50,
    productId:second,triggerProductIds:[first],suppressIfPresent:[]
  }]);
  const output=JSON.stringify(m);
  expect(output).not.toContain('do-not-publish');
  expect(output).not.toContain('private-user');
  expect(output).not.toContain('999999');
});
it('sin activación explícita no aparece ningún producto sugerido',()=>{
  const st=demoState();
  expect(buildMenuJson(st).cartRecommendations).toEqual({enabled:false});
  expect(buildMenuJson(st,{promotions:{enabled:true,cartRecommendationPolicy:{enabled:false}}}).cartRecommendations).toEqual({enabled:false});
});
it('bebidas para Shawarma SUPERMIX: solo las aprobadas, precio normal, sin exponer costos',()=>{
  const state=demoState(),main=state.products[0],approved=state.products[1],blocked=state.products[2];
  main.id='p1779299917243';main.name='Shawarma SUPERMIX';
  approved.category='Bebidas';approved.name='Agua con gas 600 ml';
  blocked.category='Bebidas';blocked.name='Sprite Zero 220 ml';
  const result=buildMenuJson(state,{promotions:{
    enabled:false,
    cartRecommendationPolicy:{enabled:true,complements:[]},
    beverageUpsellPolicy:{enabled:true,
      options:[{id:approved.id,verified:true,secretCost:914.83},
        {id:blocked.id,verified:false,secretCost:846.25}],
      contexts:[{id:'sandwich-small',name:'Bebida para tu SUPERMIX',
        triggerProductIds:[main.id],options:[blocked.id,approved.id],priority:80}]}
  }});
  expect(result.cartRecommendations.beverageContexts).toHaveLength(1);
  expect(result.cartRecommendations.beverageContexts[0].options).toEqual([approved.id]);
  expect(result.promotions).toEqual({enabled:false});
  expect(JSON.stringify(result)).not.toContain('secretCost');
  expect(JSON.stringify(result)).not.toContain('914.83');
});
