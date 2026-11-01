import {describe,it,expect} from 'vitest';
import {promotionCampaignManifest} from '../src/online/promotion-manifest.js';

describe('manifiesto público de promociones para estados en vivo',()=>{
  const campaign=(enabled)=>({id:'weekly-meals',name:'Platos semanales',kind:'public',enabled,
    extraPercent:5,priority:20,channels:['online','mostrador'],productIds:['fatay3'],
    schedule:{type:'weekly',weekdays:[1,2,3]},cost:100,margin:0.5,customerId:'secret',
    advertising:{enabled:true,placement:['ticket','cart'],message:'OFERTA'}});
  it('conserva la campaña pausada con su mismo ID para poder reactivarla sin subir archivos',()=>{
    const rows=promotionCampaignManifest([campaign(false)]);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({id:'weekly-meals',enabled:false,productIds:['fatay3']});
  });
  it('no expone información confidencial ni publica campañas privadas o de cupones',()=>{
    const rows=promotionCampaignManifest([campaign(true),{id:'private',kind:'coupon',enabled:true,customerId:'secret'}]);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({id:'weekly-meals',enabled:true,extraPercent:5});
    expect(rows[0]).not.toHaveProperty('cost');
    expect(rows[0]).not.toHaveProperty('margin');
    expect(rows[0]).not.toHaveProperty('customerId');
  });
  it('no modifica la configuración original y descarta IDs inválidos',()=>{
    const c=campaign(false);const rows=promotionCampaignManifest([c,{...c,id:'../../path'}]);
    expect(rows).toHaveLength(1);
    rows[0].productIds.push('otra');
    expect(c.productIds).toEqual(['fatay3']);
    expect(c.enabled).toBe(false);
  });
});
