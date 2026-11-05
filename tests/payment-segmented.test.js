import {it,expect} from 'vitest';
import {JSDOM} from 'jsdom';
import {paymentChoiceHtml} from '../src/ui/payment-choice.js';
it('direct payment uses two labelled native radio positions and does not duplicate Mostrador methods',()=>{
 const dom=new JSDOM(paymentChoiceHtml({methods:['efectivo','transferencia','mercadopago'],selected:'efectivo',percent:10}));
 try{const d=dom.window.document;const group=d.querySelector('[role=radiogroup]');expect(group).toBeTruthy();expect(group.querySelectorAll('input[type=radio]')).toHaveLength(2);expect(group.querySelector('input:checked').value).toBe('efectivo');group.querySelector('input[value=transferencia]').click();expect(group.querySelector('input:checked').value).toBe('transferencia');expect(group.textContent).toContain('Transferencia');expect(group.querySelector('button')).toBeNull();
 const compact=new JSDOM(paymentChoiceHtml({methods:['efectivo','transferencia','qr'],selected:'qr',compact:true}));try{expect(compact.window.document.querySelector('[role=radiogroup]')).toBeNull();expect(compact.window.document.querySelectorAll('[data-payment-choice]')).toHaveLength(3);}finally{compact.window.close();}
 }finally{dom.window.close();}
});
