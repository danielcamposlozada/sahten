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