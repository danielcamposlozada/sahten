import {it,expect,vi} from 'vitest';
import {JSDOM} from 'jsdom';
import {installServiceHours} from '../src/delivery/hours.js';
import {sahtenOpeningHours,sahtenDeliveryHours} from '../src/delivery/preset.js';
import {createAvailabilityPublisher} from '../src/online/availability.js';
const clone=v=>JSON.parse(JSON.stringify(v));
function setup(){
 const dom=new JSDOM('<div id="service-hours-settings"></div><div id="most-opening-hours-notice"></div><input id="other-draft" value="9000">'),w=dom.window;
 let cfg={openingHours:sahtenOpeningHours(),deliveryV2:{hours:sahtenDeliveryHours(),zones:[{baseCost:1000}]},deliveryHours:sahtenDeliveryHours()};
 let info={state:'sin cambios',states:{},changes:{}},context='p1';const events=[];
 w.SAHTEN={project:{session:{get id(){return context;},readOnly:false},markDirty:vi.fn()},online:{conn:()=>({storeId:'s',url:'https://db.test'}),hoursPublisher:{info:()=>info,discard:vi.fn(),flush:vi.fn(async()=>{})},readStates:vi.fn()}};
 w._getTiendaConfig=()=>clone(cfg);w._saveTiendaConfig=v=>cfg=clone(v);w.scheduleSave=vi.fn();
 w.addEventListener('sahten:service-hours',e=>events.push(e.detail));
 const api=installServiceHours(w);w.SAHTEN.delivery={hours:api};api.mount();
 const edit=(selector,value)=>{const el=w.document.querySelector(selector);el.value=value;el.dispatchEvent(new w.Event('change',{bubbles:true}));};
 return {w,api,events,edit,cfg:()=>cfg,q:v=>info=v,context:v=>context=v,close:()=>dom.window.close()};
}
it('edita y guarda solo un calendario; conserva costos y el otro servicio y no publica catálogo',()=>{
 const s=setup();try{const initial=clone(s.cfg());
 s.edit('[data-service-period="opening:w1:0:start"]','12:30');expect(s.cfg()).toEqual(initial);
 s.w.document.querySelector('[data-hours-save="opening"]').click();expect(s.cfg().openingHours.weekly[1][0].start).toBe('12:30');
 expect(s.cfg().deliveryHours).toEqual(initial.deliveryHours);expect(s.cfg().deliveryV2).toEqual(initial.deliveryV2);
 expect(s.events).toEqual([{kind:'opening',value:{hours:s.cfg().openingHours,revision:null}}]);
 s.edit('[data-service-period="delivery:w1:0:end"]','21:30');s.w.document.querySelector('[data-hours-save="delivery"]').click();
 expect(s.cfg().deliveryV2.hours).toEqual(s.cfg().deliveryHours);expect(s.cfg().deliveryV2.zones).toEqual(initial.deliveryV2.zones);
 expect(JSON.stringify(s.events)).not.toMatch(/baseCost|price|products|customers/);
 }finally{s.close();}
});
it('un horario remoto preserva borrador, foco y otros formularios; conflicto exige revisar la versión de la web',async()=>{
 const s=setup();try{s.api.applyRemote({opening:{hours:s.cfg().openingHours,revision:'old'}},s.cfg());
 s.edit('[data-service-period="opening:w1:0:start"]','12:30');const input=s.w.document.querySelector('[data-service-period="opening:w1:0:start"]');input.focus();
 const newer=sahtenOpeningHours();newer.weekly[1][0].start='13:00';s.api.applyRemote({opening:{hours:newer,revision:'new'}},s.cfg());
 expect(input.value).toBe('12:30');expect(s.w.document.activeElement).toBe(input);expect(s.w.document.querySelector('#other-draft').value).toBe('9000');
 expect(s.w.document.querySelector('[data-hours-save="opening"]').disabled).toBe(true);expect(s.w.document.querySelector('[data-hours-status="opening"]').textContent).toContain('otro equipo');
 s.w.SAHTEN.online.readStates=vi.fn(async()=>s.api.applyRemote({opening:{hours:newer,revision:'new'}},s.cfg()));
 s.w.document.querySelector('[data-hours-reload="opening"]').click();await Promise.resolve();await Promise.resolve();
 expect(s.w.SAHTEN.online.hoursPublisher.discard).toHaveBeenCalledWith('opening');expect(s.w.document.querySelector('[data-service-period="opening:w1:0:start"]').value).toBe('13:00');
 s.edit('[data-service-period="opening:w1:0:start"]','13:30');s.w.document.querySelector('[data-hours-save="opening"]').click();expect(s.events.at(-1).value.revision).toBe('new');
 }finally{s.close();}
});
it('conserva un borrador al reabrir Ajustes y una confirmación propia permite seguir editándolo',()=>{
 const s=setup();try{s.api.applyRemote({opening:{hours:s.cfg().openingHours,revision:'v1'}},s.cfg());s.edit('[data-service-period="opening:w1:0:start"]','12:15');s.api.mount();expect(s.w.document.querySelector('[data-service-period="opening:w1:0:start"]').value).toBe('12:15');
 s.w.document.querySelector('[data-hours-save="opening"]').click();s.edit('[data-service-period="opening:w1:0:start"]','12:30');s.api.ack('opening',{revision:'v2'});s.api.refreshStatus();expect(s.w.document.querySelector('[data-hours-save="opening"]').disabled).toBe(false);s.w.document.querySelector('[data-hours-save="opening"]').click();expect(s.events.at(-1).value.revision).toBe('v2');
 }finally{s.close();}
});
it('la vista de Mostrador solo avisa fuera de apertura; roles sin administración no guardan horarios',()=>{
 vi.useFakeTimers({toFake:['Date']});vi.setSystemTime(new Date('2026-10-30T14:00:00Z'));const s=setup();try{
 expect(s.api.posNotice()).toContain('Mostrador podés continuar y cobrar');s.api.refreshPosNotice();expect(s.w.document.getElementById('most-opening-hours-notice').textContent).toContain('fuera de horario');
 vi.setSystemTime(new Date('2026-10-30T16:00:00Z'));s.api.refreshPosNotice();expect(s.w.document.getElementById('most-opening-hours-notice').textContent).toBe('');expect(s.api.deliveryStatus().open).toBe(false);
 s.w.document.body.dataset.role='cajero';s.api.mount();expect(s.w.document.querySelector('[data-hours-save="opening"]').disabled).toBe(true);expect(s.api.save('opening',sahtenOpeningHours())).toBe(false);expect(s.events).toHaveLength(0);
 }finally{s.close();vi.useRealTimers();}
});
it('cola de horarios es persistente y aislada por proyecto: no pierde cambios ante un conflicto ni toca los booleanos',async()=>{
 let context='a';const data={},calls=[];const store={get:(k,d)=>data[k]??d,set:(k,v)=>data[k]=clone(v)};
 const args={namespace:'service-hours',accepts:v=>!!v?.hours,publish:async(kind,value)=>{calls.push([kind,value]);if(kind==='opening')throw Object.assign(Error('service_hours_conflict'),{status:409});},store,context:()=>context,enabled:()=>true,timer:{set:()=>0,clear:()=>{}}};
 const q=createAvailabilityPublisher(args);q.set('opening',{hours:sahtenOpeningHours(),revision:'v1'});q.set('delivery',{hours:sahtenDeliveryHours(),revision:null});await q.flush();expect(calls).toHaveLength(2);expect(q.info().changes.opening.available.revision).toBe('v1');expect(q.info().changes.delivery).toBeUndefined();expect(q.info().state).toBe('error');
 const restored=createAvailabilityPublisher(args);expect(restored.info().pending).toBe(1);context='b';expect(restored.info().pending).toBe(0);context='a';restored.discard('opening');expect(restored.info().pending).toBe(0);
});

it('una lectura iniciada antes de guardar no revierte la revisión confirmada propia',()=>{
 const s=setup();try{const before=clone(s.cfg());s.api.applyRemote({opening:{hours:before.openingHours,revision:'r1'}},before);const changed=clone(before.openingHours);changed.weekly[1][0].start='12:30';s.api.save('opening',changed,'r1');s.api.ack('opening',{revision:'r2'});
 s.api.applyRemote({opening:{hours:before.openingHours,revision:'r1'}},before);s.edit('[data-service-period="opening:w1:0:start"]','12:45');expect(s.w.document.querySelector('[data-hours-save=opening]').disabled).toBe(false);s.w.document.querySelector('[data-hours-save=opening]').click();expect(s.events.at(-1).value.revision).toBe('r2');expect(s.cfg().openingHours.weekly[1][0].start).toBe('12:45');
 }finally{s.close();}
});
it('un horario importado corrupto no rompe Ajustes ni abre ventas automáticamente',()=>{
 const s=setup();try{const cfg=s.cfg();cfg.openingHours={enabled:true,weekly:null};s.api.mount();expect(s.w.document.querySelector('[data-hours-status=opening]').textContent).toContain('no es válido');expect(s.cfg().openingHours.weekly).toBeNull();expect(s.api.posNotice()).toContain('revisar su horario');expect(s.events).toHaveLength(0);expect(s.w.document.querySelectorAll('[data-service-add^="opening:"]')).toHaveLength(7);
 }finally{s.close();}
});
