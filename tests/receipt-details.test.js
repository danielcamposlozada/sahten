import {it,expect,vi} from 'vitest';
import {JSDOM} from 'jsdom';
import {receiptProfile} from '../src/ui/receipt-paper.js';
import {buildReceipt} from '../src/ui/receipt-template.js';
import {cashChangeQuote,deliveryDetails,cashOrderFields} from '../src/core/order-details.js';
import {toLocalOrder} from '../src/online/orders.js';
import {buildWaMessage} from '../src/online/orderMessage.js';
import {createAutoPrinter,saveReceiptOptions} from '../src/ui/receipt-settings.js';
const order={id:'test',num:22,createdAt:'2026-10-24T22:00:00Z',source:'delivery',status:'en_preparacion',customerName:'Cliente de prueba',customerPhone:'1112345678',address:'Calle de prueba 1234, Ciudad',addressFloor:'2',addressApartment:'B',deliveryReference:'Timbre 2B',paymentMethod:'efectivo',paymentName:'Efectivo',cashTendered:20000,cashChange:3060,total:16940,subtotal:16000,discountAmount:1600,paymentDiscount:{percent:10},shipping:2540,notes:'Sin cebolla',items:[{productId:'p',qty:1,name:'Plato de prueba con nombre completo',lineTotal:16000,unitPrice:16000}]};
it('ticket compacto 48/58 mm conserva dirección y notas, no imprime el estado y escapa todos los datos',()=>{
 for(const mm of [48,58]){const html=buildReceipt({...order,num:'<script>22</script>',deliveryReference:'<script>timbre</script>'},{paper:receiptProfile(mm,{calibration:mm===48?88:100})});const d=new JSDOM(html).window.document;const body=d.body.textContent;
 expect(body).toContain('Calle de prueba 1234, Ciudad');expect(body).toContain('Piso 2 · Depto B');expect(body).toContain('<script>timbre</script>');expect(body).toContain('Sin cebolla');expect(body).toContain('Vuelto$3.060');expect(body).not.toMatch(/EN PREPARACIÓN|en_preparacion/);expect(d.querySelector('script')).toBeNull();}
});
it('no duplica ingresos: efectivo es opcional, usa centavos, ignora otros medios y rechaza montos insuficientes',()=>{
 expect(cashChangeQuote(16940,20000,'efectivo')).toMatchObject({valid:true,change:3060});expect(cashChangeQuote(16940,1000,'efectivo')).toMatchObject({valid:false,shortfall:15940});expect(cashChangeQuote(16940,'','efectivo').valid).toBe(true);expect(cashChangeQuote(.1,.3,'efectivo').change).toBe(.2);expect(cashOrderFields(1,100,'transferencia')).toEqual({});expect(deliveryDetails(order,'pickup')).toEqual({});
});
it('importación online y WhatsApp conservan el piso y el vuelto; el total no cambia',()=>{
 const local=toLocalOrder({id:'r',created_at:order.createdAt,status:'pendiente',payload:order});expect(local).toMatchObject({addressFloor:'2',addressApartment:'B',deliveryReference:'Timbre 2B',cashTendered:20000,cashChange:3060,total:16940});const msg=buildWaMessage(order);expect(msg).toContain('Piso 2 · Depto B');expect(msg).toContain('Vuelto: $3.060');expect(msg).toContain('*Total: $16.940*');
});
it('impresión automática local por equipo: desactivada de inicio, no historial, no duplicados, cola y cambio de proyecto',async()=>{
 const data=new Map(),storage={getItem:k=>data.get(k)||null,setItem:(k,v)=>data.set(k,v)};let ctx='project-a';let release;const print=vi.fn(()=>new Promise(r=>release=r)),notify=vi.fn(),find=id=>({...order,id});
 const auto=createAutoPrinter({storage,context:()=>ctx,find,print,notify});expect(auto.enqueue(order)).toBe(false);saveReceiptOptions({autoLocal:true,autoOnline:true},storage);expect(auto.enqueue(order,{initial:true,origin:'online'})).toBe(false);expect(auto.enqueue(order)).toBe(true);expect(auto.enqueue(order)).toBe(false);expect(auto.enqueue({...order,id:'next'})).toBe(true);ctx='project-b';release();await new Promise(r=>setTimeout(r,0));expect(print).toHaveBeenCalledTimes(1);expect(auto.idle()).toBe(true);ctx='project-a';const reopened=createAutoPrinter({storage,context:()=>ctx,find,print,notify});expect(reopened.enqueue(order)).toBe(false);
});
it('fallo de impresora avisa y no reintenta en bucle ni imprime pedidos cancelados',async()=>{
 const data=new Map(),storage={getItem:k=>data.get(k)||null,setItem:(k,v)=>data.set(k,v)};saveReceiptOptions({autoLocal:true},storage);const notify=vi.fn(),print=vi.fn(async()=>{throw Error('Sin impresora');});const auto=createAutoPrinter({storage,context:()=> 'p',find:()=>order,print,notify});expect(auto.enqueue({...order,status:'cancelado'})).toBe(false);expect(auto.enqueue(order)).toBe(true);await new Promise(r=>setTimeout(r,0));expect(notify).toHaveBeenCalledOnce();expect(auto.enqueue(order)).toBe(false);
});
