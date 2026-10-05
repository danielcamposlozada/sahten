// ═══════════════════════════════════════════════════════════
// SAHTEN — ASISTENTE DE ESTRATEGIA (v3) · Proyección
// Lee todo el proyecto, diagnostica con ingeniería de menú (Kasavana & Smith),
// hace preguntas según los datos y propone escenarios con vista previa,
// aplicación con respaldo y deshacer. 100% offline, basado en reglas.
// ═══════════════════════════════════════════════════════════
(function(){
const css=`
.es-ov{position:fixed;inset:0;z-index:9300;background:rgba(10,20,12,.55);backdrop-filter:blur(6px);-webkit-backdrop-filter:blur(6px);display:flex;align-items:center;justify-content:center;padding:14px}
.es-box{background:var(--card,#fff);color:var(--ink);border-radius:20px;width:100%;max-width:980px;max-height:calc(100vh - 28px);display:flex;flex-direction:column;box-shadow:0 24px 80px rgba(0,0,0,.35);overflow:hidden}
.es-head{padding:18px 24px 12px;border-bottom:1px solid var(--border);display:flex;gap:14px;align-items:center}
.es-head h3{margin:0;font-size:18px;letter-spacing:-.02em;flex:1}
.es-tabs{display:flex;gap:4px;padding:10px 24px 0;flex-wrap:wrap}.es-tab{font-size:12px;font-weight:600;padding:6px 12px;border-radius:99px;color:var(--muted);background:transparent;border:none;font-family:inherit}
.es-tab.on{background:var(--sand2);color:var(--ink)}
.es-body{padding:18px 24px;overflow-y:auto;display:flex;flex-direction:column;gap:16px}
.es-foot{padding:12px 24px 16px;border-top:1px solid var(--border);display:flex;gap:10px;align-items:center}
.es-kpis{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:10px}
.es-kpi{background:var(--sand);border-radius:12px;padding:12px 14px}.es-kpi small{display:block;font-size:11px;color:var(--muted);margin-bottom:4px}.es-kpi b{font-size:18px;font-family:'DM Mono',monospace}
.es-kpi em{display:block;font-style:normal;font-size:11px;margin-top:3px}
.es-sec h4{margin:0 0 8px;font-size:13px;text-transform:uppercase;letter-spacing:.4px;color:var(--muted)}
.es-mx{display:grid;grid-template-columns:1fr 1fr;gap:8px}.es-q{border-radius:12px;padding:12px;border:1px solid var(--border)}
.es-q b{font-size:13px}.es-q p{margin:4px 0 6px;font-size:11px;color:var(--muted);line-height:1.4}.es-q div{font-size:12px;line-height:1.6}
.es-warn{font-size:12px;line-height:1.5;padding:10px 12px;border-radius:10px;background:rgba(242,140,0,.1);border:1px solid rgba(242,140,0,.3)}
.es-goals{display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:10px}
.es-goal{border:1.5px solid var(--border);border-radius:14px;padding:14px;cursor:pointer;text-align:left;background:transparent;color:var(--ink);font-family:inherit;display:flex;flex-direction:column;gap:4px}
.es-goal.on{border-color:var(--accent);box-shadow:0 0 0 3px rgba(242,140,0,.12)}.es-goal b{font-size:14px}.es-goal span{font-size:12px;color:var(--muted);line-height:1.4}
.es-qq{border:1px solid var(--border);border-radius:14px;padding:14px;display:flex;flex-direction:column;gap:8px}.es-qq b{font-size:14px}.es-qq p{margin:0;font-size:12px;color:var(--muted);line-height:1.45}
.es-chips{display:flex;flex-wrap:wrap;gap:6px}.es-chip{padding:6px 12px;border-radius:99px;border:1.5px solid var(--border);background:transparent;color:var(--ink);font-size:12px;cursor:pointer;font-family:inherit}.es-chip.on{background:var(--accent);border-color:var(--accent);color:#fff;font-weight:600}
.es-in{border:1.5px solid var(--border);border-radius:10px;padding:8px 10px;font-size:14px;font-family:inherit;background:var(--sand);color:var(--ink);outline:none;width:140px}
.es-sc{display:grid;grid-template-columns:repeat(auto-fit,minmax(210px,1fr));gap:10px}
.es-scard{border:1.5px solid var(--border);border-radius:14px;padding:14px;cursor:pointer;text-align:left;background:transparent;color:var(--ink);font-family:inherit;display:flex;flex-direction:column;gap:6px}
.es-scard.on{border-color:var(--accent);box-shadow:0 0 0 3px rgba(242,140,0,.12)}.es-scard b{font-size:14px}.es-scard span{font-size:12px;color:var(--muted);line-height:1.4}
.es-ok{color:var(--green);font-weight:700}.es-no{color:var(--red);font-weight:700}
.es-tbl{width:100%;border-collapse:collapse;font-size:12px}.es-tbl th{text-align:left;font-size:10px;text-transform:uppercase;letter-spacing:.4px;color:var(--muted);padding:6px 8px;border-bottom:1px solid var(--border);white-space:nowrap}
.es-tbl td{padding:7px 8px;border-bottom:1px solid var(--border);vertical-align:top}.es-tbl .n{text-align:right;font-family:'DM Mono',monospace;white-space:nowrap}
.es-tbl tr.off td{opacity:.4}.es-why{font-size:11px;color:var(--muted);margin-top:2px;line-height:1.35}
.es-btn{border:1.5px solid var(--border);background:transparent;color:var(--ink);border-radius:11px;padding:9px 16px;font-size:13px;font-weight:600;cursor:pointer;font-family:inherit}.es-btn.pri{background:var(--accent);border-color:var(--accent);color:#fff}
.es-banner{display:flex;align-items:center;gap:10px;flex-wrap:wrap;padding:10px 14px;margin-bottom:14px;border-radius:12px;background:rgba(35,83,40,.08);border:1px solid rgba(35,83,40,.25);font-size:13px}
.es-launch{display:flex;align-items:center;gap:12px;flex-wrap:wrap;padding:14px 16px;margin-bottom:14px;border-radius:var(--r,14px);background:var(--card,#fff);border:1px solid var(--border);box-shadow:var(--shadow)}
@media(max-width:640px){.es-mx{grid-template-columns:1fr}}`;
const st=document.createElement('style'); st.textContent=css; document.head.appendChild(st);
const esc=s=>String(s??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[m]));
const pct=(v,d=1)=>(isFinite(v)?(v*100).toFixed(d):'—')+'%';
const sgn=v=>v>0?'+':'';
// El modelo (diagnóstico, cuadrantes, simulación y escenarios) vive en src/core/menuEngineering.js
const ME=SAHTEN.core, ST=SAHTEN.state;
const {QN,QD,ELAST}=ME;
const classify=ME.classify;
function simulate(rows,ch,E){ return ME.simulate(ST,rows,ch,E); }
function diagnose(){ return ME.diagnose(ST); }

// ── Estado del asistente ─────────────────────────────────
let D=null, S=null, tab='diag';
function initState(){ D=diagnose(); S=ME.defaultAnswers(D); }
window.openStrategy=function(){ if(!PRODUCTS.filter(p=>!p.recetaOnly).length){ alert('Cargá al menos un producto con su receta para usar el asistente.'); return; } initState(); tab='diag'; render(); };
function close(){ document.getElementById('es-ov')?.remove(); }
window.esClose=close;
window.esTab=t=>{ if(t==='prev'&&!S.scenario){ S.scenario=buildScenarios().find(x=>x.ok)?.key||'combo'; } tab=t; render(); };
window.esSet=(k,v,re=true)=>{ S[k]=v; if(re) render(); };
window.esLock=id=>{ const i=S.locked.indexOf(id); if(i>=0) S.locked.splice(i,1); else S.locked.push(id); render(); };
window.esPick=k=>{ S.scenario=k; S.acc={}; tab='prev'; render(); };
window.esAcc=(key,v)=>{ S.acc[key]=v; render(); };

// ── Escenarios ───────────────────────────────────────────
function goalMet(base,sim){ return ME.goalMet(ST,S,base,sim); }
function buildScenarios(){ return ME.buildScenarios(ST,S,D); }

// ── Render ───────────────────────────────────────────────
function kpiHtml(base,sim){
  const k=(t,a,b,fmtF,goodUp=true)=>{ const d=b-a; const col=!isFinite(d)||Math.abs(d)<1e-9?'var(--muted)':((d>0)===goodUp?'var(--green)':'var(--red)'); return `<div class="es-kpi"><small>${t}</small><b>${fmtF(b)}</b>${sim?`<em style="color:${col}">antes ${fmtF(a)}</em>`:''}</div>`; };
  const s=sim||base;
  return `<div class="es-kpis">${k('Resultado mensual',base.resultado,s.resultado,fmt)}${k('Margen de contribución',base.cmTot,s.cmTot,fmt)}${k('Costo de materia prima',base.fc,s.fc,v=>pct(v),false)}${k('Punto de equilibrio',base.beUnits||0,s.beUnits||0,v=>v?Math.round(v).toLocaleString('es-AR')+' u.':'—',false)}${k('Cobertura de GF',base.coverage,s.coverage,v=>pct(v,0))}</div>`;
}
function render(){
  let ov=document.getElementById('es-ov'); if(!ov){ ov=document.createElement('div'); ov.id='es-ov'; ov.className='es-ov'; ov.addEventListener('click',e=>{ if(e.target===ov) close(); }); document.body.appendChild(ov); }
  const T=[['diag','1 · Diagnóstico'],['goal','2 · Objetivo'],['ask','3 · Preguntas'],['scen','4 · Escenarios'],['prev','5 · Vista previa']];
  let body='',foot='';
  if(tab==='diag'){ body=viewDiag(); foot=`<span style="flex:1"></span><button class="es-btn pri" onclick="esTab('goal')">Elegir objetivo</button>`; }
  if(tab==='goal'){ body=viewGoal(); foot=`<button class="es-btn" onclick="esTab('diag')">Atrás</button><span style="flex:1"></span><button class="es-btn pri" onclick="esTab('ask')">Siguiente</button>`; }
  if(tab==='ask'){ body=viewAsk(); foot=`<button class="es-btn" onclick="esTab('goal')">Atrás</button><span style="flex:1"></span><button class="es-btn pri" onclick="esTab('scen')">Ver escenarios</button>`; }
  if(tab==='scen'){ body=viewScen(); foot=`<button class="es-btn" onclick="esTab('ask')">Atrás</button><span style="flex:1"></span>`; }
  if(tab==='prev'){ const r=viewPrev(); body=r.html; foot=`<button class="es-btn" onclick="esTab('scen')">Otros escenarios</button><span style="flex:1;font-size:12px;color:var(--muted)">${r.count} cambio${r.count!==1?'s':''} aceptado${r.count!==1?'s':''}</span><button class="es-btn" onclick="esSaveSnap()">Guardar como proyección</button><button class="es-btn pri" ${r.count?'':'disabled'} onclick="esApply()">Aplicar a toda la app</button>`; }
  ov.innerHTML=`<div class="es-box"><div class="es-head"><h3>✦ Asistente de estrategia</h3><button class="es-btn" style="padding:6px 12px" onclick="esClose()">Cerrar</button></div>
    <div class="es-tabs">${T.map(([k,l])=>`<button class="es-tab ${tab===k?'on':''}" onclick="esTab('${k}')">${l}</button>`).join('')}</div>
    <div class="es-body">${body}</div><div class="es-foot">${foot}</div></div>`;
}
function viewDiag(){
  const s=D.sim, q=D.q; const by={star:[],horse:[],puzzle:[],dog:[]}; D.rows.forEach(r=>by[q[r.id]].push(r));
  const warn=[]; if(D.missing.noUnits.length) warn.push(`<b>${D.missing.noUnits.length}</b> producto${D.missing.noUnits.length>1?'s':''} sin ventas proyectadas (${esc(D.missing.noUnits.slice(0,4).join(', '))}${D.missing.noUnits.length>4?'…':''}). <a href="#" onclick="esClose();showPanel('ventas');return false">Cargar en Ventas + GF</a>`);
  if(D.missing.noRecipe.length) warn.push(`<b>${D.missing.noRecipe.length}</b> sin receta ni costo (${esc(D.missing.noRecipe.slice(0,4).join(', '))}${D.missing.noRecipe.length>4?'…':''}). <a href="#" onclick="esClose();showPanel('costreceta');return false">Completar en Costo de Receta</a>`);
  const low=D.chans[0];
  return `${warn.length?`<div class="es-warn">${warn.join('<br>')}<br><span style="color:var(--muted)">Podés seguir: esos productos se analizan con lo que haya.</span></div>`:''}
  <div class="es-sec"><h4>Situación actual (según la Proyección)</h4>${kpiHtml(s)}</div>
  <div class="es-sec"><h4>Ingeniería de menú · por categoría</h4><div class="es-mx">${['star','horse','puzzle','dog'].map(k=>`<div class="es-q"><b>${QN[k]} · ${by[k].length}</b><p>${QD[k]}</p><div>${by[k].slice(0,8).map(r=>`${esc(r.name)} <span style="color:var(--muted);font-family:'DM Mono',monospace;font-size:11px">${Math.round(r.units)} u · ${fmt(r.cm)}</span>`).join('<br>')||'<span style="color:var(--muted)">—</span>'}${by[k].length>8?'<br><span style="color:var(--muted)">+'+(by[k].length-8)+' más</span>':''}</div></div>`).join('')}</div>
  <div style="font-size:11px;color:var(--muted);margin-top:6px">Popular = vende al menos el 70% de lo esperado en su categoría. Rentable = margen de contribución unitario (neto por canal − costo) mayor al promedio ponderado de la categoría.</div></div>
  <div class="es-sec"><h4>Ingredientes que más pesan en tu costo</h4>${D.ings.length?`<table class="es-tbl"><tr><th>Ingrediente</th><th class="n">Costo/mes</th><th class="n">% del costo</th><th class="n">Platos</th></tr>${D.ings.slice(0,5).map(i=>`<tr><td>${esc(i.name)}</td><td class="n">${fmt(i.month)}</td><td class="n">${pct(i.share,0)}</td><td class="n">${i.uses}</td></tr>`).join('')}</table>`:'<div style="font-size:12px;color:var(--muted)">Sin recetas con ingredientes vinculados.</div>'}</div>
  <div class="es-sec"><h4>Canales</h4><div style="font-size:13px;line-height:1.7">${D.chans.map(x=>`${esc(x.c.name)}: recibís <b>${pct(x.ratio,0)}</b> del precio mostrador · ${pct(x.dist,0)} de las unidades`).join('<br>')}</div>${low&&low.ratio<0.9&&low.c.id!=='mostrador'?`<div class="es-warn" style="margin-top:8px">${esc(low.c.name)} es el canal que menos te deja.</div>`:''}</div>`;
}
function viewGoal(){
  const g=(k,t,d,ctl)=>`<div class="es-goal ${S.goal===k?'on':''}" onclick="if(event.target.tagName!=='INPUT')esSet('goal','${k}')"><b>${t}</b><span>${d}</span>${S.goal===k&&ctl?`<div style="margin-top:6px">${ctl}</div>`:''}</div>`;
  return `<div class="es-sec"><h4>¿Qué querés lograr?</h4><div class="es-goals">
  ${g('plato','Ganar más por plato','Subir el margen de cada plato un porcentaje.',`<input class="es-in" type="number" min="1" max="200" value="${S.platoPct}" onchange="esSet('platoPct',+this.value)"> %`)}
  ${g('mensual','Llegar a un resultado mensual','Ganancia después de gastos fijos.',`<input class="es-in" style="width:170px" type="number" min="0" step="1000" value="${S.monthly}" onchange="esSet('monthly',+this.value)"><div style="font-size:11px;color:var(--muted);margin-top:4px">Hoy: ${fmt(D.sim.resultado)}</div>`)}
  ${g('equilibrio','Alcanzar el punto de equilibrio','Que el margen cubra todos los gastos fijos.','')}
  ${g('foodcost','Bajar el costo de materia prima','Costo como % del precio, por plato.',`<input class="es-in" type="number" min="5" max="80" value="${S.fcTarget}" onchange="esSet('fcTarget',+this.value)"> % <div style="font-size:11px;color:var(--muted);margin-top:4px">Hoy: ${pct(D.sim.fc)}</div>`)}
  </div></div>`;
}
function viewAsk(){
  const qs=[]; const horses=D.rows.filter(r=>D.q[r.id]==='horse').sort((a,b)=>b.units-a.units);
  qs.push(`<div class="es-qq"><b>¿Cuánto podés subir un precio como máximo?</b><p>Ningún plato va a subir más que esto. Las estrellas suben como mucho 5%.</p><div style="display:flex;align-items:center;gap:10px"><input type="range" min="0" max="40" value="${S.maxInc}" style="flex:1;accent-color:var(--accent)" oninput="this.nextElementSibling.textContent=this.value+'%'" onchange="esSet('maxInc',+this.value)"><b>${S.maxInc}%</b></div></div>`);
  qs.push(`<div class="es-qq"><b>¿Qué platos no se pueden tocar?</b><p>Por precio de referencia, competencia o porque son tu marca.</p><div class="es-chips">${D.rows.map(r=>`<button class="es-chip ${S.locked.includes(r.id)?'on':''}" onclick="esLock('${r.id}')">${esc(r.name)}</button>`).join('')}</div></div>`);
  qs.push(`<div class="es-qq"><b>Si subís precios, ¿cuánto creés que bajan las ventas?</b><p>Para no proyectar ganancias irreales. Media: si subís 10%, vendés ~8% menos de ese plato.</p><div class="es-chips">${Object.keys(ELAST).map(k=>`<button class="es-chip ${S.elast===k?'on':''}" onclick="esSet('elast','${k}')">${k[0].toUpperCase()+k.slice(1)}</button>`).join('')}</div></div>`);
  if(horses.length) qs.push(`<div class="es-qq"><b>${esc(horses[0].name)} vende ${Math.round(horses[0].units)} u./mes con margen bajo${horses.length>1?' (y '+(horses.length-1)+' caballo'+(horses.length>2?'s':'')+' más)':''}.</b><p>¿Preferís subir el precio o revisar porción e ingredientes?</p><div class="es-chips">${[['precio','Subir precio'],['porcion','Revisar porción / costo'],['ambos','Las dos']].map(([k,l])=>`<button class="es-chip ${S.horseMode===k?'on':''}" onclick="esSet('horseMode','${k}')">${l}</button>`).join('')}</div></div>`);
  const top=D.ings.filter(i=>i.share>=0.08||i.uses>=3).slice(0,3);
  if(top.length) qs.push(`<div class="es-qq"><b>¿Podés renegociar ${top.map(i=>esc(i.name)).join(', ')} o cambiar de proveedor?</b><p>Son los que más pesan en tu costo (${top.map(i=>pct(i.share,0)).join(', ')}).</p><div class="es-chips"><button class="es-chip ${S.reneg===true?'on':''}" onclick="esSet('reneg',true)">Sí</button><button class="es-chip ${S.reneg===false?'on':''}" onclick="esSet('reneg',false)">No</button><button class="es-chip ${S.reneg===null?'on':''}" onclick="esSet('reneg',null)">No sé (usar supuesto)</button></div>${S.reneg!==false?`<div style="display:flex;align-items:center;gap:8px;font-size:13px">Baja estimada <input class="es-in" style="width:80px" type="number" min="1" max="50" value="${S.renegPct}" onchange="esSet('renegPct',+this.value)"> %</div>`:''}</div>`);
  const low=D.chans.find(x=>x.c.id!=='mostrador'&&x.ratio<0.9&&x.dist>0);
  if(low) qs.push(`<div class="es-qq"><b>En ${esc(low.c.name)} recibís ${pct(low.ratio,0)} de lo que cobrás en el mostrador.</b><p>¿Subimos el sobrecargo de ese canal para compensar la comisión?</p><div class="es-chips"><button class="es-chip ${S.chFix!==false?'on':''}" onclick="esSet('chFix',true)">Sí</button><button class="es-chip ${S.chFix===false?'on':''}" onclick="esSet('chFix',false)">No, quiero ser competitivo ahí</button></div></div>`);
  if(D.rows.some(r=>D.q[r.id]==='puzzle')) qs.push(`<div class="es-qq"><b>¿Podés destacar los platos enigma?</b><p>Buen margen pero poca venta. Moverlos arriba en el menú, mejor foto o combos suele subir sus ventas.</p><div class="es-chips"><button class="es-chip ${S.promoteEnigma?'on':''}" onclick="esSet('promoteEnigma',true)">Sí</button><button class="es-chip ${!S.promoteEnigma?'on':''}" onclick="esSet('promoteEnigma',false)">No</button></div></div>`);
  return qs.join('');
}
function viewScen(){
  const list=buildScenarios(); const base=D.sim;
  return `<div class="es-sec"><h4>Escenarios propuestos</h4><div class="es-sc">${list.map(s=>{ const nP=Object.keys(s.ch.priceAdj||{}).length, nI=Object.keys(s.ch.ingCut||{}).length, nC=Object.keys(s.ch.chSurcharge||{}).length, nU=Object.keys(s.ch.unitAdj||{}).length; const d=s.sim.resultado-base.resultado;
    return `<button class="es-scard ${S.scenario===s.key?'on':''}" onclick="esPick('${s.key}')"><b>${s.title}</b><span>${s.desc}</span>
      <div style="font-size:12px;line-height:1.6">${[nP?nP+' precio'+(nP>1?'s':''):'',nI?nI+' ingrediente'+(nI>1?'s':''):'',nC?nC+' canal':'',nU?nU+' plato'+(nU>1?'s':'')+' a destacar':''].filter(Boolean).join(' · ')||'<span style="color:var(--muted)">Sin cambios aplicables con tus respuestas</span>'}</div>
      <div style="font-family:'DM Mono',monospace;font-size:15px;font-weight:700">${fmt(s.sim.resultado)}<span style="font-size:11px;color:${d>=0?'var(--green)':'var(--red)'}"> ${sgn(d)}${fmt(d)}</span></div>
      <div class="${s.ok?'es-ok':'es-no'}" style="font-size:12px">${s.ok?'✓ ':'✕ '}${esc(s.met.txt)}</div></button>`; }).join('')}</div>
    <div style="font-size:11px;color:var(--muted);margin-top:8px">Resultados con elasticidad ${S.elast}. Los precios finales se redondean igual que en la app.</div></div>`;
}
function currentChanges(){
  const sc=buildScenarios().find(x=>x.key===S.scenario); if(!sc) return null;
  return {sc,ch:ME.acceptedChanges(S,sc)};
}
function viewPrev(){
  const cc=currentChanges(); if(!cc) return {html:'Elegí un escenario.',count:0};
  const {sc,ch}=cc; const E=ELAST[S.elast]; const base=D.sim; const sim=simulate(D.rows,ch,E); const qA=classify(sim); const met=goalMet(base,sim);
  const cb=(k)=>`<input type="checkbox" ${S.acc[k]!==false?'checked':''} onchange="esAcc('${k}',this.checked)" style="width:16px;height:16px;accent-color:var(--accent)">`;
  const rowsP=Object.keys(sc.ch.priceAdj||{}).map(id=>{ const b=base.rows.find(r=>r.id===id), a=sim.rows.find(r=>r.id===id); const f=sc.ch.priceAdj[id]; const k='p:'+id; const off=S.acc[k]===false; const aa=off?b:a; const risk=f-1>0.15;
    return `<tr class="${off?'off':''}"><td>${cb(k)}</td><td><b>${esc(b.name)}</b><div class="es-why">${esc((sc.why.price||{})[id]||'')}</div></td><td>${QN[D.q[id]]}${qA[id]!==D.q[id]&&!off?' → '+QN[qA[id]]:''}</td><td class="n">${fmt(b.price)} → <b>${fmt(b.price*f)}</b> <span style="color:${risk?'var(--red)':'var(--muted)'}">${sgn(f-1)}${pct(f-1,0)}${risk?' ⚠':''}</span></td><td class="n">${fmt(b.cm)} → ${fmt(aa.cm)}</td><td class="n">${Math.round(b.units)} → ${Math.round(aa.units)}</td></tr>`; }).join('');
  const rowsI=Object.keys(sc.ch.ingCut||{}).map(id=>{ const i=D.ings.find(x=>x.id===id); const k='i:'+id; return `<tr class="${S.acc[k]===false?'off':''}"><td>${cb(k)}</td><td><b>${esc(i?i.name:id)}</b><div class="es-why">${esc((sc.why.ing||{})[id]||'')}</div></td><td colspan="2">Precio de compra −${pct(sc.ch.ingCut[id],0)}</td><td class="n" colspan="2">Ahorro ≈ ${fmt((i?i.month:0)*sc.ch.ingCut[id])}/mes</td></tr>`; }).join('');
  const rowsC=Object.keys(sc.ch.chSurcharge||{}).map(id=>{ const c=CHANNELS.find(x=>x.id===id); const k='c:'+id; return `<tr class="${S.acc[k]===false?'off':''}"><td>${cb(k)}</td><td><b>${esc(c.name)}</b><div class="es-why">${esc((sc.why.ch||{})[id]||'')}</div></td><td colspan="4">Sobrecargo ${pct(c.surcharge||0,0)} → <b>${pct(sc.ch.chSurcharge[id],0)}</b></td></tr>`; }).join('');
  const rowsU=Object.keys(sc.ch.unitAdj||{}).map(id=>{ const b=base.rows.find(r=>r.id===id); const k='u:'+id; return `<tr class="${S.acc[k]===false?'off':''}"><td>${cb(k)}</td><td><b>${esc(b.name)}</b><div class="es-why">${esc((sc.why.units||{})[id]||'')}</div></td><td colspan="2">Destacar (enigma)</td><td class="n" colspan="2">${Math.round(b.units)} → ${Math.round(b.units*sc.ch.unitAdj[id])} u. (solo proyección)</td></tr>`; }).join('');
  const count=Object.values(ch).reduce((s,o)=>s+Object.keys(o).length,0);
  const risks=Object.entries(ch.priceAdj).filter(([id,f])=>f-1>0.15).length;
  const starsTouched=Object.keys(ch.priceAdj).filter(id=>D.q[id]==='star').length;
  return {count,html:`<div class="es-sec"><h4>${esc(sc.title)} · antes / después</h4>${kpiHtml(base,sim)}<div class="${met.ok?'es-ok':'es-no'}" style="font-size:13px;margin-top:8px">${met.ok?'✓ ':'✕ '}${esc(met.txt)}</div>
    ${risks||starsTouched?`<div class="es-warn" style="margin-top:8px">${risks?risks+' plato'+(risks>1?'s suben':' sube')+' más de 15%. ':''}${starsTouched?starsTouched+' estrella'+(starsTouched>1?'s':'')+' con cambio de precio.':''}</div>`:''}</div>
    <div class="es-sec"><h4>Cambios propuestos (destildá los que no quieras)</h4><div style="overflow-x:auto"><table class="es-tbl"><tr><th></th><th>Qué</th><th>Cuadrante</th><th class="n">Precio mostrador</th><th class="n">Margen unit.</th><th class="n">Unid./mes</th></tr>${rowsP+rowsI+rowsC+rowsU||'<tr><td colspan="6" style="color:var(--muted)">Sin cambios.</td></tr>'}</table></div>
    <div style="font-size:11px;color:var(--muted);margin-top:6px">Las subas de precio se guardan como "Ajuste de precio" por producto (editable en Ventas + GF). Antes de aplicar se guarda un respaldo para deshacer.</div></div>`};
}

// ── Guardar / aplicar / deshacer ─────────────────────────
// El respaldo previo vive en el proyecto (.<nombre>.pre-estrategia.sahten), no en localStorage
function goalLabel(){ return S.goal==='plato'?'+'+S.platoPct+'% por plato':S.goal==='mensual'?'Resultado '+fmt(S.monthly):S.goal==='equilibrio'?'Punto de equilibrio':'Costo MP '+S.fcTarget+'%'; }
window.esSaveSnap=function(){
  const cc=currentChanges(); if(!cc) return; const E=ELAST[S.elast]; const sim=simulate(D.rows,cc.ch,E);
  if(typeof _commitSnap==='function'&&typeof _buildSnapData==='function'){
    const snap=_buildSnapData('Estrategia ('+cc.sc.title+'): '+goalLabel());
    Object.assign(snap,{tI:Math.round(sim.rev),tM:Math.round(sim.cmTot),tC:Math.round(sim.rev-sim.cmTot),resultado:Math.round(sim.resultado),gananciaDiaria:sim.resultado/30,gananciaWeekly:sim.resultado/4.33,strategy:{goal:S.goal,scenario:cc.sc.key}});
    _commitSnap({...snap,id:Date.now()});
  }
  if(typeof _posToast==='function') _posToast('Escenario guardado en Proyecciones');
};
window.esApply=function(){
  const cc=currentChanges(); if(!cc) return; const {ch,sc}=cc;
  showConfirm('Aplicar estrategia','Se cambian precios, ingredientes y canales en toda la app. Se guarda un respaldo para deshacer.',async()=>{
    try{ await SAHTEN.project.session.backupBeforeStrategy(); }catch(e){ alert('No se pudo guardar el respaldo: '+e.message); return; }
    try{ _commitSnap({..._buildSnapData('Antes de estrategia · '+new Date().toLocaleDateString('es-AR')),id:Date.now()}); }catch(e){}
    ME.applyStrategyChanges(ST,ch);
    SAHTEN_PROJECT.lastStrategy={at:new Date().toISOString(),name:sc.title+' · '+goalLabel(),changes:Object.values(ch).reduce((s,o)=>s+Object.keys(o).length,0)};
    (SAHTEN_PROJECT.strategyLog=SAHTEN_PROJECT.strategyLog||[]).push({...SAHTEN_PROJECT.lastStrategy,detail:ch});
    try{ recalcAll(); }catch(e){} try{ renderProyeccion(); }catch(e){}
    try{ _commitSnap({..._buildSnapData('Estrategia aplicada: '+goalLabel()),id:Date.now()+1}); }catch(e){}
    if(typeof saveData==='function') saveData();
    close(); renderBanner();
    if(typeof _posToast==='function') _posToast('Estrategia aplicada · podés deshacerla');
  },null,'Aplicar','Cancelar');
};
window.esUndo=function(){ SAHTEN.projectUi.restore('preStrategy'); };
function renderBanner(){
  const panel=document.getElementById('panel-proyeccion'); if(!panel) return;
  let box=document.getElementById('es-launch');
  if(!box){ box=document.createElement('div'); box.id='es-launch-wrap'; panel.insertBefore(box,panel.firstChild); box.id='es-launch'; }
  const ls=SAHTEN_PROJECT.lastStrategy; const today=ls&&new Date(ls.at).toDateString()===new Date().toDateString();
  const hasBk=!!window._esHasBk;
  if(SAHTEN.project.session.isOpen) SAHTEN.project.session.backups().then(b=>{ const v=!!b.preStrategy; if(v!==window._esHasBk){ window._esHasBk=v; if(ls) renderBanner(); } }).catch(()=>{});
  box.className='';
  box.innerHTML=`${ls&&hasBk?`<div class="es-banner"><span>✦</span><span style="flex:1">Estrategia <b>${esc(ls.name)}</b> aplicada ${today?'hoy':'el '+new Date(ls.at).toLocaleDateString('es-AR')} · ${ls.changes} cambio${ls.changes!==1?'s':''}</span><button class="es-btn" style="padding:6px 12px" onclick="esUndo()">Deshacer</button></div>`:''}
    <div class="es-launch"><div style="flex:1;min-width:200px"><div style="font-weight:700;font-size:14px">✦ Asistente de estrategia</div><div style="font-size:12px;color:var(--muted)">Analiza tus platos, costos, canales y gastos, te hace preguntas y propone cambios con vista previa.</div></div><button class="es-btn pri" onclick="openStrategy()">Empezar</button></div>`;
}
window.esRenderBanner=renderBanner;
SAHTEN.events.afterRender('renderProyeccion',()=>renderBanner());
window.addEventListener('load',()=>{ setTimeout(()=>{ try{ renderBanner(); }catch(e){} },800); });
})();
