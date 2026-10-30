import {it,expect,vi} from 'vitest';
import {JSDOM} from 'jsdom';
import {installDeliveryConfiguration} from '../src/delivery/configuration.js';
import {deliveryConfiguration,applyDeliveryConfiguration,deliveryConfigurationFingerprint} from '../src/core/delivery-configuration.js';
import {sahtenDeliveryPolicy,sahtenOpeningHours} from '../src/delivery/preset.js';
import {createAvailabilityPublisher} from '../src/online/availability.js';
const clone=v=>JSON.parse(JSON.stringify(v));
function setup(){
 const dom=new JSDOM('<div id="delivery-config-legacy-control"></div>'),w=dom.window,p=sahtenDeliveryPolicy();
 let cfg={address:p.center.address,lat:p.center.lat,lng:p.center.lng,deliveryV2:p,deliveryHours:p.hours,openingHours:sahtenOpeningHours(),paymentMethods:{efectivo:true},bankDetails:{cbu:'no-enviar'},zones:[],deliveryMinOrder:0,freeShippingMin:0,costPerKm:0};
 const events=[];let info={changes:{},states:{},state:'sin cambios',pending:0};
 w._getTiendaConfig=()=>clone(cfg);w._saveTiendaConfig=v=>cfg=clone(v);w.scheduleSave=vi.fn();
 w.SAHTEN={project:{session:{id:'p1',readOnly:false},markDirty:vi.fn()},online:{conn:()=>({storeId:'s',url:'https://db.test'}),configurationPublisher:{info:()=>info,discard:vi.fn(),flush:vi.fn(async()=>{})}},delivery:{admin:{configurationChanged:vi.fn(),mount:vi.fn()}}};
 const api=installDeliveryConfiguration(w);w.SAHTEN.delivery.configuration=api;w.addEventListener('sahten:delivery-configuration',e=>events.push(e.detail.value));
 api.mountLegacy();return {w,api,events,cfg:()=>clone(cfg),set:v=>cfg=clone(v),q:v=>info=v,close:()=>w.close()};
}
it('guardar aísla los datos comerciales de delivery de horarios, pagos y precios del catálogo',()=>{
 const a=setup();try{const cfg=a.cfg();cfg.deliveryV2.zones[0].minOrder=12000;const untouched=clone(cfg);
 expect(a.api.save(cfg)).toBe(true);expect(a.cfg().deliveryV2.zones[0].minOrder).toBe(12000);expect(a.cfg().openingHours).toEqual(untouched.openingHours);expect(a.cfg().deliveryHours).toEqual(untouched.deliveryHours);expect(a.cfg().bankDetails).toEqual(untouched.bankDetails);
 expect(a.events).toHaveLength(1);expect(JSON.stringify(a.events[0])).not.toMatch(/bankDetails|no-enviar|paymentMethods|openingHours|"hours"|products/);expect(a.events[0]).toMatchObject({revision:null,parentRevision:null,configuration:{version:1}});
 }finally{a.close();}
});
it('un acuse propio no pisa una edición posterior; conserva horarios y los interruptores vivos',()=>{
 const a=setup();try{let c=a.cfg();c.deliveryV2.zones[0].minOrder=12000;a.api.save(c);const one=a.events[0];
 c=a.cfg();c.deliveryV2.zones[0].minOrder=13000;c.deliveryV2.zones[0].enabled=false;a.set(c);a.api.save(c);const two=a.events[1];expect(two.parentRevision).toBe(one.requestId);
 a.api.ack(one,{configuration:one.configuration,revision:one.requestId,updatedAt:'2026-10-30T22:00:00Z'});expect(a.cfg().deliveryV2.zones[0].minOrder).toBe(13000);
 a.api.ack(two,{configuration:two.configuration,revision:two.requestId,updatedAt:'2026-10-30T22:01:00Z'});expect(a.cfg().deliveryV2.zones[0]).toMatchObject({minOrder:13000,enabled:false});expect(a.cfg().deliveryV2.hours).toEqual(c.deliveryHours);
 const before=a.cfg();a.api.applyRemote({configuration:one.configuration,revision:one.requestId},{...before,deliveryConfigurationRevision:one.requestId});expect(a.api.revision()).toBe(two.requestId);
 }finally{a.close();}
});
it('una lectura inicial no descarta un ajuste local sin publicar; un equipo ya vinculado adopta el nuevo mínimo',()=>{
 const a=setup();try{const c=deliveryConfiguration(a.cfg()),changed=clone(c);changed.policy.zones[0].minOrder=11000;
 a.api.applyRemote({configuration:changed,revision:'r1'},a.cfg());expect(a.cfg().deliveryV2.zones[0].minOrder).not.toBe(11000);
 expect(a.w.document.querySelector('[data-delivery-config-reload]').hidden).toBe(false);expect(a.w.document.querySelector('[data-delivery-config-status]').textContent).toContain('sin vincular');
 const local=a.cfg();local.deliveryConfigurationRevision='r1';a.set(local);a.api.applyRemote({configuration:changed,revision:'r2'},a.cfg());expect(a.cfg().deliveryV2.zones[0].minOrder).toBe(11000);expect(a.cfg().deliveryConfigurationRevision).toBe('r2');
 }finally{a.close();}
});
it('el estado confirma o muestra pendiente/error; cajero y solo lectura no publican configuración',()=>{
 const a=setup();try{a.q({state:'error',pending:1,changes:{configuration:{}},error:'Sin conexión'});a.api.refreshStatus();expect(a.w.document.querySelector('[data-delivery-config-status]').textContent).toContain('pendiente');expect(a.w.document.querySelector('[data-delivery-config-retry]').hidden).toBe(false);
 a.q({state:'publicado',pending:0,changes:{}});a.api.refreshStatus();expect(a.w.document.querySelector('[data-delivery-config-status]').textContent).toContain('confirmada en la web');
 a.w.document.body.dataset.role='cajero';expect(a.api.save(a.cfg())).toBe(false);expect(a.events).toHaveLength(0);
 a.w.document.body.dataset.role='owner';a.w.SAHTEN.project.session.readOnly=true;expect(a.api.save(a.cfg())).toBe(false);
 }finally{a.close();}
});
it('la huella ignora el orden de claves y la aplicación de configuración no arrastra campos ajenos',()=>{
 const a=setup();try{const c=deliveryConfiguration(a.cfg()),other={policy:c.policy,legacy:c.legacy,origin:c.origin,version:1};expect(deliveryConfigurationFingerprint(c)).toBe(deliveryConfigurationFingerprint(other));
 const applied=applyDeliveryConfiguration(a.cfg(),c,{revision:'r'});expect(applied.paymentMethods).toEqual({efectivo:true});expect(applied.deliveryV2.revision).toBe('r');
 }finally{a.close();}
});
it('la cola conserva la última configuración sin conexión y la separa por tienda/proyecto',async()=>{
 let context='p1',offline=true;const data={},calls=[];const args={namespace:'delivery-configuration',store:{get:(k,d)=>data[k]??d,set:(k,v)=>data[k]=clone(v)},context:()=>context,enabled:()=>true,timer:{set:()=>0,clear:()=>{}},accepts:v=>v?.configuration?.version===1,publish:async(_id,value)=>{calls.push(value);if(offline)throw Object.assign(Error('offline'),{offline:true});}};
 const q=createAvailabilityPublisher(args),value={configuration:{version:1},revision:null,requestId:'one'};q.set('configuration',value);await expect(q.flush()).rejects.toThrow('offline');const restored=createAvailabilityPublisher(args);expect(restored.info().pending).toBe(1);context='p2';expect(restored.info().pending).toBe(0);context='p1';offline=false;await restored.flush();expect(restored.info().pending).toBe(0);expect(calls).toEqual([value,value]);
});
