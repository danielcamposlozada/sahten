// ═══════════════════════════════════════════════════════════
// SAHTEN — REPORTES v3
// Date range filters, Charts (Chart.js), Fudo XLSX import
// ═══════════════════════════════════════════════════════════

// ─── Data ─────────────────────────────────────────────
window._repDefaults=()=>({ventasRaw:[],productosRaw:[],imports:[]});
function _loadRepData(){try{const r=localStorage.getItem('sahten_report_data');if(r)return JSON.parse(r);}catch(e){}return window._repDefaults();}
function _saveRepData(){try{localStorage.setItem('sahten_report_data',JSON.stringify(REP));}catch(e){}}
let REP=_loadRepData();
let repTab='sahten';
let repDateFrom=null, repDateTo=null, repPreset='all';
let _showFudoOverlay=false;
const _rc={};
function _dc(id){if(_rc[id]){_rc[id].destroy();delete _rc[id];}}

// ─── Helpers ──────────────────────────────────────────
function _e(s){return String(s||'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[m]));}
function _f(n){return Number(n||0).toLocaleString('es-AR',{maximumFractionDigits:0});}
function _fk(n){return n>=1e6?(n/1e6).toFixed(1)+'M':n>=1000?Math.round(n/1000)+'k':String(n);}
function _pn(v){if(typeof v==='number')return v;const s=String(v||'').replace(/[\$\s]/g,'').replace(/\./g,'').replace(',','.');return parseFloat(s)||0;}
function _isoToday(){return new Date().toISOString().split('T')[0];}
function _isoDate(d){return d.toISOString().split('T')[0];}
function _addDays(iso,n){const d=new Date(iso);d.setDate(d.getDate()+n);return _isoDate(d);}

// Chart theme
function _chartTheme(){
  const isDark=document.documentElement.getAttribute('data-theme')==='dark';
  const cs=getComputedStyle(document.documentElement);
  return{isDark,
    bg:isDark?'#162019':'#fff',
    grid:isDark?'rgba(255,255,255,0.06)':'rgba(0,0,0,0.06)',
    text:isDark?'#a0b8a3':'#6b7c6c',
    ink:isDark?'#e8ede9':'#1e2c1f',
    primary:cs.getPropertyValue('--primary').trim()||'#235328',
    accent:cs.getPropertyValue('--accent').trim()||'#F28C00',
    green:'#27ae60',red:'#e74c3c',blue:'#2980b9',
    colors:['#235328','#F28C00','#2980b9','#8e44ad','#27ae60','#e74c3c','#f39c12','#1abc9c','#e67e22','#3498db','#c0392b','#16a085']
  };
}

// ─── Date presets ─────────────────────────────────────
function _getDateRange(preset){
  const today=new Date();
  const iso=d=>_isoDate(d);
  const startOfWeek=()=>{const d=new Date(today);d.setDate(d.getDate()-d.getDay()+1);return d;};
  const startOfMonth=()=>new Date(today.getFullYear(),today.getMonth(),1);
  switch(preset){
    case 'today': return{from:iso(today),to:iso(today)};
    case 'yesterday':{const y=new Date(today);y.setDate(y.getDate()-1);return{from:iso(y),to:iso(y)};}
    case 'week': return{from:iso(startOfWeek()),to:iso(today)};
    case 'last_week':{const s=startOfWeek();s.setDate(s.getDate()-7);const e=new Date(s);e.setDate(e.getDate()+6);return{from:iso(s),to:iso(e)};}
    case 'month': return{from:iso(startOfMonth()),to:iso(today)};
    case 'last_month':{const d=new Date(today.getFullYear(),today.getMonth()-1,1);const e=new Date(today.getFullYear(),today.getMonth(),0);return{from:iso(d),to:iso(e)};}
    case '7d':{const d=new Date(today);d.setDate(d.getDate()-6);return{from:iso(d),to:iso(today)};}
    case '30d':{const d=new Date(today);d.setDate(d.getDate()-29);return{from:iso(d),to:iso(today)};}
    case '90d':{const d=new Date(today);d.setDate(d.getDate()-89);return{from:iso(d),to:iso(today)};}
    default: return{from:null,to:null};
  }
}

function repSetPreset(preset){
  repPreset=preset;
  if(preset==='custom') return; // user sets dates manually
  const r=_getDateRange(preset);
  repDateFrom=r.from; repDateTo=r.to;
  // Sync input fields
  const fi=document.getElementById('rep-date-from');
  const ti=document.getElementById('rep-date-to');
  if(fi) fi.value=r.from||'';
  if(ti) ti.value=r.to||'';
  _updatePresetBtns();
  _refreshCurrentTab();
}

function repSetCustomDate(which,val){
  repPreset='custom';
  if(which==='from') repDateFrom=val||null;
  else repDateTo=val||null;
  _updatePresetBtns();
  _refreshCurrentTab();
}

function _updatePresetBtns(){
  document.querySelectorAll('.rep-preset-btn').forEach(b=>{
    b.classList.toggle('active',b.dataset.preset===repPreset);
  });
}

function _filterByDate(rows){
  if(!repDateFrom&&!repDateTo) return rows;
  return rows.filter(r=>{
    if(!r.fecha) return true;
    if(repDateFrom&&r.fecha<repDateFrom) return false;
    if(repDateTo&&r.fecha>repDateTo) return false;
    return true;
  });
}

function _refreshCurrentTab(){
  if(repTab==='sahten') _renderMostradorReport();
  else if(repTab==='fudo_ventas') _renderVentas();
  else if(repTab==='fudo_productos') _renderProductos();
}

// ═══════════════════════════════════════════════════════════
// RENDER
// ═══════════════════════════════════════════════════════════
function renderReportes(){
  const p=document.getElementById('panel-reportes');if(!p)return;
  // Main tabs: Reportes Sahten | Fudo (histórico)
  const isFudo=repTab==='fudo_ventas'||repTab==='fudo_productos'||repTab==='fudo_importar';
  const isSahten=!isFudo;
  const mainTab=isFudo?'fudo':'sahten';

  p.innerHTML=`
  <div class="rep-tabs">
    <button class="rep-tab ${isSahten?'active':''}" onclick="repSetTab('sahten')">
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 20V10"/><path d="M12 20V4"/><path d="M6 20v-6"/></svg> Reportes Sahten
    </button>
    <button class="rep-tab ${isFudo?'active':''}" onclick="repSetTab('fudo_ventas')">
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg> Fudo (Histórico)
    </button>
  </div>
  ${isFudo?_fudoSubTabs():''}
  ${(isSahten||isFudo&&repTab!=='fudo_importar')?_dateFilterBar():''}
  <div id="rep-content"></div>`;
  _updatePresetBtns();
  if(repTab==='sahten') _renderMostradorReport();
  else if(repTab==='fudo_ventas') _renderVentas();
  else if(repTab==='fudo_productos') _renderProductos();
  else if(repTab==='fudo_importar') _renderImport();
}

function _fudoSubTabs(){
  return `<div class="rep-subtabs">
    <button class="rep-subtab ${repTab==='fudo_ventas'?'active':''}" onclick="repSetTab('fudo_ventas')">📊 Ventas</button>
    <button class="rep-subtab ${repTab==='fudo_productos'?'active':''}" onclick="repSetTab('fudo_productos')">📦 Productos</button>
    <button class="rep-subtab ${repTab==='fudo_importar'?'active':''}" onclick="repSetTab('fudo_importar')">⬆ Importar</button>
  </div>`;
}

function repSetTab(t){repTab=t;if(typeof _saveTabState==='function')_saveTabState('reportes',t);renderReportes();}

// ─── Date filter bar ──────────────────────────────────
function _dateFilterBar(){
  return `<div class="rep-date-bar">
    <div class="rep-presets">
      <button class="rep-preset-btn ${repPreset==='all'?'active':''}" data-preset="all" onclick="repSetPreset('all')">Todo</button>
      <button class="rep-preset-btn ${repPreset==='today'?'active':''}" data-preset="today" onclick="repSetPreset('today')">Hoy</button>
      <button class="rep-preset-btn ${repPreset==='yesterday'?'active':''}" data-preset="yesterday" onclick="repSetPreset('yesterday')">Ayer</button>
      <button class="rep-preset-btn ${repPreset==='7d'?'active':''}" data-preset="7d" onclick="repSetPreset('7d')">7 días</button>
      <button class="rep-preset-btn ${repPreset==='week'?'active':''}" data-preset="week" onclick="repSetPreset('week')">Semana</button>
      <button class="rep-preset-btn ${repPreset==='month'?'active':''}" data-preset="month" onclick="repSetPreset('month')">Mes</button>
      <button class="rep-preset-btn ${repPreset==='last_month'?'active':''}" data-preset="last_month" onclick="repSetPreset('last_month')">Mes ant.</button>
      <button class="rep-preset-btn ${repPreset==='30d'?'active':''}" data-preset="30d" onclick="repSetPreset('30d')">30 días</button>
      <button class="rep-preset-btn ${repPreset==='90d'?'active':''}" data-preset="90d" onclick="repSetPreset('90d')">90 días</button>
    </div>
    <div class="rep-date-custom">
      <label>Desde</label>
      <input type="date" class="rep-date-input" id="rep-date-from" value="${repDateFrom||''}" onchange="repSetCustomDate('from',this.value)">
      <label>Hasta</label>
      <input type="date" class="rep-date-input" id="rep-date-to" value="${repDateTo||''}" onchange="repSetCustomDate('to',this.value)">
    </div>
  </div>`;
}

// ═══════════════════════════════════════════════════════════
// VENTAS
// ═══════════════════════════════════════════════════════════
function _renderVentas(){
  const c=document.getElementById('rep-content');if(!c)return;
  const allRows=REP.ventasRaw||[];
  if(!allRows.length){c.innerHTML=_empty('ventas');return;}
  const rows=_filterByDate(allRows);
  if(!rows.length){c.innerHTML=_emptyFilter();return;}

  const a=_aggVentas(rows);
  const prevRows=_getPreviousPeriodRows(allRows);
  const pa=prevRows.length?_aggVentas(prevRows):null;

  c.innerHTML=`
  <div class="rep-kpis">
    ${_kpi('Ventas brutas','$'+_f(a.bruto),pa?_delta(a.bruto,pa.bruto):null,'primary')}
    ${_kpi('Ventas netas','$'+_f(a.neto),pa?_delta(a.neto,pa.neto):null,'accent')}
    ${_kpi('Descuentos','$'+_f(a.desc),null,'red')}
    ${_kpi('Cant. ventas',_f(a.count),pa?_delta(a.count,pa.count):null,'blue')}
    ${_kpi('Ticket promedio','$'+_f(a.avg),pa?_delta(a.avg,pa.avg):null,'green')}
    ${_kpi('Mejor día','$'+_f(a.maxDayVal)+'<div style="font-size:11px;color:var(--muted);margin-top:2px">'+(a.maxDay||'')+'</div>',null,'gold')}
  </div>

  <div class="rep-chart-card full">
    <div class="rep-chart-header"><div class="rep-chart-title">Evolución de ventas</div><div class="rep-chart-sub">Barras = monto · Línea = cantidad de ventas</div></div>
    <div style="height:300px"><canvas id="rc-evo"></canvas></div>
  </div>

  <div class="rep-chart-grid">
    <div class="rep-chart-card">
      <div class="rep-chart-title">Ventas por día de la semana</div>
      <div style="height:240px"><canvas id="rc-dia"></canvas></div>
    </div>
    <div class="rep-chart-card">
      <div class="rep-chart-title">Ventas por hora del día</div>
      <div style="height:240px"><canvas id="rc-hora"></canvas></div>
    </div>
  </div>

  <div class="rep-chart-card full">
    <div class="rep-chart-title">Tendencia de ventas acumuladas</div>
    <div style="height:260px"><canvas id="rc-acum"></canvas></div>
  </div>

  <div class="rep-chart-3col">
    <div class="rep-chart-card">
      <div class="rep-chart-title">Medios de pago</div>
      <div style="height:200px"><canvas id="rc-pago"></canvas></div>
      ${_legend(a.byPago)}
    </div>
    <div class="rep-chart-card">
      <div class="rep-chart-title">Origen de las ventas</div>
      <div style="height:200px"><canvas id="rc-origen"></canvas></div>
      ${_legend(a.byOrigen)}
    </div>
    <div class="rep-chart-card">
      <div class="rep-chart-title">Canales de delivery</div>
      <div style="height:200px"><canvas id="rc-canal"></canvas></div>
      ${_legend(a.byCanal)}
    </div>
  </div>

  <div class="rep-chart-grid">
    <div class="rep-chart-card">
      <div class="rep-chart-title">Distribución de montos</div>
      <div class="rep-chart-sub">Cantidad de ventas por rango de precio</div>
      <div style="height:220px"><canvas id="rc-dist"></canvas></div>
    </div>
    <div class="rep-chart-card">
      <div class="rep-chart-title">Descuentos vs Ventas brutas</div>
      <div style="height:220px"><canvas id="rc-descevo"></canvas></div>
    </div>
  </div>`;

  setTimeout(()=>_drawVentas(a),150);
}

function _aggVentas(rows){
  let bruto=0,neto=0,desc=0,totalCount=0;
  const byFecha={},byDia={},byHora={},byPago={},byOrigen={},byCanal={};
  const byFechaCount={},byFechaDesc={};
  rows.forEach(r=>{
    const b=r.bruto||0,n=r.neto||b,d=r.desc||0;
    const cnt=r.count||1;
    bruto+=b;neto+=n;desc+=d;totalCount+=cnt;
    if(r.fecha){
      byFecha[r.fecha]=(byFecha[r.fecha]||0)+b;
      byFechaCount[r.fecha]=(byFechaCount[r.fecha]||0)+cnt;
      byFechaDesc[r.fecha]=(byFechaDesc[r.fecha]||0)+d;
    }
    if(r.dia) byDia[r.dia]=(byDia[r.dia]||0)+b;
    if(r.hora!=null) byHora[r.hora]=(byHora[r.hora]||0)+b;
    // Flat-format rows may have pago/origen/canal directly
    if(r.pago) byPago[r.pago]=(byPago[r.pago]||0)+b;
    if(r.origen) byOrigen[r.origen]=(byOrigen[r.origen]||0)+b;
    if(r.canal) byCanal[r.canal]=(byCanal[r.canal]||0)+b;
  });

  // Merge dimension data from separate Fudo sheets (stored in REP)
  const activeFechas=new Set(Object.keys(byFecha));
  if(REP.pagoByDate){
    Object.entries(REP.pagoByDate).forEach(([fecha,methods])=>{
      if(repDateFrom&&fecha<repDateFrom)return;
      if(repDateTo&&fecha>repDateTo)return;
      if(repPreset!=='all'&&!activeFechas.has(fecha))return;
      Object.entries(methods).forEach(([m,v])=>{byPago[m]=(byPago[m]||0)+v;});
    });
  }
  if(REP.origenByDate){
    Object.entries(REP.origenByDate).forEach(([fecha,origins])=>{
      if(repDateFrom&&fecha<repDateFrom)return;
      if(repDateTo&&fecha>repDateTo)return;
      if(repPreset!=='all'&&!activeFechas.has(fecha))return;
      Object.entries(origins).forEach(([o,v])=>{byOrigen[o]=(byOrigen[o]||0)+v;});
    });
  }
  if(REP.canalByDate){
    Object.entries(REP.canalByDate).forEach(([fecha,canals])=>{
      if(repDateFrom&&fecha<repDateFrom)return;
      if(repDateTo&&fecha>repDateTo)return;
      if(repPreset!=='all'&&!activeFechas.has(fecha))return;
      Object.entries(canals).forEach(([c,v])=>{byCanal[c]=(byCanal[c]||0)+v;});
    });
  }

  let maxDay=null,maxDayVal=0;
  Object.entries(byFecha).forEach(([f,v])=>{if(v>maxDayVal){maxDayVal=v;maxDay=f;}});
  if(maxDay){const p=maxDay.split('-');maxDay=p[2]+'/'+p[1]+'/'+p[0];}
  return{bruto,neto,desc,count:totalCount,avg:totalCount?Math.round(bruto/totalCount):0,
    maxDay,maxDayVal,byFecha,byFechaCount,byFechaDesc,byDia,byHora,byPago,byOrigen,byCanal};
}

function _getPreviousPeriodRows(allRows){
  if(!repDateFrom||!repDateTo) return [];
  const from=new Date(repDateFrom),to=new Date(repDateTo);
  const days=Math.round((to-from)/(864e5))+1;
  const prevTo=new Date(from);prevTo.setDate(prevTo.getDate()-1);
  const prevFrom=new Date(prevTo);prevFrom.setDate(prevFrom.getDate()-days+1);
  const pf=_isoDate(prevFrom),pt=_isoDate(prevTo);
  return allRows.filter(r=>r.fecha&&r.fecha>=pf&&r.fecha<=pt);
}

function _delta(cur,prev){
  if(!prev||prev===0) return null;
  const pct=((cur-prev)/prev*100).toFixed(1);
  const up=cur>=prev;
  return `<span style="font-size:11px;font-weight:600;color:${up?'var(--green,#27ae60)':'var(--red,#e74c3c)'}">${up?'▲':'▼'} ${Math.abs(pct)}%</span>`;
}

function _kpi(label,value,delta,colorKey){
  const accentMap={primary:'var(--primary)',accent:'var(--accent)',red:'var(--red,#e74c3c)',blue:'#2980b9',green:'var(--green,#27ae60)',gold:'var(--accent)'};
  const c=accentMap[colorKey]||'var(--ink)';
  return `<div class="rep-kpi">
    <div class="rep-kpi-label">${label}</div>
    <div class="rep-kpi-value" style="color:${c}">${value}</div>
    ${delta?'<div class="rep-kpi-change">'+delta+'</div>':''}
  </div>`;
}

function _drawVentas(a){
  if(typeof Chart==='undefined')return;
  const t=_chartTheme();
  const baseBar={responsive:true,maintainAspectRatio:false,plugins:{legend:{display:false},tooltip:{backgroundColor:t.isDark?'#1e2b22':'#fff',titleColor:t.ink,bodyColor:t.ink,borderColor:t.grid,borderWidth:1,padding:10,cornerRadius:8,titleFont:{weight:'700'}}},scales:{x:{grid:{display:false},ticks:{color:t.text,font:{size:10}}},y:{grid:{color:t.grid,drawBorder:false},ticks:{color:t.text,font:{size:10},callback:v=>'$'+_fk(v)},border:{display:false}}}};
  const baseLine={...baseBar,elements:{line:{tension:0.35,borderWidth:2.5},point:{radius:3,hoverRadius:5}}};

  // 1. Evolution: bars + line dual axis
  const fechas=Object.keys(a.byFecha).sort();
  _dc('evo');
  const evoEl=document.getElementById('rc-evo');
  if(evoEl&&fechas.length){
    _rc.evo=new Chart(evoEl,{type:'bar',data:{
      labels:fechas.map(f=>{const p=f.split('-');return p[2]+'/'+p[1];}),
      datasets:[
        {type:'bar',data:fechas.map(f=>a.byFecha[f]),backgroundColor:t.primary+'b3',hoverBackgroundColor:t.primary,borderRadius:6,yAxisID:'y',label:'Ventas $',barPercentage:0.7},
        {type:'line',data:fechas.map(f=>a.byFechaCount[f]||0),borderColor:t.accent,backgroundColor:t.accent+'22',pointBackgroundColor:t.accent,pointRadius:3,borderWidth:2.5,tension:0.35,yAxisID:'y1',label:'Cantidad',fill:true}
      ]},options:{...baseBar,scales:{...baseBar.scales,y1:{position:'right',grid:{display:false},ticks:{color:t.accent,font:{size:10}},border:{display:false}}},plugins:{...baseBar.plugins,legend:{display:true,position:'bottom',labels:{color:t.text,font:{size:11},usePointStyle:true,pointStyle:'circle',padding:16}}}}});
  }

  // 2. By day of week — bar chart
  const dias=['Lun','Mar','Mié','Jue','Vie','Sáb','Dom'];
  const diasData=dias.map(d=>a.byDia[d]||0);
  const maxDia=Math.max(...diasData);
  _dc('dia');
  const dEl=document.getElementById('rc-dia');
  if(dEl){_rc.dia=new Chart(dEl,{type:'bar',data:{labels:dias,datasets:[{data:diasData,backgroundColor:diasData.map(v=>v===maxDia?t.accent+'cc':t.primary+'88'),hoverBackgroundColor:t.primary,borderRadius:8,barPercentage:0.6}]},options:baseBar});}

  // 3. By hour — smooth area line
  const horas=Array.from({length:24},(_,i)=>i);
  const horasData=horas.map(h=>a.byHora[h]||0);
  _dc('hora');
  const hEl=document.getElementById('rc-hora');
  if(hEl){_rc.hora=new Chart(hEl,{type:'line',data:{labels:horas.map(h=>String(h).padStart(2,'0')+':00'),datasets:[{data:horasData,borderColor:t.accent,backgroundColor:t.accent+'18',fill:true,pointRadius:2,pointBackgroundColor:t.accent,borderWidth:2.5,tension:0.4}]},options:{...baseLine,scales:{...baseLine.scales,x:{...baseLine.scales.x,ticks:{...baseLine.scales.x.ticks,maxTicksLimit:12,autoSkip:true}}}}});}

  // 4. Cumulative trend — area
  _dc('acum');
  const acEl=document.getElementById('rc-acum');
  if(acEl&&fechas.length>1){
    let cum=0;const cumData=fechas.map(f=>{cum+=a.byFecha[f];return cum;});
    _rc.acum=new Chart(acEl,{type:'line',data:{labels:fechas.map(f=>{const p=f.split('-');return p[2]+'/'+p[1];}),datasets:[{data:cumData,borderColor:t.green||'#27ae60',backgroundColor:(t.green||'#27ae60')+'15',fill:true,pointRadius:0,borderWidth:2.5,tension:0.3}]},options:{...baseLine,scales:{...baseLine.scales,y:{...baseLine.scales.y,ticks:{...baseLine.scales.y.ticks,callback:v=>'$'+_fk(v)}}}}});
  }

  // 5. Payment/origin/channel — doughnut
  _doughnut('pago',a.byPago,t);
  _doughnut('origen',a.byOrigen,t);
  _doughnut('canal',a.byCanal,t);

  // 6. Distribution histogram
  _dc('dist');
  const distEl=document.getElementById('rc-dist');
  if(distEl){
    const bins=[0,1000,3000,5000,10000,20000,50000,Infinity];
    const binLabels=['0-1k','1k-3k','3k-5k','5k-10k','10k-20k','20k-50k','50k+'];
    const binCounts=new Array(binLabels.length).fill(0);
    (REP.ventasRaw||[]).forEach(r=>{
      if(repDateFrom&&r.fecha&&r.fecha<repDateFrom)return;
      if(repDateTo&&r.fecha&&r.fecha>repDateTo)return;
      const v=r.bruto||0;
      for(let i=0;i<bins.length-1;i++){if(v>=bins[i]&&v<bins[i+1]){binCounts[i]++;break;}}
    });
    _rc.dist=new Chart(distEl,{type:'bar',data:{labels:binLabels,datasets:[{data:binCounts,backgroundColor:t.blue+'99',hoverBackgroundColor:t.blue,borderRadius:6,barPercentage:0.7}]},options:{...baseBar,scales:{...baseBar.scales,y:{...baseBar.scales.y,ticks:{...baseBar.scales.y.ticks,callback:v=>v}}}}});
  }

  // 7. Discounts vs Sales over time — dual line
  _dc('descevo');
  const deEl=document.getElementById('rc-descevo');
  if(deEl&&fechas.length>1){
    _rc.descevo=new Chart(deEl,{type:'line',data:{labels:fechas.map(f=>{const p=f.split('-');return p[2]+'/'+p[1];}),datasets:[
      {data:fechas.map(f=>a.byFecha[f]),borderColor:t.primary,backgroundColor:t.primary+'15',fill:true,pointRadius:2,borderWidth:2,tension:0.3,label:'Ventas'},
      {data:fechas.map(f=>a.byFechaDesc[f]||0),borderColor:t.red||'#e74c3c',backgroundColor:(t.red||'#e74c3c')+'15',fill:true,pointRadius:2,borderWidth:2,tension:0.3,label:'Descuentos'}
    ]},options:{...baseLine,plugins:{...baseLine.plugins,legend:{display:true,position:'bottom',labels:{color:t.text,font:{size:11},usePointStyle:true,pointStyle:'circle',padding:16}}}}});
  }
}

function _doughnut(id,data,t){
  _dc(id);const el=document.getElementById('rc-'+id);if(!el)return;
  const labels=Object.keys(data),values=Object.values(data);
  if(!labels.length)return;
  _rc[id]=new Chart(el,{type:'doughnut',data:{labels,datasets:[{data:values,backgroundColor:labels.map((_,i)=>t.colors[i%t.colors.length]),borderWidth:2,borderColor:t.bg,hoverOffset:6}]},
    options:{responsive:true,maintainAspectRatio:false,cutout:'65%',plugins:{legend:{display:false},tooltip:{backgroundColor:t.isDark?'#1e2b22':'#fff',titleColor:t.ink,bodyColor:t.ink,borderColor:t.grid,borderWidth:1,padding:10,cornerRadius:8,callbacks:{label:ctx=>{const total=ctx.dataset.data.reduce((s,v)=>s+v,0);const pct=((ctx.parsed/total)*100).toFixed(1);return ' $'+_f(ctx.parsed)+' ('+pct+'%)';}}}}}}
  );
}

function _legend(data){
  const total=Object.values(data).reduce((s,v)=>s+v,0);
  const colors=['#235328','#F28C00','#2980b9','#8e44ad','#27ae60','#e74c3c','#f39c12','#1abc9c','#e67e22','#3498db'];
  if(!total)return'';
  return'<div class="rep-legend">'+Object.entries(data).map(([n,v],i)=>{
    const pct=((v/total)*100).toFixed(1);
    return'<div class="rep-legend-row"><div class="rep-legend-dot" style="background:'+colors[i%colors.length]+'"></div><span class="rep-legend-name">'+_e(n)+'</span><span class="rep-legend-val">$'+_f(v)+'</span><span class="rep-legend-pct">'+pct+'%</span></div>';
  }).join('')+'</div>';
}

// ═══════════════════════════════════════════════════════════
// PRODUCTOS
// ═══════════════════════════════════════════════════════════
function _renderProductos(){
  const c=document.getElementById('rep-content');if(!c)return;
  const allRows=REP.productosRaw||[];
  if(!allRows.length){c.innerHTML=_empty('productos');return;}
  const rows=_filterByDate(allRows);
  if(!rows.length){c.innerHTML=_emptyFilter();return;}

  const byProd={},byCat={},bySubCat={};
  let totalCMV=0;
  rows.forEach(r=>{
    const k=r.nombre||'?';
    if(!byProd[k])byProd[k]={name:k,qty:0,venta:0,cmv:0,cat:r.cat||''};
    byProd[k].qty+=(r.qty||0);byProd[k].venta+=(r.venta||0);byProd[k].cmv+=(r.cmv||0);
    if(r.cat){byCat[r.cat]=(byCat[r.cat]||0)+(r.venta||0);}
    if(r.subCat){bySubCat[r.subCat]=(bySubCat[r.subCat]||0)+(r.venta||0);}
    totalCMV+=(r.cmv||0);
  });
  const items=Object.values(byProd).sort((a,b)=>b.venta-a.venta);
  const totalQty=items.reduce((s,x)=>s+x.qty,0);
  const totalVenta=items.reduce((s,x)=>s+x.venta,0);
  const top3=items.slice(0,3).reduce((s,x)=>s+x.venta,0);
  const top3Pct=totalVenta>0?((top3/totalVenta)*100).toFixed(1):0;
  const uniqueProds=items.length;
  const avgTicket=totalQty>0?Math.round(totalVenta/totalQty):0;
  const margin=totalVenta>0?((1-totalCMV/totalVenta)*100).toFixed(1):0;

  // Build category filter options
  const cats=Object.keys(byCat).sort();
  const catFilter=cats.length>0?`<div style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:14px">
    <button class="rep-preset-btn ${!_prodCatFilter?'active':''}" onclick="_prodCatFilter=null;_renderProductos()">Todas</button>
    ${cats.map(cat=>`<button class="rep-preset-btn ${_prodCatFilter===cat?'active':''}" onclick="_prodCatFilter='${_e(cat)}';_renderProductos()">${_e(cat)}</button>`).join('')}
  </div>`:'';

  c.innerHTML=`
  <div class="rep-kpis">
    ${_kpi('Productos vendidos',_f(totalQty),null,'primary')}
    ${_kpi('Ingresos','$'+_f(totalVenta),null,'accent')}
    ${_kpi('Productos únicos',_f(uniqueProds),null,'blue')}
    ${_kpi('Ticket promedio','$'+_f(avgTicket),null,'green')}
    ${_kpi('Top 3 = '+top3Pct+'%','$'+_f(top3),null,'gold')}
    ${totalCMV>0?_kpi('CMV total','$'+_f(totalCMV)+'<div style="font-size:11px;color:var(--muted);margin-top:2px">Margen: '+margin+'%</div>',null,'red'):''}
  </div>

  ${catFilter}

  <div class="rep-chart-card full">
    <div class="rep-chart-header">
      <div><div class="rep-chart-title">Evolución de ventas por producto</div>
      <div class="rep-chart-sub">Agrupado por mes · Top 10 productos</div></div>
    </div>
    <div style="height:340px"><canvas id="rc-prod-evo-month"></canvas></div>
    <div id="rc-prod-evo-legend" style="margin-top:14px"></div>
  </div>

  <div class="rep-chart-card full">
    <div class="rep-chart-title">Top 15 productos por ventas</div>
    <div style="height:${Math.max(280,Math.min(items.length,15)*32+40)}px"><canvas id="rc-top-bar"></canvas></div>
  </div>

  <div class="rep-chart-grid">
    <div class="rep-chart-card">
      <div class="rep-chart-title">Top 10 por cantidad</div>
      <div style="height:280px"><canvas id="rc-top-qty"></canvas></div>
    </div>
    <div class="rep-chart-card">
      <div class="rep-chart-title">Distribución de ingresos</div>
      <div class="rep-chart-sub">Top 8 productos</div>
      <div style="height:280px"><canvas id="rc-prod-pie"></canvas></div>
    </div>
  </div>

  ${Object.keys(byCat).length>0?`
  <div class="rep-chart-grid">
    <div class="rep-chart-card">
      <div class="rep-chart-title">Ventas por categoría</div>
      <div style="height:${Math.max(200,Object.keys(byCat).length*40)}px"><canvas id="rc-cat"></canvas></div>
      ${_legend(byCat)}
    </div>
    <div class="rep-chart-card">
      <div class="rep-chart-title">Cantidad por categoría</div>
      <div style="height:${Math.max(200,Object.keys(byCat).length*40)}px"><canvas id="rc-cat-qty"></canvas></div>
    </div>
  </div>`:''}

  <div class="rep-chart-card full">
    <div class="rep-chart-title">Tabla detallada de productos</div>
    <div class="table-wrap"><table class="rep-prod-table">
      <thead><tr><th>#</th><th>Producto</th>${cats.length?'<th>Categoría</th>':''}<th style="text-align:right">Cantidad</th><th style="text-align:right">Venta ($)</th><th style="text-align:right">% total</th><th style="text-align:right">Ticket prom.</th>${totalCMV>0?'<th style="text-align:right">CMV $</th><th style="text-align:right">Margen</th>':''}</tr></thead>
      <tbody>${items.slice(0,30).map((it,idx)=>{
        const pct=totalVenta>0?((it.venta/totalVenta)*100).toFixed(1):0;
        const avg=it.qty>0?Math.round(it.venta/it.qty):0;
        const mrg=it.venta>0?((1-it.cmv/it.venta)*100).toFixed(1):'—';
        return'<tr><td style="color:var(--muted)">'+(idx+1)+'</td><td><strong>'+_e(it.name)+'</strong></td>'+(cats.length?'<td style="color:var(--muted);font-size:12px">'+_e(it.cat)+'</td>':'')+'<td class="mono" style="text-align:right">'+_f(it.qty)+'</td><td class="mono" style="text-align:right">$'+_f(it.venta)+'</td><td style="text-align:right;color:var(--muted)">'+pct+'%</td><td class="mono" style="text-align:right">$'+_f(avg)+'</td>'+(totalCMV>0?'<td class="mono" style="text-align:right">$'+_f(it.cmv)+'</td><td style="text-align:right;color:'+(parseFloat(mrg)>50?'var(--green,#27ae60)':'var(--red,#e74c3c)')+'">'+mrg+'%</td>':'')+'</tr>';
      }).join('')}</tbody>
    </table></div>
  </div>`;

  setTimeout(()=>_drawProductos(items,rows,byCat),150);
}

// Category filter state
let _prodCatFilter = null;

function _drawProductos(items,rows,byCat){
  if(typeof Chart==='undefined')return;
  const t=_chartTheme();
  const baseBar={responsive:true,maintainAspectRatio:false,plugins:{legend:{display:false},tooltip:{backgroundColor:t.isDark?'#1e2b22':'#fff',titleColor:t.ink,bodyColor:t.ink,borderColor:t.grid,borderWidth:1,padding:10,cornerRadius:8}},scales:{x:{grid:{display:false},ticks:{color:t.text,font:{size:10}}},y:{grid:{color:t.grid,drawBorder:false},ticks:{color:t.text,font:{size:10}},border:{display:false}}}};

  // 0. Monthly evolution (Fudo-style) — top 10 products as lines
  const top10=items.slice(0,10);
  const monthSet=new Set();
  rows.forEach(r=>{if(r.fecha){const m=r.fecha.substring(0,7);monthSet.add(m);}});
  const months=[...monthSet].sort();
  const monthLabels=['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'];

  if(months.length>1){
    const datasets=top10.map((prod,i)=>{
      const byMonth={};
      rows.filter(r=>r.nombre===prod.name).forEach(r=>{
        if(r.fecha){const m=r.fecha.substring(0,7);byMonth[m]=(byMonth[m]||0)+(r.qty||0);}
      });
      return{
        label:prod.name,
        data:months.map(m=>byMonth[m]||0),
        borderColor:t.colors[i%t.colors.length],
        backgroundColor:t.colors[i%t.colors.length]+'11',
        pointRadius:4,pointHoverRadius:6,
        pointBackgroundColor:t.colors[i%t.colors.length],
        borderWidth:2.5,tension:0.3,fill:false
      };
    });
    _dc('prodEvoMonth');
    const el=document.getElementById('rc-prod-evo-month');
    if(el){
      _rc.prodEvoMonth=new Chart(el,{type:'line',data:{
        labels:months.map(m=>{const parts=m.split('-');return monthLabels[parseInt(parts[1])-1]+' '+parts[0];}),
        datasets
      },options:{
        responsive:true,maintainAspectRatio:false,
        interaction:{mode:'index',intersect:false},
        plugins:{
          legend:{display:false},
          tooltip:{
            backgroundColor:t.isDark?'#1e2b22':'#fff',
            titleColor:t.ink,bodyColor:t.ink,
            borderColor:t.grid,borderWidth:1,
            padding:14,cornerRadius:10,
            titleFont:{size:13,weight:'700'},
            bodyFont:{size:12},
            callbacks:{
              title:ctx=>{const idx=ctx[0].dataIndex;return months[idx]?months[idx].split('-').reverse().join('/'):'';}
            }
          }
        },
        scales:{
          x:{grid:{display:false},ticks:{color:t.text,font:{size:11}}},
          y:{grid:{color:t.grid,drawBorder:false},ticks:{color:t.text,font:{size:10}},border:{display:false},
            title:{display:true,text:'Cantidad',color:t.text,font:{size:11}}}
        }
      }});
      // Rich legend like Fudo
      const leg=document.getElementById('rc-prod-evo-legend');
      if(leg){
        leg.innerHTML='<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(220px,1fr));gap:8px 16px">'+
          top10.map((p,i)=>{
            const color=t.colors[i%t.colors.length];
            return'<div style="display:flex;align-items:center;gap:8px;font-size:13px">'+
              '<div style="width:12px;height:12px;border-radius:3px;background:'+color+';flex-shrink:0"></div>'+
              '<span style="color:'+t.ink+';font-weight:600;flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">'+_e(p.name)+'</span>'+
              '<span style="color:'+t.text+';font-family:DM Mono,monospace;font-size:11px;white-space:nowrap">$'+_f(p.venta)+'</span>'+
              '<span style="color:'+t.text+';font-family:DM Mono,monospace;font-size:11px;min-width:36px;text-align:right">'+_f(p.qty)+'</span>'+
            '</div>';
          }).join('')+'</div>';
      }
    }
  }

  // 1. Top 15 horizontal bar (by venta $)
  const top15=items.slice(0,15);
  _dc('topBar');
  const tbEl=document.getElementById('rc-top-bar');
  if(tbEl){
    _rc.topBar=new Chart(tbEl,{type:'bar',data:{
      labels:top15.map(p=>p.name.length>28?p.name.slice(0,26)+'…':p.name),
      datasets:[{data:top15.map(p=>p.venta),backgroundColor:top15.map((_,i)=>t.colors[i%t.colors.length]+'bb'),hoverBackgroundColor:top15.map((_,i)=>t.colors[i%t.colors.length]),borderRadius:6,barPercentage:0.65}]
    },options:{...baseBar,indexAxis:'y',scales:{y:{grid:{display:false},ticks:{color:t.text,font:{size:11,weight:'500'}}},x:{grid:{color:t.grid},ticks:{color:t.text,font:{size:10},callback:v=>'$'+_fk(v)}}}}});
  }

  // 2. Top 10 by qty — vertical bar
  const top10q=items.slice(0,10);
  _dc('topQty');
  const tqEl=document.getElementById('rc-top-qty');
  if(tqEl){
    _rc.topQty=new Chart(tqEl,{type:'bar',data:{
      labels:top10q.map(p=>p.name.length>14?p.name.slice(0,12)+'…':p.name),
      datasets:[{data:top10q.map(p=>p.qty),backgroundColor:t.accent+'99',hoverBackgroundColor:t.accent,borderRadius:6,barPercentage:0.6}]
    },options:{...baseBar,scales:{...baseBar.scales,y:{...baseBar.scales.y,ticks:{...baseBar.scales.y.ticks,callback:v=>v}},x:{...baseBar.scales.x,ticks:{...baseBar.scales.x.ticks,maxRotation:45}}}}});
  }

  // 3. Pie — top 8 revenue share
  const top8=items.slice(0,8);
  const _totalV=items.reduce((s,x)=>s+x.venta,0);
  const otherV=_totalV-top8.reduce((s,x)=>s+x.venta,0);
  _dc('prodPie');
  const ppEl=document.getElementById('rc-prod-pie');
  if(ppEl){
    const pieLabels=[...top8.map(p=>p.name)];
    const pieData=[...top8.map(p=>p.venta)];
    if(otherV>0){pieLabels.push('Otros');pieData.push(otherV);}
    _rc.prodPie=new Chart(ppEl,{type:'doughnut',data:{labels:pieLabels,datasets:[{data:pieData,backgroundColor:pieLabels.map((_,i)=>t.colors[i%t.colors.length]),borderWidth:2,borderColor:t.bg,hoverOffset:8}]},
      options:{responsive:true,maintainAspectRatio:false,cutout:'55%',plugins:{legend:{display:true,position:'right',labels:{color:t.text,font:{size:10},padding:8,usePointStyle:true,pointStyle:'circle'}},tooltip:{callbacks:{label:ctx=>{const tot=ctx.dataset.data.reduce((s,v)=>s+v,0);return' $'+_f(ctx.parsed)+' ('+((ctx.parsed/tot)*100).toFixed(1)+'%)';}}}}}});
  }

  // 4. Category horizontal bars
  if(Object.keys(byCat).length>0){
    _dc('cat');
    const cEl=document.getElementById('rc-cat');
    if(cEl){
      const catLabels=Object.keys(byCat).sort((a,b)=>byCat[b]-byCat[a]);
      const catVals=catLabels.map(k=>byCat[k]);
      _rc.cat=new Chart(cEl,{type:'bar',data:{labels:catLabels,datasets:[{data:catVals,backgroundColor:catLabels.map((_,i)=>t.colors[i%t.colors.length]+'bb'),borderRadius:6,barPercentage:0.6}]},
        options:{...baseBar,indexAxis:'y',scales:{y:{grid:{display:false},ticks:{color:t.text,font:{size:11}}},x:{grid:{color:t.grid},ticks:{color:t.text,font:{size:10},callback:v=>'$'+_fk(v)}}}}});
    }

    // Category qty chart
    const catQty={};
    rows.forEach(r=>{if(r.cat)catQty[r.cat]=(catQty[r.cat]||0)+(r.qty||0);});
    _dc('catQty');
    const cqEl=document.getElementById('rc-cat-qty');
    if(cqEl){
      const cqLabels=Object.keys(catQty).sort((a,b)=>catQty[b]-catQty[a]);
      const cqVals=cqLabels.map(k=>catQty[k]);
      _rc.catQty=new Chart(cqEl,{type:'bar',data:{labels:cqLabels,datasets:[{data:cqVals,backgroundColor:cqLabels.map((_,i)=>t.colors[i%t.colors.length]+'88'),borderRadius:6,barPercentage:0.6}]},
        options:{...baseBar,indexAxis:'y',scales:{y:{grid:{display:false},ticks:{color:t.text,font:{size:11}}},x:{grid:{color:t.grid},ticks:{color:t.text,font:{size:10}}}}}});
    }
  }
}

// ═══════════════════════════════════════════════════════════
// IMPORT
// ═══════════════════════════════════════════════════════════
function _renderImport(){
  const c=document.getElementById('rep-content');if(!c)return;
  const hasXLSX=typeof XLSX!=='undefined';
  c.innerHTML=`
  <div class="info-banner" style="margin-bottom:18px"><strong>Importar datos de Fudo:</strong> Subí los reportes XLSX exportados desde Fudo. Se parsean localmente y los datos se acumulan — podés importar múltiples períodos sin perder los anteriores.</div>
  ${!hasXLSX?'<div class="info-banner" style="margin-bottom:18px;border-color:var(--accent);background:rgba(242,140,0,0.06)"><strong>⏳ Cargando librería SheetJS...</strong> Esperá unos segundos y volvé a esta pestaña.</div>':''}
  <div style="display:grid;grid-template-columns:1fr 1fr;gap:14px;margin-bottom:24px">
    <div class="rep-import-zone" onclick="document.getElementById('rep-xv').click()">
      <svg viewBox="0 0 24 24" width="40" height="40" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M18 20V10"/><path d="M12 20V4"/><path d="M6 20v-6"/></svg>
      <div class="import-title">Reporte de Ventas</div>
      <div class="import-sub">Reporte-Ventas.xlsx</div>
      <input type="file" id="rep-xv" accept=".xlsx,.xls,.csv" style="display:none" onchange="repImport(event,'ventas')">
    </div>
    <div class="rep-import-zone" onclick="document.getElementById('rep-xp').click()">
      <svg viewBox="0 0 24 24" width="40" height="40" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/></svg>
      <div class="import-title">Reporte de Productos</div>
      <div class="import-sub">Reporte-Productos.xlsx</div>
      <input type="file" id="rep-xp" accept=".xlsx,.xls,.csv" style="display:none" onchange="repImport(event,'productos')">
    </div>
  </div>
  <div style="display:flex;gap:10px;flex-wrap:wrap;margin-bottom:24px">
    <button class="btn" onclick="repClear('ventas')">🗑 Limpiar ventas (${(REP.ventasRaw||[]).length})</button>
    <button class="btn" onclick="repClear('productos')">🗑 Limpiar productos (${(REP.productosRaw||[]).length})</button>
  </div>
  <div class="rep-chart-card"><div class="rep-chart-title">Historial de importaciones</div><div id="rep-hist"></div></div>`;
  _renderHist();
  if(!hasXLSX)_loadXLSX();
}

function _renderHist(){
  const el=document.getElementById('rep-hist');if(!el)return;
  const imps=REP.imports||[];
  if(!imps.length){el.innerHTML='<div style="text-align:center;color:var(--muted);padding:20px;font-size:13px">No hay importaciones registradas.</div>';return;}
  el.innerHTML=imps.map(i=>'<div class="rep-import-item"><span class="import-icon">'+(i.type==='ventas'?'📊':'📦')+'</span><div class="import-info"><div class="import-file">'+_e(i.file)+'</div><div class="import-date">'+i.date+' · '+i.rows+' registros · '+i.type+'</div></div></div>').join('');
}

function _loadXLSX(){ if(window._xlsxLoading)return; window._xlsxLoading=true; SAHTEN.libs.xlsx().then(()=>{ window._xlsxLoading=false; renderReportes(); }); }   // SheetJS viene empaquetado (sin CDN)

// ═══════════════════════════════════════════════════════════
// XLSX PARSING — FUDO MULTI-SHEET FORMAT
// ═══════════════════════════════════════════════════════════
// Fudo exports 6 sheets, each with different structure:
//   1. "Evolución de ventas"      → Fecha | Día | Hora | Ventas | Cantidad
//   2. "Medios de pago"           → Fecha | Medio | Ventas | Cantidad
//   3. "Origen de ventas"         → Fecha | Origen | Ventas | Cantidad
//   4. "Canales de delivery"      → Fecha | Plataforma | Ventas | Cantidad
//   5. "Ranking de camareros"     → Fecha | Usuario | Cant. productos | Ventas
//   6. "Cancelaciones"            → Usuario | Cant. | Monto
// Dates are Excel serial numbers (days since 1900-01-01).

function _excelToDate(serial){
  if(!serial||typeof serial!=='number'||serial<1) return null;
  const epoch=new Date(1899,11,30);
  const d=new Date(epoch.getTime()+serial*86400000);
  return isNaN(d.getTime())?null:d;
}
function _excelToISO(serial){
  const d=_excelToDate(serial);if(!d)return null;
  const pad=n=>String(n).padStart(2,'0');
  return d.getFullYear()+'-'+pad(d.getMonth()+1)+'-'+pad(d.getDate());
}
function _tryParseDate(val){
  if(!val)return null;
  if(typeof val==='number')return _excelToISO(val);
  const s=String(val).trim();
  const m=s.match(/^(\d{1,2})[\/-](\d{1,2})[\/-](\d{2,4})/);
  if(m){const yr=m[3].length===2?2000+parseInt(m[3]):parseInt(m[3]);const d=new Date(yr,parseInt(m[2])-1,parseInt(m[1]));if(!isNaN(d.getTime()))return _isoDate(d);}
  const d=new Date(s);return!isNaN(d.getTime())?_isoDate(d):null;
}
const _dMap={0:'Dom',1:'Lun',2:'Mar',3:'Mié',4:'Jue',5:'Vie',6:'Sáb'};

function _getVal(row,aliases){
  for(const key of Object.keys(row)){
    const kn=key.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').trim();
    for(const a of aliases){if(kn===a||kn.includes(a))return row[key];}
  }
  return undefined;
}
function _sheetRows(wb,partialName){
  const norm=s=>s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').trim();
  const target=norm(partialName);
  const found=wb.SheetNames.find(sn=>norm(sn).includes(target));
  if(!found)return[];
  return XLSX.utils.sheet_to_json(wb.Sheets[found],{defval:'',raw:true});
}

function repImport(ev,type){
  const file=ev.target.files?.[0];ev.target.value='';
  if(!file)return;
  if(typeof XLSX==='undefined'){alert('SheetJS cargando, esperá...');return;}
  const reader=new FileReader();
  reader.onload=e=>{
    try{
      const wb=XLSX.read(new Uint8Array(e.target.result),{type:'array',cellDates:false,raw:true});
      console.log('Sheet names:',wb.SheetNames);
      if(type==='ventas') _parseFudoVentas(wb,file.name);
      else _parseFudoProductos(wb,file.name);
    }catch(err){alert('Error: '+err.message);console.error(err);}
  };
  reader.readAsArrayBuffer(file);
}

function _findCol(cols,aliases){
  return cols.find(c=>{
    const cl=c.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').trim();
    return aliases.some(a=>cl===a||cl.includes(a));
  })||null;
}

// ── FUDO multi-sheet ventas parser ────────────────────
function _parseFudoVentas(wb, fileName){
  const evoRows=_sheetRows(wb,'evolucion');
  const pagoRows=_sheetRows(wb,'medios');
  const origenRows=_sheetRows(wb,'origen');
  const canalRows=_sheetRows(wb,'canales');
  console.log('Sheets found — Evo:',evoRows.length,'Pago:',pagoRows.length,'Origen:',origenRows.length,'Canal:',canalRows.length);

  if(!evoRows.length){
    // Fallback: single-sheet flat format
    _parseFlatVentas(wb,fileName);return;
  }

  const parsed=[];const payMethods=new Set();

  // Sheet 1: Evolución — main sales data
  evoRows.forEach(r=>{
    const fechaRaw=_getVal(r,['fecha','date']);
    const horaRaw=_getVal(r,['hora','hour']);
    const ventaRaw=_getVal(r,['ventas','venta','total']);
    const cantRaw=_getVal(r,['cantidad','cant']);
    const bruto=_pn(ventaRaw);if(bruto<=0)return;
    const cnt=Math.max(1,_pn(cantRaw)||1);
    const fechaISO=(typeof fechaRaw==='number')?_excelToISO(fechaRaw):_tryParseDate(fechaRaw);
    const d=(typeof fechaRaw==='number')?_excelToDate(fechaRaw):null;
    const dia=d?_dMap[d.getDay()]:null;
    let hora=null;
    if(horaRaw!=null){
      if(typeof horaRaw==='number') hora=(horaRaw<1)?Math.floor(horaRaw*24):Math.floor(horaRaw);
      else hora=parseInt(String(horaRaw).split(':')[0])||null;
    }
    parsed.push({bruto,neto:bruto,desc:0,fecha:fechaISO,dia,hora,pago:null,origen:null,canal:null,count:cnt});
  });

  // Sheet 2: Medios de pago — build lookup by date
  const pagoByDate={};
  pagoRows.forEach(r=>{
    const fechaRaw=_getVal(r,['fecha']);
    const method=String(_getVal(r,['medio','metodo','pago'])||'').trim();
    const ventas=_pn(_getVal(r,['ventas','venta','total']));
    if(!method||ventas<=0)return;
    const fecha=(typeof fechaRaw==='number')?_excelToISO(fechaRaw):_tryParseDate(fechaRaw);
    if(!pagoByDate[fecha])pagoByDate[fecha]={};
    pagoByDate[fecha][method]=(pagoByDate[fecha][method]||0)+ventas;
    payMethods.add(method);
  });

  // Sheet 3: Origen
  const origenByDate={};
  origenRows.forEach(r=>{
    const fechaRaw=_getVal(r,['fecha']);
    const origen=String(_getVal(r,['origen','origin','tipo'])||'').trim();
    const ventas=_pn(_getVal(r,['ventas','venta','total']));
    if(!origen||ventas<=0)return;
    const fecha=(typeof fechaRaw==='number')?_excelToISO(fechaRaw):_tryParseDate(fechaRaw);
    if(!origenByDate[fecha])origenByDate[fecha]={};
    origenByDate[fecha][origen]=(origenByDate[fecha][origen]||0)+ventas;
  });

  // Sheet 4: Canales
  const canalByDate={};
  canalRows.forEach(r=>{
    const fechaRaw=_getVal(r,['fecha']);
    const canal=String(_getVal(r,['plataforma','canal','channel'])||'').trim();
    const ventas=_pn(_getVal(r,['ventas','venta','total']));
    if(!canal||ventas<=0)return;
    const fecha=(typeof fechaRaw==='number')?_excelToISO(fechaRaw):_tryParseDate(fechaRaw);
    if(!canalByDate[fecha])canalByDate[fecha]={};
    canalByDate[fecha][canal]=(canalByDate[fecha][canal]||0)+ventas;
  });

  // Store dimension lookups
  REP.pagoByDate=pagoByDate;
  REP.origenByDate=origenByDate;
  REP.canalByDate=canalByDate;

  if(!parsed.length){alert('No se pudieron parsear filas con montos > 0.');return;}

  REP.ventasRaw=[...(REP.ventasRaw||[]),...parsed];
  REP.imports=[...(REP.imports||[]),{type:'ventas',file:fileName,date:new Date().toLocaleDateString('es-AR'),rows:parsed.length}];
  _saveRepData();

  // Auto-create payment methods in Mostrador
  if(payMethods.size&&typeof MOSTRADOR_PAYMENTS!=='undefined'){
    let created=0;
    payMethods.forEach(name=>{
      if(!name)return;
      if(!MOSTRADOR_PAYMENTS.some(p=>p.name.toLowerCase()===name.toLowerCase())){
        MOSTRADOR_PAYMENTS.push({id:'pay_'+Date.now().toString(36)+Math.random().toString(36).slice(2,5),name});created++;}
    });
    if(created&&typeof _savePaymentMethods==='function')_savePaymentMethods();
  }

  alert('✅ '+parsed.length+' registros de ventas importados de "'+fileName+'"\n'+
    (pagoRows.length?'· '+pagoRows.length+' registros de medios de pago\n':'')+
    (origenRows.length?'· '+origenRows.length+' registros de origen\n':'')+
    (canalRows.length?'· '+canalRows.length+' registros de canales':''));
  repTab='ventas';renderReportes();
}

// Fallback single-sheet parser
function _parseFlatVentas(wb,fileName){
  let allRows=[];
  wb.SheetNames.forEach(sn=>{const rows=XLSX.utils.sheet_to_json(wb.Sheets[sn],{defval:'',raw:true});if(rows.length)allRows=allRows.concat(rows);});
  if(!allRows.length){alert('Archivo vacío.');return;}
  const cols=Object.keys(allRows[0]);
  const cFecha=_findCol(cols,['fecha','date','dia','created']);
  const cHora=_findCol(cols,['hora','hour','time']);
  const cTotal=_findCol(cols,['total','monto','ventas','venta','importe','bruto','subtotal','valor']);
  const cPago=_findCol(cols,['medio de pago','medio','metodo de pago','pago']);
  const cOrigen=_findCol(cols,['origen','origin','tipo de venta','tipo']);
  const cCanal=_findCol(cols,['canal','channel','plataforma']);
  let totalCol=cTotal;
  if(!totalCol){for(const c of cols){const v=allRows[0][c];if(typeof v==='number'&&v>0){totalCol=c;break;}}}
  if(!totalCol){alert('No se encontró columna de monto. Columnas: '+cols.join(', '));return;}
  const parsed=[];
  allRows.forEach(r=>{
    const bruto=_pn(r[totalCol]);if(bruto<=0)return;
    const fechaRaw=cFecha?r[cFecha]:null;
    const fechaISO=(typeof fechaRaw==='number')?_excelToISO(fechaRaw):_tryParseDate(fechaRaw);
    const d=(typeof fechaRaw==='number')?_excelToDate(fechaRaw):null;
    const dia=d?_dMap[d.getDay()]:null;
    let hora=null;
    if(cHora){const hv=r[cHora];hora=(typeof hv==='number')?(hv<1?Math.floor(hv*24):Math.floor(hv)):parseInt(String(hv).split(':')[0])||null;}
    parsed.push({bruto,neto:bruto,desc:0,fecha:fechaISO,dia,hora,
      pago:cPago?String(r[cPago]||'').trim()||null:null,
      origen:cOrigen?String(r[cOrigen]||'').trim()||null:null,
      canal:cCanal?String(r[cCanal]||'').trim()||null:null,count:1});
  });
  if(!parsed.length){alert('Sin filas válidas.');return;}
  REP.ventasRaw=[...(REP.ventasRaw||[]),...parsed];
  REP.imports=[...(REP.imports||[]),{type:'ventas',file:fileName,date:new Date().toLocaleDateString('es-AR'),rows:parsed.length}];
  _saveRepData();
  alert('✅ '+parsed.length+' ventas importadas de "'+fileName+'"');
  repTab='ventas';renderReportes();
}

// ── Products parser (Fudo multi-sheet) ────────────────
function _parseFudoProductos(wb,fileName){
  // Fudo Products XLSX has 2 sheets:
  //   1. "Detalle" — daily: Fecha | Categoría | Sub categoría | Producto | Cantidades vendidas | Monto total | CMV $ | CMV % | Markup
  //   2. Summary  — totals: Categoría | Sub categoría | Producto | Cantidades vendidas | Ingresos totales $ | % del total | CMV $ | CMV %

  // Prefer "Detalle" sheet for date-level data
  const detRows = _sheetRows(wb, 'detalle');
  console.log('Detalle rows:', detRows.length);

  if(detRows.length > 0) {
    // Use detail sheet — has dates for time-series
    const cols = Object.keys(detRows[0]);
    console.log('Product detail columns:', cols);
    const parsed = [];

    detRows.forEach(r => {
      const nombre = String(_getVal(r, ['producto', 'name', 'item', 'descripcion']) || '').trim();
      if(!nombre) return;
      const qty = _pn(_getVal(r, ['cantidades', 'cantidad', 'qty', 'cant', 'vendidas']));
      const venta = _pn(_getVal(r, ['monto', 'total', 'ventas', 'venta', 'ingresos', 'importe']));
      if(qty <= 0 && venta <= 0) return;
      const cat = String(_getVal(r, ['categoria', 'category', 'rubro']) || '').trim();
      const subCat = String(_getVal(r, ['sub categoria', 'subcategoria', 'sub_categoria']) || '').trim();
      const cmv = _pn(_getVal(r, ['cmv $', 'cmv', 'costo']));
      const cmvPct = _pn(_getVal(r, ['cmv %', 'cmv%']));
      const markup = _pn(_getVal(r, ['markup']));
      const fechaRaw = _getVal(r, ['fecha', 'date']);
      const fecha = (typeof fechaRaw === 'number') ? _excelToISO(fechaRaw) : _tryParseDate(fechaRaw);

      parsed.push({ nombre, qty, venta, cat, subCat, cmv, cmvPct, markup, fecha });
    });

    if(!parsed.length) { alert('Sin filas válidas en Detalle.'); return; }

    REP.productosRaw = [...(REP.productosRaw || []), ...parsed];
    REP.imports = [...(REP.imports || []), { type: 'productos', file: fileName, date: new Date().toLocaleDateString('es-AR'), rows: parsed.length }];
    _saveRepData();
    alert('✅ ' + parsed.length + ' productos importados de "' + fileName + '" (detalle diario con categorías)');
    repTab = 'productos';
    renderReportes();
    return;
  }

  // Fallback: try any sheet with product-like columns
  let allRows = [];
  wb.SheetNames.forEach(sn => {
    const rows = XLSX.utils.sheet_to_json(wb.Sheets[sn], { defval: '', raw: true });
    if(rows.length) allRows = allRows.concat(rows);
  });
  if(!allRows.length) { alert('Archivo vacío.'); return; }

  const cols = Object.keys(allRows[0]);
  console.log('Fallback product columns:', cols);
  const cNombre = _findCol(cols, ['producto', 'nombre', 'name', 'item', 'descripcion', 'articulo']);
  const cQty = _findCol(cols, ['cantidades', 'cantidad', 'qty', 'cant', 'unidades', 'vendidos', 'vendidas']);
  const cVenta = _findCol(cols, ['monto', 'venta', 'total', 'ingresos', 'importe', 'ventas']);
  const cCat = _findCol(cols, ['categoria', 'category', 'rubro', 'tipo', 'grupo', 'familia']);
  const cFecha = _findCol(cols, ['fecha', 'date', 'dia', 'periodo']);
  if(!cNombre) { alert('No se encontró columna de producto. Columnas: ' + cols.join(', ')); return; }

  const parsed = [];
  allRows.forEach(r => {
    const nombre = String(r[cNombre] || '').trim(); if(!nombre) return;
    const qty = cQty ? _pn(r[cQty]) : 0;
    const venta = cVenta ? _pn(r[cVenta]) : 0;
    if(qty <= 0 && venta <= 0) return;
    const cat = cCat ? String(r[cCat] || '').trim() : '';
    const fechaRaw = cFecha ? r[cFecha] : null;
    const fecha = (typeof fechaRaw === 'number') ? _excelToISO(fechaRaw) : _tryParseDate(fechaRaw);
    parsed.push({ nombre, qty, venta, cat, fecha });
  });
  if(!parsed.length) { alert('Sin filas válidas.'); return; }
  REP.productosRaw = [...(REP.productosRaw || []), ...parsed];
  REP.imports = [...(REP.imports || []), { type: 'productos', file: fileName, date: new Date().toLocaleDateString('es-AR'), rows: parsed.length }];
  _saveRepData();
  alert('✅ ' + parsed.length + ' productos importados de "' + fileName + '"');
  repTab = 'productos';
  renderReportes();
}

function repClear(type){
  if(!confirm('¿Limpiar datos de '+type+'?'))return;
  if(type==='ventas')REP.ventasRaw=[];else REP.productosRaw=[];
  _saveRepData();renderReportes();
}

// ═══════════════════════════════════════════════════════════
// MOSTRADOR REPORT — reads from SAHTEN_ORDERS
// ═══════════════════════════════════════════════════════════
function _renderMostradorReport(){
  const c=document.getElementById('rep-content');if(!c)return;
  const orders=(typeof SAHTEN_ORDERS!=='undefined')?SAHTEN_ORDERS:[];
  if(!orders.length){
    c.innerHTML='<div style="text-align:center;padding:60px 20px"><svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.2" style="color:var(--muted);opacity:0.4;margin-bottom:16px"><circle cx="9" cy="21" r="1"/><circle cx="20" cy="21" r="1"/><path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"/></svg><div style="font-size:16px;font-weight:600;color:var(--ink);margin-bottom:8px">Sin órdenes registradas</div><div style="font-size:13px;color:var(--muted);max-width:400px;margin:0 auto">Creá pedidos desde la sección <strong>Mostrador</strong> y se reflejarán automáticamente aquí.</div></div>';
    return;
  }

  // Filter by date
  const filtered=orders.filter(o=>{
    if(!o.createdAt)return true;
    const fecha=o.createdAt.split('T')[0];
    if(repDateFrom&&fecha<repDateFrom)return false;
    if(repDateTo&&fecha>repDateTo)return false;
    return true;
  });

  if(!filtered.length){c.innerHTML=_emptyFilter();return;}

  // Aggregate orders
  let totalVentas=0,totalDesc=0,totalEnvio=0,totalItems=0;
  const byFecha={},byFechaCount={},byHora={},byPago={},byCliente={},byProducto={},byStatus={};

  filtered.forEach(o=>{
    const total=o.total||0;
    totalVentas+=total;
    totalDesc+=(o.discount||0);
    totalEnvio+=(o.shipping||0);
    const itemCount=(o.items||[]).reduce((s,it)=>s+(it.qty||0),0);
    totalItems+=itemCount;
    if(o.createdAt){
      const fecha=o.createdAt.split('T')[0];
      byFecha[fecha]=(byFecha[fecha]||0)+total;
      byFechaCount[fecha]=(byFechaCount[fecha]||0)+1;
      const hour=parseInt(o.createdAt.split('T')[1]?.split(':')[0])||0;
      byHora[hour]=(byHora[hour]||0)+total;
    }
    const payName=o.paymentName||'Sin especificar';
    byPago[payName]=(byPago[payName]||0)+total;
    const custName=o.customerName||'Consumidor Final';
    if(!byCliente[custName])byCliente[custName]={name:custName,total:0,count:0};
    byCliente[custName].total+=total;byCliente[custName].count++;
    (o.items||[]).forEach(it=>{
      const name=it.name||'?';
      if(!byProducto[name])byProducto[name]={name,qty:0,venta:0};
      byProducto[name].qty+=(it.qty||0);
      byProducto[name].venta+=(it.lineTotal||it.unitPrice*(it.qty||0)||0);
    });
    const st=o.status||'pendiente';
    byStatus[st]=(byStatus[st]||0)+1;
  });

  // Merge Fudo historical data if overlay is on
  let fudoMerged=false;
  if(_showFudoOverlay&&(REP.ventasRaw||[]).length){
    fudoMerged=true;
    const fudoRows=_filterByDate(REP.ventasRaw);
    fudoRows.forEach(r=>{
      const b=r.bruto||0;const cnt=r.count||1;
      totalVentas+=b;totalDesc+=(r.desc||0);
      if(r.fecha){
        byFecha[r.fecha]=(byFecha[r.fecha]||0)+b;
        byFechaCount[r.fecha]=(byFechaCount[r.fecha]||0)+cnt;
      }
      if(r.hora!=null) byHora[r.hora]=(byHora[r.hora]||0)+b;
      if(r.pago) byPago[r.pago]=(byPago[r.pago]||0)+b;
    });
    // Merge Fudo dimension data
    if(REP.pagoByDate){
      Object.entries(REP.pagoByDate).forEach(([fecha,methods])=>{
        if(repDateFrom&&fecha<repDateFrom)return;
        if(repDateTo&&fecha>repDateTo)return;
        Object.entries(methods).forEach(([m,v])=>{byPago[m]=(byPago[m]||0)+v;});
      });
    }
  }

  const avgTicket=filtered.length?Math.round(totalVentas/filtered.length):0;
  const topProducts=Object.values(byProducto).sort((a,b)=>b.venta-a.venta);
  const topClients=Object.values(byCliente).sort((a,b)=>b.total-a.total);

  // Best day
  let bestDay=null,bestDayVal=0;
  Object.entries(byFecha).forEach(([f,v])=>{if(v>bestDayVal){bestDayVal=v;bestDay=f;}});
  const bestDayLabel=bestDay?bestDay.split('-').reverse().join('/'):'—';

  const statusLabels={pendiente:'⏳ Pendiente',en_preparacion:'🔥 En preparación',listo:'✅ Listo'};

  const hasFudoData=(REP.ventasRaw||[]).length>0;
  const showFudoToggle=hasFudoData?`
    <div style="display:flex;align-items:center;gap:10px;margin-bottom:16px;padding:12px 16px;background:var(--sand);border:1px solid var(--border);border-radius:12px">
      <label style="display:flex;align-items:center;gap:8px;cursor:pointer;font-size:13px;font-weight:600;color:var(--ink)">
        <input type="checkbox" id="rep-fudo-overlay" ${_showFudoOverlay?'checked':''} onchange="_showFudoOverlay=this.checked;_renderMostradorReport()" style="width:18px;height:18px;accent-color:var(--accent)">
        Incluir datos históricos de Fudo
      </label>
      <span style="font-size:11px;color:var(--muted)">${(REP.ventasRaw||[]).length} registros importados</span>
    </div>`:'';

  c.innerHTML=`
  <div class="info-banner" style="margin-bottom:16px">
    <strong>Reportes Sahten:</strong> estadísticas generadas automáticamente con las órdenes del Mostrador. No requieren importación.
  </div>
  ${showFudoToggle}

  <div class="rep-kpis">
    ${_kpi('Total vendido','$'+_f(totalVentas),null,'accent')}
    ${_kpi('Órdenes',_f(filtered.length),null,'primary')}
    ${_kpi('Ticket promedio','$'+_f(avgTicket),null,'green')}
    ${_kpi('Productos vendidos',_f(totalItems),null,'blue')}
    ${_kpi('Descuentos','$'+_f(totalDesc),null,'red')}
    ${_kpi('Mejor día','$'+_f(bestDayVal)+'<div style="font-size:11px;color:var(--muted);margin-top:2px">'+bestDayLabel+'</div>',null,'gold')}
  </div>

  <div class="rep-chart-card full">
    <div class="rep-chart-header"><div><div class="rep-chart-title">Ventas diarias del Mostrador</div><div class="rep-chart-sub">Barras = monto · Línea = cantidad de órdenes</div></div></div>
    <div style="height:300px"><canvas id="rc-most-evo"></canvas></div>
  </div>

  <div class="rep-chart-grid">
    <div class="rep-chart-card">
      <div class="rep-chart-title">Ventas por hora</div>
      <div style="height:240px"><canvas id="rc-most-hora"></canvas></div>
    </div>
    <div class="rep-chart-card">
      <div class="rep-chart-title">Métodos de pago</div>
      <div style="height:240px"><canvas id="rc-most-pago"></canvas></div>
      ${_legend(byPago)}
    </div>
  </div>

  <div class="rep-chart-card full">
    <div class="rep-chart-title">Top 15 productos más vendidos</div>
    <div style="height:${Math.max(280,Math.min(topProducts.length,15)*32+40)}px"><canvas id="rc-most-prods"></canvas></div>
  </div>

  <div class="rep-chart-grid">
    <div class="rep-chart-card">
      <div class="rep-chart-title">Estado de órdenes</div>
      <div style="height:200px"><canvas id="rc-most-status"></canvas></div>
    </div>
    <div class="rep-chart-card">
      <div class="rep-chart-title">Top clientes</div>
      <div class="table-wrap"><table class="rep-prod-table">
        <thead><tr><th>Cliente</th><th style="text-align:right">Órdenes</th><th style="text-align:right">Total</th></tr></thead>
        <tbody>${topClients.slice(0,10).map(cl=>'<tr><td><strong>'+_e(cl.name)+'</strong></td><td class="mono" style="text-align:right">'+cl.count+'</td><td class="mono" style="text-align:right">$'+_f(cl.total)+'</td></tr>').join('')}</tbody>
      </table></div>
    </div>
  </div>

  <div class="rep-chart-card full">
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px;flex-wrap:wrap;gap:8px">
      <div class="rep-chart-title" style="margin:0">Historial de órdenes</div>
      <button class="btn btn-accent" onclick="_exportMostradorXLSX()">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
        Exportar CSV
      </button>
    </div>
    <div class="table-wrap"><table class="rep-prod-table">
      <thead><tr><th>#</th><th>Fecha</th><th>Cliente</th><th>Pago</th><th>Estado</th><th style="text-align:right">Items</th><th style="text-align:right">Total</th></tr></thead>
      <tbody>${filtered.slice(0,50).map(o=>{
        const num=String(o.num||0).padStart(4,'0');
        const fecha=o.createdAt?new Date(o.createdAt).toLocaleDateString('es-AR',{day:'2-digit',month:'short',year:'numeric',hour:'2-digit',minute:'2-digit'}):'—';
        const items=(o.items||[]).reduce((s,it)=>s+(it.qty||0),0);
        const stLabel=statusLabels[o.status]||o.status;
        return'<tr><td style="font-family:DM Mono,monospace;font-weight:600">#'+num+'</td><td>'+fecha+'</td><td>'+_e(o.customerName||'Consumidor Final')+'</td><td>'+_e(o.paymentName||'—')+'</td><td>'+stLabel+'</td><td class="mono" style="text-align:right">'+items+'</td><td class="mono" style="text-align:right;font-weight:700">$'+_f(o.total)+'</td></tr>';
      }).join('')}${filtered.length>50?'<tr><td colspan="7" style="text-align:center;color:var(--muted);padding:12px">...y '+(filtered.length-50)+' órdenes más. Exportá CSV para ver todo.</td></tr>':''}</tbody>
    </table></div>
  </div>`;

  setTimeout(()=>_drawMostradorReport(byFecha,byFechaCount,byHora,byPago,topProducts,byStatus),150);
}

function _drawMostradorReport(byFecha,byFechaCount,byHora,byPago,topProducts,byStatus){
  if(typeof Chart==='undefined')return;
  const t=_chartTheme();
  const baseOpts={responsive:true,maintainAspectRatio:false,plugins:{legend:{display:false},tooltip:{backgroundColor:t.isDark?'#1e2b22':'#fff',titleColor:t.ink,bodyColor:t.ink,borderColor:t.grid,borderWidth:1,padding:10,cornerRadius:8}},scales:{x:{grid:{display:false},ticks:{color:t.text,font:{size:10}}},y:{grid:{color:t.grid,drawBorder:false},ticks:{color:t.text,font:{size:10},callback:v=>'$'+_fk(v)},border:{display:false}}}};

  // 1. Daily evolution: bars + line
  const fechas=Object.keys(byFecha).sort();
  _dc('mostEvo');
  const evoEl=document.getElementById('rc-most-evo');
  if(evoEl&&fechas.length){
    _rc.mostEvo=new Chart(evoEl,{type:'bar',data:{
      labels:fechas.map(f=>{const p=f.split('-');return p[2]+'/'+p[1];}),
      datasets:[
        {type:'bar',data:fechas.map(f=>byFecha[f]),backgroundColor:t.accent+'b3',hoverBackgroundColor:t.accent,borderRadius:6,yAxisID:'y',label:'Ventas $',barPercentage:0.7},
        {type:'line',data:fechas.map(f=>byFechaCount[f]||0),borderColor:t.primary,backgroundColor:t.primary+'22',pointBackgroundColor:t.primary,pointRadius:3,borderWidth:2.5,tension:0.35,yAxisID:'y1',label:'Órdenes',fill:true}
      ]},options:{...baseOpts,scales:{...baseOpts.scales,y1:{position:'right',grid:{display:false},ticks:{color:t.primary,font:{size:10}},border:{display:false}}},plugins:{...baseOpts.plugins,legend:{display:true,position:'bottom',labels:{color:t.text,font:{size:11},usePointStyle:true,pointStyle:'circle',padding:16}}}}});
  }

  // 2. By hour — bar
  const horas=Array.from({length:24},(_,i)=>i);
  const horasData=horas.map(h=>byHora[h]||0);
  _dc('mostHora');
  const hEl=document.getElementById('rc-most-hora');
  if(hEl){_rc.mostHora=new Chart(hEl,{type:'bar',data:{labels:horas.map(h=>String(h).padStart(2,'0')+':00'),datasets:[{data:horasData,backgroundColor:t.accent+'88',hoverBackgroundColor:t.accent,borderRadius:4,barPercentage:0.6}]},options:{...baseOpts,scales:{...baseOpts.scales,x:{...baseOpts.scales.x,ticks:{...baseOpts.scales.x.ticks,maxTicksLimit:12,autoSkip:true}}}}});}

  // 3. Payment — doughnut
  _doughnut('mostPago',byPago,t);

  // 4. Top products — horizontal bar
  const top15=topProducts.slice(0,15);
  _dc('mostProds');
  const pEl=document.getElementById('rc-most-prods');
  if(pEl&&top15.length){
    _rc.mostProds=new Chart(pEl,{type:'bar',data:{
      labels:top15.map(p=>p.name.length>28?p.name.slice(0,26)+'…':p.name),
      datasets:[{data:top15.map(p=>p.venta),backgroundColor:top15.map((_,i)=>t.colors[i%t.colors.length]+'bb'),borderRadius:6,barPercentage:0.65}]
    },options:{...baseOpts,indexAxis:'y',scales:{y:{grid:{display:false},ticks:{color:t.text,font:{size:11,weight:'500'}}},x:{grid:{color:t.grid},ticks:{color:t.text,font:{size:10},callback:v=>'$'+_fk(v)}}}}});
  }

  // 5. Status — doughnut
  const statusColors={'pendiente':'#f39c12','en_preparacion':'#e67e22','listo':'#27ae60'};
  _dc('mostStatus');
  const sEl=document.getElementById('rc-most-status');
  if(sEl&&Object.keys(byStatus).length){
    const labels=Object.keys(byStatus).map(s=>({pendiente:'Pendiente',en_preparacion:'En preparación',listo:'Listo'}[s]||s));
    _rc.mostStatus=new Chart(sEl,{type:'doughnut',data:{
      labels,
      datasets:[{data:Object.values(byStatus),backgroundColor:Object.keys(byStatus).map(s=>statusColors[s]||t.colors[0]),borderWidth:2,borderColor:t.bg,hoverOffset:6}]
    },options:{responsive:true,maintainAspectRatio:false,cutout:'60%',plugins:{legend:{display:true,position:'bottom',labels:{color:t.text,font:{size:11},usePointStyle:true,pointStyle:'circle',padding:12}}}}});
  }
}

// ── Export Mostrador orders to CSV ────────────────────
function _exportMostradorXLSX(){
  const orders=(typeof SAHTEN_ORDERS!=='undefined')?SAHTEN_ORDERS:[];
  if(!orders.length){alert('No hay órdenes.');return;}

  const filtered=orders.filter(o=>{
    if(!o.createdAt)return true;
    const fecha=o.createdAt.split('T')[0];
    if(repDateFrom&&fecha<repDateFrom)return false;
    if(repDateTo&&fecha>repDateTo)return false;
    return true;
  });

  // Build CSV rows
  const rows=[['#Orden','Fecha','Hora','Cliente','Teléfono','Producto','Cantidad','Precio Unit.','Subtotal Línea','Descuento','Envío','Método Pago','Total Orden','Estado']];

  filtered.forEach(o=>{
    const num=String(o.num||0).padStart(4,'0');
    const d=o.createdAt?new Date(o.createdAt):new Date();
    const fecha=d.toLocaleDateString('es-AR');
    const hora=d.toLocaleTimeString('es-AR',{hour:'2-digit',minute:'2-digit'});
    const custName=o.customerName||'Consumidor Final';
    const custPhone=o.customerPhone||'';
    const payName=o.paymentName||'';
    const status={pendiente:'Pendiente',en_preparacion:'En preparación',listo:'Listo'}[o.status]||o.status;

    (o.items||[]).forEach(it=>{
      rows.push([num,fecha,hora,custName,custPhone,it.name||'?',it.qty||0,it.unitPrice||0,it.lineTotal||0,o.discount||0,o.shipping||0,payName,o.total||0,status]);
    });
  });

  // Build CSV string
  const csv=rows.map(r=>r.map(v=>{
    const s=String(v);
    return s.includes(',')||s.includes('"')||s.includes('\n')?'"'+s.replace(/"/g,'""')+'"':s;
  }).join(',')).join('\n');

  const blob=new Blob(['\uFEFF'+csv],{type:'text/csv;charset=utf-8'});
  const a=document.createElement('a');
  a.href=URL.createObjectURL(blob);
  const projName=(typeof wsGetCurrent==='function')?(wsGetCurrent()?.name||'Sahten'):'Sahten';
  const ts=new Date().toISOString().split('T')[0];
  a.download='Sahten_Mostrador_'+projName.replace(/[^\w-]+/g,'_')+'_'+ts+'.csv';
  a.click();
  URL.revokeObjectURL(a.href);
}

// ═══════════════════════════════════════════════════════════
// EMPTY STATES
// ═══════════════════════════════════════════════════════════
function _empty(type){
  return'<div style="text-align:center;padding:60px 20px"><svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.2" style="color:var(--muted);opacity:0.4;margin-bottom:16px"><path d="M18 20V10"/><path d="M12 20V4"/><path d="M6 20v-6"/></svg><div style="font-size:16px;font-weight:600;color:var(--ink);margin-bottom:8px">Sin datos de '+type+'</div><div style="font-size:13px;color:var(--muted);margin-bottom:20px;max-width:400px;margin-left:auto;margin-right:auto">Importá un reporte XLSX de Fudo desde la pestaña <strong>"Importar"</strong> para ver estadísticas.</div><button class="btn btn-accent" onclick="repSetTab(\'importar\')">Ir a Importar</button></div>';
}
function _emptyFilter(){
  return'<div style="text-align:center;padding:60px 20px"><svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" style="color:var(--muted);opacity:0.4;margin-bottom:12px"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg><div style="font-size:15px;font-weight:600;color:var(--ink);margin-bottom:6px">Sin datos en este rango</div><div style="font-size:13px;color:var(--muted)">Probá con un rango de fechas más amplio o seleccioná <strong>"Todo"</strong>.</div></div>';
}

// ═══════════════════════════════════════════════════════════
// STOCK TABS (unchanged)
// ═══════════════════════════════════════════════════════════
let stockTabCat='ingredientes';
function _injectStockTabs(){
  if(window._stockTabsPatched)return;
  SAHTEN.events.beforeRender('renderStock',()=>{
    const panel=document.getElementById('panel-stock');
    if(panel&&!panel.querySelector('.stock-tabs')){
      const toolbar=panel.querySelector('.s2-topbar');
      if(toolbar){const tabs=document.createElement('div');tabs.className='stock-tabs';tabs.id='stock-cat-tabs';toolbar.parentNode.insertBefore(tabs,toolbar.nextSibling);}
    }
    _renderStockTabs();
  });
  window._stockTabsPatched=true;
}
function _renderStockTabs(){
  const tabs=document.getElementById('stock-cat-tabs');if(!tabs)return;
  const ic=typeof INGREDIENTES!=='undefined'?INGREDIENTES.length:0;
  const pc=typeof PRODUCTS!=='undefined'?PRODUCTS.filter(p=>!p.recetaOnly).length:0;
  const ec=typeof ENVASES!=='undefined'?ENVASES.length:0;
  tabs.innerHTML='<button class="stock-tab '+(stockTabCat==='ingredientes'?'active':'')+'" onclick="setStockCat(\'ingredientes\')">🍴 Ingredientes <span class="stock-tab-count">'+ic+'</span></button><button class="stock-tab '+(stockTabCat==='productos'?'active':'')+'" onclick="setStockCat(\'productos\')">📦 Productos <span class="stock-tab-count">'+pc+'</span></button><button class="stock-tab '+(stockTabCat==='envases'?'active':'')+'" onclick="setStockCat(\'envases\')">🏷️ Envases <span class="stock-tab-count">'+ec+'</span></button>';
}
function setStockCat(cat){stockTabCat=cat;if(typeof _saveTabState==='function')_saveTabState('stockCat',cat);if(typeof renderStock==='function')renderStock();}

// ═══════════════════════════════════════════════════════════
// INIT
// ═══════════════════════════════════════════════════════════
document.addEventListener('DOMContentLoaded',()=>{
  setTimeout(_injectStockTabs,300);
});

Object.assign(window,{
  renderReportes,repSetTab,repImport,repClear,
  repSetPreset,repSetCustomDate,
  _exportMostradorXLSX,
  setStockCat,_renderStockTabs,
});
