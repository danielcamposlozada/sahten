import { validDeliveryHours, deliveryHours } from '../core/delivery.js';
import { emptyServiceHours, serviceHoursMessage } from '../core/service-hours.js';
import './admin.css';

const copy = value => JSON.parse(JSON.stringify(value));
const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const fields = { opening: 'openingHours', delivery: 'deliveryHours' };
const days = ['Domingo','Lunes','Martes','Miércoles','Jueves','Viernes','Sábado'];

/** Dos calendarios independientes. Guardar envía únicamente el calendario elegido. */
export function installServiceHours(w) {
  let host, context = '', revisions = {}, forms = {};
  const identity = () => JSON.stringify([w.SAHTEN.project.session.id, w.SAHTEN.online?.conn()?.url, w.SAHTEN.online?.conn()?.storeId]);
  const ensure = () => { const next = identity(); if (next !== context) { context = next; revisions = {}; forms = {}; } };
  const canEdit = () => !w.SAHTEN.project.session.readOnly && (!w.document.body.dataset.role || ['owner','admin'].includes(w.document.body.dataset.role));
  const configured = (cfg, kind) => cfg[fields[kind]] ?? (kind === 'delivery' ? cfg.deliveryV2?.hours : null) ?? emptyServiceHours();
  function persist(cfg) {
    w._saveTiendaConfig(cfg);
    if (!w.SAHTEN.project.session.readOnly) { w.SAHTEN.project.markDirty(); w.scheduleSave?.(); }
    refreshPosNotice();
  }
  function save(kind, hours, revision) {
    ensure(); if(revision===undefined)revision=revisions[kind]??null; if (!Object.hasOwn(fields,kind) || !canEdit() || !hours || !validDeliveryHours(hours)) return false;
    const cfg = w._getTiendaConfig(); cfg[fields[kind]] = copy(hours);
    if (kind === 'delivery' && cfg.deliveryV2) cfg.deliveryV2 = {...cfg.deliveryV2, hours:copy(hours)};
    persist(cfg);
    if(forms[kind]){forms[kind].hours=copy(hours);forms[kind].invalid=false;}
    w.dispatchEvent(new w.CustomEvent('sahten:service-hours', {detail:{kind, value:{hours:copy(hours), revision}}}));
    refreshStatus(); return true;
  }
  function applyRemote(remote, before) {
    ensure(); const cfg = w._getTiendaConfig(); let changed = false;
    for (const kind of Object.keys(fields)) {
      const row = remote?.[kind]; if (!row) continue;
      if (w.SAHTEN.online?.hoursPublisher?.info().changes[kind] || !row.hours || !validDeliveryHours(row.hours)) continue;
      if (before && JSON.stringify(configured(cfg,kind)) !== JSON.stringify(configured(before,kind))) continue;
      revisions[kind] = row.revision ?? null;
      if (JSON.stringify(configured(cfg,kind)) !== JSON.stringify(row.hours)) {
        cfg[fields[kind]] = copy(row.hours);
        if (kind === 'delivery' && cfg.deliveryV2) cfg.deliveryV2 = {...cfg.deliveryV2,hours:copy(row.hours)};
        changed = true;
      }
      if (forms[kind] && !forms[kind].dirty) { forms[kind].hours = copy(row.hours); forms[kind].revision = revisions[kind];forms[kind].invalid=false; }
    }
    if (changed) { persist(cfg); if (host?.isConnected && !Object.values(forms).some(f=>f.dirty)) mount(); }
    refreshStatus();
  }
  function ack(kind, row) { ensure(); revisions[kind] = row.revision; if (forms[kind]) forms[kind].revision = row.revision; }
  function refreshStatus() {
    if (!host?.isConnected) return;
    const q = w.SAHTEN.online?.hoursPublisher?.info(), connected = !!w.SAHTEN.online?.conn()?.storeId;
    for (const kind of Object.keys(fields)) {
      const form = forms[kind]; if (!form) continue;
      const pending = !!q?.changes[kind], conflict = form.dirty && form.revision !== (revisions[kind] ?? null);
      const status = host.querySelector('[data-hours-status="'+kind+'"]');
      if (status) status.textContent = conflict ? 'Este horario cambió en otro equipo. Cargá el horario de la web antes de editarlo.' : pending ? q.state === 'publicando' ? 'Aplicando este horario en la web…' : q.error ? 'Pendiente: '+q.error : 'Pendiente de enviar a la web.' : form.invalid ? 'El horario importado no es válido. Revisá y guardá un horario correcto; hasta entonces, las ventas web de este servicio permanecen cerradas.' : form.dirty ? 'Cambios sin guardar.' : !connected ? 'Solo en este proyecto. Conectá la tienda para aplicarlo en la web.' : q?.states[kind] === 'publicado' ? 'Horario confirmado en la web.' : 'Al guardar se actualiza la web automáticamente, sin subir archivos ni publicar precios.';
      const button = host.querySelector('[data-hours-save="'+kind+'"]'); if (button) button.disabled = !canEdit() || conflict || q?.states[kind] === 'publicando';
      const retry = host.querySelector('[data-hours-retry="'+kind+'"]'); if (retry) retry.hidden = !pending;
      const reload = host.querySelector('[data-hours-reload="'+kind+'"]'); if (reload) {reload.hidden = !(conflict || pending && q?.state === 'error');reload.disabled=q?.states[kind]==='publicando';}
    }
  }
  function mount() {
    ensure(); host = w.document.getElementById('service-hours-settings'); if (!host) return;
    const cfg = w._getTiendaConfig();
    for (const kind of Object.keys(fields)) if (!forms[kind]?.dirty) {
      const raw=configured(cfg,kind),invalid=!validDeliveryHours(raw);
      const hours=invalid?{...emptyServiceHours(),enabled:true}:copy(raw);
      forms[kind]={hours,revision:revisions[kind] ?? null,dirty:false,invalid};
    }
    render();
  }
  function render() {
    const periods = (kind,scope,list) => list.map((p,i)=>`<div class="delivery-benefit-row"><label>Desde<input type="time" data-service-period="${kind}:${scope}:${i}:start" value="${esc(p.start)}"></label><label>Hasta<input type="time" data-service-period="${kind}:${scope}:${i}:end" value="${esc(p.end)}"></label><button type="button" class="btn" data-service-remove="${kind}:${scope}:${i}" aria-label="Quitar turno ${i+1}">Quitar turno</button></div>`).join('');
    host.innerHTML = Object.entries(fields).map(([kind])=>{
      const h=forms[kind].hours;
      return `<section class="card service-hours-card"><div class="card-header"><h3>${kind==='opening'?'Apertura y retiro en local':'Horario de delivery'}</h3></div><div class="card-body"><p>${kind==='opening'?'Define cuándo se aceptan retiros desde la web. En Mostrador se avisa fuera de horario, pero se permite cobrar.':'Se usa solo para entregas a domicilio. Puede ser distinto de la apertura del local; pausar delivery no cambia este horario.'}</p><label class="delivery-switch"><input type="checkbox" data-service-enabled="${kind}" ${h.enabled?'checked':''}> Respetar este horario</label><label>Zona horaria<input data-service-zone="${kind}" value="${esc(h.timeZone)}" placeholder="America/Argentina/Buenos_Aires"></label><details ${kind==='opening'?'open':''}><summary>Editar días y turnos</summary><div class="delivery-hours-days">${h.weekly.map((list,day)=>`<section><strong>${days[day]}</strong>${list.length?'':' · cerrado'}${periods(kind,'w'+day,list)}<button type="button" class="btn" data-service-add="${kind}:w${day}">Agregar turno</button></section>`).join('')}</div><p>Un turno que cierra antes de su inicio termina al día siguiente. El cierre es exacto.</p><h4>Feriados y fechas especiales</h4>${h.exceptions.map((ex,i)=>`<section><label>Fecha<input type="date" data-service-date="${kind}:${i}" value="${esc(ex.date)}"></label>${ex.periods.length?'':'<p>Cerrado este día</p>'}${periods(kind,'e'+i,ex.periods)}<button type="button" class="btn" data-service-add="${kind}:e${i}">Agregar turno especial</button><button type="button" class="btn" data-service-exception-remove="${kind}:${i}">Quitar fecha</button></section>`).join('')}<button type="button" class="btn" data-service-exception="${kind}">Agregar fecha especial</button></details><div class="delivery-admin-actions"><button type="button" class="btn btn-accent" data-hours-save="${kind}">Guardar horario y aplicar en web</button><button type="button" class="btn" data-hours-retry="${kind}" hidden>Reintentar</button><button type="button" class="btn" data-hours-reload="${kind}" hidden>Usar horario de la web</button></div><p role="status" aria-live="polite" data-hours-status="${kind}"></p></div></section>`;
    }).join('');
    if (!canEdit()) host.querySelectorAll('input,button').forEach(el=>el.disabled=true);
    host.oninput = host.onchange = e => {
      if (!canEdit()) return; const el=e.target;let kind;
      if (el.dataset.serviceEnabled) {kind=el.dataset.serviceEnabled;forms[kind].hours.enabled=el.checked;}
      else if (el.dataset.serviceZone) {kind=el.dataset.serviceZone;forms[kind].hours.timeZone=el.value.trim();}
      else if (el.dataset.servicePeriod) {const [k,scope,i,key]=el.dataset.servicePeriod.split(':');kind=k;list(kind,scope)[Number(i)][key]=el.value;}
      else if (el.dataset.serviceDate) {const [k,i]=el.dataset.serviceDate.split(':');kind=k;forms[kind].hours.exceptions[Number(i)].date=el.value;}
      if (kind) {forms[kind].dirty=true;refreshStatus();}
    };
    host.onclick = async e => {
      const b=e.target.closest('button');if (!b || !canEdit()) return;
      const kind=b.dataset.hoursSave;
      if (kind) {
        if (!validDeliveryHours(forms[kind].hours)) {host.querySelector('[data-hours-status="'+kind+'"]').textContent='Revisá las fechas, la zona horaria y cada turno: inicio y cierre deben ser diferentes.';return;}
        if(save(kind,forms[kind].hours,forms[kind].revision)){forms[kind].dirty=false;refreshStatus();}return;
      }
      if (b.dataset.hoursRetry) {w.SAHTEN.online.hoursPublisher.flush().catch(()=>{});return;}
      if (b.dataset.hoursReload) {w.SAHTEN.online.hoursPublisher.discard(b.dataset.hoursReload);forms[b.dataset.hoursReload].dirty=false;await w.SAHTEN.online.readStates();mount();return;}
      let k;
      if (b.dataset.serviceAdd) {const [kind,scope]=b.dataset.serviceAdd.split(':');k=kind;if(list(k,scope).length<4)list(k,scope).push({start:'',end:''});}
      else if (b.dataset.serviceRemove) {const [kind,scope,i]=b.dataset.serviceRemove.split(':');k=kind;list(k,scope).splice(Number(i),1);}
      else if (b.dataset.serviceException) {k=b.dataset.serviceException;if(forms[k].hours.exceptions.length<366)forms[k].hours.exceptions.push({date:'',periods:[]});}
      else if (b.dataset.serviceExceptionRemove) {const [kind,i]=b.dataset.serviceExceptionRemove.split(':');k=kind;forms[k].hours.exceptions.splice(Number(i),1);}
      if(k){forms[k].dirty=true;render();}
    };
    refreshStatus();
  }
  function list(kind,scope) {const h=forms[kind].hours;return scope[0]==='w'?h.weekly[Number(scope.slice(1))]:h.exceptions[Number(scope.slice(1))].periods;}
  function deliveryStatus() {const cfg=w._getTiendaConfig();return {...deliveryHours(cfg.deliveryHours??cfg.deliveryV2?.hours),kind:'delivery'};}
  function deliveryNotice() {return serviceHoursMessage(deliveryStatus());}
  function posNotice() {
    const status={...deliveryHours(w._getTiendaConfig().openingHours),kind:'opening'};
    return status.open?'':`<div class="info-banner" role="status">${esc(serviceHoursMessage(status))} En Mostrador podés continuar y cobrar.</div>`;
  }
  function refreshPosNotice() { const el=w.document.getElementById('most-opening-hours-notice');if(el)el.innerHTML=posNotice();const delivery=w.document.getElementById('most-delivery-hours-notice');if(delivery)delivery.innerHTML=deliveryStatus().open?'':`<div class="info-banner" role="status">${esc(deliveryNotice())}</div>`; }
  return {mount,save,applyRemote,ack,refreshStatus,posNotice,refreshPosNotice,deliveryStatus,deliveryNotice};
}
