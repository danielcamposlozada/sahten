import {it,expect,vi} from 'vitest';
import {JSDOM} from 'jsdom';
import {deliveryNavigation,installDeliveryHandoff} from '../src/delivery/handoff.js';
const order={id:'delivery',num:12,source:'delivery',status:'listo',lat:-34.4970518,lng:-58.4899007,address:'Dirección de prueba',customerName:'Dato privado',customerPhone:'1100000000',total:50000};
it('ruta universal con destino exacto, sin origen fijo ni datos del cliente, para web y Mostrador',()=>{
 for(const o of [order,{...order,source:undefined,orderType:'delivery'}]){const r=deliveryNavigation(o),u=new URL(r.url);expect(u.origin+u.pathname).toBe('https://www.google.com/maps/dir/');expect(u.searchParams.get('api')).toBe('1');expect(u.searchParams.get('destination')).toBe('-34.4970518,-58.4899007');expect(u.searchParams.get('dir_action')).toBe('navigate');expect(u.searchParams.has('origin')).toBe(false);expect(r.exact).toBe(true);expect(r.url).not.toContain('privado');expect(r.url).not.toContain('1100000000');}
});
it('solo pedidos aceptados de delivery; sin enlaces en pendientes, cancelados, completados o retiro',()=>{
 for(const status of ['pendiente','cancelado','entregado','retirado','inventado'])expect(deliveryNavigation({...order,status})).toBeNull();
 expect(deliveryNavigation({...order,source:'pickup'})).toBeNull();for(const status of ['en_preparacion','listo','enviado'])expect(deliveryNavigation({...order,status})).not.toBeNull();
});
it('pedidos anteriores usan su dirección cuando faltan coordenadas; no inventa ubicaciones si faltan ambos',()=>{
 const r=deliveryNavigation({...order,lat:null,lng:null,address:'Río & Sol 10, 3º A, Olivos'});expect(r.exact).toBe(false);expect(new URL(r.url).searchParams.get('destination')).toBe('Río & Sol 10, 3º A, Olivos');
 for(const p of [{lat:null,lng:null},{lat:NaN,lng:500},{lat:'-34.5',lng:'-58.4'}])expect(deliveryNavigation({...order,...p,address:''})).toBeNull();
});
function setup(){const dom=new JSDOM('<body></body>'),w=dom.window;let current={...order};w.sahtenOrders=()=>[current];w.sahtenToast=vi.fn();w.sahtenDialog=vi.fn(async()=>true);const clipboard={writeText:vi.fn(async()=>{})};Object.defineProperty(w.navigator,'clipboard',{value:clipboard});return {w,dom,clipboard,api:installDeliveryHandoff(w),change:patch=>current={...current,...patch}};}
it('copia solo la URL y no cambia estado del pedido; revalida que siga aceptado al pulsar',async()=>{
 const a=setup();try{await a.api.copy(order.id);expect(a.clipboard.writeText).toHaveBeenCalledWith(deliveryNavigation(order).url);a.change({status:'cancelado'});await a.api.copy(order.id);expect(a.clipboard.writeText).toHaveBeenCalledTimes(1);expect(a.w.sahtenToast).toHaveBeenLastCalledWith(expect.stringContaining('al aceptar'));}finally{a.w.close();}
});
it('compartir abre el selector del sistema con número y ruta; cancelar no copia ni marca enviado',async()=>{
 const a=setup();try{Object.defineProperty(a.w.navigator,'share',{configurable:true,value:vi.fn(async()=>{})});await a.api.share(order.id);expect(a.w.navigator.share).toHaveBeenCalledWith({title:'Reparto #0012',text:'Pedido #0012 · Ruta para la entrega',url:deliveryNavigation(order).url});a.w.navigator.share.mockRejectedValue({name:'AbortError'});await a.api.share(order.id);expect(a.clipboard.writeText).not.toHaveBeenCalled();expect(a.w.sahtenOrders()[0].status).toBe('listo');}finally{a.w.close();}
});
it('si no se puede compartir o copiar, ofrece un enlace de solo lectura para copiar manualmente',async()=>{
 const a=setup();try{await a.api.share(order.id);expect(a.clipboard.writeText).toHaveBeenCalledTimes(1);a.clipboard.writeText.mockRejectedValue(Error('Permiso denegado'));await a.api.copy(order.id);expect(a.w.sahtenDialog).toHaveBeenCalled();const body=a.w.sahtenDialog.mock.calls[0][0].body,input=body.querySelector('input');expect(input.readOnly).toBe(true);expect(input.value).toBe(deliveryNavigation(order).url);expect(body.textContent).not.toContain('Dato privado');}finally{a.w.close();}
});
