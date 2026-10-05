// ═══════════════════════════════════════════════════════════
// SAHTEN — PRIMER USO (v3): arranque vacío, configuración inicial,
// próximos pasos y guía por sección
// ═══════════════════════════════════════════════════════════
(function(){
const css = `
.sw-ov{position:fixed;inset:0;z-index:9500;background:rgba(10,20,12,.55);backdrop-filter:blur(6px);-webkit-backdrop-filter:blur(6px);display:flex;align-items:center;justify-content:center;padding:16px}
.sw-box{background:var(--card,#fff);color:var(--ink);border-radius:20px;width:100%;max-width:560px;max-height:calc(100vh - 32px);display:flex;flex-direction:column;box-shadow:0 24px 80px rgba(0,0,0,.35);overflow:hidden}
.sw-head{padding:22px 26px 0}.sw-prog{height:4px;border-radius:99px;background:var(--sand2);overflow:hidden;margin-bottom:16px}.sw-prog>div{height:100%;background:var(--accent);transition:width .25s}
.sw-step{font-size:11px;font-weight:700;letter-spacing:.5px;text-transform:uppercase;color:var(--muted)}
.sw-title{font-size:21px;font-weight:700;letter-spacing:-.02em;margin:4px 0 4px}.sw-sub{font-size:13px;color:var(--muted);line-height:1.5;text-wrap:pretty}
.sw-body{padding:18px 26px;overflow-y:auto;display:flex;flex-direction:column;gap:14px}
.sw-foot{padding:14px 26px 20px;display:flex;gap:10px;align-items:center;border-top:1px solid var(--border)}
.sw-lbl{font-size:12px;font-weight:600;color:var(--muted);margin-bottom:5px;display:block}
.sw-in{width:100%;box-sizing:border-box;border:1.5px solid var(--border);border-radius:11px;padding:10px 12px;font-size:14px;font-family:inherit;background:var(--sand);color:var(--ink);outline:none}
.sw-in:focus{border-color:var(--accent)}
.sw-chips{display:flex;flex-wrap:wrap;gap:6px}.sw-chip{padding:7px 13px;border-radius:99px;border:1.5px solid var(--border);background:transparent;color:var(--ink);font-size:13px;cursor:pointer;font-family:inherit}
.sw-chip.on{background:var(--accent);border-color:var(--accent);color:#fff;font-weight:600}
.sw-row{display:grid;grid-template-columns:minmax(0,1fr) 130px;gap:10px;align-items:center}
.sw-grid2{display:grid;grid-template-columns:1fr 1fr;gap:10px}
.sw-btn{border:1.5px solid var(--border);background:transparent;color:var(--ink);border-radius:11px;padding:10px 18px;font-size:14px;font-weight:600;cursor:pointer;font-family:inherit}
.sw-btn.pri{background:var(--accent);border-color:var(--accent);color:#fff}
.sw-link{background:none;border:none;color:var(--muted);font-size:13px;cursor:pointer;font-family:inherit;text-decoration:underline}
.sw-card{border:1.5px solid var(--border);border-radius:14px;padding:16px;cursor:pointer;display:flex;flex-direction:column;gap:4px;text-align:left;background:transparent;color:var(--ink);font-family:inherit}
.sw-card:hover{border-color:var(--accent)}.sw-card b{font-size:15px}.sw-card span{font-size:12px;color:var(--muted);line-height:1.45}
.sw-ch{display:grid;grid-template-columns:22px minmax(0,1fr) 92px;gap:10px;align-items:center;padding:8px 0;border-bottom:1px solid var(--border)}
.sw-ch input[type=checkbox]{width:18px;height:18px;accent-color:var(--accent)}
.sw-pal{display:grid;grid-template-columns:repeat(4,1fr);gap:8px}.sw-pal button{border:2px solid var(--border);border-radius:12px;padding:8px;cursor:pointer;background:transparent;color:var(--ink);font-size:11px;font-family:inherit;display:flex;flex-direction:column;gap:6px;align-items:center}
.sw-pal button.on{border-color:var(--accent)}.sw-pal i{display:flex;width:100%;height:22px;border-radius:7px;overflow:hidden}.sw-pal i b{flex:1}
.sw-note{font-size:12px;color:var(--muted);line-height:1.5;background:var(--sand);border-radius:10px;padding:10px 12px}
.sw-sum{display:grid;grid-template-columns:auto 1fr;gap:6px 14px;font-size:13px}.sw-sum dt{color:var(--muted)}.sw-sum dd{margin:0;font-weight:600}
.sw-yn{display:grid;grid-template-columns:1fr 1fr;gap:10px}
.sp-check{background:var(--card,#fff);border:1px solid var(--border);border-radius:var(--r,14px);padding:16px 18px;margin-bottom:16px;box-shadow:var(--shadow)}
.sp-check h4{margin:0;font-size:14px}.sp-items{display:flex;flex-direction:column;gap:2px;margin-top:10px}
.sp-item{display:flex;align-items:center;gap:10px;padding:8px 6px;border-radius:9px;cursor:pointer;font-size:13px}.sp-item:hover{background:var(--sand)}
.sp-dot{width:20px;height:20px;border-radius:50%;border:2px solid var(--border);display:flex;align-items:center;justify-content:center;font-size:11px;flex-shrink:0}
.sp-item.done .sp-dot{background:var(--green);border-color:var(--green);color:#fff}.sp-item.done .sp-t{color:var(--muted);text-decoration:line-through}
.sg-tip{position:fixed;right:20px;bottom:20px;z-index:9400;max-width:340px;background:var(--card,#fff);color:var(--ink);border:1px solid var(--border);border-radius:16px;padding:16px 18px;box-shadow:0 16px 48px rgba(0,0,0,.22);animation:sgIn .25s ease}
.sg-tip h5{margin:0 0 6px;font-size:14px}.sg-tip p{margin:0;font-size:13px;line-height:1.5;color:var(--ink);text-wrap:pretty}.sg-tip small{display:block;margin-top:6px;font-size:11px;color:var(--muted)}
.sg-act{display:flex;gap:8px;justify-content:space-between;align-items:center;margin-top:12px}
@keyframes sgIn{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:none}}
@media(max-width:600px){.sw-grid2,.sw-yn{grid-template-columns:1fr}.sw-pal{grid-template-columns:repeat(2,1fr)}.sg-tip{left:12px;right:12px;bottom:84px;max-width:none}}`;
const st=document.createElement('style'); st.textContent=css; document.head.appendChild(st);

const esc=s=>String(s??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[m]));
const CURRENCIES=[
  {code:'ARS',name:'Peso argentino',symbol:'$',roundTo:50},{code:'USD',name:'Dólar',symbol:'US$',roundTo:0.5},
  {code:'EUR',name:'Euro',symbol:'€',roundTo:0.5},{code:'UYU',name:'Peso uruguayo',symbol:'$U',roundTo:10},
  {code:'CLP',name:'Peso chileno',symbol:'$',roundTo:100},{code:'MXN',name:'Peso mexicano',symbol:'$',roundTo:5},
  {code:'COP',name:'Peso colombiano',symbol:'$',roundTo:500},{code:'PEN',name:'Sol',symbol:'S/',roundTo:0.5}];
const TYPES=['Restaurante','Rotisería','Dark kitchen','Café / panadería','Catering','Food truck','Otro'];
const STEPS=['proyecto','moneda','marca','canales','gastos','sueldos','ventas','margen','delivery','menu','resumen'];

let A=null, si=0;
function defaults(){
  return { name:'', type:'Restaurante', currency:'ARS', usd:1200, brandPalette:(typeof _cust!=='undefined'&&_cust.paletteId)||'sahten', logo:null,
    channels: CHANNELS.map(c=>({id:c.id,name:c.name,on:c.id==='mostrador'||c.id==='whatsapp',comm:Math.round((c.commission||0)*100)})),
    gfMode:'detalle', gf:{Alquiler:'',Servicios:'','Impuestos y contador':'','Sistema / software':'',Otros:''}, gfTotal:'',
    employees:'', salary:'', owner:'', perDay:'', days:26, margin:40, delivery:null, address:'', online:null, whatsapp:'' };
}

// ── Arranque vacío ───────────────────────────────────────
window.sahtenFreshStart=function(){
  PRODUCTS.length=0; INGREDIENTES.length=0; ENVASES.length=0; GASTOS_OP.length=0; GASTOS_S.length=0;
  Object.keys(STOCK).forEach(k=>delete STOCK[k]); MOVIMIENTOS.length=0;
  if(typeof GF_DISC_HISTORY!=='undefined') GF_DISC_HISTORY.length=0;
  try{ renderDashboard(); }catch(e){}
  openSetup(true);
};
window.sahtenLoadDemo=function(){
  const D=window.SAHTEN_DEMO_DATA; if(!D) return alert('No hay datos de ejemplo disponibles.');
  const set=(a,b)=>{ a.length=0; JSON.parse(JSON.stringify(b)).forEach(x=>a.push(x)); };
  set(PRODUCTS,D.PRODUCTS); set(INGREDIENTES,D.INGREDIENTES); set(ENVASES,D.ENVASES); set(GASTOS_OP,D.GASTOS_OP); set(GASTOS_S,D.GASTOS_S); set(CHANNELS,D.CHANNELS);
  TIERS=JSON.parse(JSON.stringify(D.TIERS));
  Object.assign(SAHTEN_PROJECT,{name:'Proyecto de ejemplo',setupDone:true,demo:true,checklistDismissed:true});
  closeSetup(); if(typeof saveData==='function') saveData(); location.reload();
};

// ── Asistente ────────────────────────────────────────────
function openSetup(welcome){ A=defaults(); si=welcome?-1:0; render(); }
window.sahtenOpenSetup=()=>openSetup(false);
function closeSetup(){ document.getElementById('sw-ov')?.remove(); }
function render(){
  let ov=document.getElementById('sw-ov'); if(!ov){ ov=document.createElement('div'); ov.id='sw-ov'; ov.className='sw-ov'; document.body.appendChild(ov); }
  if(si<0){ ov.innerHTML=`<div class="sw-box"><div class="sw-head"><div class="sw-title">Bienvenido a Sahten</div><div class="sw-sub">Este proyecto está vacío. Configuralo en unos minutos o explorá la app con un negocio de ejemplo.</div></div>
    <div class="sw-body"><button class="sw-card" onclick="swGo(0)"><b>Configurar mi negocio</b><span>Te hago 10 preguntas cortas (nombre, moneda, canales, gastos, ventas estimadas, margen) y armo el proyecto. Todo se puede cambiar después.</span></button>
    <button class="sw-card" onclick="sahtenLoadDemo()"><b>Explorar con datos de ejemplo</b><span>Carga un restaurante de muestra con recetas, gastos y canales para ver cómo funciona todo.</span></button></div>
    <div class="sw-foot"><button class="sw-link" onclick="swSkipAll()">Empezar vacío sin configurar</button></div></div>`; return; }
  const k=STEPS[si]; const [title,sub,body]=view(k);
  ov.innerHTML=`<div class="sw-box"><div class="sw-head"><div class="sw-prog"><div style="width:${((si+1)/STEPS.length*100).toFixed(0)}%"></div></div>
    <div class="sw-step">Paso ${si+1} de ${STEPS.length}</div><div class="sw-title">${title}</div><div class="sw-sub">${sub}</div></div>
    <div class="sw-body">${body}</div>
    <div class="sw-foot">${si>0?'<button class="sw-btn" onclick="swGo(si-1)">Atrás</button>':''}
      ${k!=='resumen'?'<button class="sw-link" onclick="swGo(si+1)">Omitir</button>':''}
      <span style="flex:1"></span><button class="sw-btn pri" onclick="${k==='resumen'?'swFinish()':'swNext()'}">${k==='resumen'?'Crear proyecto':'Siguiente'}</button></div></div>`;
  const f=ov.querySelector('.sw-body input'); if(f&&f.type!=='checkbox'&&f.type!=='file') setTimeout(()=>f.focus(),50);
}
const num=v=>{ const n=parseFloat(String(v).replace(/\./g,'').replace(',','.')); return isFinite(n)?n:0; };
const cur=()=>CURRENCIES.find(c=>c.code===A.currency)||CURRENCIES[0];
const money=n=>cur().symbol+' '+Math.round(n).toLocaleString('es-AR');
function view(k){
  const inp=(key,ph,type='text',extra='')=>`<input class="sw-in" type="${type}" value="${esc(A[key])}" placeholder="${esc(ph)}" oninput="swSet('${key}',this.value)" ${extra}>`;
  if(k==='proyecto') return ['¿Cómo se llama tu negocio?','Es el nombre del proyecto. Cada proyecto guarda sus datos por separado.',
    `<div><label class="sw-lbl">Nombre</label>${inp('name','Ej.: La Esquina')}</div><div><label class="sw-lbl">Tipo de negocio</label><div class="sw-chips">${TYPES.map(t=>`<button class="sw-chip ${A.type===t?'on':''}" onclick="swSet('type','${t}',1)">${t}</button>`).join('')}</div></div>`];
  if(k==='moneda') return ['Moneda','Se usa en todos los precios. Los precios se redondean según la moneda.',
    `<div><label class="sw-lbl">Moneda de trabajo</label><select class="sw-in" onchange="swSet('currency',this.value,1)">${CURRENCIES.map(c=>`<option value="${c.code}" ${A.currency===c.code?'selected':''}>${c.name} (${c.symbol}) · redondeo a ${c.roundTo}</option>`).join('')}</select></div>
    ${A.currency!=='USD'?`<div><label class="sw-lbl">Cotización del dólar (1 USD = ? ${cur().symbol})</label>${inp('usd','1200','number','min="0"')}<div class="sw-note" style="margin-top:8px">Solo se usa como referencia para insumos en dólares. La actualizás cuando quieras desde la barra lateral.</div></div>`:''}`];
  if(k==='marca'){ const pals=(typeof PALETTES!=='undefined'?PALETTES:[]).slice(0,4);
    return ['Logo y colores','Opcional. Podés cambiarlo cuando quieras en Personalización.',
    `<div><label class="sw-lbl">Paleta</label><div class="sw-pal">${pals.map(p=>`<button class="${A.brandPalette===p.id?'on':''}" onclick="swSet('brandPalette','${p.id}',1)"><i><b style="background:${p.primary}"></b><b style="background:${p.accent}"></b></i>${esc(p.name)}</button>`).join('')}</div></div>
    <div><label class="sw-lbl">Logo</label><div style="display:flex;gap:12px;align-items:center">${A.logo?`<img src="${A.logo}" style="height:44px;max-width:120px;object-fit:contain;border-radius:8px;border:1px solid var(--border)">`:''}<label class="sw-btn" style="display:inline-block">${A.logo?'Cambiar':'Subir logo'}<input type="file" accept="image/*" style="display:none" onchange="swLogo(this)"></label>${A.logo?'<button class="sw-link" onclick="swSet(\'logo\',null,1)">Quitar</button>':''}</div></div>`]; }
  if(k==='canales') return ['¿Dónde vendés?','Marcá los canales y su comisión. El precio de cada canal se ajusta para que recibas lo mismo que en el mostrador.',
    `<div>${A.channels.map((c,i)=>`<div class="sw-ch"><input type="checkbox" ${c.on?'checked':''} onchange="swCh(${i},'on',this.checked)"><div style="font-size:14px;font-weight:600">${esc(c.name)}</div><div style="display:flex;align-items:center;gap:4px">${c.id==='mostrador'?'<span style="font-size:12px;color:var(--muted)">sin comisión</span>':`<input class="sw-in" style="padding:7px 8px;text-align:right" type="number" min="0" max="80" value="${c.comm}" onchange="swCh(${i},'comm',this.value)" ${c.on?'':'disabled'}><span style="font-size:12px;color:var(--muted)">%</span>`}</div></div>`).join('')}</div>`];
  if(k==='gastos'){ const tot=A.gfMode==='total'?num(A.gfTotal):Object.values(A.gf).reduce((s,v)=>s+num(v),0);
    return ['Gastos fijos aproximados','Lo que pagás todos los meses sin importar cuánto vendas (sin sueldos, van en el paso siguiente).',
    `<div class="sw-chips"><button class="sw-chip ${A.gfMode==='detalle'?'on':''}" onclick="swSet('gfMode','detalle',1)">Por concepto</button><button class="sw-chip ${A.gfMode==='total'?'on':''}" onclick="swSet('gfMode','total',1)">Un total estimado</button></div>
    ${A.gfMode==='total'?`<div><label class="sw-lbl">Total mensual (${cur().symbol})</label>${inp('gfTotal','0','number','min="0"')}</div>`
      :Object.keys(A.gf).map(n=>`<div class="sw-row"><label style="font-size:14px">${n}</label><input class="sw-in" type="number" min="0" value="${esc(A.gf[n])}" placeholder="0" oninput="swGf('${n}',this.value)"></div>`).join('')}
    <div class="sw-note">Total: <b id="sw-gf-tot">${money(tot)}</b> por mes. Después lo controlás mes a mes en Gastos Fijos.</div>`]; }
  if(k==='sueldos') return ['Sueldos','Cantidad de empleados y costo mensual de cada uno (con cargas sociales).',
    `<div class="sw-grid2"><div><label class="sw-lbl">Empleados</label>${inp('employees','0','number','min="0"')}</div><div><label class="sw-lbl">Costo mensual por empleado</label>${inp('salary','0','number','min="0"')}</div></div>
    <div><label class="sw-lbl">Retiro del dueño (opcional)</label>${inp('owner','0','number','min="0"')}</div>`];
  if(k==='ventas'){ const u=num(A.perDay)*num(A.days);
    return ['Ventas estimadas','Cuántos platos o productos vendés por mes. Con esto se reparte el gasto fijo en cada precio.',
    `<div class="sw-grid2"><div><label class="sw-lbl">Unidades por día</label>${inp('perDay','0','number','min="0"')}</div><div><label class="sw-lbl">Días abiertos por mes</label>${inp('days','26','number','min="1" max="31"')}</div></div>
    <div class="sw-note">≈ <b id="sw-units">${Math.round(u).toLocaleString('es-AR')}</b> unidades por mes. Cuando cargues tus productos, podés poner las ventas de cada uno en Ventas + GF.</div>`]; }
  if(k==='margen'){ const m=+A.margin; const tiers=tiersFor(m);
    return ['Margen objetivo','Qué porcentaje del precio querés que te quede después de pagar costos y gastos fijos.',
    `<div><div style="display:flex;justify-content:space-between;align-items:baseline"><label class="sw-lbl">Margen</label><b style="font-size:22px">${m}%</b></div><input type="range" min="10" max="75" step="1" value="${m}" style="width:100%;accent-color:var(--accent)" oninput="swSet('margin',this.value,1)"></div>
    <div class="sw-note">Se crean 3 niveles de precio (tiers) para asignar a tus platos:<br>${tiers.map(t=>`<b>${t.name}</b>: costo × ${t.factor.toFixed(2)}`).join(' · ')}</div>`]; }
  if(k==='delivery') return ['¿Hacés delivery propio?','Con tu dirección, el envío se calcula solo por zonas al cargar un pedido.',
    `<div class="sw-yn"><button class="sw-card" style="${A.delivery===true?'border-color:var(--accent)':''}" onclick="swSet('delivery',true,1)"><b>Sí</b><span>Configuro zonas y costos de envío.</span></button><button class="sw-card" style="${A.delivery===false?'border-color:var(--accent)':''}" onclick="swSet('delivery',false,1)"><b>No</b><span>Solo retiro o plataformas.</span></button></div>
    ${A.delivery?`<div><label class="sw-lbl">Dirección del local</label>${inp('address','Calle, altura, localidad')}<div class="sw-note" style="margin-top:8px">Se crean 3 zonas circulares (2, 4 y 6 km) que después podés editar en Tienda.</div></div>`:''}`];
  if(k==='menu') return ['¿Querés menú online?','Una página con tu carta para que los clientes pidan. Los pedidos llegan por WhatsApp.',
    `<div class="sw-yn"><button class="sw-card" style="${A.online===true?'border-color:var(--accent)':''}" onclick="swSet('online',true,1)"><b>Sí</b><span>Activo el Menú Online.</span></button><button class="sw-card" style="${A.online===false?'border-color:var(--accent)':''}" onclick="swSet('online',false,1)"><b>Ahora no</b><span>Lo activo más adelante.</span></button></div>
    ${A.online?`<div><label class="sw-lbl">WhatsApp para recibir pedidos</label>${inp('whatsapp','Ej.: 5491122334455','tel')}</div>`:''}`];
  // resumen
  const gfTot=A.gfMode==='total'?num(A.gfTotal):Object.values(A.gf).reduce((s,v)=>s+num(v),0);
  const sal=num(A.employees)*num(A.salary)+num(A.owner); const units=num(A.perDay)*num(A.days);
  const gfu=units>0?(gfTot+sal)/units:0;
  return ['Listo para crear','Revisá el resumen. Todo se puede cambiar después.',
    `<dl class="sw-sum"><dt>Proyecto</dt><dd>${esc(A.name||'Mi negocio')} · ${esc(A.type)}</dd><dt>Moneda</dt><dd>${cur().name} (${cur().symbol})</dd>
    <dt>Canales</dt><dd>${A.channels.filter(c=>c.on).map(c=>esc(c.name)+(c.comm&&c.id!=='mostrador'?' '+c.comm+'%':'')).join(', ')||'—'}</dd>
    <dt>Gastos fijos</dt><dd>${money(gfTot)} + sueldos ${money(sal)} = ${money(gfTot+sal)}/mes</dd>
    <dt>Ventas estimadas</dt><dd>${Math.round(units).toLocaleString('es-AR')} u./mes${gfu?' · GF por unidad ≈ '+money(gfu):''}</dd>
    <dt>Margen objetivo</dt><dd>${A.margin}%</dd><dt>Delivery</dt><dd>${A.delivery?'Sí'+(A.address?' · '+esc(A.address):''):'No'}</dd><dt>Menú online</dt><dd>${A.online?'Sí'+(A.whatsapp?' · WhatsApp '+esc(A.whatsapp):''):'No'}</dd></dl>
    <div class="sw-note">Después te muestro los próximos pasos: cargar ingredientes, envases y tu primera receta.</div>`];
}
function tiersFor(m){ const mk=(mm,name,i)=>{ mm=Math.min(.85,Math.max(.05,mm/100)); const f=Math.round(1/(1-mm)*100)/100; return {id:'T'+(i+1),name:name+' ('+Math.round((f-1)*100)+'%)',factor:f,color:TIER_COLORS[i]}; };
  return [mk(m+10,'Premium',0),mk(m,'Estándar',1),mk(m-10,'Accesible',2)]; }
window.swGo=i=>{ si=Math.max(-1,Math.min(STEPS.length-1,i)); render(); };
window.swNext=()=>{ if(STEPS[si]==='proyecto'&&!String(A.name).trim()){ const f=document.querySelector('.sw-body input'); if(f){ f.style.borderColor='var(--red)'; f.placeholder='Escribí un nombre'; f.focus(); } return; } swGo(si+1); };
window.swSet=(k,v,re)=>{ A[k]=(k==='margin'?+v:v); if(re) render(); else liveTotals(); };
window.swGf=(n,v)=>{ A.gf[n]=v; liveTotals(); };
window.swCh=(i,k,v)=>{ A.channels[i][k]=k==='on'?v:Math.max(0,Math.min(80,num(v))); if(k==='on') render(); };
window.swLogo=inp=>{ const f=inp.files&&inp.files[0]; if(!f) return; const r=new FileReader(); r.onload=e=>{ A.logo=e.target.result; render(); }; r.readAsDataURL(f); };
function liveTotals(){ const g=document.getElementById('sw-gf-tot'); if(g){ const tot=A.gfMode==='total'?num(A.gfTotal):Object.values(A.gf).reduce((s,v)=>s+num(v),0); g.textContent=money(tot); }
  const u=document.getElementById('sw-units'); if(u) u.textContent=Math.round(num(A.perDay)*num(A.days)).toLocaleString('es-AR'); }
window.swSkipAll=()=>{ Object.assign(SAHTEN_PROJECT,{setupDone:true,skipped:true}); closeSetup(); if(typeof saveData==='function') saveData(); try{renderDashboard();}catch(e){} };
window.swFinish=async()=>{
  const c=cur(); const id=()=> (typeof gfNewId==='function'?gfNewId():'g'+Math.random().toString(36).slice(2,9));
  Object.assign(SAHTEN_PROJECT,{name:String(A.name).trim()||'Mi negocio',businessType:A.type,currency:c.code,currencySymbol:c.symbol,roundTo:c.roundTo,locale:'es-AR',
    estUnitsMonth:Math.round(num(A.perDay)*num(A.days)),targetMargin:+A.margin,deliveryOwn:!!A.delivery,online:{enabled:!!A.online,mode:'whatsapp',whatsapp:A.whatsapp||''},
    setupDone:true,createdAt:new Date().toISOString(),checklistDismissed:false});
  const usd=document.getElementById('usd-rate'); if(usd&&A.currency!=='USD'&&num(A.usd)>0){ usd.value=num(A.usd); usd.dispatchEvent(new Event('input',{bubbles:true})); }
  A.channels.forEach(a=>{ const ch=CHANNELS.find(x=>x.id===a.id); if(!ch) return; ch.enabled=a.on; if(ch.id!=='mostrador'){ const cm=a.comm/100; ch.commission=cm; ch.surcharge=cm>0?Math.round(cm/(1-cm)*100)/100:0; } });
  GASTOS_OP.length=0;
  if(A.gfMode==='total'){ if(num(A.gfTotal)>0) GASTOS_OP.push({id:id(),name:'Gastos fijos (estimado)',amount:num(A.gfTotal)}); }
  else Object.entries(A.gf).forEach(([n,v])=>{ if(num(v)>0) GASTOS_OP.push({id:id(),name:n,amount:num(v)}); });
  GASTOS_S.length=0; for(let i=0;i<Math.min(50,num(A.employees));i++) GASTOS_S.push({id:id(),name:'Empleado '+(i+1),amount:num(A.salary)});
  if(num(A.owner)>0) GASTOS_S.push({id:id(),name:'Retiro del dueño',amount:num(A.owner)});
  TIERS=tiersFor(+A.margin);
  if(typeof _cust!=='undefined'){ _cust.brandName=SAHTEN_PROJECT.name; _cust.paletteId=A.brandPalette; _cust.customPrimary=null; _cust.customAccent=null; if(A.logo){ _cust.logoData=A.logo; _cust.logoStyle='upload'; } try{ custSave(_cust); custApply(); }catch(e){} }
  try{ if(typeof wsRename==='function'&&typeof wsCurrentId==='function') wsRename(wsCurrentId(),SAHTEN_PROJECT.name); }catch(e){}
  if(typeof MENU_CONFIG!=='undefined'){ MENU_CONFIG.enabled=!!A.online; if(A.whatsapp) MENU_CONFIG.whatsapp=A.whatsapp; try{ _saveMenuConfig(); }catch(e){} }
  if(A.delivery&&typeof _getTiendaConfig==='function'){
    const cfg=_getTiendaConfig(); if(A.address) cfg.address=A.address;
    try{ const r=await fetch('https://nominatim.openstreetmap.org/search?format=json&limit=1&accept-language=es&q='+encodeURIComponent(A.address)); const d=await r.json(); if(d&&d[0]){ cfg.lat=+d[0].lat; cfg.lng=+d[0].lon; cfg.geoOk=true; } }catch(e){}
    try{ _saveTiendaConfig(cfg); }catch(e){}
  }
  closeSetup();
  if(typeof gfmEnsureMonths==='function') gfmEnsureMonths();
  if(typeof saveData==='function') saveData();
  try{ recalcAll(); }catch(e){} try{ showPanel('dashboard'); renderDashboard(); }catch(e){}
  if(typeof _posToast==='function') _posToast('Proyecto "'+SAHTEN_PROJECT.name+'" creado');
};

// ── Próximos pasos (Dashboard) ───────────────────────────
function checklist(){
  const mc=typeof MENU_CONFIG!=='undefined'?MENU_CONFIG:{};
  return [
    {t:'Cargar ingredientes',d:'Con su precio y presentación.',ok:INGREDIENTES.length>0,p:'ingredientes'},
    {t:'Cargar envases y papelería',d:'Cajas, bolsas, servilletas.',ok:ENVASES.length>0,p:'envases'},
    {t:'Crear tu primera receta',d:'Ingredientes + envases = costo por porción.',ok:PRODUCTS.some(p=>(p.ingredients||[]).some(r=>r.ingId)),p:'costreceta'},
    {t:'Asignar tier y revisar el precio',d:'Elegí el nivel de precio de cada plato.',ok:PRODUCTS.some(p=>!p.recetaOnly&&p.tier),p:'productos'},
    {t:'Cargar ventas por producto',d:'Mejora el reparto del gasto fijo.',ok:PRODUCTS.some(p=>(p.avgMes||0)>0),p:'ventas'},
    ...(SAHTEN_PROJECT.online&&SAHTEN_PROJECT.online.enabled?[{t:'Revisar el Menú Online',d:'Qué productos y categorías se muestran.',ok:!!(mc.hiddenProducts&&SAHTEN_PROJECT.menuReviewed),p:'menuonline',mark:'menuReviewed'}]:[])
  ];
}
window.sahtenRenderChecklist=function(){
  const panel=document.getElementById('panel-dashboard'); if(!panel) return;
  let el=document.getElementById('sp-check');
  if(!SAHTEN_PROJECT.setupDone||SAHTEN_PROJECT.checklistDismissed||SAHTEN_PROJECT.demo){ el&&el.remove(); return; }
  const items=checklist(); const done=items.filter(i=>i.ok).length;
  if(!el){ el=document.createElement('div'); el.id='sp-check'; el.className='sp-check'; panel.insertBefore(el,panel.firstChild); }
  el.innerHTML=`<div style="display:flex;align-items:center;gap:10px"><h4 style="flex:1">Próximos pasos · ${done}/${items.length}</h4><button class="sw-link" onclick="sahtenDismissChecklist()">${done===items.length?'Cerrar':'Ocultar'}</button></div>
    <div style="height:4px;border-radius:99px;background:var(--sand2);margin-top:8px;overflow:hidden"><div style="height:100%;width:${(done/items.length*100).toFixed(0)}%;background:var(--green)"></div></div>
    <div class="sp-items">${items.map(i=>`<div class="sp-item ${i.ok?'done':''}" onclick="${i.mark?`SAHTEN_PROJECT.${i.mark}=true;scheduleSave();`:''}showPanel('${i.p}')"><span class="sp-dot">${i.ok?'✓':''}</span><div style="flex:1;min-width:0"><div class="sp-t" style="font-weight:600">${i.t}</div><div style="font-size:11px;color:var(--muted)">${i.d}</div></div><span style="color:var(--muted)">›</span></div>`).join('')}</div>`;
};
window.sahtenDismissChecklist=()=>{ SAHTEN_PROJECT.checklistDismissed=true; scheduleSave(); sahtenRenderChecklist(); };

// ── Guía por sección (primera visita) ─────────────────────
const GUIDE={
  dashboard:['Dashboard','Resumen del negocio: precios promedio, márgenes, gastos fijos y la proyección activa.','Se alimenta de todas las demás secciones.'],
  productos:['Menú','Tus platos con su precio final por canal. Acá asignás el tier (nivel de precio) y los descuentos.','El costo viene de Costo de Receta; el gasto fijo, de Gastos Fijos y Ventas + GF.'],
  costreceta:['Costo de Receta','Armá cada receta con ingredientes, envases y sub-recetas. Calcula el costo por porción.','Usa los precios de Ingredientes y Envases.'],
  ingredientes:['Ingredientes','Cargá cada insumo con el precio y el tamaño del paquete. Si cambia un precio, se actualizan todas las recetas.','Alimenta Costo de Receta y Stock.'],
  envases:['Envases','Cajas, bolsas, servilletas y papelería, con su precio por paquete.','Se suman al costo de cada receta.'],
  stock:['Stock','Cantidades actuales y mínimos de ingredientes, envases y productos. Registrá ingresos, egresos y mermas.','Las ventas del Mostrador pueden descontar stock desde el detalle de cada orden.'],
  gastos:['Gastos Fijos','Lo que pagás todos los meses. El control mensual compara lo presupuestado con lo que pagaste.','El total se reparte en el precio de los productos que absorben GF.'],
  ventas:['Ventas + GF','Unidades que vendés por mes de cada producto y cuánto gasto fijo absorbe cada uno.','Define el GF por unidad que entra en cada precio.'],
  proyeccion:['Proyección','Simulá un mes: unidades, reparto por canal, ingreso neto, margen y punto de equilibrio.','Usa precios, costos y gastos fijos actuales.'],
  mostrador:['Mostrador','Cargá pedidos de retiro o delivery. El envío se calcula solo según la dirección y tus zonas.','Las órdenes alimentan Reportes.'],
  reportes:['Reportes','Ventas reales del Mostrador y de los archivos que importes.','Compará lo real con lo que proyectaste.'],
  menuonline:['Menú Online','Elegí qué productos y categorías ve el cliente en tu carta web.','Los precios salen del Menú.'],
  ajustes:['Ajustes','Tiers, canales de venta, respaldo y datos del proyecto.','Los tiers y canales cambian todos los precios.'],
  personalizacion:['Personalización','Nombre, logo y colores de tu negocio.','Cada proyecto tiene su propia identidad.']
};
const TKEY='sahten-guide';
const seen=()=>{ try{ return JSON.parse(localStorage.getItem(TKEY)||'{}'); }catch(e){ return {}; } };
const markSeen=(o)=>{ try{ localStorage.setItem(TKEY,JSON.stringify(o)); }catch(e){} };
window.sahtenGuide=function(name,force){
  const g=GUIDE[name]; const s=seen(); document.getElementById('sg-tip')?.remove();
  if(!g||(!force&&(s._off||s[name]))) return;
  if(document.getElementById('sw-ov')) return;
  const el=document.createElement('div'); el.id='sg-tip'; el.className='sg-tip';
  el.innerHTML=`<h5>${g[0]}</h5><p>${g[1]}</p><small>${g[2]}</small><div class="sg-act"><button class="sw-link" onclick="sahtenGuideOff()">No mostrar más guías</button><button class="sw-btn pri" style="padding:7px 16px;font-size:13px" onclick="sahtenGuideOk('${name}')">Entendido</button></div>`;
  document.body.appendChild(el);
};
window.sahtenGuideOk=n=>{ const s=seen(); s[n]=1; markSeen(s); document.getElementById('sg-tip')?.remove(); };
window.sahtenGuideOff=()=>{ const s=seen(); s._off=1; markSeen(s); document.getElementById('sg-tip')?.remove(); };
window.sahtenGuideReset=()=>{ markSeen({}); if(typeof currentPanel!=='undefined') sahtenGuide(currentPanel,true); };

// ── Enganches ────────────────────────────────────────────
function hook(){
  if(typeof window.showPanel==='function'&&!window._spShowHooked){ const o=window.showPanel; window.showPanel=function(n){ const r=o.apply(this,arguments); setTimeout(()=>sahtenGuide(n),250); return r; }; window._spShowHooked=true; }
  if(typeof window.renderDashboard==='function'&&!window._spDashHooked){ const o=window.renderDashboard; window.renderDashboard=function(){ const r=o.apply(this,arguments); try{ sahtenRenderChecklist(); }catch(e){} return r; }; window._spDashHooked=true; }
}
hook(); window.addEventListener('load',()=>{ hook(); setTimeout(()=>{ try{ sahtenRenderChecklist(); }catch(e){} },900); });
})();
