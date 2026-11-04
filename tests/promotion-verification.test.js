import { describe, it, expect } from 'vitest';
import { verificationCheck, summarizeVerification, serverVerificationChecks } from '../src/core/promotion-verification.js';
import { promotionDraftReview } from '../src/core/promotion-draft-review.js';

describe('Estados de evidencia comercial', () => {
  it('distingue fallo, falta de evidencia, pendiente y no aplicable', () => {
    expect(verificationCheck({ok:false}).status).toBe('rejected');
    expect(verificationCheck({}).status).toBe('unverified');
    expect(verificationCheck({status:'pending'}).ok).toBe(false);
    expect(verificationCheck({status:'not_applicable'}).ok).toBe(true);
    expect(summarizeVerification([]).status).toBe('unverified');
    expect(summarizeVerification([{status:'approved'},{status:'not_applicable'}]).status).toBe('approved');
    expect(summarizeVerification([{status:'approved'},{status:'unverified'}]).status).toBe('unverified');
    expect(summarizeVerification([{status:'pending'},{status:'rejected'}]).status).toBe('rejected');
  });
  it('los checks fijos del servidor antiguo no se convierten en pruebas aprobadas', () => {
    const checks=serverVerificationChecks({checks:[
      {id:'costs',ok:false}, {id:'checkout',ok:false},
      {id:'additional',ok:false}, {id:'publication',ok:false}, {id:'triggers',ok:true}
    ]},'couponPrograms');
    expect(checks.map(c=>c.status)).toEqual(['rejected','unverified','unverified','unverified','not_applicable']);
    expect(checks.every(c=>c.source==='server')).toBe(true);
  });
  it('conserva un rechazo explícito del servidor nuevo y no interpreta flags como autorización', () => {
    expect(serverVerificationChecks({checks:[{id:'checkout',ok:false,status:'rejected'}]})[0].status).toBe('rejected');
    const result=promotionDraftReview('upsells',{id:'example',name:'Complemento ejemplo',extraPercent:5,
      productIds:['a'],triggerProductIds:['b']},[{id:'a'},{id:'b'}]);
    expect(result.checks.find(c=>c.id==='economics')).toMatchObject({status:'unverified',ok:false});
    expect(result.readyForDiscount).toBe(false);
  });
});

it('la escala Fatay aprobada como concepto se revisa como excepción; no se autoriza por copiar un porcentaje',()=>{
 const proposal={id:'fatay-individual-up',name:'Fatay adicional',maxUnits:1,extraPercent:10,
  productIds:['fatay'],triggerProductIds:['plato'],
  discountTiers:[{totalDiscountPercent:30,minEligibleNetSubtotal:50000}]};
 const products=[{id:'fatay'},{id:'plato'}];
 const review=promotionDraftReview('upsells',proposal,products);
 expect(review.checks.find(c=>c.id==='limits').status).toBe('pending');
 expect(review.readyForDiscount).toBe(false);
 expect(promotionDraftReview('upsells',{...proposal,id:'arbitrary-offer'},products).checks.find(c=>c.id==='limits').status).toBe('rejected');
});
