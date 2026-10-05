// ═══════════════════════════════════════════════════════
// DATA
// ═══════════════════════════════════════════════════════
TIERS = [
  { id:'T1', name:'Premium (100%)',  factor:2.00, color:'#c0392b' },
  { id:'T2', name:'Alto (70%)',      factor:1.70, color:'#d68910' },
  { id:'T3', name:'Estándar (60%)', factor:1.60, color:'#235328' },
  { id:'T4', name:'Accesible (40%)',factor:1.40, color:'#2980b9' },
  { id:'T5', name:'Mínimo (20%)',   factor:1.20, color:'#6b7c6c' },
];
const TIER_COLORS = ['#c0392b','#d68910','#235328','#2980b9','#6b7c6c','#8e44ad','#16a085','#e67e22'];

CHANNELS = [
  { id:'mostrador', name:'Mostrador',    desc:'Venta directa en el local',  surcharge:0,    enabled:true,  commission:0    },
  { id:'fudo',      name:'Fudo',         desc:'Sistema propio del local',   surcharge:0.15, enabled:true,  commission:0.05 },
  { id:'rappi',     name:'Rappi',        desc:'Plataforma de delivery',     surcharge:0.45, enabled:true,  commission:0.30 },
  { id:'pedidosya', name:'Pedidos Ya',   desc:'Plataforma de delivery',     surcharge:0.45, enabled:true,  commission:0.28 },
  { id:'mercadopago',name:'Mercado Pago',desc:'Pago online / QR',           surcharge:0.15, enabled:true,  commission:0.06 },
  { id:'whatsapp',  name:'WhatsApp',     desc:'Venta directa por mensaje',  surcharge:0,    enabled:false, commission:0    },
];


const CHANNEL_COLORS = {
  mostrador: {bg:'#235328', text:'white'},
  fudo:      {bg:'#C44A00', text:'white'},
  rappi:     {bg:'#FF6B00', text:'white'},
  pedidosya: {bg:'#e0000b', text:'white'},
  mercadopago:{bg:'#009EE3',text:'white'},
  whatsapp:  {bg:'#25D366', text:'white'},
};
const chColor = id => CHANNEL_COLORS[id] || {bg:'#888', text:'white'};
const chBadge = (c,price,small=false) => {
  const col=chColor(c.id);
  return `<div class="ch-price-pill${small?' ch-price-pill-sm':''}" style="background:${col.bg};color:${col.text}">
    <span class="ch-label">${c.name.toUpperCase()}</span>
    <span class="ch-val">${fmt(price)}</span>
  </div>`;
};

INGREDIENTES = [];   // la app arranca siempre vacía

ENVASES = [];   // la app arranca siempre vacía

GASTOS_OP = [];   // la app arranca siempre vacía
GASTOS_S = [];   // la app arranca siempre vacía

// Historial de notas de descuento sobre GF: [{pct, nota, fecha, resultado}]
// v3: control mensual de gastos fijos { 'YYYY-MM': { items:[{name,type,budget,real}], note, closed } }
// v3: datos del proyecto (configuración inicial, moneda, ventas estimadas, etc.)

PRODUCTS = [];   // la app arranca siempre vacía

let projWeeks = PRODUCTS.map(p=>[...p.weeks]);
const charts = {};
let selectedSet = new Set();
let ventasView = 'grilla';
let prodSortCol = null;  // column key being sorted
let prodSortDir = 'asc'; // 'asc' | 'desc'
let prodView    = 'tabla'; // 'tabla' | 'grilla'
let stockView = 'tabla';
// ═══════════════════════════════════════════════════════════════
// RECETAS INDEXADAS — importadas del Excel "Costos Recetas Mayo"
// Se aplican al inicio para poblar ingredients[] y packaging[]
// ═══════════════════════════════════════════════════════════════
const RECETAS_EXCEL = {};   // las recetas del ejemplo ya vienen en PRODUCTS

// ── Aplicar recetas del Excel a los productos al iniciar ──────────────────
function applyRecetasExcel() {
  PRODUCTS.forEach(p => {
    const r = RECETAS_EXCEL[p.id];
    if (!r) return;
    p.ingredients = r.ingredients.map(x => ({...x, v:0}));
    p.packaging   = r.packaging.map(x => ({...x, v:0}));
    p.receta_cost = p.ingredients.reduce((s, row) => s + calcIngCost(row), 0);
  });
}

// ═══════════════════════════════════════════════════════════════════════
// COSTO DE RECETA — datos triangulados del Excel "Costos Recetas Mayo"
// Estructura: { id_producto: { cat, unidPaquete, costoPaquete, rendimiento,
//   ingredientes: [{nombre, precioKg, grUsados, inversion}],
//   envases: [{nombre, costoUnitario}] } }
// ═══════════════════════════════════════════════════════════════════════
// COSTO DE RECETA — dinámico, lee de PRODUCTS + INGREDIENTES + ENVASES
// ═══════════════════════════════════════════════════════════════════════

let crExpandedId = null;
let crSort = 'name-asc';

function renderCostReceta() {
  const search = (document.getElementById('cr-search')?.value||'').toLowerCase();
  const visFilter = document.getElementById('cr-visibility-filter')?.value || 'all';
  const usd    = getUSD();

  let items = PRODUCTS.map((p, idx) => ({p, idx}));
  if (search) items = items.filter(({p}) => p.name.toLowerCase().includes(search));
  if (visFilter === 'menu') items = items.filter(({p}) => !p.recetaOnly);
  else if (visFilter === 'internal') items = items.filter(({p}) => p.recetaOnly);

  items.sort((a, b) => {
    const ca = costPerUnit(a.p), cb = costPerUnit(b.p);
    if (crSort === 'name-asc')  return a.p.name.localeCompare(b.p.name);
    if (crSort === 'name-desc') return b.p.name.localeCompare(a.p.name);
    if (crSort === 'cost-asc')  return ca - cb;
    if (crSort === 'cost-desc') return cb - ca;
    if (crSort === 'tier')      return (a.p.tier||'').localeCompare(b.p.tier||'');
    return 0;
  });

  const allCosts = PRODUCTS.map(p => costPerUnit(p));
  const avgCost  = allCosts.reduce((s,v) => s+v, 0) / (allCosts.length||1);
  const maxIdx   = allCosts.indexOf(Math.max(...allCosts));
  const kpiEl    = document.getElementById('cr-kpis');
  if (kpiEl) kpiEl.innerHTML = `
    <div class="kpi"><div class="kpi-label">Productos</div><div class="kpi-value">${PRODUCTS.length}</div></div>
    <div class="kpi"><div class="kpi-label">Costo promedio</div><div class="kpi-value gold">${fmt(avgCost)}</div></div>
    <div class="kpi"><div class="kpi-label">Más costoso</div><div class="kpi-value bad" style="font-size:12px">${PRODUCTS[maxIdx]?.name||'-'}</div></div>
    <div class="kpi"><div class="kpi-label">Tipo de cambio</div><div class="kpi-value">$${usd.toLocaleString('es-AR')}</div></div>`;

  const container = document.getElementById('cr-tabla-container');
  if (!container) return;
  if (!items.length) { container.innerHTML='<div style="padding:24px;color:var(--muted);text-align:center">Sin resultados.</div>'; return; }

  container.innerHTML = items.map(({p, idx}) => {
    const ingCost = p.ingredients.reduce((s,r) => s + calcIngCost(r), 0);
    const pkgCost = p.packaging.reduce((s,r) => s + calcEnvCost(r), 0);
    const cmbCost = (p.combos||[]).reduce((s,r) => s + calcComboCost(r), 0);
    const tot     = ingCost + pkgCost + cmbCost;
    const isExp   = crExpandedId === p.id;
    const tierObj = getTier(p.tier);
    const ingMax  = Math.max(...p.ingredients.map(r => calcIngCost(r)), 1);

    const ingRows = p.ingredients.map(row => {
      const ing  = row.ingId ? INGREDIENTES.find(x=>x.id===row.ingId) : null;
      const cost = calcIngCost(row);
      const pct  = tot > 0 ? Math.round(cost / tot * 100) : 0;
      const pxg  = ing ? (ing.precioPkg / ing.grPaquete) : 0;
      return `<tr><td>${ing ? ing.name : (row.n||'\u2014')}</td><td class="r">${row.qty||''}${row.unit||''}</td><td class="r">${ing ? fmt(pxg)+'/g' : ''}</td><td class="r">${fmt(cost)}</td><td style="min-width:60px"><div class="cr-bar-track"><div class="cr-bar-fill" style="width:${Math.min(100,Math.round(cost/ingMax*100))}%;background:${tierObj.color}88"></div></div><span style="font-size:9px;color:var(--muted)">${pct}%</span></td></tr>`;
    }).join('');

    const envRows = p.packaging.length ? p.packaging.map(row => {
      const env = row.envId ? ENVASES.find(x=>x.id===row.envId) : null;
      const cost = calcEnvCost(row);
      return `<tr><td colspan="3" style="color:var(--accent)">${env ? env.name : (row.n||'\u2014')} ${row.qty>1?'\u00d7'+row.qty:''}</td><td class="r">${fmt(cost)}</td><td></td></tr>`;
    }).join('') : '';

    const comboRows = (p.combos||[]).length ? (p.combos||[]).map(row => {
      const tgt = row.prodId ? PRODUCTS.find(x=>x.id===row.prodId) : null;
      const cost = calcComboCost(row);
      return `<tr><td colspan="3" style="color:var(--accent);font-weight:600">\u21b3 ${tgt?tgt.name:(row.prodId||'\u2014')} \u00d7${row.frac||1}</td><td class="r" style="color:var(--accent)">${fmt(cost)}</td><td></td></tr>`;
    }).join('') : '';

    return `<div class="cr-product-card ${isExp?'expanded':''}" style="border-left-color:${isExp?tierObj.color:'var(--border)'}">
      <div class="cr-product-header" onclick="crToggle('${p.id}')">
        <div>
          <div class="cr-product-name">${p.star?'\u2b50 ':''}<span class="cr-name-text">${p.name}</span> <span class="cr-cat-badge" style="background:${tierObj.color}22;color:${tierObj.color}">${p.tier} \u00d7${tierObj.factor}</span>${p.category?'<span onclick="event.stopPropagation();editCategoryInline('+idx+',this)" style="font-size:10px;background:var(--accent);color:#fff;border-radius:99px;padding:1px 7px;margin-left:5px;font-weight:600;cursor:pointer">'+p.category+'</span>':'<span onclick="event.stopPropagation();editCategoryInline('+idx+',this)" style="font-size:10px;background:rgba(150,150,150,0.15);color:var(--muted);border-radius:99px;padding:1px 7px;margin-left:5px;font-weight:500;cursor:pointer">+ categoría</span>'}${p.recetaOnly?'<span style="font-size:10px;background:rgba(107,124,108,0.12);color:var(--muted);border:1px solid rgba(107,124,108,0.25);border-radius:99px;padding:1px 7px;margin-left:5px;font-weight:500">🔒 interna</span>':'<span style="font-size:10px;background:rgba(42,125,46,0.12);color:var(--green);border:1px solid rgba(42,125,46,0.3);border-radius:99px;padding:1px 7px;margin-left:5px;font-weight:500">📋 menú</span>'}</div>
          <div class="cr-meta"><span class="cr-meta-item">${p.ingredients.length} ing. \u00b7 ${p.packaging.length} env.${(p.combos||[]).length?' \u00b7 '+(p.combos||[]).length+' combo':''}</span></div>
        </div>
        <div style="text-align:right;display:flex;flex-direction:column;align-items:flex-end;gap:2px">
          ${getPorc(p)>1?`<div style="font-size:10px;background:rgba(242,140,0,0.15);color:var(--accent);padding:2px 8px;border-radius:99px;font-weight:600;margin-bottom:2px">✂ ÷${getPorc(p).toFixed(getPorc(p)%1===0?0:2)} ${p.porcionLabel||'porciones'}</div>
          <div class="cr-cost-main" style="color:var(--accent)">${fmt(costPerUnit(p))}<span style="font-size:10px;font-weight:400;color:var(--muted)"> /${p.porcionLabel||'porción'}</span></div>
          <div style="font-size:10px;color:var(--muted);text-decoration:line-through">${fmt(tot)} receta completa</div>`:`<div class="cr-cost-main">${fmt(tot)}</div>`}
          <div class="cr-cost-usd">USD ${(costPerUnit(p)/usd).toFixed(2)}</div>
          <div style="display:flex;gap:4px;margin-top:2px">
            <span style="font-size:10px;background:rgba(35,83,40,0.1);color:var(--primary);padding:1px 6px;border-radius:4px">Ing: ${fmt(ingCost)}</span>
            <span style="font-size:10px;background:rgba(242,140,0,0.1);color:var(--accent);padding:1px 6px;border-radius:4px">Env: ${fmt(pkgCost)}</span>
            ${cmbCost>0?`<span style="font-size:10px;background:rgba(22,160,133,0.1);color:#16a085;padding:1px 6px;border-radius:4px">Cmb: ${fmt(cmbCost)}</span>`:''}
          </div>
        </div>
      </div>
      <div class="cr-expand-body">
        <div style="display:flex;gap:8px;margin-bottom:10px;flex-wrap:wrap">
          <button class="btn btn-accent" style="font-size:11px;padding:4px 12px" onclick="event.stopPropagation();openRecipe(${idx})">\u270f\ufe0f Editar receta</button>
          <button class="btn" style="font-size:11px;padding:4px 12px" onclick="event.stopPropagation();directUploadImage('${p.id}')">📷 Foto</button>
          <button class="btn" style="font-size:11px;padding:4px 12px" onclick="event.stopPropagation();openProductDetail(${idx})">\ud83d\udcca Ver detalle precios</button>
          <button class="btn" style="font-size:11px;padding:4px 12px;${p.recetaOnly?'border-color:var(--muted);color:var(--muted)':'border-color:var(--green);color:var(--green);background:var(--green-pale)'}" 
            onclick="event.stopPropagation();PRODUCTS[${idx}].recetaOnly=!PRODUCTS[${idx}].recetaOnly;renderCostReceta();renderProductos()"
            title="${p.recetaOnly?'Esta receta NO aparece en el Menú. Clic para activar.':'Este producto SÍ aparece en el Menú. Clic para ocultarlo del Menú.'}">
            ${p.recetaOnly?'🔒 Solo receta interna':'✅ Visible en Menú'}
          </button>
        </div>
        <table class="cr-ing-table">
          <thead><tr><th>Ingrediente</th><th class="r">Cant.</th><th class="r">Precio/g</th><th class="r">Inversi\u00f3n</th><th>%</th></tr></thead>
          <tbody>
            ${ingRows}
            ${ingCost>0?`<tr class="subtotal"><td colspan="3">Subtotal ingredientes</td><td class="r">${fmt(ingCost)}</td><td></td></tr>`:''}
            ${envRows}
            ${comboRows}
            <tr class="total-row"><td colspan="3" style="color:var(--primary)">COSTO TOTAL RECETA</td><td class="r" style="color:var(--primary)">${fmt(tot)}</td><td style="font-size:10px;color:var(--muted)">USD ${(tot/usd).toFixed(2)}</td></tr>
            ${getPorc(p)>1?`<tr style="background:rgba(242,140,0,0.06)"><td colspan="3" style="color:var(--accent);font-weight:700">✂ COSTO POR ${(p.porcionLabel||'PORCIÓN').toUpperCase()} (÷${getPorc(p).toFixed(getPorc(p)%1===0?0:2)})</td><td class="r" style="color:var(--accent);font-weight:700">${fmt(costPerUnit(p))}</td><td style="font-size:10px;color:var(--muted)">USD ${(costPerUnit(p)/usd).toFixed(2)}</td></tr>`:''}
          </tbody>
        </table>
      </div>
    </div>`;
  }).join('');
}

function crToggle(id) { crExpandedId = crExpandedId===id?null:id; renderCostReceta(); }
function crSetSort(val) { crSort = val; renderCostReceta(); }
function closeCRModal() { document.getElementById('cr-modal-overlay')?.classList.remove('open'); }

async function crNewRecipe() {
  const name = await sahtenAsk('Nombre del nuevo producto:');
  if (!name || !name.trim()) return;
  const id = name.trim().toLowerCase().replace(/\s+/g,'_').replace(/[^a-z0-9_]/g,'');
  if (PRODUCTS.find(p => p.id === id)) { alert('Ya existe un producto con ese ID.'); return; }
  PRODUCTS.push({
    id, name: name.trim(), star: false, tier: 'T3', gfPct: 2, avgMes: 0, discount: 0,
    discountType: 'pct', receta_cost: 0, ingredients: [], packaging: [], combos: [], weeks: [0,0,0,0], tags: [],
    recetaOnly: true,
  });
  projWeeks.push([0,0,0,0]);
  scheduleSave();
  openRecipe(PRODUCTS.length - 1);
  renderCostReceta();
  renderProductos();
}



let recipeIdx = -1;
let currentPanel = 'dashboard';

// ═══════════════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════════════

// ── INGREDIENTES UNIT HELPERS ──
// Normaliza grPaquete a partir de unit+cantidad (para compatibilidad con recetas)
// Precio por unidad base (g, ml o u)
// Label de precio para display
function ingPriceLabels(ing) {
  const u = ing.unit || 'g';
  const pxb = ingPxBase(ing);
  if (u === 'g' || u === 'kg') return { a: '$/g: ' + pxb.toFixed(3), b: '$/kg: ' + fmt(pxb * 1000) };
  if (u === 'ml' || u === 'L') return { a: '$/ml: ' + pxb.toFixed(4), b: '$/L: ' + fmt(pxb * 1000) };
  return { a: '$/u: ' + fmt(pxb), b: '' };
}
// Suma todos los descuentos activos en GF_DISC_HISTORY y los aplica acumulativamente
// v3: los descuentos sobre GF se reemplazaron por el Control mensual
// ─── AUTO-WEIGHT HELPERS ──────────────────────────────────────
// Peso de un ingrediente en gramos (null si unidad=u sin equiv)
// Peso aportado por un combo en gramos base
// Calcula el peso total auto-sumado de ingredientes + combos
// Devuelve { grams, display: '1500 g' | '1.5 kg' } o null si no hay datos
// ─────────────────────────────────────────────────────────────

// Convierte un valor a unidad base (g o ml)
// Calcula porciones automáticamente a partir de pesoTotal + porcionCant
// Si no se puede calcular, devuelve null (usa el campo manual)
// Resuelve porciones efectivas (prioridad: override > auto×merma > manual)

// Costo por unidad vendida — si la receta rinde N porciones, el costo unitario es totalCost / N
// GF por unidad = GF Total / total unidades de TODOS los productos
// v3: el GF se reparte solo entre los productos que lo absorben (interruptor por producto en Ventas + GF)
// Si todavía no hay ventas por producto, usa las ventas estimadas del setup inicial
// alias para compatibilidad
// GF asignado a un producto:
// Si el producto tiene gfPctOverride, usa: promedio_base × (gfPctOverride / 100)
// Ej: 100% = promedio exacto, 150% = 50% más, 70% = 30% menos
// Si no tiene override, usa el promedio base directo: gfPerUnit()
// ── Cobertura real de GF: cuánto se recupera al mes (ponderado por volumen) ──
// ── Ganancia extra generada por los Tiers, por encima del costo+GF ──

// channelPrice = precio que se COBRA al cliente (lo que aparece en la plataforma)
// channelNetReceived = lo que VOS recibís = precio cobrado × (1 - comisión plataforma)
// El sobrecargo está diseñado para que: mostrador × (1+surcharge) × (1−commission) ≈ mostrador
// Descuento efectivo de canal para un producto (no acumulable)

// channelPriceWithDisc = precio cobrado al cliente con descuento aplicado

// channelNetReceivedWithDisc = lo que vos recibís con descuento

function marginColor(pct) {
  if(pct>=0.45) return {bg:'#d6eed7',text:'#235328'};
  if(pct>=0.30) return {bg:'#fef9e7',text:'#d68910'};
  return {bg:'#fde8e6',text:'#c0392b'};
}
function destroyChart(id) { if(charts[id]){charts[id].destroy();delete charts[id];} }
function mkChart(id,cfg) { destroyChart(id); const el=document.getElementById(id); if(!el) return; charts[id]=new Chart(el,cfg); }

// ═══════════════════════════════════════════════════════
// NAVIGATION
// ═══════════════════════════════════════════════════════
const PANELS=['dashboard','mostrador','menuonline','nube','costreceta','productos','stock','ingredientes','envases','gastos','ajustes','ventas','proyeccion','reportes','wiki'];
const PANEL_NAMES={dashboard:'Dashboard',productos:'Menú',proyeccion:'Proyección',ventas:'Ventas + GF',stock:'Control de Stock',ingredientes:'Ingredientes',envases:'Envases y Papelería',menuonline:'Menú Online',nube:'Nube y usuarios',ajustes:'Ajustes de Ganancia',canales:'Canales de Venta',gastos:'Gastos Fijos',costreceta:'Costo de Receta',mostrador:'Mostrador',reportes:'Reportes',personalizacion:'Personalización',wiki:'Guía de uso'};
// ── APP DRAWER + BOTTOM NAV ──────────────────────────────────
const BOTTOM_NAV_PANELS = ['dashboard','productos','ingredientes','proyeccion'];

function toggleTopbarMenu() {
  const menu = document.getElementById('topbar-menu');
  if (menu) menu.classList.toggle('open');
}
function closeTopbarMenu() {
  const menu = document.getElementById('topbar-menu');
  if (menu) menu.classList.remove('open');
}
// Close topbar menu when clicking outside
document.addEventListener('click', e => {
  const wrap = document.getElementById('topbar-more-btn')?.closest('.topbar-menu-wrap');
  if (wrap && !wrap.contains(e.target)) closeTopbarMenu();
});

let _openRowMenu = null;
function buildRowMenuHTML(i) {
  const p = PRODUCTS[i];
  if (!p) return '';
  const discVal = (!p.discountType||p.discountType==='pct')
    ? (p.discount>0&&p.discount<1?(p.discount*100).toFixed(1):'')
    : (p.discount>=1?p.discount:'');
  const discStep = (!p.discountType||p.discountType==='pct')?'0.5':'10';
  const discPh   = (!p.discountType||p.discountType==='pct')?'%':'$';
  return `
    <button class="ram-item" onclick="closeRowMenus();openModal(${i})">
      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>Detalle
    </button>
    <button class="ram-item accent" onclick="closeRowMenus();openRecipe(${i})">
      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/></svg>Receta
    </button>
    <div class="ram-sep"></div>
    <div class="ram-disc-row">
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="var(--muted)" stroke-width="2"><line x1="19" y1="5" x2="5" y2="19"/><circle cx="6.5" cy="6.5" r="2.5"/><circle cx="17.5" cy="17.5" r="2.5"/></svg>
      <span style="font-size:12px;color:var(--muted);margin-right:2px">Descuento</span>
      <select style="border:1px solid var(--border);border-radius:5px;padding:2px 5px;background:white;outline:none"
        onchange="PRODUCTS[${i}].discountType=this.value;renderProductos()">
        <option value="pct" ${(!p.discountType||p.discountType==='pct')?'selected':''}>%</option>
        <option value="val" ${p.discountType==='val'?'selected':''}>$</option>
      </select>
      <input type="number" value="${discVal}" min="0" step="${discStep}" placeholder="${discPh}"
        style="width:56px;border:1px solid var(--border);border-radius:5px;padding:2px 5px;outline:none;font-family:'DM Mono',monospace"
        onchange="const t=PRODUCTS[${i}].discountType||'pct';PRODUCTS[${i}].discount=t==='pct'?parseFloat(this.value)/100||0:parseFloat(this.value)||0;renderProductos()">
    </div>
    <div class="ram-sep"></div>
    <div style="padding:6px 14px 4px">
      <div style="font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:0.5px;color:var(--muted);margin-bottom:6px">Descuento por canal</div>
      ${CHANNELS.filter(c=>c.enabled).map(c => {
        const prodDisc = ((p.channelDiscounts||{})[c.id]) || 0;
        const chDisc   = c.channelDisc || 0;
        const isOverride = prodDisc > 0;
        return `<div style="display:flex;align-items:center;gap:6px;margin-bottom:5px">
          <div style="width:6px;height:6px;border-radius:50%;background:${chColor(c.id).bg};flex-shrink:0"></div>
          <span style="font-size:11px;flex:1;color:var(--ink)">${c.name}</span>
          ${chDisc>0&&!isOverride?`<span style="font-size:9px;color:var(--muted);background:var(--sand);border-radius:4px;padding:1px 5px">global ${chDisc}%</span>`:''}
          <input type="number" min="0" max="100" step="1" value="${prodDisc||''}" placeholder="${chDisc>0?chDisc+'%':'%'}"
            style="width:52px;border:1px solid ${isOverride?'var(--accent)':'var(--border)'};border-radius:5px;padding:2px 5px;font-size:12px;text-align:center;outline:none;font-family:'DM Mono',monospace"
            title="${isOverride?'Override activo: tiene prioridad sobre el descuento global del canal':'0 = usar descuento global del canal si existe'}"
            onchange="if(!PRODUCTS[${i}].channelDiscounts)PRODUCTS[${i}].channelDiscounts={};PRODUCTS[${i}].channelDiscounts['${c.id}']=parseFloat(this.value)||0;renderProductos()">
        </div>`;
      }).join('')}
    </div>
    <div class="ram-sep"></div>
    <button class="ram-item danger" onclick="closeRowMenus();confirmDel(${i})">
      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/></svg>Eliminar
    </button>`;
}

function toggleRowMenu(i, btnEl) {
  const portal = document.getElementById('row-action-portal');
  if (!portal) return;
  // If same menu open — close it
  if (_openRowMenu === i) { closeRowMenus(); return; }
  closeRowMenus();
  // Build content
  portal.innerHTML = buildRowMenuHTML(i);
  // Position: below the button, right-aligned
  const rect = btnEl.getBoundingClientRect();
  portal.style.display = 'block';
  const pw = portal.offsetWidth;
  const ph = portal.offsetHeight;
  const vw = window.innerWidth, vh = window.innerHeight;
  // Prefer below, flip above if not enough space
  let top = rect.bottom + 4;
  if (top + ph > vh - 8) top = rect.top - ph - 4;
  // Prefer right-aligned to button, flip left if off-screen
  let left = rect.right - pw;
  if (left < 8) left = rect.left;
  if (left + pw > vw - 8) left = vw - pw - 8;
  portal.style.top  = top  + 'px';
  portal.style.left = left + 'px';
  _openRowMenu = i;
}
function closeRowMenus() {
  const portal = document.getElementById('row-action-portal');
  if (portal) portal.style.display = 'none';
  _openRowMenu = null;
}
// Close on outside click or scroll
document.addEventListener('click', e => {
  // Grid sort buttons (use data-col attribute)
  const gsb = e.target.closest('.grid-sort-btn');
  if (gsb) { setProdSort(gsb.dataset.col); return; }
  // Row menu close
  if (_openRowMenu === null) return;
  const portal = document.getElementById('row-action-portal');
  const btn = document.getElementById('raw-' + _openRowMenu);
  if (portal && !portal.contains(e.target) && btn && !btn.contains(e.target)) closeRowMenus();
});
document.addEventListener('scroll', () => closeRowMenus(), true);

function toggleDrawer() {
  const overlay = document.getElementById('app-drawer-overlay');
  const btn = document.getElementById('bn-more');
  if (!overlay) return;
  if (overlay.classList.contains('open')) { closeDrawer(); }
  else { overlay.classList.add('open'); if (btn) btn.classList.add('drawer-open'); }
}
function closeDrawer() {
  const overlay = document.getElementById('app-drawer-overlay');
  const btn = document.getElementById('bn-more');
  if (overlay) overlay.classList.remove('open');
  if (btn) btn.classList.remove('drawer-open');
}
// ─────────────────────────────────────────────────────────────

// ── Tab State Persistence ──────────────────────────────────
function _getTabState() {
  try { return JSON.parse(localStorage.getItem((window.SAVE_KEY||'sahten_v4_data')+'_tabs')||'{}'); } catch(e) { return {}; }
}
function _saveTabState(section, tab) {
  const s = _getTabState(); s[section] = tab;
  localStorage.setItem((window.SAVE_KEY||'sahten_v4_data')+'_tabs', JSON.stringify(s));
}
function _getSavedTab(section, fallback) {
  return _getTabState()[section] || fallback;
}

function showPanel(name) {
  currentPanel = name;
  // Save last visited panel
  _saveTabState('_panel', name);
  document.querySelectorAll('.panel').forEach(p=>p.classList.remove('active'));
  document.querySelectorAll('.nav-item').forEach(n=>{n.classList.toggle('active',(n.getAttribute('onclick')||'').includes("'"+name+"'"));});
  document.getElementById('panel-'+name).classList.add('active');
  document.getElementById('page-title').textContent=PANEL_NAMES[name]||name;

  // Sync bottom nav active state
  BOTTOM_NAV_PANELS.forEach(id => {
    const btn = document.getElementById('bn-' + id);
    if (btn) btn.classList.toggle('active', id === name);
  });
  // Sync app drawer active state
  document.querySelectorAll('.app-drawer-item').forEach(el => el.classList.remove('active'));
  const ad = document.getElementById('ad-' + name);
  if (ad) ad.classList.add('active');

  // Restore last sub-tab for sections with tabs
  const savedAjTab = _getSavedTab('ajustes', 'tiers');
  const savedMostTab = _getSavedTab('mostrador', 'pedido');
  const savedRepTab = _getSavedTab('reportes', 'sahten');
  const savedStockCat = _getSavedTab('stockCat', 'ingredientes');
  const savedStockView = _getSavedTab('stockView', 'tabla');
  const savedProdView = _getSavedTab('prodView', 'tabla');

  // Restore view states
  if (name === 'stock') { stockView = savedStockView; if (typeof stockTabCat !== 'undefined') stockTabCat = savedStockCat; }
  if (name === 'productos') { prodView = savedProdView; }
  if (name === 'reportes' && typeof repTab !== 'undefined') { repTab = savedRepTab; }

  // El render de cada panel lo declara su módulo (src/modules/*.js) con onPanelShow
}
function recalcAll() {
  // Aplicar recetas del Excel si aún no se aplicaron
  if (!window._recetasApplied) {
    applyRecetasExcel();
    window._recetasApplied = true;
  }
  // Always refresh price-dependent panels so channel changes reflect everywhere
  renderProductos();
  renderDashboard();
  // Also re-render current panel if it's something else
  const cur = document.querySelector('.panel.active')?.id.replace('panel-','');
  if(cur && cur!=='productos' && cur!=='dashboard') showPanel(cur);
  scheduleSave();
}

// ═══════════════════════════════════════════════════════
// DASHBOARD
// ═══════════════════════════════════════════════════════
// Dashboard state
let dashActiveChannels = null; // null = all active
let dashHiddenProds    = new Set(); // product indices hidden from margin chart

function initDashChannels() {
  if (dashActiveChannels === null) {
    dashActiveChannels = new Set(CHANNELS.filter(c=>c.enabled).map(c=>c.id));
  }
}

function toggleDashChannel(chId) {
  initDashChannels();
  if (dashActiveChannels.has(chId)) dashActiveChannels.delete(chId);
  else dashActiveChannels.add(chId);
  renderDashboard();
}

function toggleDashProd(idx) {
  if (dashHiddenProds.has(idx)) dashHiddenProds.delete(idx);
  else dashHiddenProds.add(idx);
  renderDashboard();
}

function renderDashboard() {
  initDashChannels();
  const avgM = PRODUCTS.length ? PRODUCTS.reduce((s,p)=>s+marginPct(mostradorFinalPrice(p),costPerUnit(p)+gfAssigned(p)),0)/PRODUCTS.length : 0;
  const gf = totalGF();

  // KPIs
  document.getElementById('dash-kpis').innerHTML=`
    <div class="kpi"><div class="kpi-label tip-wrap">Productos<span class="tip-box">Total de productos configurados en el sistema.</span></div><div class="kpi-value gold">${PRODUCTS.length}</div></div>
    <div class="kpi"><div class="kpi-label tip-wrap">Margen promedio<span class="tip-box">Margen bruto promedio de todos los productos al precio de mostrador final (con sobrecargo de canal). Verde ≥ 35%, rojo &lt; 35%.</span></div><div class="kpi-value ${avgM>=0.35?'good':'bad'}">${(avgM*100).toFixed(1)}%</div></div>
    <div class="kpi"><div class="kpi-label tip-wrap">GF / Producto<span class="tip-box">Gastos fijos totales ÷ unidades vendidas por mes. Es el costo fijo promedio que carga cada unidad.</span></div><div class="kpi-value gold">${fmt(gfPerUnit())}</div></div>
    <div class="kpi"><div class="kpi-label tip-wrap">Gastos fijos / mes<span class="tip-box">Total neto de gastos fijos mensuales (operativos + sueldos). Se usa en la Proyección.</span></div><div class="kpi-value">${fmt(gf)}</div></div>
    <div class="kpi"><div class="kpi-label tip-wrap">Comisión global<span class="tip-box">Comisión de venta global que se suma a todos los precios. Hacé clic para ir a Gastos Fijos.</span></div><div class="kpi-value gold" style="cursor:pointer" onclick="showPanel('gastos')">${(globalComm()*100).toFixed(1)}% →</div></div>
    <div class="kpi"><div class="kpi-label tip-wrap">Control GF<span class="tip-box">Real vs. presupuesto del último mes con gastos reales cargados (Gastos Fijos › Control mensual).</span></div><div class="kpi-value" style="cursor:pointer;color:${gfmLastVar()==null?'var(--muted)':(gfmLastVar()>0?'var(--red)':'var(--green)')}" onclick="showPanel('gastos')">${gfmLastVar()==null?'—':(gfmLastVar()>0?'+':'')+gfmLastVar().toFixed(1)+'%'} →</div></div>
    <div class="kpi"><div class="kpi-label tip-wrap">USD<span class="tip-box">Tipo de cambio configurado. Se usa para mostrar equivalencias en dólares.</span></div><div class="kpi-value gold">$${getUSD().toLocaleString('es-AR')}</div></div>`;

  // ── CHART COMPARE: line chart Google Ads style ─────────────────
  const enabledChannels = CHANNELS.filter(c => c.enabled);
  const labels = PRODUCTS.map(p => p.name.length>13 ? p.name.slice(0,12)+'…' : p.name);
  const CH_COLORS = {
    mostrador:   '#F28C00', fudo: '#2980b9', rappi: '#c0392b',
    pedidosya:   '#E91E63', mercadopago: '#009EE3', whatsapp: '#25D366',
  };
  const getChColor = (id) => CH_COLORS[id] || chColor(id).bg || '#888';

  // Build custom legend pills
  const legendEl = document.getElementById('dash-compare-legend');
  if (legendEl) {
    legendEl.innerHTML = enabledChannels.map(c => {
      const col = getChColor(c.id);
      const active = dashActiveChannels.has(c.id);
      return `<span class="dash-ch-pill ${active?'':'inactive'}" style="background:${col}18;color:${col};border-color:${col}44"
        onclick="toggleDashChannel('${c.id}')">
        <span class="pill-dot" style="background:${col}"></span>${c.name}
      </span>`;
    }).join('');
  }

  // Build line datasets — one line per active channel
  const compareDatasets = enabledChannels
    .filter(c => dashActiveChannels.has(c.id))
    .map(c => {
      const col = getChColor(c.id);
      return {
        label: c.name,
        data: PRODUCTS.map(p => channelPrice(p, c.id) || mostradorFinalPrice(p)),
        borderColor: col,
        backgroundColor: col + '18',
        borderWidth: 2.5,
        pointRadius: 4,
        pointHoverRadius: 7,
        pointBackgroundColor: col,
        pointBorderColor: 'white',
        pointBorderWidth: 2,
        tension: 0.3,
        fill: false,
      };
    });

  mkChart('chart-compare', {
    type: 'line',
    data: { labels, datasets: compareDatasets },
    options: {
      responsive: true, maintainAspectRatio: false,
      interaction: { mode: 'index', intersect: false },
      plugins: {
        legend: { display: false }, // custom legend above
        tooltip: {
          callbacks: {
            label: ctx => `${ctx.dataset.label}: ${fmt(ctx.parsed.y)}`
          }
        }
      },
      scales: {
        x: { ticks: { font: { size: 10 }, maxRotation: 45 } },
        y: { ticks: { callback: v => '$'+(v/1000).toFixed(0)+'k', font: { size: 10 } } }
      }
    }
  });

  // ── CHART MARGINS with filter ───────────────────────────────────
  const marginFilter = document.getElementById('dash-margin-filter')?.value || 'top10';
  const allSorted = [...PRODUCTS]
    .map((p,i) => ({ p, i, m: marginPct(mostradorFinalPrice(p), costPerUnit(p)+gfAssigned(p)) }))
    .filter(x => !dashHiddenProds.has(x.i))
    .sort((a,b) => b.m - a.m);

  let marginProds = allSorted;
  if (marginFilter === 'top10') marginProds = allSorted.slice(0, 10);
  else if (marginFilter === 'bot10') marginProds = [...allSorted].reverse().slice(0, 10);

  // Render product chips for manual selection (only in 'all' mode)
  const filterWrap = document.getElementById('dash-prod-filter-wrap');
  if (filterWrap) {
    if (marginFilter === 'all') {
      filterWrap.innerHTML = PRODUCTS.map((p,i) => {
        const hidden = dashHiddenProds.has(i);
        return `<span class="dash-prod-chip ${hidden?'':'active'}" onclick="toggleDashProd(${i})">${p.name.slice(0,16)}</span>`;
      }).join('');
      filterWrap.style.display = 'flex';
    } else {
      filterWrap.innerHTML = '';
      filterWrap.style.display = 'none';
    }
  }

  mkChart('chart-margins', {
    type: 'bar',
    data: {
      labels: marginProds.map(x => x.p.name.length>14 ? x.p.name.slice(0,13)+'…' : x.p.name),
      datasets: [{
        label: 'Margen $',
        data: marginProds.map(x => Math.round(mostradorFinalPrice(x.p)-(costPerUnit(x.p)+gfAssigned(x.p)))),
        backgroundColor: marginProds.map(x => x.m>=0.45?'#23532888':x.m>=0.30?'#F28C0088':'#c0392b88'),
        borderColor:     marginProds.map(x => x.m>=0.45?'#235328':x.m>=0.30?'#F28C00':'#c0392b'),
        borderWidth: 1, borderRadius: 4
      }]
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: { legend: { display: false },
        tooltip: { callbacks: { label: ctx => {
          const x = marginProds[ctx.dataIndex];
          return [`Margen $: ${fmt(ctx.parsed.y)}`, `Margen %: ${(x.m*100).toFixed(1)}%`];
        }}}
      },
      scales: {
        x: { ticks: { font: { size: 10 }, maxRotation: 45 } },
        y: { ticks: { callback: v => '$'+(v/1000).toFixed(0)+'k', font: { size: 10 } } }
      }
    }
  });

  // ── CHART GF ──────────────────────────────────────────────────
  const allGF=[...GASTOS_OP,...GASTOS_S];
  const pc=['#F28C00','#d68910','#c0392b','#2980b9','#235328','#8e44ad','#e67e22','#16a085','#E91E63','#795548'];
  mkChart('chart-gf',{type:'doughnut',data:{labels:allGF.map(g=>g.name),datasets:[{data:allGF.map(g=>g.amount),backgroundColor:pc,borderWidth:2,borderColor:'white'}]},options:{responsive:true,maintainAspectRatio:false,cutout:'52%',plugins:{legend:{display:true,position:'bottom',labels:{boxWidth:10,font:{size:10},padding:8}},tooltip:{callbacks:{label:ctx=>`${ctx.label}: ${fmt(ctx.parsed)}`}}}}});
}

// ═══════════════════════════════════════════════════════
// PRODUCTOS
// ═══════════════════════════════════════════════════════
function renderProductos() {
  const gfpu=gfPerUnit(); const totalU=PRODUCTS.reduce((s,p)=>s+(p.avgMes||0),0);
  const covAmt=gfCoverageAmount(); const covPct=gfCoveragePct(); const gfTot=totalGF();
  const diff=covAmt-gfTot;
  let stateColor, stateLabel, stateIcon;
  if(covPct<95){ stateColor='var(--red)'; stateLabel='Déficit — no estás cubriendo todo el GF'; stateIcon='⚠️'; }
  else if(covPct<=105){ stateColor='var(--green)'; stateLabel='Cubierto — el GF está bien distribuido'; stateIcon='✓'; }
  else { stateColor='#2980b9'; stateLabel='Superávit — estás sobre-cubriendo el GF'; stateIcon='↑'; }
  const barPct=Math.min(covPct,150);
  const dailyGap = diff/30;
  // ── Ganancia extra por Tiers (independiente de la cobertura de GF) ──
  const tierProfit = tierProfitTotal();
  const tierProfitPctOfGF = gfTot>0 ? (tierProfit/gfTot)*100 : 0;
  document.getElementById('gf-remaining-bar').innerHTML=`
    <div style="width:100%;display:flex;flex-direction:column;gap:10px">
      <div style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:10px">
        <div>
          <div style="font-size:13px;font-weight:700;color:var(--ink);display:flex;align-items:center;gap:6px">${stateIcon} Cobertura de Gasto Fijo <span class="tip-wrap" style="font-size:11px;font-weight:600;padding:2px 9px;border-radius:99px;background:${stateColor}18;color:${stateColor}">${covPct.toFixed(0)}%<span class="tip-box" style="font-weight:500">Este % mide si el reparto de GF entre productos (según sus overrides y volumen) está balanceado — no cambia solo porque el GF total suba o baje, ya que el GF asignado a cada producto se reajusta automáticamente en la misma proporción. Mirá el monto en $ ("Falta cubrir"/día) para ver el efecto real de un cambio de GF.</span></span></div>
          <div style="font-size:11px;color:var(--muted);margin-top:2px">${stateLabel}</div>
          <div style="font-size:11px;color:var(--primary);margin-top:4px;font-weight:600">📅 ${diff<0?`Te falta cubrir ~${fmt(Math.abs(dailyGap))}/día en promedio para llegar al 100%`:`Ya cubrís el GF con margen de ~${fmt(dailyGap)}/día extra`}</div>
        </div>
        <div style="text-align:right">
          <div style="font-family:'DM Mono',monospace;font-size:16px;font-weight:700;color:${stateColor}">${fmt(covAmt)} <span style="font-size:11px;color:var(--muted);font-weight:400">/ ${fmt(gfTot)}</span></div>
          <div style="font-size:11px;color:var(--muted)">${diff>=0?'Superávit':'Falta cubrir'}: ${fmt(Math.abs(diff))}/mes</div>
        </div>
      </div>
      <div style="position:relative;height:10px;border-radius:99px;background:var(--sand2,rgba(0,0,0,0.06));overflow:hidden">
        <div style="position:absolute;left:0;top:0;height:100%;width:${(100/150*100).toFixed(2)}%;border-right:2px dashed rgba(0,0,0,0.25)"></div>
        <div style="height:100%;border-radius:99px;background:${stateColor};width:${(barPct/150*100).toFixed(2)}%;transition:width 0.3s"></div>
      </div>
      <div style="display:flex;justify-content:space-between;font-size:10px;color:var(--muted)">
        <span>0%</span><span>100% (GF cubierto)</span><span>150%+</span>
      </div>
      <div style="border-top:1px solid var(--border);margin-top:2px;padding-top:12px">
        <div style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:10px">
          <div>
            <div style="font-size:13px;font-weight:700;color:#8e44ad;display:flex;align-items:center;gap:6px">💰 Ganancia extra por Tiers <span style="font-size:11px;font-weight:600;padding:2px 9px;border-radius:99px;background:#8e44ad18;color:#8e44ad">+${tierProfitPctOfGF.toFixed(0)}% del GF</span></div>
            <div style="font-size:11px;color:var(--muted);margin-top:2px">Ganancia proyectada por encima del costo + GF, generada solo por el factor de cada tier</div>
          </div>
          <div style="text-align:right">
            <div style="font-family:'DM Mono',monospace;font-size:16px;font-weight:700;color:#8e44ad">${fmt(tierProfit)}<span style="font-size:11px;color:var(--muted);font-weight:400">/mes</span></div>
          </div>
        </div>
        <div style="position:relative;height:8px;border-radius:99px;background:var(--sand2,rgba(0,0,0,0.06));overflow:hidden;margin-top:8px">
          <div style="height:100%;border-radius:99px;background:#8e44ad;width:${Math.min(100,tierProfitPctOfGF/1.5).toFixed(2)}%;transition:width 0.3s"></div>
        </div>
      </div>
      <div style="font-size:11px;color:var(--muted);border-top:1px solid var(--border);padding-top:8px">GF promedio por unidad: <strong style="color:var(--ink)">${fmt(gfpu)}</strong> · ${totalU} u/mes proyectadas entre todos los productos. Ajustá el % GF de cada producto en la tabla para redistribuir — subilo en tus productos estrella y bajalo en los de bajo margen, siempre que la barra se mantenga cerca del 100%. Después, usá el Tier para agregar ganancia por encima de ese costo.</div>
    </div>`;
  const bb=document.getElementById('bulk-bar');
  bb.classList.toggle('visible',selectedSet.size>0);
  if(selectedSet.size>0) document.getElementById('bulk-count-lbl').textContent=selectedSet.size+' seleccionado'+(selectedSet.size>1?'s':'');
  const cb=document.getElementById('cb-all');
  const menuProds = PRODUCTS.filter(p=>!p.recetaOnly);
  if(cb) cb.checked=selectedSet.size===menuProds.length&&menuProds.length>0;

  // Search & sort
  const search = (document.getElementById('prod-search')?.value||'').toLowerCase();
  const sortMode = document.getElementById('prod-sort')?.value || '';
  // Filtrar productos "solo receta" — no deben aparecer en el Menú público
  let indices = PRODUCTS.map((p,i)=>i).filter(i => !PRODUCTS[i].recetaOnly);
  if (search) indices = indices.filter(i => PRODUCTS[i].name.toLowerCase().includes(search));
  if (sortMode) {
    indices.sort((a,b) => {
      const pa=PRODUCTS[a], pb=PRODUCTS[b];
      if (sortMode==='name-asc')   return pa.name.localeCompare(pb.name);
      if (sortMode==='name-desc')  return pb.name.localeCompare(pa.name);
      if (sortMode==='cost-desc')  return costPerUnit(pb)-costPerUnit(pa);
      if (sortMode==='cost-asc')   return costPerUnit(pa)-costPerUnit(pb);
      if (sortMode==='price-desc') return mostradorPrice(pb)-mostradorPrice(pa);
      if (sortMode==='price-asc')  return mostradorPrice(pa)-mostradorPrice(pb);
      if (sortMode==='tier')       return (pa.tier||'').localeCompare(pb.tier||'');
      return 0;
    });
  }
  // Column header sort (overrides toolbar sort when active)
  if (prodSortCol) {
    indices.sort((a,b) => {
      const pa=PRODUCTS[a], pb=PRODUCTS[b];
      if (prodSortCol==='name') return prodSortDir==='asc' ? pa.name.localeCompare(pb.name) : pb.name.localeCompare(pa.name);
      let va=0, vb=0;
      if (prodSortCol==='cost')       { va=totalCost(pa);       vb=totalCost(pb); }
      if (prodSortCol==='cost_total') { va=costPerUnit(pa)+gfAssigned(pa); vb=costPerUnit(pb)+gfAssigned(pb); }
      if (prodSortCol==='base')       { va=mostradorPrice(pa);  vb=mostradorPrice(pb); }
      if (prodSortCol==='margin')     { va=marginPct(mostradorFinalPrice(pa),costPerUnit(pa)+gfAssigned(pa)); vb=marginPct(mostradorFinalPrice(pb),costPerUnit(pb)+gfAssigned(pb)); }
      if (prodSortCol==='star')       { va=pa.star?1:0; vb=pb.star?1:0; }
      return prodSortDir==='asc' ? va-vb : vb-va;
    });
  }
  // Update header sort icons
  document.querySelectorAll('#prod-thead-row th.sortable').forEach(th => {
    th.classList.remove('sort-active');
    const icon = th.querySelector('.sort-icon');
    if (icon) icon.textContent = '↕';
  });
  if (prodSortCol) {
    const activeTh = document.querySelector('#prod-thead-row th[data-sort="'+prodSortCol+'"]');
    if (activeTh) {
      activeTh.classList.add('sort-active');
      const icon = activeTh.querySelector('.sort-icon');
      if (icon) icon.textContent = prodSortDir==='asc' ? ' ↑' : ' ↓';
    }
  }

  const tbody=document.getElementById('prod-tbody');
  tbody.innerHTML='';
  indices.forEach(i=>{
    const p=PRODUCTS[i];
    const tc=costPerUnit(p), gfa=gfAssigned(p), mp=channelPriceWithDisc(p,'mostrador')||mostradorFinalPrice(p);
    const marg=marginPct(mp,tc+gfa); const mc=marginColor(marg);
    const tier=getTier(p.tier);
    const tierOpts=TIERS.map(t=>`<option value="${t.id}" ${t.id===p.tier?'selected':''}>${t.id} – ${Math.round((t.factor-1)*100)}%</option>`).join('');
    const disc=p.discount||0;
    const discLabel=disc>0?`<span class="disc-badge">${disc>=1?'-$'+Math.round(disc):'-'+(disc*100).toFixed(0)+'%'}</span>`:'';
    const tr=document.createElement('tr');
    if(p.star) tr.classList.add('star-row');
    // Build tags HTML
    const tagsHtml = (p.tags||[]).map((tag,ti)=>`<span class="prod-tag" style="background:${tag.color}22;color:${tag.color};border:1px solid ${tag.color}55">${tag.name}<button class="tag-del-btn" onclick="removeTag(${i},${ti})" title="Quitar etiqueta">×</button></span>`).join('');
    const addTagBtn = `<button onclick="showTagModal(${i})" title="Agregar etiqueta" style="border:1px dashed rgba(0,0,0,0.2);background:transparent;border-radius:99px;font-size:10px;padding:2px 7px;cursor:pointer;color:var(--muted)">+ etiqueta</button>`;
    // Build star rating HTML (performance 0-5)
    const rating = p.rating||0;
    const starsHtml = [1,2,3,4,5].map(s=>`<span class="sr-star${rating>=s?' filled':''}" onclick="setRating(${i},${s})" onmouseover="previewRating(${i},${s})" onmouseout="resetRating(${i})" title="${s} estrella${s>1?'s':''}">★</span>`).join('');
    const commRate = globalComm();
    const commPct = (commRate*100).toFixed(1);
    // commBase correcto: precio mostrador sin la comisión (= precio con sobrecargo, antes de comm)
    const mpFinal   = channelPrice(p, 'mostrador') || mostradorPrice(p);
    const commBase  = commRate > 0 ? mpFinal / (1 + commRate) : mpFinal;
    const commPesos = Math.round(commBase * commRate);
    tr.innerHTML=`
      <td><input type="checkbox" class="prod-cb" ${selectedSet.has(i)?'checked':''} onchange="toggleProd(${i},this.checked)"></td>
      <td style="min-width:220px;max-width:220px;width:220px"><div style="display:flex;align-items:center;gap:4px"><input class="inline-edit" value="${p.name}" style="width:100%;min-width:0" oninput="PRODUCTS[${i}].name=this.value">${discLabel}</div></td>
      <td data-col="etiquetas"><div class="prod-tags-wrap">${tagsHtml}${addTagBtn}</div></td>
      <td data-col="categoria"><span class="cat-pill" onclick="editCategoryInline(${i},this)" style="display:inline-block;background:var(--accent);color:#fff;border-radius:99px;padding:2px 10px;font-size:11px;font-weight:600;cursor:pointer;white-space:nowrap">${p.category||'Sin categoría'}</span></td>
      <td data-col="estrella" style="text-align:center"><button class="star-toggle-btn${p.star?' active':''}" onclick="PRODUCTS[${i}].star=!PRODUCTS[${i}].star;renderProductos();renderDashboard()" title="${p.star?'Quitar estrella':'Marcar como estrella'}">${p.star?'⭐':'☆'}</button></td>
      <td data-col="costo_receta" class="price-cell">${p.porciones>1 ? `<div style="display:flex;flex-direction:column;gap:2px"><span style="font-size:10px;color:var(--muted);text-decoration:line-through">${fmt(totalCost(p))} receta</span><span style="color:var(--green);font-weight:700">${fmt(costPerUnit(p))}/${p.porcionLabel||'porción'}</span><span style="font-size:9px;background:rgba(242,140,0,0.15);color:var(--accent);border-radius:99px;padding:1px 5px;font-weight:600">÷${getPorc(p).toFixed(getPorc(p)%1===0?0:2)} ${p.porcionLabel||'porc.'}</span></div>` : fmt(totalCost(p))}</td>
      <td data-col="costo_total" class="price-cell">${fmt(tc+gfa)} <span style="font-size:10px;color:var(--muted)">GF:${fmt(gfa)}</span></td>
      <td data-col="tier"><select class="tier-select" onchange="PRODUCTS[${i}].tier=this.value;renderProductos();renderDashboard()">${tierOpts}</select></td>
      <td data-col="gf_prod">
        <div style="display:flex;align-items:center;gap:6px;white-space:nowrap">
          <!-- % input -->
          <input class="gf-pct-input" type="number"
            value="${p.gfPctOverride != null ? p.gfPctOverride.toFixed(0) : '100'}"
            placeholder="100" min="0" max="500" step="5"
            style="width:58px;font-size:12px;text-align:center"
            title="% del GF base. 100% = ${fmt(gfPerUnit())}"
            onchange="const v=parseFloat(this.value);PRODUCTS[${i}].gfPctOverride=(isNaN(v)||v===100)?null:v;renderProductos();renderDashboard()">
          <span style="font-size:11px;color:var(--muted)">%</span>
          <!-- valor asignado -->
          <span style="font-family:'DM Mono',monospace;font-size:13px;font-weight:700;color:${p.gfPctOverride!=null&&p.gfPctOverride!==100?'var(--accent)':'var(--ink)'}">
            ${fmt(gfa)}
          </span>
          <!-- reset btn — solo si hay override -->
          ${(p.gfPctOverride != null && p.gfPctOverride !== 100) ? `<button title="Restaurar a 100% (${fmt(gfPerUnit())})" style="border:none;background:none;cursor:pointer;color:var(--muted);font-size:13px;padding:0;line-height:1;opacity:0.7" onclick="PRODUCTS[${i}].gfPctOverride=null;renderProductos();renderDashboard()">↺</button>` : ''}
        </div>
      </td>
      <td data-col="descuento">
        <div style="display:flex;gap:4px;align-items:center">
          <select class="tier-select" style="font-size:11px;padding:3px 5px" onchange="PRODUCTS[${i}].discountType=this.value;renderProductos()">
            <option value="pct" ${(!p.discountType||p.discountType==='pct')?'selected':''}>%</option>
            <option value="val" ${p.discountType==='val'?'selected':''}>$</option>
          </select>
          <input class="gf-pct-input" type="number" value="${(!p.discountType||p.discountType==='pct')?(p.discount>0&&p.discount<1?(p.discount*100).toFixed(1):(p.discount>=1?'':'')):(p.discount>=1?p.discount:'')}" min="0" step="${(!p.discountType||p.discountType==='pct')?'0.5':'10'}" placeholder="${(!p.discountType||p.discountType==='pct')?'%':'$'}" style="width:60px" onchange="const t=PRODUCTS[${i}].discountType||'pct';PRODUCTS[${i}].discount=t==='pct'?parseFloat(this.value)/100||0:parseFloat(this.value)||0;renderProductos()">
        </div>
      </td>
      <td data-col="comision"><div style="display:flex;flex-direction:column;gap:1px"><span style="font-family:'DM Mono',monospace;font-size:12px;font-weight:600;color:var(--primary)">${commPct}%</span>${commPesos>0?`<span style="font-family:'DM Mono',monospace;font-size:10px;color:var(--muted)" title="Pesos que suma la comisión al precio">+${fmt(commPesos)}</span>`:'<span style="font-size:10px;color:var(--muted)">sin comisión</span>'}</div></td>
      <td data-col="subtotal" class="price-cell price-main" style="color:var(--muted);font-weight:500;white-space:nowrap">${fmt(mp)}<button class="why-btn" onclick="event.stopPropagation();window.sahtenWhy&&sahtenWhy('${p.id}')" title="¿De dónde sale este precio?">?</button></td>
      <td data-col="por_canal">
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:3px;width:220px">
          ${CHANNELS.filter(c=>c.enabled).map(c=>{
            const cp   = channelPrice(p,c.id)||mp;
            const col  = chColor(c.id);
            const disc = effectiveChannelDisc(p, c.id);
            const cpD  = disc > 0 ? Math.round(cp*(1-disc)/50)*50 : cp;
            const net  = channelNetReceivedWithDisc(p, c.id) || Math.round(cpD*(1-(getChannel(c.id).commission||0)));
            return `<div style="background:${col.bg};color:${col.text};border-radius:6px;padding:5px 8px;display:flex;flex-direction:column;gap:2px">
              <div style="display:flex;align-items:center;justify-content:space-between;gap:4px">
                <span style="font-size:10px;font-weight:700;opacity:0.9;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:72px">${c.name}</span>
                ${disc>0?`<span style="font-size:8px;background:rgba(0,0,0,0.18);border-radius:99px;padding:1px 5px;font-weight:700;white-space:nowrap;flex-shrink:0">−${(disc*100).toFixed(0)}%</span>`:''}
              </div>
              <div style="display:flex;align-items:baseline;gap:4px">
                ${disc>0?`<span style="font-family:'DM Mono',monospace;font-size:9px;opacity:0.5;text-decoration:line-through">${fmt(cp)}</span>`:''}
                <span style="font-family:'DM Mono',monospace;font-size:12px;font-weight:700">${fmt(cpD)}</span>
              </div>
              <div style="font-family:'DM Mono',monospace;font-size:9px;opacity:0.7;white-space:nowrap">↳ ${fmt(net)}</div>
            </div>`;
          }).join('')}
        </div>
      </td>
      <td data-col="margen"><span class="margin-badge" style="background:${mc.bg};color:${mc.text}">${(marg*100).toFixed(1)}%</span></td>
      <td style="white-space:nowrap">
        <button class="row-action-btn" id="raw-${i}" onclick="toggleRowMenu(${i},this)" title="Acciones">···</button>
      </td>`;
    tbody.appendChild(tr);
  });
  applyColVisibility();
  // Show/hide table vs grid
  const tableCard = document.querySelector('#panel-productos .card');
  const gridCont  = document.getElementById('prod-grid-container');
  if (prodView === 'grilla') {
    if (tableCard) tableCard.style.display = 'none';
    if (gridCont)  { gridCont.style.display = 'block'; renderProdGrid(indices); }
  } else {
    if (tableCard) tableCard.style.display = '';
    if (gridCont)  gridCont.style.display = 'none';
  }
}

// ── PRODUCT VIEW / SORT HELPERS ─────────────────────────
function setProdSort(col) {
  if (prodSortCol === col) {
    prodSortDir = prodSortDir === 'asc' ? 'desc' : 'asc';
  } else {
    prodSortCol = col;
    prodSortDir = 'asc';
  }
  renderProductos();
}

function setProdView(view) {
  prodView = view;
  if (typeof _saveTabState === 'function') _saveTabState('prodView', view);
  document.getElementById('pv-tabla').className = 'ptb-view-btn' + (view === 'tabla' ? ' active' : '');
  document.getElementById('pv-grilla').className = 'ptb-view-btn' + (view === 'grilla' ? ' active' : '');
  renderProductos();
}

function renderProdGrid(indices) {
  const cont = document.getElementById('prod-grid-container');
  if (!cont) return;
  const sortOpts = [
    {col:'name',  label:'Nombre'},
    {col:'star',  label:'⭐ Favorito'},
    {col:'cost',  label:'Costo'},
    {col:'base',  label:'Base tier'},
    {col:'margin',label:'Margen'},
  ];
  const sortBar = '<div style="display:flex;align-items:center;gap:6px;padding:0 2px 12px;flex-wrap:wrap">'
    + '<span style="font-size:11px;color:var(--muted);font-weight:600;text-transform:uppercase;letter-spacing:0.4px">Ordenar:</span>'
    + sortOpts.map(o => {
        const active = prodSortCol === o.col;
        const dir = active ? (prodSortDir==='asc'?' ↑':' ↓') : '';
        var st='border:1px solid '+(active?'var(--primary)':'var(--border)')+';'+(active?'background:var(--primary);color:white;':'')+'border-radius:99px;padding:4px 12px;font-size:12px;font-weight:'+(active?'700':'500')+';cursor:pointer';
        return '<button class="grid-sort-btn" data-col="'+o.col+'" style="'+st+'">'+o.label+dir+'</button>';
      }).join('')
    + '</div>';
  cont.innerHTML = sortBar + '<div class="prod-grid">' + indices.map(i => {
    const p = PRODUCTS[i];
    const tc   = costPerUnit(p), gfa = gfAssigned(p), mp = mostradorFinalPrice(p);
    const marg = marginPct(mp, tc + gfa), mc = marginColor(marg);
    const tier = getTier(p.tier);
    const tierColor = tier.color || 'var(--primary)';
    const channels = CHANNELS.filter(c => c.enabled).map(c => {
      const cp   = channelPrice(p, c.id) || mp;
      const col  = chColor(c.id);
      const disc = effectiveChannelDisc(p, c.id);
      const cpD  = disc > 0 ? Math.round(cp*(1-disc)/50)*50 : cp;
      const net  = channelNetReceivedWithDisc(p, c.id) || Math.round(cpD*(1-(getChannel(c.id).commission||0)));
      const ch   = getChannel(c.id);
      const prodDisc = ((p.channelDiscounts||{})[c.id])||0;
      const chDisc   = ch.channelDisc||0;
      // Tooltip: discount source + net breakdown
      let tooltipLines = ['Canal: '+c.name];
      tooltipLines.push('Cobrado al cliente: '+fmt(cpD));
      if(disc>0){
        tooltipLines.push(prodDisc>0 ? 'Descuento producto: −'+prodDisc+'%' : 'Descuento canal: −'+chDisc+'%');
        tooltipLines.push('Precio sin desc: '+fmt(cp));
      }
      if(ch.commission>0) tooltipLines.push('Comisión plataforma: −'+(ch.commission*100).toFixed(0)+'%');
      tooltipLines.push('Vos recibís: '+fmt(net));
      const tt = tooltipLines.join('&#10;');
      return '<div class="prod-card-ch" style="background:'+col.bg+';color:'+col.text+';flex-direction:column;align-items:flex-start;gap:1px;cursor:default" title="'+tt+'">'
        + '<div style="display:flex;align-items:center;justify-content:space-between;width:100%;gap:4px">'
        +   '<span class="prod-card-ch-name">'+c.name+'</span>'
        +   (disc>0 ? '<span style="font-size:8px;background:rgba(0,0,0,0.2);border-radius:99px;padding:1px 5px;font-weight:700;white-space:nowrap">−'+(disc*100).toFixed(0)+'%</span>' : '')
        + '</div>'
        + '<span class="prod-card-ch-price">'+(disc>0?'<s style="opacity:0.45;font-size:9px">'+fmt(cp)+'</s> ':'')+fmt(cpD)+'</span>'
        + '<span style="font-size:9px;opacity:0.7">↳ '+fmt(net)+'</span>'
        + '</div>';
    }).join('');
    const disc = p.discount || 0;
    const discBadge = disc > 0 ? '<span class="disc-badge" style="font-size:11px">' + (disc>=1?'-$'+Math.round(disc):'-'+(disc*100).toFixed(0)+'%') + '</span>' : '';
    const tagsHtml = (p.tags||[]).map((tag,ti) => '<span style="display:inline-flex;align-items:center;gap:3px;background:'+tag.color+'22;color:'+tag.color+';border:1px solid '+tag.color+'55;border-radius:99px;padding:1px 7px;font-size:10px;font-weight:600">'+tag.name+'<button onclick="removeTag('+i+','+ti+')" style="background:none;border:none;cursor:pointer;color:'+tag.color+';font-size:11px;line-height:1;padding:0;margin-left:1px">×</button></span>').join('');
    const addTagBtnGrid = '<button onclick="showTagModal('+i+')" title="Agregar etiqueta" style="border:1px dashed rgba(0,0,0,0.18);background:transparent;border-radius:99px;font-size:10px;padding:2px 8px;cursor:pointer;color:var(--muted)">+ etiqueta</button>';
    return '<div class="prod-card' + (p.star ? ' star-card' : '') + (selectedSet.has(i) ? ' selected' : '') + '" data-prod-idx="' + i + '">'
      // Top-left checkbox + Top-right 3-dot menu
      + '<div class="prod-card-grid-controls">'
      +   '<input type="checkbox" class="prod-card-cb"' + (selectedSet.has(i) ? ' checked' : '') + ' onchange="toggleProd(' + i + ', this.checked)" onclick="event.stopPropagation()" title="Seleccionar">'
      + '</div>'
      + '<div class="prod-card-menu-wrap">'
      +   '<button class="prod-card-menu-btn" onclick="event.stopPropagation();openGridCardMenu(' + i + ', this)" title="Más opciones">⋯</button>'
      + '</div>'
      // Header: name + star
      + '<div class="prod-card-header">'
      +   '<div style="flex:1;min-width:0">'
      +     '<div class="prod-card-name">' + p.name + discBadge + '</div>'
      +     '<div style="display:flex;gap:4px;flex-wrap:wrap;margin-top:5px;align-items:center">' + tagsHtml + addTagBtnGrid + '</div>'
      +   '</div>'
      +   '<div style="display:flex;flex-direction:column;align-items:flex-end;gap:4px;flex-shrink:0">'
      +     (p.star ? '<span class="prod-card-star">⭐</span>' : '')
      +     (p.category ? '<span style="background:var(--accent);color:#fff;border-radius:99px;padding:2px 8px;font-size:10px;font-weight:600">' + p.category + '</span>' : '')
      +   '</div>'
      + '</div>'
      // Costs
      + '<div class="prod-card-costs">'
      +   '<div class="prod-card-cost-item"><div class="prod-card-cost-label">Costo receta</div><div class="prod-card-cost-val">'+fmt(tc)+'</div></div>'
      +   '<div class="prod-card-cost-item"><div class="prod-card-cost-label">Costo + GF</div><div class="prod-card-cost-val">'+fmt(tc+gfa)+'</div></div>'
      + '</div>'
      // Channels
      + '<div class="prod-card-channels">' + channels + '</div>'
      // Footer: margin + actions
      + '<div class="prod-card-footer">'
      +   '<span class="prod-card-margin" style="background:'+mc.bg+';color:'+mc.text+'">' + (marg*100).toFixed(1) + '%</span>'
      +   '<div class="prod-card-actions">'
      +     '<button class="btn" style="padding:4px 9px;font-size:12px" onclick="openModal('+i+')">Detalle</button>'
      +     '<button class="btn" style="padding:4px 9px;font-size:12px;color:var(--accent);border-color:var(--accent)" onclick="openRecipe('+i+')">Receta</button>'
      +   '</div>'
      + '</div>'
      + '</div>';
  }).join('') + '</div>';
}
// ─────────────────────────────────────────────────────────
function toggleAll(checked) { PRODUCTS.forEach((_,i)=>{ if(!PRODUCTS[i].recetaOnly){ checked?selectedSet.add(i):selectedSet.delete(i); } }); renderProductos(); }
function toggleProd(i,checked) { checked?selectedSet.add(i):selectedSet.delete(i); document.getElementById('bulk-count-lbl').textContent=selectedSet.size+' seleccionado'+(selectedSet.size>1?'s':''); document.getElementById('bulk-bar').classList.toggle('visible',selectedSet.size>0); const cb=document.getElementById('cb-all'); if(cb) cb.checked=selectedSet.size===PRODUCTS.length; }
function clearSelection() { selectedSet.clear(); renderProductos(); }

// ── INLINE CATEGORY EDIT ────────────────────────────────
function editCategoryInline(idx, el) {
  const cats = [...new Set(PRODUCTS.map(p=>p.category).filter(Boolean))];
  const rect = el.getBoundingClientRect();
  let pop = document.getElementById('cat-inline-pop');
  if (pop) pop.remove();
  pop = document.createElement('div');
  pop.id = 'cat-inline-pop';
  const popBg = getComputedStyle(document.body).backgroundColor;
  pop.style.cssText = 'position:fixed;z-index:99999;background:'+popBg+';border:1px solid var(--border);border-radius:10px;box-shadow:0 8px 30px rgba(0,0,0,0.35);padding:8px;min-width:180px;max-height:260px;overflow-y:auto;top:'+(rect.bottom+4)+'px;left:'+rect.left+'px';
  const cur = PRODUCTS[idx].category || '';
  pop.innerHTML = '<input placeholder="Nueva categoría…" style="width:100%;box-sizing:border-box;border:1px solid var(--border);border-radius:6px;padding:6px 8px;font-size:12px;margin-bottom:6px;background:var(--card);color:var(--ink)" id="cat-inline-input" value="'+cur+'">' 
    + cats.map(c => '<div class="cat-opt" style="padding:5px 10px;border-radius:6px;cursor:pointer;font-size:12px;font-weight:'+(c===cur?'700':'500')+';color:'+(c===cur?'var(--primary)':'var(--ink)')+';background:'+(c===cur?'var(--primary-light,#e8f0e8)':'transparent')+'" onmouseover="this.style.background=\'var(--hover)\'" onmouseout="this.style.background=\''+(c===cur?'var(--primary-light,#e8f0e8)':'transparent')+'\'">' + c + '</div>').join('')
    + '<div class="cat-opt" style="padding:5px 10px;border-radius:6px;cursor:pointer;font-size:11px;color:var(--muted);font-style:italic">✕ Sin categoría</div>';
  document.body.appendChild(pop);
  pop.querySelectorAll('.cat-opt').forEach(opt => {
    opt.onclick = () => {
      const val = opt.textContent.trim();
      PRODUCTS[idx].category = val.startsWith('✕') ? '' : val;
      pop.remove();
      renderProductos();
    };
  });
  const inp = document.getElementById('cat-inline-input');
  inp.focus(); inp.select();
  inp.onkeydown = e => { if(e.key==='Enter'){ PRODUCTS[idx].category=inp.value.trim(); pop.remove(); renderProductos(); } if(e.key==='Escape'){ pop.remove(); } };
  setTimeout(()=>{ document.addEventListener('click', function handler(e){ if(!pop.contains(e.target)&&e.target!==el){ pop.remove(); document.removeEventListener('click',handler); } }); },10);
}
// ── BULK BAR — sistema de popovers estilo Notion ────────────────────────────
let bulkActivePop = null;

function bulkTogglePop(type) {
  if (bulkActivePop === type) { bulkClosePop(); return; }
  bulkClosePop();
  bulkActivePop = type;
  const btn = document.getElementById('bulk-btn-' + type);
  const pop = document.getElementById('bulk-pop-' + type);
  if (!btn || !pop) return;
  btn.classList.add('active');

  // Posicionar el popover sobre el botón
  const rect = btn.getBoundingClientRect();
  pop.style.left   = rect.left + 'px';
  pop.style.bottom = (window.innerHeight - rect.top + 8) + 'px';
  pop.style.top    = 'auto';
  pop.style.display = 'block';

  // Renderizar contenido del popover
  if (type === 'tag')  bulkRenderTagPop(pop);
  if (type === 'star') bulkRenderStarPop(pop);
  if (type === 'tier') bulkRenderTierPop(pop);
  if (type === 'disc') bulkRenderDiscPop(pop);
}

function bulkClosePop() {
  if (!bulkActivePop) return;
  const pop = document.getElementById('bulk-pop-' + bulkActivePop);
  const btn = document.getElementById('bulk-btn-' + bulkActivePop);
  if (pop) pop.style.display = 'none';
  if (btn) btn.classList.remove('active');
  bulkActivePop = null;
}

// Cerrar al click fuera
document.addEventListener('click', e => {
  if (!bulkActivePop) return;
  const pop = document.getElementById('bulk-pop-' + bulkActivePop);
  const btn = document.getElementById('bulk-btn-' + bulkActivePop);
  if (pop && !pop.contains(e.target) && btn && !btn.contains(e.target)) bulkClosePop();
});

// ── Popover: ETIQUETA ──────────────────────────────────────────────────────
function bulkRenderTagPop(pop) {
  const TAG_PRESETS_BULK = [
    {name:'Destacado',color:'#F28C00'},{name:'Nuevo',color:'#235328'},
    {name:'Promo',color:'#c0392b'},{name:'Temporada',color:'#2980b9'},
    {name:'Vegano',color:'#27ae60'},{name:'Sin gluten',color:'#8e44ad'},
    {name:'Popular',color:'#e67e22'},{name:'Exclusivo',color:'#16a085'},
  ];
  pop.innerHTML = `
    <div class="bulk-pop-title">Agregar etiqueta</div>
    <div style="display:flex;flex-wrap:wrap;gap:5px;margin-bottom:10px">
      ${TAG_PRESETS_BULK.map(t => `
        <span class="bulk-tag-chip" id="btag-${t.name}"
          style="background:${t.color}22;color:${t.color};border-color:${t.color}44"
          onclick="bulkTagToggle('${t.name}','${t.color}')">
          ${t.name}
        </span>`).join('')}
    </div>
    <div class="bulk-pop-row">
      <input id="bulk-tag-custom" placeholder="Etiqueta personalizada..." style="flex:1">
      <input id="bulk-tag-color" type="color" value="#F28C00" style="width:32px;padding:2px;cursor:pointer;background:transparent;border-radius:4px">
    </div>
    <button class="bulk-pop-apply" onclick="bulkApplyTag()">Aplicar a ${selectedSet.size} producto${selectedSet.size>1?'s':''}</button>
  `;
}

window._bulkTagSelected = null;
function bulkTagToggle(name, color) {
  window._bulkTagSelected = window._bulkTagSelected?.name === name ? null : {name, color};
  document.querySelectorAll('.bulk-tag-chip').forEach(el => {
    el.classList.toggle('selected', el.id === 'btag-' + name && window._bulkTagSelected);
  });
}

function bulkApplyTag() {
  const custom = document.getElementById('bulk-tag-custom')?.value.trim();
  const color  = document.getElementById('bulk-tag-color')?.value || '#F28C00';
  const tag    = custom ? {name:custom, color} : window._bulkTagSelected;
  if (!tag) return;
  selectedSet.forEach(i => {
    if (!PRODUCTS[i].tags) PRODUCTS[i].tags = [];
    if (!PRODUCTS[i].tags.some(t => t.name === tag.name)) PRODUCTS[i].tags.push({...tag});
  });
  bulkClosePop();
  renderProductos();
  scheduleSave();
}

// ── Popover: ESTRELLA ──────────────────────────────────────────────────────
function bulkRenderStarPop(pop) {
  pop.innerHTML = `
    <div class="bulk-pop-title">Marcar estrella</div>
    <div style="display:flex;flex-direction:column;gap:6px">
      <button class="bulk-pop-apply" style="background:var(--accent)" onclick="bulkSetStar(true)">⭐ Marcar como estrella</button>
      <button class="bulk-pop-apply" style="background:rgba(255,255,255,0.1);color:rgba(255,255,255,0.7);margin-top:0" onclick="bulkSetStar(false)">☆ Quitar estrella</button>
    </div>`;
}

function bulkSetStar(val) {
  selectedSet.forEach(i => { PRODUCTS[i].star = val; });
  bulkClosePop();
  renderProductos();
  scheduleSave();
}

// ── Popover: TIER ──────────────────────────────────────────────────────────
function bulkRenderTierPop(pop) {
  pop.innerHTML = `
    <div class="bulk-pop-title">Cambiar tier</div>
    <div style="display:flex;flex-wrap:wrap;gap:5px;margin-bottom:10px">
      ${TIERS.map(t => `
        <button class="bulk-btn" style="font-family:'DM Mono',monospace;font-weight:700;background:${t.color}33;border-color:${t.color}55;color:${t.color}"
          onclick="bulkSetTier('${t.id}')">
          ${t.id}
          <span style="font-size:9px;font-family:'DM Sans',sans-serif;opacity:0.8">+${Math.round((t.factor-1)*100)}%</span>
        </button>`).join('')}
    </div>`;
}

function bulkSetTier(tierId) {
  selectedSet.forEach(i => { PRODUCTS[i].tier = tierId; });
  bulkClosePop();
  renderProductos();
  renderDashboard();
  scheduleSave();
}

// ── Popover: DESCUENTO ─────────────────────────────────────────────────────
function bulkRenderDiscPop(pop) {
  pop.innerHTML = `
    <div class="bulk-pop-title">Aplicar descuento</div>
    <div class="bulk-pop-row">
      <input id="bulk-disc-val" type="number" min="0" step="0.5" placeholder="0" style="width:80px;font-family:'DM Mono',monospace">
      <select id="bulk-disc-type" style="flex:1">
        <option value="pct">%  Porcentaje</option>
        <option value="val">$  Monto fijo</option>
        <option value="none">✕  Sin descuento</option>
      </select>
    </div>
    <div style="font-size:10px;color:rgba(255,255,255,0.35);margin-bottom:8px">
      Ej: 10% → descuenta 10% del precio final · $500 → descuenta $500 fijo
    </div>
    <button class="bulk-pop-apply" onclick="bulkApplyDisc()">Aplicar a ${selectedSet.size} producto${selectedSet.size>1?'s':''}</button>`;
}

function bulkApplyDisc() {
  const val  = parseFloat(document.getElementById('bulk-disc-val')?.value||0);
  const type = document.getElementById('bulk-disc-type')?.value || 'pct';
  selectedSet.forEach(i => {
    if (type === 'none') { PRODUCTS[i].discount = 0; PRODUCTS[i].discountType = 'pct'; return; }
    PRODUCTS[i].discountType = type;
    PRODUCTS[i].discount = type === 'pct' ? val/100 : val;
  });
  bulkClosePop();
  renderProductos();
  scheduleSave();
}

// ── Eliminar ───────────────────────────────────────────────────────────────
function bulkDelete() {
  showConfirm(`Eliminar ${selectedSet.size} producto${selectedSet.size>1?'s':''}`,
    'Esta acción no se puede deshacer.',
    () => {
      [...selectedSet].sort((a,b)=>b-a).forEach(i=>{PRODUCTS.splice(i,1);});
      selectedSet.clear();
      document.getElementById('bulk-bar').classList.remove('visible');
      renderProductos(); renderDashboard();
    });
}

// ── Legacy (mantener compatibilidad con toggleProd) ────────────────────────
function applyBulk() { /* reemplazado por popovers */ }
function updateBulkInput() { /* reemplazado por popovers */ }

function showAddProductModal() {
  document.getElementById('np-tier').innerHTML = TIERS.map(t =>
    `<option value="${t.id}">${t.id} – ${t.name} (×${t.factor})</option>`
  ).join('');
  document.getElementById('np-name').value = '';
  // Reset to step 1
  document.getElementById('add-prod-step1').style.display = 'flex';
  document.getElementById('add-prod-step2').style.display = 'none';
  document.getElementById('add-prod-modal-title').textContent = 'Nuevo producto · Paso 1 de 2';
  document.getElementById('add-prod-modal-sub').textContent = 'Nombre y categoría de precio';
  npUpdateProgress();
  document.getElementById('add-prod-overlay').classList.add('open');
  setTimeout(() => document.getElementById('np-name').focus(), 80);
}

function closeAddProdModal() {
  document.getElementById('add-prod-overlay').classList.remove('open');
}

function npUpdateProgress() {
  const name = document.getElementById('np-name').value.trim();
  const btn   = document.getElementById('np-next-btn');
  const bar   = document.getElementById('np-progress');
  const dot2  = document.getElementById('np-step2-dot');
  const ready = name.length >= 2;
  btn.disabled = !ready;
  btn.style.opacity  = ready ? '1' : '0.5';
  btn.style.cursor   = ready ? 'pointer' : 'not-allowed';
  bar.style.width    = ready ? '50%' : '0%';
  dot2.style.background = ready ? 'rgba(242,140,0,0.25)' : 'var(--border)';
  dot2.style.color      = ready ? 'var(--accent)' : 'var(--muted)';
}

function npGoStep2() {
  const name = document.getElementById('np-name').value.trim();
  if (!name) return;
  const tier = document.getElementById('np-tier').value;

  // Crear el producto
  const newProd = {
    id: 'p' + Date.now(), name, star: false, tier, gfPct: 0, avgMes: 0,
    discount: 0, discountType: 'pct', receta_cost: 0,
    packaging: [], ingredients: [], combos: [],
    porciones: 1, porcionLabel: 'porciones', pesoTotal: '', pesoUnit: 'g', porcionCant: '', porcionUnit: 'g',
    weeks: [10, 10, 15, 15], tags: [], category: '',
  };
  PRODUCTS.push(newProd);
  projWeeks.push([10, 10, 15, 15]);
  scheduleSave();

  const idx = PRODUCTS.length - 1;

  // Mostrar pantalla de transición (paso 2)
  document.getElementById('add-prod-step1').style.display = 'none';
  document.getElementById('add-prod-step2').style.display = 'flex';
  document.getElementById('add-prod-modal-title').textContent = 'Nuevo producto · Paso 2 de 2';
  document.getElementById('add-prod-modal-sub').textContent = 'Cargando editor de receta…';
  document.getElementById('np-created-name').textContent = '✅ "' + name + '" creado';
  document.getElementById('np-progress').style.width = '100%';
  document.getElementById('np-step2-dot').style.background = 'var(--accent)';
  document.getElementById('np-step2-dot').style.color = 'white';

  // Pequeño delay para mostrar la transición, luego abrir el editor
  setTimeout(() => {
    closeAddProdModal();
    renderProductos();
    renderDashboard();
    openRecipe(idx);
  }, 550);
}

function confirmAddProduct() { npGoStep2(); } // alias por compatibilidad
function confirmDel(i) { showConfirm(`Eliminar "${PRODUCTS[i].name}"`,'¿Eliminar este producto?',()=>{PRODUCTS.splice(i,1);projWeeks.splice(i,1);selectedSet.delete(i);renderProductos();renderDashboard();}); }

// ═══════════════════════════════════════════════════════
// MODAL DETALLE
// ═══════════════════════════════════════════════════════
function openProductDetail(i) { openModal(i); }
function openModal(i) {
  const p=PRODUCTS[i]; const tc=costPerUnit(p); const gfa=gfAssigned(p); const mp=mostradorFinalPrice(p);
  document.getElementById('modal-title').textContent=p.name;
  // Resolve each ingredient to {label, cost} regardless of format (legacy vs new)
  const _ingResolved = p.ingredients.map(row => {
    if (row.ingId) {
      const ing = INGREDIENTES.find(x => x.id === row.ingId);
      return { label: ing ? ing.name : row.ingId, cost: calcIngCost(row) };
    }
    return { label: row.n || '?', cost: row.v || 0 };
  });
  const tot = _ingResolved.reduce((s,x) => s + x.cost, 0) || 1;
  const ingBars = _ingResolved.map(x => {
    const pct = Math.round(x.cost / tot * 100);
    return `<div class="ingredient-bar-wrap"><div class="ingredient-bar-label"><span>${x.label}</span><span style="font-family:'DM Mono',monospace;color:#888">${fmt(x.cost)} (${pct}%)</span></div><div class="ingredient-bar-track"><div class="ingredient-bar-fill" style="width:${pct}%"></div></div></div>`;
  }).join('');
  const chCards=CHANNELS.filter(c=>c.enabled).map(c=>{
    const cp=channelPrice(p,c.id)||mp;
    const m=marginPct(cp,tc+gfa);const mc=marginColor(m);
    const col=chColor(c.id);
    return`<div class="ch-card" style="border-top:3px solid ${col.bg};background:${col.bg}10">
      <div class="ch-card-name" style="color:${col.bg}">${c.name}</div>
      <div class="ch-card-price" style="color:${col.bg}">${fmt(cp)}</div>
      <div class="ch-card-margin" style="color:${mc.text}">Margen: ${(m*100).toFixed(1)}%</div>
      ${c.id==='mostrador'?'<div style="font-size:10px;color:var(--muted);margin-top:2px">Precio base</div>':c.surcharge>0?`<div style="font-size:10px;color:var(--muted);margin-top:2px">+${(c.surcharge*100).toFixed(0)}% sobre mostrador</div>`:'<div style="font-size:10px;color:var(--muted);margin-top:2px">= Precio mostrador</div>'}
    </div>`;
  }).join('');
  const commRate = globalComm();
  // commBase correcto: precio del mostrador SIN la comisión global (= precio con sobrecargo, antes de aplicar comm)
  // channelPrice ya incluye (1+globalComm), entonces el precio pre-comm = channelPrice / (1+globalComm)
  const mpFinal   = channelPrice(p, 'mostrador') || mostradorPrice(p);
  const commBase  = commRate > 0 ? mpFinal / (1 + commRate) : mpFinal;
  const commPesos = Math.round(commBase * commRate);
  // Para cada canal: mostrar cuánto suma la comisión sobre ese canal específico
  const chComms = CHANNELS.filter(c=>c.enabled).map(c => {
    const cpFinal  = channelPrice(p, c.id) || mpFinal;
    const cpPreComm = commRate > 0 ? cpFinal / (1 + commRate) : cpFinal;
    return { id: c.id, name: c.name, cpFinal, cpPreComm, commAdd: Math.round(cpPreComm * commRate) };
  });
  document.getElementById('modal-body').innerHTML=`
    <div class="section-title">Desglose de costos</div>
    <div>
      ${[{n:'Costo receta (ingredientes)',v:Math.round(_ingResolved.reduce((s,x)=>s+x.cost,0))},{n:'Envases y packaging',v:packCost(p)},{n:'GF por producto'+(p.gfPctOverride!=null?' ('+p.gfPctOverride.toFixed(0)+'% del base)':' (100% del base)'),v:gfa}]
        .map(r=>`<div class="cost-row"><span class="cost-name">${r.n}</span><span class="cost-val">${fmt(r.v)}</span></div>`).join('')}
      <div class="cost-row total"><span class="cost-name">Base para precio</span><span class="cost-val">${fmt(tc+gfa)}</span></div>
      <div class="cost-row total">
        <span class="cost-name" style="display:flex;flex-direction:column;gap:2px">
          <span>Subtotal (×${getTier(p.tier).factor})</span>
          <span style="font-size:11px;font-weight:400;color:var(--muted)">Base de referencia para los canales</span>
        </span>
        <span class="cost-val" style="color:var(--green)">${fmt(tc+gfa > 0 ? Math.round((tc+gfa)*getTier(p.tier).factor) : 0)}</span>
      </div>
      ${commRate>0 ? `
      <div style="background:#fff8e1;border:1px solid rgba(242,140,0,0.3);border-radius:8px;padding:10px 12px;margin-top:8px">
        <div style="font-size:11px;font-weight:700;color:var(--accent);text-transform:uppercase;letter-spacing:0.4px;margin-bottom:8px">
          ✦ Com. venta global ${(commRate*100).toFixed(1)}% — aplicada sobre el precio final de cada canal (después del sobrecargo)
        </div>
        <div style="display:flex;flex-direction:column;gap:5px">
          ${chComms.map(ch => `
            <div style="display:flex;align-items:center;justify-content:space-between;font-size:11px">
              <span style="color:var(--muted);min-width:90px">${ch.name}</span>
              <span style="font-family:'DM Mono',monospace;color:var(--ink)">${fmt(Math.round(ch.cpPreComm/50)*50)}</span>
              <span style="color:var(--muted);padding:0 6px">×</span>
              <span style="font-weight:600;color:var(--accent)">${(commRate*100).toFixed(1)}%</span>
              <span style="color:var(--muted);padding:0 6px">=</span>
              <span style="font-family:'DM Mono',monospace;font-weight:700;color:var(--accent)">+${fmt(ch.commAdd)}</span>
              <span style="margin-left:6px;font-family:'DM Mono',monospace;font-weight:700;color:var(--primary)">→ ${fmt(ch.cpFinal)}</span>
            </div>`).join('')}
        </div>
      </div>` :
      '<div class="cost-row" style="opacity:0.5"><span class="cost-name" style="font-size:12px">Com. venta</span><span class="cost-val">0% · sin impacto</span></div>'}
    </div>
    <div class="section-title">Precios por canal</div>
    <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(140px,1fr));gap:10px;margin-bottom:18px">${chCards}</div>
    <div class="section-title">Composición de receta</div>
    ${ingBars||'<p style="color:var(--muted);font-size:13px">Sin ingredientes</p>'}
    <div style="height:190px;position:relative;margin-top:10px"><canvas id="modal-chart"></canvas></div>
    <div class="section-title">Envases y packaging</div>
    ${p.packaging.map(pk=>`<div class="cost-row"><span class="cost-name" style="font-size:12px;color:#555">${pk.envId ? (ENVASES.find(e=>e.id===pk.envId)?.name||pk.n||pk.envId) : (pk.n||'')}</span><span class="cost-val">${fmt(calcEnvCost(pk))}</span></div>`).join('')||'<p style="color:var(--muted);font-size:13px">Sin envases</p>'}`;
  document.getElementById('modal-overlay').classList.add('open');
  if(p.ingredients.length>0) setTimeout(()=>{
    destroyChart('modal-chart');
    const cols=['#F28C00','#c0392b','#2980b9','#235328','#d68910','#8e44ad','#16a085','#e67e22','#F39C12','#795548'];
    charts['modal-chart']=new Chart(document.getElementById('modal-chart'),{type:'pie',data:{labels:_ingResolved.map(x=>x.label),datasets:[{data:_ingResolved.map(x=>Math.round(x.cost)),backgroundColor:cols,borderWidth:2,borderColor:'white'}]},options:{responsive:true,maintainAspectRatio:false,plugins:{legend:{display:true,position:'right',labels:{boxWidth:10,font:{size:10}}},tooltip:{callbacks:{label:ctx=>`${ctx.label}: ${fmt(ctx.parsed)}`}}}}});
  },50);
}
function closeModal() { document.getElementById('modal-overlay').classList.remove('open'); }

// ═══════════════════════════════════════════════════════
// RECIPE EDITOR
// ═══════════════════════════════════════════════════════
function openRecipe(i) {
  recipeIdx=i;
  renderRecipeBody();
  document.getElementById('recipe-title').textContent='Editar receta: '+PRODUCTS[i].name;
  document.getElementById('recipe-overlay').classList.add('open');
}
function closeRecipe() { document.getElementById('recipe-overlay').classList.remove('open'); recipeIdx=-1; }

function duplicateProduct(i) {
  const src = PRODUCTS[i];
  const clone = JSON.parse(JSON.stringify(src)); // deep clone
  clone.id   = 'prod_' + Date.now();
  clone.name = src.name + ' (copia)';
  PRODUCTS.push(clone);
  scheduleSave();
  renderProductos();
  // Open the new product's recipe editor
  const newIdx = PRODUCTS.length - 1;
  closeRecipe();
  setTimeout(() => openRecipeEditor(newIdx), 80);
}

function clearRecipe(i) {
  showConfirm(
    'Eliminar receta',
    '¿Eliminar todos los ingredientes, envases y combos de esta receta? El producto no se elimina, solo su receta.',
    () => {
      PRODUCTS[i].ingredients = [];
      PRODUCTS[i].packaging   = [];
      PRODUCTS[i].combos      = [];
      PRODUCTS[i].receta_cost = 0;
      PRODUCTS[i].pesoTotal   = '';
      PRODUCTS[i].porcionCant = '';
      PRODUCTS[i].pesoTotalManual = false;
      recalcAndRender(i);
    }
  );
}

// Calcular costo de un ítem de ingrediente basado en ingId + qty + unit

// Calcular costo de un ítem de envase basado en envId + qty + unit

// Recalcular receta_cost a partir de ingredients indexados

// Fracción de combo: {'1':1, '1/2':0.5, '1/3':0.333, '1/4':0.25, '2':2, '3':3}

// Resolve proportion of target used by this combo row

// Costo de una fila de sub-producto con soporte a sub-combos anidados

// Helper: cost of one packaging row
// v3: una sola regla de costo de envase (respeta unidad)

// Info de contexto para mostrar en UI
function comboCostContext(row) {
  if (!row.prodId) return null;
  const target = PRODUCTS.find(x => x.id === row.prodId);
  if (!target) return null;
  const qty  = parseFloat(row.qty) || 0;
  const unit = row.unit || 'u';
  const pt   = parseFloat(target.pesoTotal);
  const pu   = target.pesoUnit || 'g';
  if (pt > 0 && qty > 0) {
    const isWeightU = u => u==='g'||u==='kg';
    const isVolU    = u => u==='ml'||u==='L';
    if ((isWeightU(unit) && isWeightU(pu)) || (isVolU(unit) && isVolU(pu))) {
      const prop = toBase(qty, unit) / toBase(pt, pu);
      return `${qty}${unit} de ${target.pesoTotal}${pu} = ${(prop*100).toFixed(1)}%`;
    }
    if (unit === 'u' && target.pesoUnit === 'u') {
      return `${qty}u de ${pt}u = ${((qty/pt)*100).toFixed(1)}%`;
    }
    if (unit === 'u') {
      const porc = getPorc(target);
      return `${qty} ${target.porcionLabel||'porción'} de ${porc.toFixed(0)}`;
    }
    return `⚠ Unidades incompatibles`;
  }
  if (unit === 'u' && qty > 0) return `${qty} ${target.porcionLabel||'porción/es'}`;
  if (qty > 0) return `⚠ Configurá "peso total" en ${target.name}`;
  return null;
}


// ── RECIPE EDITOR HELPERS (evitan lógica inline en onclick) ──
function togglePesoManual(i) {
  PRODUCTS[i].pesoTotalManual = !PRODUCTS[i].pesoTotalManual;
  recalcAndRender(i);
}
function toggleSubCombos(i, j) {
  const el = document.getElementById(`sub-combos-${i}-${j}`);
  const btn = document.getElementById(`sc-btn-${i}-${j}`);
  if (!el) return;
  const isOpen = el.style.display !== 'none';
  el.style.display = isOpen ? 'none' : 'block';
  if (btn) btn.textContent = isOpen ? '▸ sub-combos' : '▾ sub-combos';
}

function setComboOverride(i, j, k, field, val) {
  if (!PRODUCTS[i].combos[j].comboOverrides) PRODUCTS[i].combos[j].comboOverrides = {};
  if (!PRODUCTS[i].combos[j].comboOverrides[k]) PRODUCTS[i].combos[j].comboOverrides[k] = {};
  PRODUCTS[i].combos[j].comboOverrides[k][field] = val;
  recalcAndRender(i);
}

function toggleComboWeight(i, j) {
  if (!PRODUCTS[i].combos) return;
  const cur = PRODUCTS[i].combos[j].addWeight;
  PRODUCTS[i].combos[j].addWeight = (cur === false) ? true : false;
  recalcAndRender(i);
}
function toggleComboPackaging(i, j) {
  if (!PRODUCTS[i].combos) return;
  const cur = PRODUCTS[i].combos[j].addPackaging;
  PRODUCTS[i].combos[j].addPackaging = (cur === false) ? true : false;
  recalcAndRender(i);
}
// ─────────────────────────────────────────────────────────────

function renderSubCombosPanel(i, j, row, target) {
  if (!target || !(target.combos||[]).length) return '';
  const subCombos = target.combos;
  const overrides = row.comboOverrides || {};
  const COMBO_UNITS_SC = ['u','g','kg','ml','L'];
  let subRows = '';
  subCombos.forEach(function(sc, k) {
    const scTarget = sc.prodId ? PRODUCTS.find(function(x){return x.id===sc.prodId;}) : null;
    const scName = scTarget ? scTarget.name : (sc.prodId || '?');
    const ov = overrides[k] || {};
    const effQty  = ov.qty  != null ? ov.qty  : (sc.qty  != null ? sc.qty  : 1);
    const effUnit = ov.unit != null ? ov.unit : (sc.unit != null ? sc.unit : 'u');
    const isOv = ov.qty != null || ov.unit != null;
    const effectiveRow = Object.assign({}, sc, {qty: effQty, unit: effUnit});
    const scCost = calcComboCost(effectiveRow, new Set([row.prodId]));
    const ovBadge = isOv ? '<span style="font-size:9px;background:rgba(242,140,0,0.15);color:var(--accent);border-radius:99px;padding:1px 5px;margin-left:4px;font-weight:700">override</span>' : '';
    const ovBtn   = isOv ? '<button onclick="const ov2=PRODUCTS['+i+'].combos['+j+'].comboOverrides||{};delete ov2['+k+'];recalcAndRender('+i+')" style="border:none;background:none;cursor:pointer;font-size:10px;color:var(--muted);padding:0" title="Quitar override">↺</button>' : '';
    const unitOpts = COMBO_UNITS_SC.map(function(u){ return '<option value="'+u+'"'+(effUnit===u?' selected':'')+'>'+u+'</option>'; }).join('');
    subRows += '<div style="display:flex;align-items:center;gap:7px;padding:6px 12px 6px 28px;border-top:1px solid rgba(242,140,0,0.15);flex-wrap:wrap;background:'+(isOv?'rgba(242,140,0,0.04)':'transparent')+'">'
      + '<svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" stroke-width="2.5" style="flex-shrink:0;opacity:0.5"><polyline points="9 18 15 12 9 6"/></svg>'
      + '<span style="font-size:11px;color:var(--ink);flex:1;min-width:100px">'+scName+ovBadge+'</span>'
      + '<div style="display:flex;align-items:center;gap:4px">'
      + '<input type="number" min="0" step="any" value="'+effQty+'" style="width:60px;border:1px solid '+(isOv?'var(--accent)':'var(--border)')+';border-radius:5px;padding:3px 6px;font-family:\'DM Mono\',monospace;font-size:12px;text-align:center;outline:none" onchange="setComboOverride('+i+','+j+','+k+',\'qty\',parseFloat(this.value)||0)">'
      + '<select style="border:1px solid var(--border);border-radius:5px;padding:3px 5px;font-size:11px;background:white;outline:none" onchange="setComboOverride('+i+','+j+','+k+',\'unit\',this.value)">'+unitOpts+'</select>'
      + '<span style="font-family:\'DM Mono\',monospace;font-size:11px;color:var(--accent);min-width:54px;text-align:right">'+fmt(scCost)+'</span>'
      + ovBtn
      + '</div></div>';
  });
  return '<div style="border:1px solid rgba(242,140,0,0.25);border-top:none;border-radius:0 0 7px 7px;background:rgba(242,140,0,0.02);margin-top:-2px">'
    + '<div style="padding:5px 10px;display:flex;align-items:center;justify-content:space-between">'
    + '<button id="sc-btn-'+i+'-'+j+'" onclick="toggleSubCombos('+i+','+j+')" style="border:none;background:none;cursor:pointer;font-size:10px;color:var(--accent);font-weight:600;padding:0;font-family:\'DM Sans\',sans-serif">&#9658; sub-combos ('+subCombos.length+')</button>'
    + '<span style="font-size:9px;color:var(--muted)">Edit\u00e1 solo para este producto</span>'
    + '</div>'
    + '<div id="sub-combos-'+i+'-'+j+'" style="display:none">'+subRows+'</div>'
    + '</div>';
}

function renderRecipeBody() {
  if(recipeIdx<0) return;
  const p = PRODUCTS[recipeIdx];
  const i = recipeIdx;

  const combos   = p.combos || [];
  const totIng   = p.ingredients.reduce((s,r) => s + calcIngCost(r), 0);
  const totPack  = p.packaging.reduce((s,r)  => s + calcEnvCost(r), 0);
  const totCombo = combos.reduce((s,r) => s + calcComboCost(r), 0);
  const totTotal = totIng + totPack + totCombo;

  const ingUnits = ['g','kg','ml','L','u'];
  const envUnits = ['u','g','kg'];

  // Opciones de productos (excluir el producto actual)
  const prodOptions = PRODUCTS
    .filter(x => x.id !== p.id)
    .map(x => {
      const c = costPerUnit(x);
      const pesoInfo = parseFloat(x.pesoTotal)>0 ? ` · ${x.pesoTotal}${x.pesoUnit||'g'}` : '';
      return `<option value="${x.id}">${x.name}${pesoInfo} — ${fmt(c)}/u</option>`;
    }).join('');

  // ── Auto-weight precompute (antes del template literal) ──
  const _aw         = calcAutoWeight(p);
  const _isManual   = !!p.pesoTotalManual;
  const _effVal     = (!_isManual && _aw) ? String(_aw.value)  : (p.pesoTotal||'');
  const _effUnit    = (!_isManual && _aw) ? _aw.unit           : (p.pesoUnit||'g');
  // Sync silently into product so getPorc/calcAutoPorc can read updated pesoTotal
  if (!_isManual && _aw) { p.pesoTotal = String(_aw.value); p.pesoUnit = _aw.unit; }
  // Peso card HTML — built as plain string (no nested backtick) 
  const _unitOpts   = ['g','kg','ml','L','u'].map(u=>`<option value="${u}" ${_effUnit===u?'selected':''}>${u}</option>`).join('');
  const _pesoBadge  = !_isManual && _aw
    ? '<span style="font-size:9px;background:rgba(35,83,40,0.1);color:var(--primary);border-radius:99px;padding:1px 7px;font-weight:700">⚡ AUTO</span>'
    : '<span style="font-size:9px;background:rgba(242,140,0,0.1);color:var(--accent);border-radius:99px;padding:1px 7px;font-weight:600">MANUAL</span>';
  const _pesoBtn    = !_isManual
    ? `<button onclick="togglePesoManual(${i})" title="Cambiar a ingreso manual" style="margin-left:auto;border:1px solid var(--border);border-radius:5px;background:white;cursor:pointer;padding:2px 7px;font-size:10px;color:var(--muted);font-family:'DM Sans',sans-serif">✏ Manual</button>`
    : `<button onclick="togglePesoManual(${i})" title="Volver a cálculo automático" style="margin-left:auto;border:1px solid var(--border);border-radius:5px;background:rgba(35,83,40,0.06);cursor:pointer;padding:2px 7px;font-size:10px;color:var(--primary);font-weight:600;font-family:'DM Sans',sans-serif">⚡ Auto</button>`;
  const _pesoBody   = (!_isManual && _aw)
    ? `<div style="font-family:'DM Mono',monospace;font-size:22px;font-weight:700;color:var(--primary);text-align:center;padding:4px 0">${_aw.display}</div><div style="font-size:10px;color:var(--muted);text-align:center;margin-top:3px">Suma de ingredientes + combos incluidos</div>`
    : `<div style="display:flex;align-items:center;gap:6px"><input type="number" min="0" step="any" placeholder="ej: 6" value="${_effVal}" style="flex:1;border:1.5px solid rgba(242,140,0,0.5);border-radius:6px;padding:6px 9px;font-family:'DM Mono',monospace;font-size:16px;font-weight:700;color:var(--accent);outline:none;text-align:center;background:white;min-width:0" onchange="PRODUCTS[${i}].pesoTotal=this.value;recalcAndRender(${i})"><select style="border:1.5px solid rgba(242,140,0,0.4);border-radius:6px;padding:6px 8px;font-size:13px;font-family:'DM Sans',sans-serif;background:white;outline:none;color:var(--ink);font-weight:600" onchange="PRODUCTS[${i}].pesoUnit=this.value;recalcAndRender(${i})">${_unitOpts}</select></div>${!_aw?'<div style="font-size:10px;color:var(--muted);margin-top:5px">Cantidad total que produce esta receta</div>':''}`;
  const _pesoBorder = (!_isManual && _aw) ? 'var(--primary)' : 'var(--border)';
  const _pesoCard   = `<div style="background:white;border:1px solid ${_pesoBorder};border-radius:8px;padding:10px 12px"><div style="display:flex;align-items:center;gap:6px;margin-bottom:8px"><span style="font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:0.5px;color:var(--muted)">📦 Peso / vol. total del batch</span>${_pesoBadge}${_pesoBtn}</div>${_pesoBody}</div>`;
  // ────────────────────────────────────────────────────────────

  document.getElementById('recipe-body').innerHTML=`

    <!-- KPIs -->
    <div style="display:flex;gap:10px;margin-bottom:18px;flex-wrap:wrap">
      <div class="kpi" style="flex:1;min-width:100px"><div class="kpi-label">Ingredientes</div><div class="kpi-value" style="font-size:15px">${fmt(totIng)}</div></div>
      <div class="kpi" style="flex:1;min-width:100px"><div class="kpi-label">Envases</div><div class="kpi-value" style="font-size:15px">${fmt(totPack)}</div></div>
      ${totCombo>0?`<div class="kpi" style="flex:1;min-width:100px;border-color:var(--accent)"><div class="kpi-label" style="color:var(--accent)">Combo / Sub-prod.</div><div class="kpi-value" style="font-size:15px;color:var(--accent)">${fmt(totCombo)}</div></div>`:''}
      ${(()=>{ const aw=calcAutoWeight(p); return aw?`<div class="kpi" style="flex:1;min-width:100px;border-color:var(--primary);background:rgba(35,83,40,0.04)"><div class="kpi-label" style="color:var(--primary)">⚡ Peso calculado</div><div class="kpi-value" style="font-size:15px;color:var(--primary)">${aw.display}</div></div>`:''; })()}
      <div class="kpi" style="flex:1;min-width:100px;background:rgba(35,83,40,0.06);border-color:var(--primary)"><div class="kpi-label" style="color:var(--primary)">Costo total receta</div><div class="kpi-value good" style="font-size:15px">${fmt(totTotal)}</div></div>
      ${getPorc(p)>1?`<div class="kpi" style="flex:1;min-width:100px;background:rgba(242,140,0,0.06);border-color:var(--accent)"><div class="kpi-label" style="color:var(--accent)">✂ Costo por ${p.porcionLabel||'porción'}</div><div class="kpi-value" style="font-size:18px;color:var(--accent);font-weight:700">${fmt(totTotal/getPorc(p))}</div><div style="font-size:10px;color:var(--muted);margin-top:2px">receta ÷ ${getPorc(p).toFixed(getPorc(p)%1===0?0:2)} ${p.porcionLabel||'porciones'}</div></div>`:''}
    </div>

    <!-- RENDIMIENTO / PORCIONES -->
    <div style="background:rgba(242,140,0,0.06);border:1.5px solid rgba(242,140,0,0.3);border-radius:10px;padding:14px 16px;margin-bottom:18px">
      <div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap;margin-bottom:14px">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M12 8v4l3 3"/></svg>
        <span style="font-weight:600;font-size:13px;color:var(--ink)">Rendimiento de la receta</span>
        <span style="font-size:11px;color:var(--muted)">Definí el batch total y cuánto va en cada porción — el sistema calcula automáticamente.</span>
      </div>

      <!-- FILA 1: Peso total + Cant. por porción -->
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:14px">

        ${_pesoCard}

        <!-- Cant. por porción -->
        <div style="background:white;border:1px solid var(--border);border-radius:8px;padding:10px 12px">
          <div style="font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:0.5px;color:var(--muted);margin-bottom:8px">
            ✂ Cantidad por
            <select style="border:none;background:transparent;font-size:10px;font-weight:700;color:var(--muted);outline:none;padding:0 2px;text-transform:uppercase;letter-spacing:0.5px;font-family:'DM Sans',sans-serif;cursor:pointer"
              onchange="PRODUCTS[${i}].porcionLabel=this.value;recalcAndRender(${i})">
              ${['porción','unidad','tajada','pedazo','trozo'].map(v=>`<option value="${v}" ${(p.porcionLabel||'porción')===v?'selected':''}>${v.toUpperCase()}</option>`).join('')}
            </select>
          </div>
          <div style="display:flex;align-items:center;gap:6px">
            <input type="number" min="0" step="any" placeholder="ej: 200"
              value="${p.porcionCant||''}"
              style="flex:1;border:1.5px solid rgba(35,83,40,0.5);border-radius:6px;padding:6px 9px;font-family:'DM Mono',monospace;font-size:16px;font-weight:700;color:var(--primary);outline:none;text-align:center;background:white;min-width:0"
              onchange="PRODUCTS[${i}].porcionCant=this.value;recalcAndRender(${i})">
            <select style="border:1.5px solid rgba(35,83,40,0.4);border-radius:6px;padding:6px 8px;font-size:13px;font-family:'DM Sans',sans-serif;background:white;outline:none;color:var(--ink);font-weight:600"
              onchange="PRODUCTS[${i}].porcionUnit=this.value;recalcAndRender(${i})">
              ${['g','kg','ml','L','u'].map(u=>`<option value="${u}" ${(p.porcionUnit||'g')===u?'selected':''}>${u}</option>`).join('')}
            </select>
          </div>
          <div style="font-size:10px;color:var(--muted);margin-top:5px">Cuánto lleva cada unidad que vendés</div>
        </div>
      </div>

      <!-- RESULTADO: calculado o manual -->
      ${(()=>{
        const autoP = calcAutoPorc(p);
        const effP  = getPorc(p);
        if (autoP !== null) {
          const mermaVal = parseFloat(p.merma) || 0;
          const basePorc = autoP;
          return `<div style="display:flex;flex-direction:column;gap:10px">
            <div style="display:flex;align-items:center;gap:12px;flex-wrap:wrap">
              <!-- Result card -->
              <div style="background:rgba(35,83,40,0.08);border:1.5px solid var(--primary);border-radius:8px;padding:8px 16px;display:flex;flex-direction:column;gap:2px;min-width:160px">
                <span style="font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:0.5px;color:var(--primary)">✓ Porciones efectivas</span>
                <span style="font-family:'DM Mono',monospace;font-size:22px;font-weight:700;color:var(--primary)">${effP.toFixed(effP%1===0?0:2)} ${p.porcionLabel||'porciones'}</span>
                <span style="font-size:10px;color:var(--muted)">${p.pesoTotal} ${p.pesoUnit||'g'} ÷ ${p.porcionCant} ${p.porcionUnit||'g'}${mermaVal>0?' − '+mermaVal+'% merma':''} = ${effP.toFixed(effP%1===0?0:2)}</span>
              </div>
              <!-- Cost card -->
              <div style="display:flex;flex-direction:column;gap:2px;background:rgba(242,140,0,0.06);border:1px solid rgba(242,140,0,0.25);border-radius:8px;padding:8px 14px;min-width:140px">
                <span style="font-size:10px;color:var(--muted);text-transform:uppercase;letter-spacing:0.5px">Costo por ${p.porcionLabel||'porción'}</span>
                <span style="font-family:'DM Mono',monospace;font-size:20px;font-weight:700;color:var(--accent)">${fmt(totTotal/effP)}</span>
                <span style="font-size:10px;color:var(--muted)">${fmt(totTotal)} ÷ ${effP.toFixed(effP%1===0?0:2)}</span>
              </div>
            </div>
            <!-- Merma + manual override row -->
            <div style="display:flex;align-items:center;gap:14px;flex-wrap:wrap;padding:10px 12px;background:rgba(242,140,0,0.04);border:1px solid rgba(242,140,0,0.2);border-radius:8px">
              <!-- Merma input -->
              <div style="display:flex;align-items:center;gap:6px">
                <span style="font-size:11px;color:var(--muted);white-space:nowrap">🔥 Merma por cocción:</span>
                <input type="number" min="0" max="99" step="1" placeholder="0"
                  value="${mermaVal||''}"
                  style="width:58px;border:1.5px solid rgba(242,140,0,0.4);border-radius:6px;padding:4px 7px;font-family:'DM Mono',monospace;font-size:14px;font-weight:700;color:var(--accent);outline:none;text-align:center;background:white"
                  onchange="PRODUCTS[${i}].merma=parseFloat(this.value)||0;recalcAndRender(${i})">
                <span style="font-size:11px;color:var(--muted)">%</span>
                ${mermaVal>0?`<span style="font-size:10px;color:var(--accent);font-family:'DM Mono',monospace">${basePorc.toFixed(1)} → ${effP.toFixed(effP%1===0?0:2)} porc.</span>`:''}
              </div>
              <div style="width:1px;height:18px;background:rgba(242,140,0,0.2)"></div>
              <!-- Manual override of final porciones -->
              <div style="display:flex;align-items:center;gap:6px;flex-wrap:wrap">
                <span style="font-size:11px;color:var(--muted);white-space:nowrap">✏ O fijar directamente:</span>
                <input type="number" min="0.1" step="0.5"
                  value="${parseFloat(p.porcionesOverride)>0?p.porcionesOverride:''}"
                  placeholder="${effP.toFixed(effP%1===0?0:1)}"
                  style="width:66px;border:1.5px solid ${parseFloat(p.porcionesOverride)>0?'var(--accent)':'var(--border)'};border-radius:6px;padding:4px 7px;font-family:'DM Mono',monospace;font-size:14px;font-weight:700;color:${parseFloat(p.porcionesOverride)>0?'var(--accent)':'var(--muted)'};outline:none;text-align:center;background:white"
                  onchange="const v=parseFloat(this.value);PRODUCTS[${i}].porcionesOverride=v>0?v:null;recalcAndRender(${i})">
                <span style="font-size:11px;color:var(--muted)">${p.porcionLabel||'porc.'}</span>
                ${parseFloat(p.porcionesOverride)>0?`<button onclick="PRODUCTS[${i}].porcionesOverride=null;recalcAndRender(${i})" style="border:none;background:none;cursor:pointer;font-size:10px;color:var(--muted);padding:0;text-decoration:underline">⟳ auto</button>`:''}
              </div>
            </div>
          </div>`;
        } else {
          return `<div style="border-top:1px dashed rgba(242,140,0,0.3);padding-top:12px">
            <div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap">
              <span style="font-size:11px;color:var(--muted);">${p.pesoTotal && p.porcionCant ? '⚠ Unidades incompatibles (ej: kg y u). Usá porciones manuales:' : 'O ingresá el número de porciones manualmente:'}</span>
              <div style="display:flex;align-items:center;gap:6px">
                <label style="font-size:12px;color:var(--muted)">Rinde:</label>
                <input type="number" min="1" step="1" value="${p.porciones||1}"
                  style="width:72px;border:1.5px solid rgba(242,140,0,0.5);border-radius:6px;padding:5px 8px;font-family:'DM Mono',monospace;font-size:15px;font-weight:700;color:var(--accent);outline:none;text-align:center;background:white"
                  onchange="const v=Math.max(1,parseInt(this.value)||1);PRODUCTS[${i}].porciones=v;recalcAndRender(${i})">
                <span style="font-size:12px;color:var(--muted)">${p.porcionLabel||'porciones'}</span>
              </div>
              ${effP > 1 ? `<div style="background:rgba(242,140,0,0.06);border:1px solid rgba(242,140,0,0.25);border-radius:8px;padding:6px 12px;display:flex;flex-direction:column;gap:1px">
                <span style="font-size:10px;color:var(--muted)">Costo por ${p.porcionLabel||'porción'}</span>
                <span style="font-family:'DM Mono',monospace;font-size:18px;font-weight:700;color:var(--accent)">${fmt(totTotal/effP)}</span>
              </div>` : ''}
            </div>
          </div>`;
        }
      })()}
    </div>

    <!-- INGREDIENTES -->
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px">
      <span class="section-title" style="margin:0">Ingredientes</span>
      <button class="btn btn-accent" style="padding:4px 10px;font-size:11px" onclick="addRI(${i})">+ Agregar</button>
    </div>
    <div style="border:1px solid var(--border);border-radius:8px;overflow:hidden;margin-bottom:16px">
      ${p.ingredients.length ? p.ingredients.map((row,j) => {
        const ing  = row.ingId ? INGREDIENTES.find(x=>x.id===row.ingId) : null;
        const cost = calcIngCost(row);
        const pxg  = ing ? (ing.precioPkg/ing.grPaquete) : 0;
        return `<div style="display:flex;align-items:center;gap:8px;padding:8px 10px;border-bottom:1px solid var(--border);flex-wrap:wrap">
          <div style="flex:2;min-width:140px">
            <select style="width:100%;border:1px solid var(--border);border-radius:6px;padding:5px 8px;font-size:12px;font-family:'DM Sans',sans-serif;background:white;outline:none;color:var(--ink)"
              onchange="PRODUCTS[${i}].ingredients[${j}].ingId=this.value;PRODUCTS[${i}].ingredients[${j}].unit=PRODUCTS[${i}].ingredients[${j}].unit||'g';recalcAndRender(${i})">
              <option value="">— Seleccionar ingrediente —</option>
              ${INGREDIENTES.map(ing2=>`<option value="${ing2.id}" ${row.ingId===ing2.id?'selected':''}>${ing2.name}</option>`).join('')}
            </select>
          </div>
          <div style="display:flex;align-items:center;gap:4px;min-width:130px">
            <input type="number" min="0" step="0.1" value="${row.qty||''}" placeholder="Cant."
              style="width:76px;border:1px solid var(--border);border-radius:6px;padding:5px 8px;font-family:'DM Mono',monospace;font-size:13px;outline:none;text-align:right"
              onchange="PRODUCTS[${i}].ingredients[${j}].qty=parseFloat(this.value)||0;recalcAndRender(${i})">
            <select style="border:1px solid var(--border);border-radius:6px;padding:5px 6px;font-size:12px;background:white;outline:none"
              onchange="PRODUCTS[${i}].ingredients[${j}].unit=this.value;recalcAndRender(${i})">
              ${ingUnits.map(u=>`<option value="${u}" ${(row.unit||'g')===u?'selected':''}>${u}</option>`).join('')}
            </select>
          </div>
          <span style="font-family:'DM Mono',monospace;font-size:12px;color:var(--green);font-weight:600;min-width:68px;text-align:right">${fmt(cost)}</span>
          ${ing?`<span style="font-size:10px;color:var(--muted);min-width:56px">${fmt(pxg)}/g</span>`:'<span style="min-width:56px"></span>'}
          <button class="remove-row-btn" onclick="PRODUCTS[${i}].ingredients.splice(${j},1);recalcAndRender(${i})">✕</button>
        </div>`;
      }).join('') : '<div style="padding:12px;color:var(--muted);font-size:13px">Sin ingredientes — usá + Agregar</div>'}
    </div>

    <!-- ENVASES / PACKAGING -->
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px">
      <span class="section-title" style="margin:0">Envases y packaging</span>
      <button class="btn btn-accent" style="padding:4px 10px;font-size:11px" onclick="addRP(${i})">+ Agregar</button>
    </div>
    <div style="border:1px solid var(--border);border-radius:8px;overflow:hidden;margin-bottom:16px">
      ${p.packaging.length ? p.packaging.map((row,j) => {
        const env  = row.envId ? ENVASES.find(x=>x.id===row.envId) : null;
        const cost = calcEnvCost(row);
        const pxu  = env ? (env.precioPkg/env.cantidad) : 0;
        return `<div style="display:flex;align-items:center;gap:8px;padding:8px 10px;border-bottom:1px solid var(--border);flex-wrap:wrap">
          <div style="flex:2;min-width:140px">
            <select style="width:100%;border:1px solid var(--border);border-radius:6px;padding:5px 8px;font-size:12px;font-family:'DM Sans',sans-serif;background:white;outline:none;color:var(--ink)"
              onchange="PRODUCTS[${i}].packaging[${j}].envId=this.value;PRODUCTS[${i}].packaging[${j}].unit=PRODUCTS[${i}].packaging[${j}].unit||'u';recalcAndRender(${i})">
              <option value="">— Seleccionar envase —</option>
              ${ENVASES.map(env2=>`<option value="${env2.id}" ${row.envId===env2.id?'selected':''}>${env2.name}</option>`).join('')}
            </select>
          </div>
          <div style="display:flex;align-items:center;gap:4px;min-width:130px">
            <input type="number" min="0" step="1" value="${row.qty!==undefined?row.qty:1}" placeholder="Cant."
              style="width:76px;border:1px solid var(--border);border-radius:6px;padding:5px 8px;font-family:'DM Mono',monospace;font-size:13px;outline:none;text-align:right"
              onchange="PRODUCTS[${i}].packaging[${j}].qty=parseFloat(this.value)||0;recalcAndRender(${i})">
            <select style="border:1px solid var(--border);border-radius:6px;padding:5px 6px;font-size:12px;background:white;outline:none"
              onchange="PRODUCTS[${i}].packaging[${j}].unit=this.value;recalcAndRender(${i})">
              ${envUnits.map(u=>`<option value="${u}" ${(row.unit||'u')===u?'selected':''}>${u}</option>`).join('')}
            </select>
          </div>
          <span style="font-family:'DM Mono',monospace;font-size:12px;color:var(--green);font-weight:600;min-width:68px;text-align:right">${fmt(cost)}</span>
          ${env?`<span style="font-size:10px;color:var(--muted);min-width:56px">${fmt(pxu)}/u</span>`:'<span style="min-width:56px"></span>'}
          <button class="remove-row-btn" onclick="PRODUCTS[${i}].packaging.splice(${j},1);recalcAndRender(${i})">✕</button>
        </div>`;
      }).join('') : '<div style="padding:12px;color:var(--muted);font-size:13px">Sin envases — usá + Agregar</div>'}
    </div>

    <!-- COMBO / SUB-PRODUCTOS -->
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px">
      <div style="display:flex;align-items:center;gap:8px">
        <span class="section-title" style="margin:0">Combo / Sub-productos</span>
        <span style="font-size:10px;background:rgba(242,140,0,0.12);color:var(--accent);border:1px solid rgba(242,140,0,0.3);border-radius:99px;padding:2px 8px;font-weight:600">Referencia a otro ítem del menú</span>
      </div>
      <button class="btn btn-accent" style="padding:4px 10px;font-size:11px" onclick="addRC(${i})">+ Agregar</button>
    </div>
    <div style="border:1.5px solid rgba(242,140,0,0.35);border-radius:8px;overflow:hidden;margin-bottom:16px;background:rgba(242,140,0,0.02)">
      ${combos.length ? combos.map((row,j) => {
        const target = row.prodId ? PRODUCTS.find(x=>x.id===row.prodId) : null;
        const cost   = calcComboCost(row);
        const ctx = comboCostContext(row);
        const COMBO_UNITS = ['u','g','kg','ml','L'];
        return `<div style="display:flex;align-items:center;gap:8px;padding:8px 10px;border-bottom:1px solid rgba(242,140,0,0.2);flex-wrap:wrap">
          <!-- Switches: peso + envases -->
          <div style="display:flex;flex-direction:column;gap:6px;flex-shrink:0">
            <div onclick="toggleComboWeight(${i},${j})" title="Incluir en el peso total automático" style="display:flex;flex-direction:column;align-items:center;gap:2px;cursor:pointer">
              <div style="position:relative;width:28px;height:16px">
                <div style="position:absolute;inset:0;border-radius:99px;background:${row.addWeight!==false?'var(--primary)':'#ccc'};transition:background 0.2s"></div>
                <div style="position:absolute;top:2px;left:${row.addWeight!==false?'14px':'2px'};width:12px;height:12px;border-radius:50%;background:white;transition:left 0.2s"></div>
              </div>
              <span style="font-size:8px;color:${row.addWeight!==false?'var(--primary)':'var(--muted)'};font-weight:600;white-space:nowrap">⚖ peso</span>
            </div>
            <div onclick="toggleComboPackaging(${i},${j})" title="Incluir costo de envases del sub-producto" style="display:flex;flex-direction:column;align-items:center;gap:2px;cursor:pointer">
              <div style="position:relative;width:28px;height:16px">
                <div style="position:absolute;inset:0;border-radius:99px;background:${row.addPackaging!==false?'var(--accent)':'#ccc'};transition:background 0.2s"></div>
                <div style="position:absolute;top:2px;left:${row.addPackaging!==false?'14px':'2px'};width:12px;height:12px;border-radius:50%;background:white;transition:left 0.2s"></div>
              </div>
              <span style="font-size:8px;color:${row.addPackaging!==false?'var(--accent)':'var(--muted)'};font-weight:600;white-space:nowrap">📦 env.</span>
            </div>
          </div>
          <!-- Selector de producto -->
          <div style="flex:2;min-width:150px">
            <select style="width:100%;border:1.5px solid rgba(242,140,0,0.4);border-radius:6px;padding:5px 8px;font-size:12px;font-family:'DM Sans',sans-serif;background:white;outline:none;color:var(--ink)"
              onchange="if(!PRODUCTS[${i}].combos)PRODUCTS[${i}].combos=[];PRODUCTS[${i}].combos[${j}].prodId=this.value;recalcAndRender(${i})">
              <option value="">— Seleccionar producto del menú —</option>
              ${PRODUCTS.filter(x=>x.id!==p.id).map(x=>`<option value="${x.id}" ${row.prodId===x.id?'selected':''}>${x.name}${parseFloat(x.pesoTotal)>0?' ('+x.pesoTotal+' '+x.pesoUnit+')':''}</option>`).join('')}
            </select>
          </div>
          <!-- Cantidad + Unidad -->
          <div style="display:flex;align-items:center;gap:4px">
            <input type="number" min="0" step="any" placeholder="Cant."
              value="${row.qty||''}"
              style="width:72px;border:1.5px solid rgba(242,140,0,0.5);border-radius:6px;padding:5px 8px;font-family:'DM Mono',monospace;font-size:13px;font-weight:600;color:var(--accent);outline:none;text-align:center;background:white"
              onchange="if(!PRODUCTS[${i}].combos)PRODUCTS[${i}].combos=[];PRODUCTS[${i}].combos[${j}].qty=parseFloat(this.value)||0;recalcAndRender(${i})">
            <select style="border:1.5px solid rgba(242,140,0,0.4);border-radius:6px;padding:5px 7px;font-size:12px;font-family:'DM Sans',sans-serif;background:white;outline:none;color:var(--ink);font-weight:600"
              onchange="if(!PRODUCTS[${i}].combos)PRODUCTS[${i}].combos=[];PRODUCTS[${i}].combos[${j}].unit=this.value;recalcAndRender(${i})">
              ${COMBO_UNITS.map(u=>`<option value="${u}" ${(row.unit||'u')===u?'selected':''}>${u}</option>`).join('')}
            </select>
          </div>
          <!-- Costo calculado -->
          <div style="display:flex;flex-direction:column;align-items:flex-end;min-width:90px">
            <span style="font-family:'DM Mono',monospace;font-size:13px;color:var(--accent);font-weight:700">${fmt(cost)}</span>
            ${ctx?`<span style="font-size:9px;color:var(--muted)">${ctx}</span>`:''}
          </div>
          <button class="remove-row-btn" onclick="PRODUCTS[${i}].combos.splice(${j},1);recalcAndRender(${i})">✕</button>
        </div>
        ${renderSubCombosPanel(i, j, row, target)}`;
      }).join('') : `<div style="padding:14px 12px;display:flex;align-items:center;gap:10px;color:var(--muted)">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" opacity="0.4"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
          <span style="font-size:12px">Podés incluir otro producto del menú como parte de este. Ej: Combo con ½ Pizza Napolitana + ⅓ Empanadas.</span>
        </div>`}
    </div>

    <div style="display:flex;justify-content:space-between;align-items:center;padding-top:4px">
      <button class="btn btn-danger" style="font-size:12px" onclick="closeRecipe();confirmDel(${i})">
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4h6v2"/></svg>
        Eliminar
      </button>
      <button class="btn" style="font-size:12px" onclick="duplicateProduct(${i})">
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
        Duplicar
      </button>
      <button class="btn" onclick="closeRecipe()">Cerrar</button>
    </div>`;
}

function recalcAndRender(i) {
  recalcRecetaCost(PRODUCTS[i]);
  renderRecipeBody();
  renderProductos();
  scheduleSave();
}

function addRI(i) {
  PRODUCTS[i].ingredients.push({ ingId:'', qty:0, unit:'g', v:0 });
  renderRecipeBody();
}
function addRP(i) {
  PRODUCTS[i].packaging.push({ envId:'', qty:1, unit:'u', v:0 });
  renderRecipeBody();
}
function addRC(i) {
  if (!PRODUCTS[i].combos) PRODUCTS[i].combos = [];
  PRODUCTS[i].combos.push({ prodId:'', qty:1, unit:'u', addWeight:true, addPackaging:true });
  renderRecipeBody();
}

// ═══════════════════════════════════════════════════════
// PROYECCION — nueva versión con distribución de canales
// ═══════════════════════════════════════════════════════

// Distribución de canales: { channelId: pct (0-100) }
// Se inicializa al primer render o al cargar datos



function setProjDist(chId, newVal) { SAHTEN.core.setProjDist(SAHTEN.state, chId, newVal); renderProyeccion(); }
function normalizeProjDist() { if (!SAHTEN.core.normalizeProjDist(SAHTEN.state)) { renderProyeccion(); return; } renderProyeccion(); }

function toggleProjLock(chId) {
  projChannelLocked[chId] = !projChannelLocked[chId];
  renderProjChannelDist();
}

// Live slider update — does NOT re-render the DOM, only syncs data + sibling inputs + bars
function updateProjDistLive(chId, val) {
  val = Math.max(0, Math.min(100, Math.round(val) || 0));
  projChannelDist[chId] = val;

  // Sync slider ↔ number input in the same row (find by iterating rows)
  const container = document.getElementById('proj-channel-dist');
  if (!container) return;
  const rows = container.querySelectorAll('.ch-dist-row[data-chid]');
  rows.forEach(row => {
    const id = row.dataset.chid;
    const v  = projChannelDist[id] || 0;
    const sl = row.querySelector('.ch-dist-slider');
    const ni = row.querySelector('.ch-dist-pct-input');
    const col = chColor(id);
    if (sl) {
      if (sl.value != v) sl.value = v;
      // Update track fill gradient
      sl.style.background = `linear-gradient(to right, ${col.bg} 0% ${v}%, #e0e0e0 ${v}% 100%)`;
    }
    if (ni && ni.value != v) ni.value = v;
  });

  // Update total bar
  const active = CHANNELS.filter(c => c.enabled);
  const total  = active.reduce((s,c) => s + (projChannelDist[c.id]||0), 0);
  const allOk  = total === 100;
  const totalEl = container.querySelector('.ch-dist-total-pct');
  const totalStatus = container.querySelector('.ch-dist-total-status');
  if (totalEl) { totalEl.textContent = total + '%'; totalEl.style.color = allOk ? 'var(--green)' : 'var(--red)'; }
  if (totalStatus) { totalStatus.textContent = allOk ? '✓ OK' : '⚠ No suma 100%'; totalStatus.style.color = allOk ? 'var(--green)' : 'var(--red)'; }
  // Update stacked total bar segments
  active.forEach(c => {
    const seg = container.querySelector(`.ch-dist-total-seg[data-chid="${c.id}"]`);
    if (seg) seg.style.width = (projChannelDist[c.id]||0) + '%';
  });
}

function resetProyeccion() {
  showConfirm(
    'Reiniciar proyección',
    '¿Reiniciar la distribución de canales y unidades manuales a los valores por defecto? No afecta el historial guardado.',
    () => {
      projChannelDist = {};
      projChannelLocked = {};
      projManualUnits = {};
      projManualMode = false;
      activeProjSnapshotId = null;
      try { localStorage.removeItem('sahten_active_proj'); } catch(e) {}
      const toggle = document.getElementById('proj-manual-toggle');
      if (toggle) toggle.checked = false;
      initProjDist();
      renderProyeccion();
      renderProjSaveBar();
      scheduleSave();
    }
  );
}

function renderProjChannelDist() {
  initProjDist();
  const active = CHANNELS.filter(c=>c.enabled);
  const total = active.reduce((s,c)=>s+(projChannelDist[c.id]||0),0);
  const container = document.getElementById('proj-channel-dist');
  if(!container) return;

  const rows = active.map(c=>{
    const pct = projChannelDist[c.id]||0;
    const col = chColor(c.id);
    const locked = !!projChannelLocked[c.id];
    return `<div class="ch-dist-row ${locked?'locked':''}" data-chid="${c.id}">
      <!-- lock toggle -->
      <button onclick="toggleProjLock('${c.id}')" title="${locked?'Desbloquear':'Bloquear canal'}"
        style="width:26px;height:26px;border-radius:6px;border:1.5px solid ${locked?'var(--primary)':'var(--border)'};background:${locked?'var(--primary)':'white'};cursor:pointer;display:flex;align-items:center;justify-content:center;flex-shrink:0;padding:0;transition:all 0.15s">
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="${locked?'white':'var(--muted)'}" stroke-width="2.5">
          ${locked
            ? '<rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>'
            : '<rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 9.9-1"/>'}
        </svg>
      </button>
      <!-- color dot + name -->
      <div style="width:8px;height:8px;border-radius:50%;background:${col.bg};flex-shrink:0"></div>
      <span style="font-size:12px;font-weight:600;min-width:82px;color:${locked?'var(--primary)':'var(--ink)'}">${c.name}</span>
      <!-- RANGE SLIDER -->
      <input type="range" min="0" max="100" step="1" value="${pct}"
        class="ch-dist-slider" id="sl-${c.id}" ${locked?'disabled':''}
        style="color:${col.bg};accent-color:${col.bg};background:linear-gradient(to right, ${col.bg} 0% ${pct}%, #e0e0e0 ${pct}% 100%)"
        oninput="updateProjDistLive('${c.id}',parseInt(this.value))"
        onchange="setProjDist('${c.id}',parseInt(this.value));renderProjChannelDist();renderProyeccion()">
      <!-- number input -->
      <input type="number" min="0" max="100" step="1" value="${pct}"
        class="ch-dist-pct-input" ${locked?'disabled':''}
        style="${locked?'border-color:var(--primary);color:var(--primary);background:#f0f7f1':''}"
        onfocus="this.select()"
        oninput="updateProjDistLive('${c.id}',parseInt(this.value)||0)"
        onchange="setProjDist('${c.id}',parseInt(this.value)||0);renderProjChannelDist();renderProyeccion()">
      <span style="font-size:11px;color:var(--muted);flex-shrink:0">%</span>

    </div>`;
  }).join('');

  // total bar
  const allOk = total === 100;
  const totalBar = `
    <div style="margin-top:6px;padding-top:8px;border-top:1px solid var(--border)">
      <div style="display:flex;align-items:center;gap:10px;margin-bottom:6px">
        <span style="font-size:11px;color:var(--muted);min-width:100px">Total</span>
        <span class="ch-dist-total-pct" style="font-family:'DM Mono',monospace;font-size:14px;font-weight:700;color:${allOk?'var(--green)':'var(--red)'}">${total}%</span>
        <span class="ch-dist-total-status" style="font-size:11px;color:${allOk?'var(--green)':'var(--red)'}">${allOk?'✓ OK':'⚠ No suma 100%'}</span>
        ${!allOk?`<button onclick="normalizeProjDist()" style="font-size:10px;padding:2px 8px;border-radius:5px;border:1px solid var(--accent);background:var(--secondary);color:var(--accent);cursor:pointer;font-family:'DM Sans',sans-serif">Normalizar</button>`:''}
      </div>
      <div style="height:5px;background:var(--sand2);border-radius:3px;overflow:hidden">
        ${active.map(c=>{
          const pct=projChannelDist[c.id]||0;
          const col=chColor(c.id);
          return `<div class="ch-dist-total-seg" data-chid="${c.id}" style="display:inline-block;height:100%;width:${pct}%;background:${col.bg};transition:width 0.1s"></div>`;
        }).join('')}
      </div>
    </div>`;

  container.innerHTML = rows + totalBar;
}


// ── PROJ MANUAL UNITS ──

function toggleProjMode(isManual) {
  projManualMode = isManual;
  document.getElementById('lbl-ventas-mode').classList.toggle('active', !isManual);
  document.getElementById('lbl-manual-mode').classList.toggle('active', isManual);
  renderProyeccion();
}


function renderProyeccion() {
  initProjDist();
  const gf = totalGF();
  const activeChs = CHANNELS.filter(c=>c.enabled);

  const gfDisp = document.getElementById('proj-gf-display');
  if(gfDisp) gfDisp.textContent = fmt(gf);

  renderProjChannelDist();

  // Build table header with tooltips
  const thead = document.getElementById('proj-thead-row');
  if(thead) thead.innerHTML = `
    <th><span class="tip-wrap" style="color:rgba(255,255,255,0.65)">Producto<span class="tip-box">Nombre del producto. ⭐ = estrella destacada.</span></span></th>
    <th style="${projManualMode ? 'background:var(--accent);' : ''}"><span class="tip-wrap" style="color:${projManualMode ? 'white' : 'rgba(255,255,255,0.65)'}">Unidades/mes${projManualMode ? ' ✏' : ''}<span class="tip-box">${projManualMode ? 'Modo manual activo — editá las unidades directamente en esta columna.' : 'Promedio mensual desde Ventas + GF. Activá el switch "Manual" para editar aquí.'}</span></span></th>` +
    activeChs.map(c=>{
      const comm = Math.round((c.commission||0)*100);
      const sur  = Math.round((c.surcharge||0)*100);
      return `<th style="color:${chColor(c.id).bg}"><span class="tip-wrap tip-left">${c.name}<span class="tip-box">Precio cobrado al cliente: +${sur}% sobre mostrador.<br>Comisión plataforma: ${comm}%.<br>Columna muestra: unidades asignadas + lo que recibís por unidad.</span></span></th>`;
    }).join('') +
    `<th><span class="tip-wrap" style="color:rgba(255,255,255,0.65)">Ingreso neto<span class="tip-box">Suma de lo que vos recibís de todos los canales (precio cobrado − comisión de plataforma × unidades).</span></span></th>
     <th><span class="tip-wrap" style="color:rgba(255,255,255,0.65)">Costo<span class="tip-box">Costo variable total del producto: (costo receta + envases) × unidades. No incluye GF.</span></span></th>
     <th><span class="tip-wrap" style="color:rgba(255,255,255,0.65)">Margen<span class="tip-box">Ingreso neto recibido − costo variable. No descuenta los gastos fijos del mes.</span></span></th>
     <th><span class="tip-wrap" style="color:rgba(255,255,255,0.65)">%<span class="tip-box">Margen como porcentaje del ingreso neto recibido.</span></span></th>
     <th><span class="tip-wrap" style="color:rgba(255,255,255,0.65)">Aporte a GF<span class="tip-box">Cuánto de este producto, con las unidades de este escenario, va a pagar el gasto fijo (unidades × GF asignado por unidad). Margen % alto no significa aporte alto — un producto puede estar bien priciado pero venderse poco y aportar casi nada a cubrir el alquiler.</span></span></th>`;

  // Todos los números salen de computeProjection() (src/core/projection.js): la misma cuenta que usan snapshot, CSV y PDF
  const PJ = computeProjection();
  const tI=PJ.tI, tC=PJ.tC, tM=PJ.tM;
  const {chIncome, chUnits, chGross} = PJ;
  const tbody = document.getElementById('proj-tbody');
  tbody.innerHTML='';
  const labels=[], ingresos=[], costos=[], margenes=[];

  const gfContribTotal=PJ.gfContribTotal;
  const totalUnitsProj=PJ.totalUnits;
  const gfContribRows=[];
  PRODUCTS.forEach((p,i)=>{
    const R = PJ.rows[i];
    const units = R.units, ingTotal = R.ing, cost = R.cost, marg = R.marg, gfContrib = R.gfContrib;
    gfContribRows.push({name:p.name, gfContrib, units});
    const mc = marginColor(ingTotal>0?marg/ingTotal:0);

    labels.push(p.name.length>15?p.name.slice(0,14)+'…':p.name);
    ingresos.push(ingTotal); costos.push(cost); margenes.push(marg);

    const chCells = activeChs.map(c=>{
      const grossBase = channelPrice(p, c.id)||mostradorFinalPrice(p);
      const disc  = effectiveChannelDisc(p, c.id);
      const gross = disc > 0 ? Math.round(grossBase*(1-disc)/50)*50 : grossBase;
      const net   = channelNetReceivedWithDisc(p, c.id) || gross;
      const pct   = projChannelDist[c.id]||0;
      const u     = Math.round(units*pct/100);
      const comm  = Math.round((c.commission||0)*100);
      const col   = chColor(c.id);
      return `<td style="font-size:11px;font-family:'DM Mono',monospace;text-align:center">
        <span class="tip-wrap tip-left">
          <span style="color:${col.bg};font-weight:700">${u}u</span> <span style="color:var(--muted)">· ${fmt(net)}</span>
          <span class="tip-box">Cobrado al cliente: ${fmt(gross)}<br>Tu ingreso neto: ${fmt(net)}<br>Comisión ${comm}%: −${fmt(gross-net)}<br>Ingreso del tramo: ${fmt(u*net)}</span>
        </span>
      </td>`;
    }).join('');

    const unitsCell = projManualMode
      ? `<td style="text-align:center">
          <input class="proj-unit-input" type="number" min="0" step="1" value="${units}"
            data-pid="${p.id}"
            onchange="projManualUnits['${p.id}']=parseInt(this.value)||0;renderProyeccion()"
            onfocus="this.select()"
            title="Unidades manuales para esta proyección">
        </td>`
      : `<td style="font-family:'DM Mono',monospace;font-size:13px;font-weight:600;text-align:center">${units}</td>`;

    const tr=document.createElement('tr');
    if(p.star) tr.classList.add('star-row');
    tr.innerHTML=`<td style="font-size:12px">${p.star?'⭐ ':''}<strong>${p.name}</strong></td>
      ${unitsCell}
      ${chCells}
      <td class="price-cell" style="font-size:12px">
        <span class="tip-wrap">${fmt(ingTotal)}<span class="tip-box">Ingreso neto total del producto: suma de (unidades × % canal × precio neto recibido) de todos los canales activos.</span></span>
      </td>
      <td class="price-cell" style="font-size:12px;color:#888">${fmt(cost)}</td>
      <td data-col="margen"><span class="margin-badge" style="background:${mc.bg};color:${mc.text}">${fmt(marg)}</span></td>
      <td style="font-size:12px;color:${mc.text}">${ingTotal>0?(marg/ingTotal*100).toFixed(1)+'%':'-'}</td>
      <td style="font-size:12px;font-family:'DM Mono',monospace;color:${gfContrib>0?'var(--primary)':'var(--muted)'}">${fmt(gfContrib)}</td>`;
    tbody.appendChild(tr);
  });

  const resultado=tM-gf;
  document.getElementById('proj-tfoot').innerHTML=`<tr><td>TOTALES DEL MES</td><td style="text-align:center">${totalUnitsProj} u.</td>${activeChs.map(()=>'<td></td>').join('')}<td>${fmt(tI)}</td><td>${fmt(tC)}</td><td>${fmt(tM)}</td><td>${tI>0?(tM/tI*100).toFixed(1)+'%':'-'}</td><td>${fmt(gfContribTotal)}</td></tr>`;
  const rc=resultado>=0?'good':'bad';

  // ── HERO: Resultado operativo (jerarqu\u00eda #1) ──
  const heroColor = resultado>=0 ? 'var(--green)' : 'var(--red)';
  const heroIcon = resultado>=0 ? '✓' : '⚠️';
  const heroMsg = resultado>=0 ? 'Ganancia proyectada este mes' : 'P\u00e9rdida proyectada — el margen no cubre el gasto fijo';
  document.getElementById('proj-hero-result').innerHTML = `
    <div style="background:${heroColor}10;border:1.5px solid ${heroColor}40;border-radius:14px;padding:20px 24px;display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:14px">
      <div>
        <div style="font-size:12px;font-weight:600;color:${heroColor};text-transform:uppercase;letter-spacing:0.03em;display:flex;align-items:center;gap:6px">${heroIcon} Resultado operativo del mes</div>
        <div style="font-size:36px;font-weight:800;font-family:'DM Mono',monospace;color:${heroColor};line-height:1.1;margin-top:4px">${fmt(resultado)}</div>
        <div style="font-size:12px;color:var(--muted);margin-top:2px">${heroMsg}</div>
      </div>
      <div style="display:flex;gap:20px;text-align:right">
        <div><div style="font-size:11px;color:var(--muted)">Ganancia diaria</div><div style="font-family:'DM Mono',monospace;font-weight:700;font-size:16px;color:${heroColor}">${fmt(Math.round(resultado/30))}</div></div>
        <div><div style="font-size:11px;color:var(--muted)">Ganancia semanal</div><div style="font-family:'DM Mono',monospace;font-weight:700;font-size:16px;color:${heroColor}">${fmt(Math.round(resultado/4.33))}</div></div>
      </div>
    </div>`;

  // ── GF Coverage bar (misma l\u00f3gica que Men\u00fa) ──
  const covAmt=gfCoverageAmount(); const covPct=gfCoveragePct(); const gfTot=totalGF();
  const diffCov=covAmt-gfTot;
  let covColor, covLabel, covIcon;
  if(covPct<95){ covColor='var(--red)'; covLabel='Déficit — el GF asignado a tus productos no cubre el gasto fijo real'; covIcon='⚠️'; }
  else if(covPct<=105){ covColor='var(--green)'; covLabel='Cubierto — el GF está bien distribuido entre productos'; covIcon='✓'; }
  else { covColor='#2980b9'; covLabel='Superávit — est\u00e1s asignando m\u00e1s GF del necesario'; covIcon='↑'; }
  const covBarPct=Math.min(covPct,150);
  const projDailyGap = diffCov/30;
  document.getElementById('proj-gf-coverage-bar').innerHTML=`
    <div style="width:100%;display:flex;flex-direction:column;gap:10px">
      <div style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:10px">
        <div>
          <div style="font-size:13px;font-weight:700;color:var(--ink);display:flex;align-items:center;gap:6px">${covIcon} Cobertura de Gasto Fijo <span class="tip-wrap" style="font-size:11px;font-weight:600;padding:2px 9px;border-radius:99px;background:${covColor}18;color:${covColor}">${covPct.toFixed(0)}%<span class="tip-box" style="font-weight:500">Este % mide si el reparto de GF entre productos está balanceado — no cambia solo porque el GF total suba o baje (se reajusta proporcionalmente). Mirá el monto en $ ("Falta cubrir"/día) para ver el efecto real de un cambio de GF.</span></span></div>
          <div style="font-size:11px;color:var(--muted);margin-top:2px">${covLabel} · <a href="#" onclick="showPanel('productos');return false" style="color:var(--primary);font-weight:600">Ajustar en Men\u00fa →</a></div>
          <div style="font-size:11px;color:var(--primary);margin-top:4px;font-weight:600">📅 ${diffCov<0?`Te falta cubrir ~${fmt(Math.abs(projDailyGap))}/d\u00eda en promedio para llegar al 100%`:`Ya cubr\u00eds el GF con margen de ~${fmt(projDailyGap)}/d\u00eda extra`}</div>
        </div>
        <div style="text-align:right">
          <div style="font-family:'DM Mono',monospace;font-size:16px;font-weight:700;color:${covColor}">${fmt(covAmt)} <span style="font-size:11px;color:var(--muted);font-weight:400">/ ${fmt(gfTot)}</span></div>
          <div style="font-size:11px;color:var(--muted)">${diffCov>=0?'Superávit':'Falta cubrir'}: ${fmt(Math.abs(diffCov))}/mes</div>
        </div>
      </div>
      <div style="position:relative;height:10px;border-radius:99px;background:var(--sand2,rgba(0,0,0,0.06));overflow:hidden">
        <div style="position:absolute;left:0;top:0;height:100%;width:${(100/150*100).toFixed(2)}%;border-right:2px dashed rgba(0,0,0,0.25)"></div>
        <div style="height:100%;border-radius:99px;background:${covColor};width:${(covBarPct/150*100).toFixed(2)}%;transition:width 0.3s"></div>
      </div>
    </div>`;

  // ── Ganancia extra por Tiers (segunda barra, separada de la cobertura de GF) — usa unidades proyectadas para ser consistente con el Resultado operativo ──
  const tierProfit = tierProfitTotalProj();
  const tierProfitPctOfGF = gfTot>0 ? (tierProfit/gfTot)*100 : 0;
  document.getElementById('proj-gf-coverage-bar').innerHTML += `
    <div style="border-top:1px solid var(--border);margin-top:12px;padding-top:12px">
      <div style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:10px">
        <div>
          <div style="font-size:13px;font-weight:700;color:#8e44ad;display:flex;align-items:center;gap:6px">💰 Ganancia extra por Tiers <span style="font-size:11px;font-weight:600;padding:2px 9px;border-radius:99px;background:#8e44ad18;color:#8e44ad">+${tierProfitPctOfGF.toFixed(0)}% del GF</span></div>
          <div style="font-size:11px;color:var(--muted);margin-top:2px">Ganancia por encima del costo + GF, generada solo por el factor de cada tier</div>
        </div>
        <div style="text-align:right">
          <div style="font-family:'DM Mono',monospace;font-size:16px;font-weight:700;color:#8e44ad">${fmt(tierProfit)}<span style="font-size:11px;color:var(--muted);font-weight:400">/mes</span></div>
        </div>
      </div>
      <div style="position:relative;height:8px;border-radius:99px;background:var(--sand2,rgba(0,0,0,0.06));overflow:hidden;margin-top:8px">
        <div style="height:100%;border-radius:99px;background:#8e44ad;width:${Math.min(100,tierProfitPctOfGF/1.5).toFixed(2)}%;transition:width 0.3s"></div>
      </div>
    </div>`;

  // ── Punto de equilibrio ──
  const avgMarginPerUnit = tI>0 ? tM/PRODUCTS.reduce((s,p)=>s+getProjUnits(p),0) : 0;
  const unitsToBreakeven = avgMarginPerUnit>0 ? Math.ceil(gf/avgMarginPerUnit) : null;
  const revenueToBreakeven = tM>0 && tI>0 ? Math.ceil(gf/(tM/tI)) : null;
  const currentUnits = PRODUCTS.reduce((s,p)=>s+getProjUnits(p),0);
  const ticketProm = currentUnits>0 ? tI/currentUnits : 0;
  const revenueDailyToBreakeven = revenueToBreakeven!=null ? revenueToBreakeven/30 : null;
  const beProgress = unitsToBreakeven ? Math.min(100,(currentUnits/unitsToBreakeven)*100) : 0;
  document.getElementById('proj-breakeven-card').innerHTML = `
    <div class="card">
      <div class="card-header"><div class="card-title tip-wrap">📍 Punto de equilibrio del mes<span class="tip-box">Cuánto necesitás vender este mes para que el margen (ingreso neto − costo de producción) alcance a cubrir el gasto fijo total. Se calcula como GF ÷ margen promedio por unidad. Una vez superado ese punto, todo lo que vendas de más es ganancia neta.</span></div></div>
      <div class="card-body" style="display:flex;gap:24px;flex-wrap:wrap;align-items:center">
        <div style="flex:1;min-width:200px">
          <div style="font-size:11px;color:var(--muted)" class="tip-wrap">Unidades necesarias para cubrir el GF<span class="tip-box">Gasto Fijo ÷ margen promedio por unidad (ingreso neto − costo de producción, sin GF prorrateado). Vendiendo esta cantidad, el margen total iguala al GF del mes.</span></div>
          <div style="font-family:'DM Mono',monospace;font-size:22px;font-weight:700;color:var(--ink)">${unitsToBreakeven!=null?unitsToBreakeven+' u.':'—'}</div>
          <div style="font-size:11px;color:var(--muted)">Proyectadas: ${currentUnits} u. ${unitsToBreakeven!=null?(currentUnits>=unitsToBreakeven?'✓ superado':'faltan '+(unitsToBreakeven-currentUnits)+' u.'):''}</div>
        </div>
        <div style="flex:1;min-width:200px">
          <div style="font-size:11px;color:var(--muted)" class="tip-wrap">Ingreso neto necesario para cubrir el GF<span class="tip-box">Gasto Fijo ÷ margen promedio (%). Es el ingreso neto total que necesitás facturar este mes para que el margen generado alcance a pagar el GF.</span></div>
          <div style="font-family:'DM Mono',monospace;font-size:22px;font-weight:700;color:var(--ink)">${revenueToBreakeven!=null?fmt(revenueToBreakeven):'—'}</div>
          <div style="font-size:11px;color:var(--muted)">Proyectado: ${fmt(tI)} ${revenueToBreakeven!=null?(tI>=revenueToBreakeven?'· ✓ superado por '+fmt(tI-revenueToBreakeven):'· faltan '+fmt(revenueToBreakeven-tI)):''}</div>
        </div>
        <div style="flex:1;min-width:200px">
          <div style="font-size:11px;color:var(--muted)" class="tip-wrap">Ticket promedio necesario<span class="tip-box">Ingreso neto necesario para cubrir el GF, dividido en día (÷30) y por unidad vendida — asumiendo el mismo mix de productos que tenés proyectado.</span></div>
          <div style="font-family:'DM Mono',monospace;font-size:22px;font-weight:700;color:var(--ink)">${fmt(ticketProm)}<span style="font-size:11px;color:var(--muted);font-weight:400"> /unidad</span></div>
          <div style="font-size:11px;color:var(--muted)">Diario: ${revenueDailyToBreakeven!=null?fmt(revenueDailyToBreakeven):'—'} · Mensual: ${revenueToBreakeven!=null?fmt(revenueToBreakeven):'—'}</div>
        </div>
        <div style="flex:1.5;min-width:220px">
          <div style="display:flex;justify-content:space-between;font-size:11px;color:var(--muted);margin-bottom:4px"><span>Avance hacia equilibrio</span><span>${beProgress.toFixed(0)}%</span></div>
          <div style="height:10px;border-radius:99px;background:var(--sand2,rgba(0,0,0,0.06));overflow:hidden">
            <div style="height:100%;border-radius:99px;background:${beProgress>=100?'var(--green)':'var(--accent)'};width:${beProgress}%;transition:width 0.3s"></div>
          </div>
        </div>
      </div>
    </div>`;

  // ── Aporte a GF por producto: quién paga realmente el alquiler en este escenario ──
  const gfContribPct = gf>0 ? (gfContribTotal/gf*100) : 0;
  const gfGap = gf - gfContribTotal;
  const topContrib = [...gfContribRows].filter(r=>r.units>0).sort((a,b)=>b.gfContrib-a.gfContrib).slice(0,5);
  document.getElementById('proj-gf-contrib-card').innerHTML = `
    <div class="card">
      <div class="card-header"><div class="card-title tip-wrap">🏗️ Aporte real a Gastos Fijos (este escenario)<span class="tip-box">Margen % alto ≠ cubrir el GF. Esto suma, para las unidades que pusiste arriba, cuánto aporta cada producto a pagar el gasto fijo (unidades × GF asignado por unidad). Un producto puede estar "verde" de margen y aportar poco si se vende poco.</span></div></div>
      <div class="card-body">
        <div style="display:flex;gap:24px;flex-wrap:wrap;align-items:center;margin-bottom:14px">
          <div style="flex:1;min-width:200px">
            <div style="font-size:11px;color:var(--muted)">Aportado por el mix actual</div>
            <div style="font-family:'DM Mono',monospace;font-size:22px;font-weight:700;color:${gfGap<=0?'var(--green)':'var(--ink)'}">${fmt(gfContribTotal)} <span style="font-size:13px;color:var(--muted)">(${gfContribPct.toFixed(0)}%)</span></div>
            <div style="font-size:11px;color:${gfGap<=0?'var(--green)':'var(--red)'}">${gfGap<=0?'✓ el mix cubre el GF completo':'faltan '+fmt(gfGap)+' para cubrirlo'}</div>
          </div>
          <div style="flex:2;min-width:220px">
            <div style="height:10px;border-radius:99px;background:var(--sand2,rgba(0,0,0,0.06));overflow:hidden">
              <div style="height:100%;border-radius:99px;background:${gfContribPct>=100?'var(--green)':'var(--accent)'};width:${Math.min(100,gfContribPct)}%;transition:width 0.3s"></div>
            </div>
          </div>
        </div>
        <div style="font-size:11px;color:var(--muted);margin-bottom:6px">Top 5 productos que más aportan a cubrir el GF en este escenario</div>
        ${topContrib.map(r=>`
          <div style="display:flex;align-items:center;gap:10px;padding:5px 0;border-bottom:1px solid var(--border)">
            <div style="flex:1;font-size:12px">${r.name}</div>
            <div style="font-size:11px;color:var(--muted)">${r.units} u.</div>
            <div style="font-family:'DM Mono',monospace;font-size:12px;font-weight:700;color:var(--primary);min-width:90px;text-align:right">${fmt(r.gfContrib)}</div>
          </div>`).join('') || '<div style="font-size:12px;color:var(--muted)">Sin unidades proyectadas todav\u00eda.</div>'}
      </div>
    </div>`;


  // KPIs with tooltips
  const gananciaDiaria  = resultado / 30;
  document.getElementById('proj-kpis').innerHTML=`
    <div class="kpi"><div class="kpi-label tip-wrap">Ingresos netos<span class="tip-box">Lo que vos recibís de todas las ventas del mes, ya descontadas las comisiones de cada plataforma.</span></div><div class="kpi-value gold">${fmt(tI)}</div></div>
    <div class="kpi"><div class="kpi-label tip-wrap">Costos variables<span class="tip-box">Costo total de producción (ingredientes + envases + GF asignado × total unidades).</span></div><div class="kpi-value">${fmt(tC)}</div></div>
    <div class="kpi"><div class="kpi-label tip-wrap">Margen bruto<span class="tip-box">Ingresos netos − costos variables. Todavía no se descontaron los gastos fijos del mes.</span></div><div class="kpi-value good">${fmt(tM)}</div></div>
    <div class="kpi"><div class="kpi-label tip-wrap">Margen %<span class="tip-box">Margen bruto como porcentaje del ingreso neto recibido. Objetivo saludable: > 40%.</span></div><div class="kpi-value good">${tI>0?(tM/tI*100).toFixed(1)+'%':'—'}</div></div>
    <div class="kpi"><div class="kpi-label tip-wrap">Gastos fijos<span class="tip-box">Total neto de gastos fijos del mes (operativos + sueldos). Se resta del margen bruto para obtener el resultado operativo.</span></div><div class="kpi-value">${fmt(gf)}</div></div>
    <div class="kpi"><div class="kpi-label tip-wrap">Ticket promedio<span class="tip-box">Ingreso neto total ÷ unidades totales vendidas. Cuánto te deja en promedio cada unidad vendida, mezclando todos los canales.</span></div><div class="kpi-value gold">${fmt(currentUnits>0?tI/currentUnits:0)}</div></div>`;

  // ── Ticket promedio por canal + lo que necesita cada canal para cubrir su parte del GF ──
  const activeChsKpi = CHANNELS.filter(c=>c.enabled);
  document.getElementById('proj-kpis').innerHTML += `
    <div class="card" style="grid-column:1/-1;margin-top:4px">
      <div class="card-header"><div class="card-title tip-wrap">Ticket promedio por canal<span class="tip-box">Para cada canal: "neto" es lo que VOS recibís por unidad (ya con la comisión de la plataforma descontada); "precio al cliente" es lo que la persona paga en esa app (con el sobrecargo de canal ya sumado). La diferencia entre ambos es la comisión que se lleva la plataforma. También cuánto necesita ESE canal para cubrir su parte del punto de equilibrio, según su % de distribución.</span></div></div>
      <div style="font-size:11px;color:var(--muted);padding:0 20px;margin-top:-4px">"Neto" = lo que te queda después de la comisión · "Precio al cliente" = lo que paga la persona en esa app (comisión ya sumada) · "Para equilibrio" = lo mínimo que ese canal necesita vender este mes, manteniendo su % de distribución, para que el total llegue a cubrir el GF.</div>
      <div class="card-body" style="display:flex;gap:16px;flex-wrap:wrap">
        ${activeChsKpi.map(c=>{
          const u = chUnits[c.id]||0; const inc = chIncome[c.id]||0; const gross = chGross[c.id]||0;
          const tp = u>0 ? inc/u : 0;
          const tpGross = u>0 ? gross/u : 0;
          const pct = (projChannelDist[c.id]||0)/100;
          const unitsNeededC = unitsToBreakeven!=null ? Math.ceil(unitsToBreakeven*pct) : null;
          const revNeededC = revenueToBreakeven!=null ? revenueToBreakeven*pct : null;
          const col = chColor(c.id);
          return `<div style="flex:1;min-width:160px;border-left:3px solid ${col.bg};padding-left:10px">
            <div style="font-size:11px;color:var(--muted)">${c.name} <span style="opacity:0.7">(${(pct*100).toFixed(0)}%)</span></div>
            <div style="font-family:'DM Mono',monospace;font-size:16px;font-weight:700;color:var(--ink)">${u>0?fmt(tp):'—'}<span style="font-size:10px;color:var(--muted);font-weight:400"> /u neto</span></div>
            <div style="font-family:'DM Mono',monospace;font-size:12px;font-weight:600;color:var(--muted)">${u>0?fmt(tpGross):'—'}<span style="font-size:10px;font-weight:400"> /u precio al cliente</span></div>
            <div style="font-size:10px;color:var(--muted);margin-top:4px">Para equilibrio: ${unitsNeededC!=null?unitsNeededC+' u.':'—'} · ${revNeededC!=null?fmt(revNeededC):'—'}/mes</div>
            ${(()=>{ const target=tI*pct; const semColor='#2a7d2e'; const semIcon='✓'; return `<div style="margin-top:6px;padding:6px 8px;border-radius:8px;background:${semColor}12;border:1px solid ${semColor}35">
              <div style="font-size:9px;color:${semColor};font-weight:700;display:flex;align-items:center;gap:4px">${semIcon} Para ingreso neto total (${fmt(tI)})</div>
              <div style="font-size:10px;color:var(--ink);font-weight:600;margin-top:2px">${u>0?Math.ceil(target/tp)+' u.':'—'} · ${fmt(target)}/mes</div>
            </div>`; })()}
          </div>`;
        }).join('')}
      </div>
    </div>`;

  mkChart('chart-proj-ing',{type:'bar',data:{labels,datasets:[{label:'Ingreso neto',data:ingresos,backgroundColor:'#F28C0088',borderColor:'#F28C00',borderWidth:1,borderRadius:3}]},options:{responsive:true,maintainAspectRatio:false,plugins:{legend:{display:false},tooltip:{callbacks:{label:ctx=>`Ingreso neto: ${fmt(ctx.parsed.y)}`}}},scales:{x:{ticks:{font:{size:9},maxRotation:45}},y:{ticks:{callback:v=>'$'+(v/1000).toFixed(0)+'k',font:{size:10}}}}}});
  mkChart('chart-proj-mc',{type:'bar',data:{labels,datasets:[{label:'Costo',data:costos,backgroundColor:'#c0392b55',borderColor:'#c0392b',borderWidth:1,borderRadius:2},{label:'Margen neto',data:margenes,backgroundColor:'#23532855',borderColor:'#235328',borderWidth:1,borderRadius:2}]},options:{responsive:true,maintainAspectRatio:false,plugins:{legend:{display:true,position:'top',labels:{boxWidth:10,font:{size:10}}}},scales:{x:{ticks:{font:{size:9},maxRotation:45}},y:{ticks:{callback:v=>'$'+(v/1000).toFixed(0)+'k',font:{size:10}}}}}});
  mkChart('chart-proj-res',{type:'bar',data:{labels:['Ingresos netos','Costos variables','Margen bruto','Gastos fijos','Resultado'],datasets:[{data:[Math.round(tI),Math.round(tC),Math.round(tM),Math.round(gf),Math.round(resultado)],backgroundColor:['#F28C0088','#c0392b55','#23532855','#2980b955',resultado>=0?'#23532888':'#c0392b88'],borderColor:['#F28C00','#c0392b','#235328','#2980b9',resultado>=0?'#235328':'#c0392b'],borderWidth:1,borderRadius:5}]},options:{indexAxis:'y',responsive:true,maintainAspectRatio:false,plugins:{legend:{display:false},tooltip:{callbacks:{label:ctx=>`${fmt(ctx.parsed.x)}`}}},scales:{x:{ticks:{callback:v=>'$'+(v/1000000).toFixed(2)+'M',font:{size:10}}},y:{ticks:{font:{size:11}}}}}});
}

// ═══════════════════════════════════════════════════════
// VENTAS + GF
// ═══════════════════════════════════════════════════════
function setVentasView(v) {
  ventasView=v;
  document.getElementById('vv-grilla').className='view-btn'+(v==='grilla'?' active':'');
  document.getElementById('vv-lista').className='view-btn'+(v==='lista'?' active':'');
  document.getElementById('ventas-grid').className='ventas-grid'+(v==='grilla'?' vis':'');
  document.getElementById('ventas-list').className='ventas-list'+(v==='lista'?' vis':'');
  renderVentas();
}
function renderVentas() {
  const gf=totalGFRaw(); const tot=totalGFPct(); const totalU=PRODUCTS.reduce((s,p)=>s+(p.avgMes||0),0);
  const gfPerU=totalU>0?gf/totalU:0;
  const gfPP=gfPerProduct();

  let tI=0, tC=0;
  PRODUCTS.forEach(p=>{ const u=p.avgMes||0; tI+=u*mostradorFinalPrice(p); tC+=u*costPerUnit(p); });
  const ticketProm = totalU>0 ? tI/totalU : 0;

  // ── Cobertura de GF (básico) ──
  const covAmt=gfCoverageAmount(); const covPct=gfCoveragePct(); const gfTot=totalGF();
  const diff=covAmt-gfTot;
  let covColor, covLabel, covIcon;
  if(covPct<95){ covColor='var(--red)'; covLabel='Déficit — el GF asignado a tus productos no cubre el gasto fijo real'; covIcon='⚠️'; }
  else if(covPct<=105){ covColor='var(--green)'; covLabel='Cubierto — el GF está bien distribuido entre productos'; covIcon='✓'; }
  else { covColor='#2980b9'; covLabel='Superávit — estás asignando más GF del necesario'; covIcon='↑'; }
  const covBarPct=Math.min(covPct,150);
  const dailyGap = diff/30;
  document.getElementById('ventas-gf-coverage-bar').innerHTML=`
    <div style="width:100%;display:flex;flex-direction:column;gap:10px">
      <div style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:10px">
        <div>
          <div style="font-size:13px;font-weight:700;color:var(--ink);display:flex;align-items:center;gap:6px">${covIcon} Cobertura de Gasto Fijo <span class="tip-wrap" style="font-size:11px;font-weight:600;padding:2px 9px;border-radius:99px;background:${covColor}18;color:${covColor}">${covPct.toFixed(0)}%<span class="tip-box" style="font-weight:500">Este % mide si el reparto de GF entre productos está balanceado — no cambia solo porque el GF total suba o baje. Mirá el monto en $ para ver el efecto real de un cambio de GF.</span></span></div>
          <div style="font-size:11px;color:var(--muted);margin-top:2px">${covLabel}</div>
          <div style="font-size:11px;color:var(--primary);margin-top:4px;font-weight:600">📅 ${diff<0?`Te falta cubrir ~${fmt(Math.abs(dailyGap))}/día en promedio para llegar al 100%`:`Ya cubrís el GF con margen de ~${fmt(dailyGap)}/día extra`}</div>
        </div>
        <div style="text-align:right">
          <div style="font-family:'DM Mono',monospace;font-size:16px;font-weight:700;color:${covColor}">${fmt(covAmt)} <span style="font-size:11px;color:var(--muted);font-weight:400">/ ${fmt(gfTot)}</span></div>
          <div style="font-size:11px;color:var(--muted)">${diff>=0?'Superávit':'Falta cubrir'}: ${fmt(Math.abs(diff))}/mes</div>
        </div>
      </div>
      <div style="position:relative;height:10px;border-radius:99px;background:var(--sand2,rgba(0,0,0,0.06));overflow:hidden">
        <div style="position:absolute;left:0;top:0;height:100%;width:${(100/150*100).toFixed(2)}%;border-right:2px dashed rgba(0,0,0,0.25)"></div>
        <div style="height:100%;border-radius:99px;background:${covColor};width:${(covBarPct/150*100).toFixed(2)}%;transition:width 0.3s"></div>
      </div>
    </div>`;

  document.getElementById('ventas-gf-summary').innerHTML=`
    <div style="display:flex;gap:16px;flex-wrap:wrap;width:100%">
      <div style="flex:1;min-width:140px">
        <div class="gf-remaining-label">Total Gastos Fijos</div>
        <div class="gf-remaining-val">${fmt(gf)}</div>
        <div style="font-size:11px;color:var(--muted)">% GF asignado total: ${tot}%</div>
      </div>
      <div style="flex:1;min-width:140px;border-left:1px solid rgba(242,140,0,0.3);padding-left:14px">
        <div class="gf-remaining-label">GF / Cant. de Productos (promedio)</div>
        <div class="gf-remaining-val">${fmt(gfPP)}</div>
        <div style="font-size:11px;color:var(--muted)">GF ÷ ${gfUnitsBase()} u. de productos que absorben GF</div>
      </div>
      <div style="flex:1;min-width:140px;border-left:1px solid rgba(242,140,0,0.3);padding-left:14px">
        <div class="gf-remaining-label">Ticket promedio</div>
        <div class="gf-remaining-val">${fmt(ticketProm)}</div>
        <div style="font-size:11px;color:var(--muted)">Ingreso neto ÷ ${totalU} u./mes</div>
      </div>
      <div style="flex:1;min-width:140px;border-left:1px solid rgba(242,140,0,0.3);padding-left:14px">
        <div class="gf-remaining-label">Total unidades/mes</div>
        <div class="gf-remaining-val">${totalU} u.</div>
        <div style="font-size:11px;color:var(--muted)">Suma de todos los productos</div>
      </div>
    </div>`;
  if(ventasView==='grilla') renderVentasGrilla(); else renderVentasLista();
}
function renderVentasGrilla() {
  const g=document.getElementById('ventas-grid'); g.innerHTML='';
  PRODUCTS.forEach((p,i)=>{
    const gfa=gfAssigned(p); const mp=mostradorFinalPrice(p);
    const ingMes=(p.avgMes||0)*mp; const costoMes=(p.avgMes||0)*(costPerUnit(p)+gfa);
    const margenMes=ingMes-costoMes; const gfPU=gfa;
    const div=document.createElement('div'); div.className='venta-card';
    div.innerHTML=`
      <div class="venta-header"><div class="venta-name">${p.star?'⭐ ':''}${p.name}</div><span class="gf-pct-badge">${p.avgMes||0} u/mes</span></div>
      <div class="venta-row"><label>Promedio mensual (u.)</label><input class="venta-input" type="number" value="${p.avgMes||0}" min="0" step="1" onchange="PRODUCTS[${i}].avgMes=parseInt(this.value)||0;renderVentas()"></div>
      <div class="venta-row"><label>Absorbe GF</label><label class="toggle" title="Si está activo, este producto absorbe parte del gasto fijo en su precio"><input type="checkbox" ${absorbsGF(p)?'checked':''} onchange="PRODUCTS[${i}].absorbeGF=this.checked;recalcAll();renderVentas();scheduleSave()"><span class="toggle-slider"></span></label></div>
      <div class="venta-row"><label>GF / unidad vendida</label><span style="font-family:'DM Mono',monospace;font-size:12px;color:var(--accent)">${fmt(gfPU)}</span></div>
      <div class="venta-row"><label>Precio mostrador</label><span style="font-family:'DM Mono',monospace;font-size:13px;color:var(--primary)">${fmt(mp)}<button class="why-btn" onclick="event.stopPropagation();window.sahtenWhy&&sahtenWhy('${p.id}')" title="¿De dónde sale este precio?">?</button></span></div>
      <div class="venta-row"><label>Ingreso est./mes</label><span style="font-family:'DM Mono',monospace;font-size:13px;color:var(--green)">${fmt(ingMes)}</span></div>
      <div class="venta-row"><label>GF asignado (mes)</label><span style="font-family:'DM Mono',monospace;font-size:12px;color:var(--accent)">${fmt(gfa)}</span></div>
      <div class="venta-row"><label>Margen neto est./mes</label><span style="font-family:'DM Mono',monospace;font-size:13px;font-weight:600;color:${margenMes>=0?'var(--green)':'var(--red)'}">${fmt(margenMes)}</span></div>
      <div style="margin-top:10px;border-top:1px solid var(--border);padding-top:10px">
        <div style="font-size:10px;color:var(--muted);margin-bottom:6px;text-transform:uppercase;letter-spacing:0.3px">Precios por canal</div>
        <div style="display:flex;flex-wrap:wrap;gap:4px">${CHANNELS.filter(c=>c.enabled).map(c=>{const cp=channelPrice(p,c.id)||mp;const col=chColor(c.id);return`<div style="background:${col.bg};color:${col.text};border-radius:6px;padding:3px 8px;font-size:11px"><span style="opacity:0.8;font-size:9px">${c.name} </span><strong>${fmt(cp)}</strong></div>`;}).join('')}</div>
      </div>
      <button class="btn" style="width:100%;margin-top:10px;font-size:11px;border-color:var(--accent);color:var(--accent)" onclick="openRecipe(${i})">✏ Editar receta</button>`;
    g.appendChild(div);
  });
}
function renderVentasLista() {
  const body=document.getElementById('ventas-list-body');
  body.innerHTML=PRODUCTS.map((p,i)=>{
    const gfa=gfAssigned(p); const mp=mostradorFinalPrice(p);
    const ingMes=(p.avgMes||0)*mp; const costoMes=(p.avgMes||0)*(costPerUnit(p)+gfa);
    const margenMes=ingMes-costoMes; const gfPU=gfa;
    const m=marginPct(mp,costPerUnit(p)+gfa); const mc=marginColor(m);
    return`<div class="vl-row${p.star?' vl-row-star':''}">
      <div class="vl-name">${p.star?'⭐ ':''}${p.name}</div>
      <div class="vl-field"><span class="vl-label">Absorbe GF</span><label class="toggle" title="Si está activo, este producto absorbe parte del gasto fijo en su precio"><input type="checkbox" ${absorbsGF(p)?'checked':''} onchange="PRODUCTS[${i}].absorbeGF=this.checked;recalcAll();renderVentas();scheduleSave()"><span class="toggle-slider"></span></label></div>
      <div class="vl-field"><span class="vl-label">Unid/mes</span><input class="stock-input" type="number" value="${p.avgMes||0}" min="0" style="width:65px" onchange="PRODUCTS[${i}].avgMes=parseInt(this.value)||0;renderVentas()"></div>
      <div class="vl-field"><span class="vl-label">GF/unidad</span>
        <div style="display:flex;align-items:center;gap:4px">
          <input class="stock-input" type="number" value="${p.gfPctOverride!=null?p.gfPctOverride.toFixed(0):'100'}" min="0" max="500" step="5" style="width:52px" title="% del GF base. 100% = ${fmt(gfPerUnit())}" onchange="const v=parseFloat(this.value);PRODUCTS[${i}].gfPctOverride=(isNaN(v)||v===100)?null:v;renderVentas();renderDashboard()">
          <span style="font-size:11px;color:var(--muted)">%</span>
          <span class="vl-val" style="color:var(--accent)">${fmt(gfPU)}</span>
        </div>
      </div>
      <div class="vl-field"><span class="vl-label">Ajuste precio</span><div style="display:flex;align-items:center;gap:4px"><input class="stock-input" type="number" step="1" style="width:56px" title="Ajuste sobre el precio del tier (lo usa el asistente de estrategia). 0 = sin ajuste" value="${Math.round(((p.priceAdj||1)-1)*1000)/10}" onchange="PRODUCTS[${i}].priceAdj=1+(parseFloat(this.value)||0)/100;recalcAll();renderVentas();scheduleSave()"><span style="font-size:11px;color:var(--muted)">%</span></div></div>
      <div class="vl-field"><span class="vl-label">Precio</span><span class="vl-val" style="color:var(--primary)">${fmt(mp)}<button class="why-btn" onclick="event.stopPropagation();window.sahtenWhy&&sahtenWhy('${p.id}')" title="¿De dónde sale este precio?">?</button></span></div>
      <div class="vl-field"><span class="vl-label">Ingreso/mes</span><span class="vl-val" style="color:var(--green)">${fmt(ingMes)}</span></div>
      <div class="vl-field"><span class="vl-label">Margen neto</span><span class="vl-val" style="color:${margenMes>=0?'var(--green)':'var(--red)'};font-weight:600">${fmt(margenMes)}</span></div>
      <div class="vl-field"><span class="vl-label">%</span><span class="margin-badge" style="background:${mc.bg};color:${mc.text}">${(m*100).toFixed(1)}%</span></div>
      <button class="btn" style="padding:4px 8px;font-size:11px;border-color:var(--accent);color:var(--accent)" onclick="openRecipe(${i})">Receta</button>
    </div>`;
  }).join('');
}

// ═══════════════════════════════════════════════════════
// STOCK
// ═══════════════════════════════════════════════════════
function setStockView(v) {
  stockView=v;
  if (typeof _saveTabState === 'function') _saveTabState('stockView', v);
  document.getElementById('sv-tabla').className='s2-tab'+(v==='tabla'?' active':'');
  document.getElementById('sv-grilla').className='s2-tab'+(v==='grilla'?' active':'');
  renderStock();
}

let movFilter = 'todo';
function setMovFilter(f) {
  movFilter = f;
  ['hoy','sem','mes','todo'].forEach(id=>{
    const el=document.getElementById('mh-'+id);
    if(el) el.className='view-btn'+(id===f||(f==='semana'&&id==='sem')?' active':'');
  });
  renderStock();
}
function renderStock() {
  initStock();
  const cat = (typeof stockTabCat !== 'undefined') ? stockTabCat : 'ingredientes';
  const filter=document.getElementById('stock-filter')?.value||'all';
  const search=(document.getElementById('stock-search')?.value||'').toLowerCase();

  // Build source list based on active tab
  let sourceList = [];
  let catLabel = 'Ingredientes';
  let pricePerUnit = (item) => item.precioPkg / item.grPaquete; // default for ingredientes

  if (cat === 'ingredientes') {
    sourceList = INGREDIENTES;
    catLabel = 'Ingredientes';
    pricePerUnit = (item) => item.precioPkg / (item.grPaquete || 1);
  } else if (cat === 'envases') {
    sourceList = (typeof ENVASES !== 'undefined') ? ENVASES : [];
    catLabel = 'Envases';
    pricePerUnit = (item) => item.precioPkg / (item.cantidad || 1);
  } else if (cat === 'productos') {
    sourceList = (typeof PRODUCTS !== 'undefined') ? PRODUCTS.filter(p => !p.recetaOnly) : [];
    catLabel = 'Productos';
    pricePerUnit = (item) => parseFloat(item.precio) || 0;
  }

  const items = sourceList.filter(item => {
    if (search && !item.name.toLowerCase().includes(search)) return false;
    const s = STOCK[item.id];
    if (!s) return true;
    if (filter === 'low') return s.actual > 0 && s.actual < s.minimo;
    if (filter === 'out') return s.actual <= 0;
    if (filter === 'ok') return s.actual >= s.minimo;
    return true;
  });

  const outN = sourceList.filter(i => STOCK[i.id]?.actual <= 0).length;
  const lowN = sourceList.filter(i => { const s = STOCK[i.id]; return s && s.actual > 0 && s.actual < s.minimo; }).length;
  const valor = sourceList.reduce((sum, item) => {
    const s = STOCK[item.id]; if (!s || s.actual <= 0) return sum;
    return sum + s.actual * pricePerUnit(item);
  }, 0);

  document.getElementById('stock-kpis').innerHTML = `
    <div class="kpi"><div class="kpi-label">Total ${catLabel.toLowerCase()}</div><div class="kpi-value gold">${sourceList.length}</div></div>
    <div class="kpi"><div class="kpi-label">Stock OK</div><div class="kpi-value good">${sourceList.length - outN - lowN}</div></div>
    <div class="kpi"><div class="kpi-label">Stock bajo</div><div class="kpi-value" style="color:#d68910">${lowN}</div></div>
    <div class="kpi"><div class="kpi-label">Sin stock</div><div class="kpi-value bad">${outN}</div></div>
    <div class="kpi"><div class="kpi-label">Valor del stock</div><div class="kpi-value gold">${fmt(valor)}</div></div>
    <div class="kpi"><div class="kpi-label">Movimientos</div><div class="kpi-value">${MOVIMIENTOS.length}</div>`;

  const cont = document.getElementById('stock-content');
  const defaultUnit = cat === 'ingredientes' ? 'g' : 'u';

  if (stockView === 'tabla') {
    const unitSel = (id, u) => `<select style="border:1px solid var(--border);border-radius:5px;padding:2px 4px;font-size:11px;background:white;outline:none;color:var(--muted)" onchange="STOCK['${id}'].unit=this.value;renderStock()"><option value="g" ${u==='g'?'selected':''}>g</option><option value="kg" ${u==='kg'?'selected':''}>kg</option><option value="L" ${u==='L'?'selected':''}>L</option><option value="u" ${u==='u'?'selected':''}>u</option></select>`;
    const colPrice = cat === 'productos' ? 'Precio venta' : '$/kg';
    cont.innerHTML = `<div class="card"><div class="table-wrap"><table class="stock-table"><thead><tr><th>${catLabel.slice(0, -1)}</th><th>Stock actual</th><th>Unidad</th><th>Mínimo</th><th>Estado</th><th>Valor stock</th><th>${colPrice}</th><th style="width:44px"></th></tr></thead><tbody>${items.map(item => {
      const s = STOCK[item.id] || { actual: 0, minimo: 0, unit: defaultUnit };
      const ppu = pricePerUnit(item);
      const val = s.actual * ppu;
      let sb, st, sl, rc = '';
      if (s.actual <= 0) { sb = '#fde8e6'; st = '#c0392b'; sl = 'Sin stock'; rc = 'out-stock'; }
      else if (s.minimo > 0 && s.actual < s.minimo) { sb = '#fff8e1'; st = '#d68910'; sl = 'Bajo'; rc = 'low-stock'; }
      else { sb = '#d6eed7'; st = '#235328'; sl = 'OK'; }
      const pct = s.minimo > 0 ? Math.min(100, Math.round(s.actual / s.minimo * 100)) : 0;
      const priceDisplay = cat === 'productos' ? fmt(ppu) : fmt(ppu * 1000);
      return `<tr class="${rc}"><td><strong>${item.name}</strong></td>
        <td><div style="display:flex;gap:6px;align-items:center"><input class="stock-input" type="number" value="${s.actual}" min="0" step="1" onchange="STOCK['${item.id}'].actual=parseFloat(this.value)||0;renderStock()"></div><div class="stock-bar"><div class="stock-bar-fill" style="width:${pct}%;background:${st}"></div></div></td>
        <td>${unitSel(item.id, s.unit || defaultUnit)}</td>
        <td><div style="display:flex;gap:6px;align-items:center"><input class="stock-input" type="number" value="${s.minimo}" min="0" step="1" onchange="STOCK['${item.id}'].minimo=parseFloat(this.value)||0;renderStock()"></div></td>
        <td><span class="stock-alert" style="background:${sb};color:${st}">${sl}</span></td>
        <td style="font-family:'DM Mono',monospace;font-size:12px">${fmt(val)}</td>
        <td style="font-family:'DM Mono',monospace;font-size:12px">${priceDisplay}</td>
        <td><button class="btn" style="padding:3px 8px;font-size:11px" onclick="quickMov('${item.id}','${item.name}','ingreso')">+ In</button> <button class="btn btn-danger" style="padding:3px 8px;font-size:11px" onclick="quickMov('${item.id}','${item.name}','egreso')">- Out</button></td></tr>`;
    }).join('')}</tbody></table></div></div>`;
  } else {
    cont.innerHTML = `<div class="stock-grid-cards">${items.map(item => {
      const s = STOCK[item.id] || { actual: 0, minimo: 0, unit: defaultUnit };
      const ppu = pricePerUnit(item);
      const val = s.actual * ppu;
      let sb, st, sl;
      if (s.actual <= 0) { sb = '#fde8e6'; st = '#c0392b'; sl = 'Sin stock'; }
      else if (s.minimo > 0 && s.actual < s.minimo) { sb = '#fff8e1'; st = '#d68910'; sl = 'Stock bajo'; }
      else { sb = '#d6eed7'; st = '#235328'; sl = 'OK ✓'; }
      const pct = s.minimo > 0 ? Math.min(100, Math.round(s.actual / s.minimo * 100)) : 0;
      const u = s.unit || defaultUnit;
      return `<div class="stock-card" style="border-top:3px solid ${st}">
        <div class="stock-card-header"><div class="stock-card-name">${item.name}</div><span class="stock-alert" style="background:${sb};color:${st}">${sl}</span></div>
        <div class="stock-bar" style="margin-bottom:10px"><div class="stock-bar-fill" style="width:${pct}%;background:${st}"></div></div>
        <div class="stock-row"><label>Unidad de medida</label><select style="border:1px solid var(--border);border-radius:5px;padding:3px 6px;font-size:12px;background:var(--card,white);color:var(--ink);outline:none" onchange="STOCK['${item.id}'].unit=this.value;renderStock()"><option value="g" ${u==='g'?'selected':''}>gramos (g)</option><option value="kg" ${u==='kg'?'selected':''}>kilos (kg)</option><option value="L" ${u==='L'?'selected':''}>litros (L)</option><option value="u" ${u==='u'?'selected':''}>unidades (u)</option></select></div>
        <div class="stock-row"><label>Stock actual (${u})</label><input class="stock-input" type="number" value="${s.actual}" min="0" step="1" onchange="STOCK['${item.id}'].actual=parseFloat(this.value)||0;renderStock()"></div>
        <div class="stock-row"><label>Mínimo (${u})</label><input class="stock-input" type="number" value="${s.minimo}" min="0" step="1" onchange="STOCK['${item.id}'].minimo=parseFloat(this.value)||0;renderStock()"></div>
        <div class="stock-row"><label>Valor</label><span style="font-family:'DM Mono',monospace;font-size:12px;color:var(--accent)">${fmt(val)}</span></div>
        <div style="display:flex;gap:6px;margin-top:10px">
          <button class="btn" style="flex:1;padding:5px;font-size:11px" onclick="quickMov('${item.id}','${item.name}','ingreso')">+ Ingreso</button>
          <button class="btn btn-danger" style="flex:1;padding:5px;font-size:11px" onclick="quickMov('${item.id}','${item.name}','egreso')">- Egreso</button>
        </div>
      </div>`;
    }).join('')}</div>`;
  }
  // Populate ingredient filter select
  const ingFilterSel = document.getElementById('stock-mov-filter-ing');
  if(ingFilterSel) {
    const curVal = ingFilterSel.value;
    ingFilterSel.innerHTML = '<option value="">Todos los ingredientes</option>' +
      INGREDIENTES.map(ing=>`<option value="${ing.name}" ${curVal===ing.name?'selected':''}>${ing.name}</option>`).join('');
  }
  const ingFilterVal = ingFilterSel?.value || '';

  const mcolors={ingreso:'#d6eed7',egreso:'#fde8e6',ajuste:'#d6eaf8',merma:'#fff8e1'};
  const mtexts={ingreso:'#235328',egreso:'#c0392b',ajuste:'#2980b9',merma:'#d68910'};
  const now = new Date();
  const todayStr = now.toLocaleDateString('es-AR');
  const filtered = [...MOVIMIENTOS].reverse().filter(m=>{
    if(ingFilterVal && m.ing !== ingFilterVal) return false;
    if(movFilter==='hoy') return m.fecha.startsWith(todayStr);
    if(movFilter==='semana') {
      const d=m.fecha.split(' ')[0].split('/');
      const md=new Date(+d[2],+d[1]-1,+d[0]);
      const diff=(now-md)/(1000*60*60*24);
      return diff<=7;
    }
    if(movFilter==='mes') {
      const d=m.fecha.split(' ')[0].split('/');
      const md=new Date(+d[2],+d[1]-1,+d[0]);
      return md.getMonth()===now.getMonth()&&md.getFullYear()===now.getFullYear();
    }
    return true;
  });

  // Group by date for summary
  const byDate={};
  filtered.forEach(m=>{
    const d=m.fecha.split(' ')[0];
    if(!byDate[d])byDate[d]={ingresos:0,egresos:0,mermas:0,count:0};
    byDate[d].count++;
    if(m.tipo==='ingreso')byDate[d].ingresos+=Math.abs(m.qty);
    else if(m.tipo==='egreso')byDate[d].egresos+=Math.abs(m.qty);
    else if(m.tipo==='merma')byDate[d].mermas+=Math.abs(m.qty);
  });

  const movTbody=document.getElementById('stock-movs');
  movTbody.innerHTML=filtered.length?filtered.map(m=>`<tr>
    <td style="font-family:'DM Mono',monospace;font-size:11px">${m.fecha}</td>
    <td><strong>${m.ing}</strong></td>
    <td><span class="mov-badge" style="background:${mcolors[m.tipo]||'#eee'};color:${mtexts[m.tipo]||'#555'}">${m.tipo}</span></td>
    <td style="font-family:'DM Mono',monospace;color:${m.qty>=0?'var(--green)':'var(--red)'}">${m.qty>=0?'+':''}${m.qty.toLocaleString('es-AR')} ${m.unit||'g'}</td>
    <td style="color:var(--muted);font-size:12px">${m.nota||'-'}</td>
  </tr>`).join(''):'<tr><td colspan="5" style="text-align:center;color:var(--muted);padding:20px">Sin movimientos en este período</td></tr>';

  // Summary bar
  const sumEl = document.getElementById('stock-mov-summary');
  if(sumEl) {
    const totIn=Object.values(byDate).reduce((s,d)=>s+d.ingresos,0);
    const totEg=Object.values(byDate).reduce((s,d)=>s+d.egresos,0);
    const totMer=Object.values(byDate).reduce((s,d)=>s+d.mermas,0);
    sumEl.innerHTML=`
      <span style="color:var(--green);font-weight:600">↑ Ingresos: ${totIn.toLocaleString('es-AR')}</span>
      <span style="color:var(--red);font-weight:600">↓ Egresos: ${totEg.toLocaleString('es-AR')}</span>
      <span style="color:#d68910;font-weight:600">⚠ Mermas: ${totMer.toLocaleString('es-AR')}</span>
      <span style="color:var(--muted)">${filtered.length} movimientos · ${Object.keys(byDate).length} días</span>`;
  }
}
function showStockModal() {
  initStock();
  document.getElementById('sm-ing').innerHTML=INGREDIENTES.map(ing=>`<option value="${ing.id}">${ing.name}</option>`).join('');
  document.getElementById('sm-qty').value='1000';
  document.getElementById('sm-nota').value='';
  document.getElementById('stock-modal').classList.add('open');
}
function closeStockModal() { document.getElementById('stock-modal').classList.remove('open'); }

// ═══════════════════════════════════════════════════════
// IMPRESIÓN DE CONTROL DE INVENTARIO (Stock)
// ═══════════════════════════════════════════════════════
function buildStockPrintDoc(template) {
  const now = new Date();
  const fecha = now.toLocaleDateString('es-AR', {weekday:'long', year:'numeric', month:'long', day:'numeric'});
  const hora  = now.toLocaleTimeString('es-AR', {hour:'2-digit', minute:'2-digit'});
  const ts    = now.toLocaleDateString('es-AR').replace(/\//g,'-');

  const header = `
    <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:18px;padding-bottom:14px;border-bottom:3px solid #235328">
      <div>
        <div style="font-family:-apple-system,BlinkMacSystemFont,'SF Pro Display','DM Sans',sans-serif;font-size:22px;font-weight:700;color:#235328;letter-spacing:-0.02em">Sahten</div>
        <div style="font-size:10px;color:#888;letter-spacing:1px;text-transform:uppercase">Control de Inventario · ${template==='alimentos'?'Alimentos e Ingredientes':'Papelería e Insumos'}</div>
      </div>
      <div style="text-align:right">
        <div style="font-size:12px;font-weight:600;color:#1e2c1f">${fecha}</div>
        <div style="font-size:11px;color:#888">Impreso a las ${hora}</div>
        <div style="margin-top:6px;background:#235328;color:white;font-size:10px;font-weight:700;padding:3px 10px;border-radius:99px;display:inline-block;letter-spacing:0.5px">USO INTERNO · CONFIDENCIAL</div>
      </div>
    </div>`;

  // KPI strip
  const valor = INGREDIENTES.reduce((sum,ing)=>{
    const s=STOCK[ing.id]; if(!s||s.actual<=0) return sum;
    return sum+(s.actual*(ing.precioPkg/ing.grPaquete));
  },0);
  const outN = INGREDIENTES.filter(i=>STOCK[i.id]?.actual<=0).length;
  const lowN = INGREDIENTES.filter(i=>{const s=STOCK[i.id];return s&&s.actual>0&&s.actual<s.minimo;}).length;
  const kpi = `
    <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:10px;margin-bottom:18px">
      ${[
        ['Total ingredientes', INGREDIENTES.length, '#235328'],
        ['Stock OK', INGREDIENTES.length-outN-lowN, '#2a7d2e'],
        ['Stock bajo', lowN, '#d68910'],
        ['Sin stock', outN, '#c0392b'],
      ].map(([l,v,c])=>`<div style="background:#f9f6ee;border-radius:8px;padding:10px 12px;border-left:3px solid ${c}">
          <div style="font-size:9px;text-transform:uppercase;letter-spacing:0.5px;color:#888;margin-bottom:4px">${l}</div>
          <div style="font-size:20px;font-weight:700;color:${c};font-family:'DM Mono',monospace">${v}</div>
        </div>`).join('')}
    </div>`;

  let tableRows = '';
  if (template === 'alimentos') {
    INGREDIENTES.forEach((ing, idx) => {
      const s = STOCK[ing.id] || {actual:0, minimo:0, unit:'g'};
      const pxg = ing.precioPkg / ing.grPaquete;
      const val = s.actual * pxg;
      let statusColor = '#235328', statusBg = '#d6eed7', statusLabel = 'OK';
      if (s.actual <= 0)          { statusColor='#c0392b'; statusBg='#fde8e6'; statusLabel='Sin stock'; }
      else if (s.actual < s.minimo){ statusColor='#d68910'; statusBg='#fff8e1'; statusLabel='Bajo'; }
      const shade = idx%2===0 ? 'white' : '#f9f6ee';
      tableRows += `<tr style="background:${shade}">
        <td style="padding:9px 10px;font-weight:600;font-size:12px">${ing.name}</td>
        <td style="padding:9px 10px;text-align:center;font-family:'DM Mono',monospace;font-size:12px">${s.actual.toLocaleString('es-AR')}</td>
        <td style="padding:9px 10px;text-align:center;font-size:11px;color:#888">${s.unit||'g'}</td>
        <td style="padding:9px 10px;text-align:center;font-family:'DM Mono',monospace;font-size:12px;color:#888">${s.minimo.toLocaleString('es-AR')}</td>
        <td style="padding:9px 10px;text-align:center"><span style="display:inline-block;font-size:10px;font-weight:700;padding:2px 9px;border-radius:99px;background:${statusBg};color:${statusColor}">${statusLabel}</span></td>
        <td style="padding:9px 10px;text-align:right;font-family:'DM Mono',monospace;font-size:11px;color:#888">${val>0?'$'+Math.round(val).toLocaleString('es-AR'):'-'}</td>
        <td style="padding:9px 10px;text-align:center;font-size:11px;color:#ccc">________</td>
        <td style="padding:9px 10px;font-size:11px;color:#ccc">___________________</td>
      </tr>`;
    });
    const table = `
      <div style="font-size:11px;font-weight:700;color:#235328;text-transform:uppercase;letter-spacing:0.5px;margin-bottom:8px">Detalle de ingredientes</div>
      <table style="width:100%;border-collapse:collapse;font-size:12px">
        <thead><tr style="background:#235328;color:white">
          <th style="padding:8px 10px;text-align:left;font-weight:600">Ingrediente</th>
          <th style="padding:8px 10px;text-align:center;font-weight:600">Stock sistema</th>
          <th style="padding:8px 10px;text-align:center;font-weight:600">Unidad</th>
          <th style="padding:8px 10px;text-align:center;font-weight:600">Mínimo</th>
          <th style="padding:8px 10px;text-align:center;font-weight:600">Estado</th>
          <th style="padding:8px 10px;text-align:right;font-weight:600">Valor</th>
          <th style="padding:8px 10px;text-align:center;font-weight:600">Conteo real</th>
          <th style="padding:8px 10px;font-weight:600">Observación</th>
        </tr></thead>
        <tbody>${tableRows}</tbody>
        <tfoot><tr style="background:#235328;color:white;font-weight:700">
          <td style="padding:9px 10px">TOTAL INGREDIENTES</td>
          <td colspan="4" style="padding:9px 10px;text-align:center">${INGREDIENTES.length} items</td>
          <td style="padding:9px 10px;text-align:right;font-family:'DM Mono',monospace">$${Math.round(valor).toLocaleString('es-AR')}</td>
          <td colspan="2"></td>
        </tr></tfoot>
      </table>`;
    return { header, kpi, table, ts };
  } else {
    // Papelería e insumos = ENVASES
    ENVASES.forEach((env, idx) => {
      const shade = idx%2===0 ? 'white' : '#f9f6ee';
      const uUnit = (env.precioPkg / env.cantidad).toFixed(2);
      tableRows += `<tr style="background:${shade}">
        <td style="padding:9px 10px;font-weight:600;font-size:12px">${env.name}</td>
        <td style="padding:9px 10px;text-align:right;font-family:'DM Mono',monospace;font-size:12px">$${env.precioPkg.toLocaleString('es-AR')}</td>
        <td style="padding:9px 10px;text-align:center;font-family:'DM Mono',monospace;font-size:12px">${env.cantidad}</td>
        <td style="padding:9px 10px;text-align:right;font-family:'DM Mono',monospace;font-size:12px">$${uUnit}</td>
        <td style="padding:9px 10px;text-align:center;font-size:11px;color:#ccc">________</td>
        <td style="padding:9px 10px;font-size:11px;color:#ccc">___________________</td>
      </tr>`;
    });
    const table = `
      <div style="font-size:11px;font-weight:700;color:#235328;text-transform:uppercase;letter-spacing:0.5px;margin-bottom:8px">Papelería e insumos</div>
      <table style="width:100%;border-collapse:collapse;font-size:12px">
        <thead><tr style="background:#235328;color:white">
          <th style="padding:8px 10px;text-align:left;font-weight:600">Insumo / Envase</th>
          <th style="padding:8px 10px;text-align:right;font-weight:600">Precio paquete</th>
          <th style="padding:8px 10px;text-align:center;font-weight:600">Unid. por paquete</th>
          <th style="padding:8px 10px;text-align:right;font-weight:600">Precio unitario</th>
          <th style="padding:8px 10px;text-align:center;font-weight:600">Conteo real</th>
          <th style="padding:8px 10px;font-weight:600">Observación</th>
        </tr></thead>
        <tbody>${tableRows}</tbody>
      </table>`;
    return { header, kpi, table, ts };
  }
}

function updatePrintPreview() { /* legacy — reemplazado por gfRenderAll */ }
let printPreviewVisible = false;
function togglePrintPreview() { /* legacy — reemplazado por gfTogglePreview */ }

function imprimirControl() {
  // Legacy fallback: usa el generador nuevo
  gfImprimirTodo();
}

// ═══════════════════════════════════════════════════════════════════════
// GENERADOR DE FORMATO DE INVENTARIO — Motor completo
// ═══════════════════════════════════════════════════════════════════════

const GF_LOGO_PATHS = `
  <path d="M531.857 0C480.757 0 439.365 41.3922 439.365 92.4921V217.882H405.927V92.4921C405.927 41.3922 364.535 0 313.435 0C262.336 0 220.943 41.3922 220.943 92.4921V368.485H338.918V644.478C338.918 658.635 327.458 669.961 313.435 669.961C299.413 669.961 287.953 658.5 287.953 644.478V468.932H204.225V485.516H220.943V611.041C220.943 662.141 262.336 703.533 313.435 703.533C322.334 703.533 330.828 702.32 338.918 699.893C377.614 688.837 405.927 653.242 405.927 611.041V335.048H287.953V59.0547C287.953 44.8978 299.413 33.5722 313.435 33.5722C327.458 33.5722 338.918 45.0326 338.918 59.0547V234.601H405.927H422.646H439.365H506.374V59.0547C506.374 44.8978 517.835 33.5722 531.857 33.5722C545.879 33.5722 557.339 45.0326 557.339 59.0547V335.048H531.857C480.757 335.048 439.365 376.44 439.365 427.54V703.533H624.349V92.4921C624.349 41.3922 582.957 0 531.857 0ZM557.339 569.649V670.096H506.24V394.103C506.24 379.946 517.7 368.62 531.722 368.62C545.744 368.62 557.205 380.08 557.205 394.103V569.649H557.339Z" fill="#235328"/>
  <path d="M1172.43 0C1121.33 0 1079.94 41.3922 1079.94 92.4921V611.041C1079.94 662.141 1121.33 703.533 1172.43 703.533C1223.53 703.533 1264.92 662.141 1264.92 611.041V468.932H1197.91H1181.19V485.651H1197.91V644.478C1197.91 658.635 1186.45 669.961 1172.43 669.961C1158.41 669.961 1146.95 658.5 1146.95 644.478V368.485H1264.92V92.4921C1264.92 41.3922 1223.53 0 1172.43 0ZM1197.91 335.048H1146.81V59.0547C1146.81 44.8978 1158.27 33.5722 1172.29 33.5722C1186.32 33.5722 1197.78 45.0326 1197.78 59.0547V335.048H1197.91Z" fill="#235328"/>
  <path d="M750.416 335.048H724.933V0.27002H641.205V16.8539H657.924V703.534H724.933V393.968C724.933 379.811 736.394 368.486 750.416 368.486C764.438 368.486 775.898 379.946 775.898 393.968V703.534H842.908V427.54C842.908 376.44 801.516 335.048 750.416 335.048Z" fill="#235328"/>
  <path d="M934.181 16.9887H950.9V0.27002H867.172V611.041C867.172 662.141 908.564 703.534 959.664 703.534C1010.76 703.534 1052.16 662.141 1052.16 611.041V468.933H968.428V485.516H985.146V644.479C985.146 658.636 973.686 669.961 959.664 669.961C945.642 669.961 934.181 658.501 934.181 644.479V134.02H1052.16V100.582H934.181V16.8539V16.9887Z" fill="#235328"/>
  <path d="M1496.14 686.949H1479.42V92.4921C1479.42 41.3922 1438.03 0 1386.93 0H1277.72V16.7187H1294.44V703.668H1361.45H1378.17V686.949H1361.45V59.0547C1361.45 44.8978 1372.91 33.5722 1386.93 33.5722C1401.09 33.5722 1412.41 45.0326 1412.41 59.0547V703.668H1479.42H1496.14V686.949Z" fill="#235328"/>
  <path d="M1594.63 280.34C1553.6 277.315 1503.4 285.065 1451.12 317.439C1417.92 338.062 1391.8 362.495 1371.33 386.439C1305.74 361.712 1289.87 326.367 1289.87 326.367C1289.87 326.367 1273.77 410.538 1192.19 410.701C1140.56 410.805 1116.43 369.98 1105.76 340.122C1157.34 314.204 1199.76 304.796 1199.76 304.796L1157 259.467C1084.68 290.447 1023.82 275.51 947.569 229.052C881.944 189.027 828.943 212.797 828.943 212.797L799.367 278.351C799.367 278.351 864.859 252.404 914.892 276.685C972.005 304.536 1036.14 308.71 1036.14 308.71C1036.14 308.71 934.73 410.501 872.958 410.625C811.185 410.749 799.275 350.298 799.275 350.298L743.551 309.297C743.551 309.297 714.045 409.51 657.224 409.624C600.403 409.738 593.908 345.691 593.908 345.691L537.015 309.712C537.015 309.712 523.075 412.761 459.181 412.889C395.287 413.017 393.754 353.98 393.754 353.98L335.43 310.116C335.43 310.116 329.54 547.005 187.605 547.29C45.671 547.575 54.2303 348.208 54.2303 348.208L2.28529 310.785C-15.8219 451.848 102.35 594.072 235.042 570.142C367.733 546.212 379.43 382.693 379.43 382.693C398.61 423.767 455.274 462.854 511.586 444.336C561.301 427.982 578.166 372.972 578.166 372.972C596.422 423.37 651.44 464.612 711.75 441.066C761.224 421.844 783.533 377.101 783.533 377.101C833.503 488.149 955.79 448.703 1032.29 386.641C1049.48 372.743 1067.37 360.995 1084.56 351.16C1101.15 391.284 1134.74 447.388 1191.8 447.274C1280.68 447.095 1311.43 377.476 1311.43 377.476C1311.43 377.476 1323.72 393.466 1350.87 411.339C1322.66 451.075 1311.17 483.367 1311.17 483.367L1351.81 528.7C1351.81 528.7 1357.39 485.903 1394.53 434.198C1427.33 447.518 1470.74 457.948 1526.14 457.837C1679.39 457.53 1702.06 356.614 1702.06 356.614C1682.17 313.151 1640.61 283.834 1593.45 280.582L1594.63 280.34ZM1528.17 410.027C1486.44 410.111 1452.01 406.595 1423.23 400.916C1436.41 387.026 1451.94 372.892 1470.54 359.23C1576.24 281.572 1669.94 330.624 1669.94 330.624C1669.94 330.624 1640.4 409.802 1528.17 410.027Z" fill="#F28C00"/>
`;

// GF_TEMPLATES ahora son definiciones de metadatos solamente.
// Los productos se generan dinámicamente desde INGREDIENTES y ENVASES.
const GF_TEMPLATES = {
  ingredientes: {
    title: 'Inventario de Ingredientes', cat: '🍴 Ingredientes',
    sectionLabel: 'Control de stock — ingredientes y materias primas',
    source: 'ingredientes',
  },
  envases: {
    title: 'Inventario de Envases y Papelería', cat: '📦 Envases y Papelería',
    sectionLabel: 'Control de stock — envases, embalaje e insumos',
    source: 'envases',
  },
  libre: {
    title: 'Control de Stock', cat: '📋 Inventario Vacío',
    sectionLabel: 'Detalle de productos',
    source: 'libre',
  }
};

function gfGetProductList(tplId) {
  if (tplId === 'ingredientes') {
    return INGREDIENTES.map(i => ({
      name:    i.name,
      unit:    'g / kg',
      precio:  i.precioPkg,
      detalle: `Paq. ${i.grPaquete}g — ${fmt(i.precioPkg / i.grPaquete)}/g`,
    }));
  }
  if (tplId === 'envases') {
    return ENVASES.map(e => ({
      name:    e.name,
      unit:    'u.',
      precio:  e.precioPkg,
      detalle: `x${e.cantidad} — ${fmt(e.precioPkg / e.cantidad)}/u`,
    }));
  }
  return []; // libre
}

const GF_ALL_COLUMNS = [
  { id:'producto',    label:'Producto',       width:'22%', center:false, default:true  },
  { id:'unidad',      label:'Unidad',          width:'8%',  center:true,  default:true  },
  { id:'teorica',     label:'Cant. Teórica',   width:'9%',  center:true,  default:true  },
  { id:'real',        label:'Cant. Real',      width:'9%',  center:true,  default:true  },
  { id:'diferencia',  label:'Diferencia',      width:'8%',  center:true,  default:true  },
  { id:'uso',         label:'Uso Interno',     width:'8%',  center:true,  default:true  },
  { id:'desperdicio', label:'Desperdicio',     width:'8%',  center:true,  default:true  },
  { id:'vencimiento', label:'Vto.',            width:'9%',  center:true,  default:false },
  { id:'precio',      label:'Precio Unit.',    width:'9%',  center:true,  default:false },
  { id:'obs',         label:'Observaciones',   width:'20%', center:false, default:true  },
];

let gfActiveColumns  = GF_ALL_COLUMNS.filter(c => c.default).map(c => c.id);
let gfPages          = _loadGfPages();
let gfPageCounter    = gfPages.length;
let gfCurrentPage    = 0;

function _loadGfPages() {
  try { const r=localStorage.getItem('sahten_gf_pages'); if(r) return JSON.parse(r); } catch(e){}
  return [{ id:1, label:'', sector:'', rows:15, showCheckboxes:true }];
}
function _saveGfPages() {
  try { localStorage.setItem('sahten_gf_pages', JSON.stringify(gfPages)); } catch(e){}
}
let gfCurrentTpl     = 'ingredientes';
let gfPreviewVisible = false;
let gfConfigVisible  = false;  // colapsado por defecto
let gfModalCurrentPage = 0;

// Init
document.addEventListener('DOMContentLoaded', () => {
  // Init generador de formato
  const today = new Date();
  const yy = today.getFullYear(), mm = String(today.getMonth()+1).padStart(2,'0'), dd = String(today.getDate()).padStart(2,'0');
  const fechaEl = document.getElementById('gf-fecha');
  if (fechaEl) fechaEl.value = `${yy}-${mm}-${dd}`;
  gfBuildColumnToggles();
  gfBuildPagesUI();
  // Inicializar badge con conteo real (después de que INGREDIENTES/ENVASES estén cargados)
  // gfSetTemplate will be called again when preview/print is triggered with fresh data
  setTimeout(() => gfSetTemplate(gfCurrentTpl), 800);
});

// ── Toggle config panel
function gfToggleConfig() {
  gfConfigVisible = !gfConfigVisible;
  const p   = document.getElementById('gf-config-panel');
  const btn = document.getElementById('gf-toggle-config-btn');
  if (p) p.style.display = gfConfigVisible ? 'block' : 'none';
  if (btn) {
    btn.style.background = gfConfigVisible ? 'rgba(35,83,40,0.08)' : 'white';
    btn.style.borderColor = gfConfigVisible ? 'var(--primary)' : 'var(--border)';
    btn.style.color = gfConfigVisible ? 'var(--primary)' : 'var(--ink)';
  }
}

// ── Abrir modal de preview
function gfTogglePreview() {
  const modal = document.getElementById('gf-preview-modal');
  if (!modal) return;
  // Don't call gfSetTemplate here — it resets gfPages and wipes custom rows.
  // Just re-render with the current page configuration.
  gfModalCurrentPage = 0;
  gfRenderModal();
  modal.style.display = 'flex';
  document.body.style.overflow = 'hidden';
}

function gfClosePreviewModal() {
  const modal = document.getElementById('gf-preview-modal');
  if (modal) modal.style.display = 'none';
  document.body.style.overflow = '';
}

// ── Render modal pages
function gfRenderModal() {
  const container = document.getElementById('gf-modal-pages-container');
  const nav       = document.getElementById('gf-modal-page-nav');
  const info      = document.getElementById('gf-modal-info');
  if (!container) return;

  // Generar todas las páginas (la activa visible, resto ocultas)
  container.innerHTML = gfPages.map((p, i) => {
    const html = gfRenderPage(p, i, gfPages.length);
    // Forzar visibilidad según página actual del modal
    return html.replace(
      /class="gf-a4-page"([^>]*style="[^"]*display:none[^"]*")/,
      'class="gf-a4-page" style=""'
    ).replace(
      /class="gf-a4-page" style=""/,
      `class="gf-a4-page" style="${i === gfModalCurrentPage ? '' : 'display:none'}"` 
    );
  }).join('\n');

  // Forzar visibilidad correcta
  container.querySelectorAll('.gf-a4-page').forEach((el, i) => {
    el.style.display = i === gfModalCurrentPage ? 'block' : 'none';
  });

  // Nav
  if (nav) {
    nav.innerHTML = gfPages.map((p, i) => `
      <button class="gf-page-nav-btn ${i === gfModalCurrentPage ? 'active' : ''}"
        onclick="gfModalSetPage(${i})"
        style="background:${i===gfModalCurrentPage?'rgba(255,255,255,0.9)':'rgba(255,255,255,0.15)'};color:${i===gfModalCurrentPage?'#235328':'white'};border-color:${i===gfModalCurrentPage?'white':'rgba(255,255,255,0.3)'}">
        ${p.label ? p.label.substring(0,8) + (p.label.length>8?'…':'') : `Hoja ${i+1}`}
      </button>
    `).join('');
  }

  const cur = gfPages[gfModalCurrentPage];
  if (info) info.textContent = `Hoja ${gfModalCurrentPage+1} de ${gfPages.length}${cur.label ? ' · ' + cur.label : ''}`;
}

function gfModalSetPage(idx) {
  gfModalCurrentPage = idx;
  const container = document.getElementById('gf-modal-pages-container');
  const nav       = document.getElementById('gf-modal-page-nav');
  const info      = document.getElementById('gf-modal-info');
  if (container) {
    container.querySelectorAll('.gf-a4-page').forEach((el, i) => {
      el.style.display = i === idx ? 'block' : 'none';
    });
  }
  if (nav) {
    nav.querySelectorAll('.gf-page-nav-btn').forEach((btn, i) => {
      btn.style.background  = i===idx ? 'rgba(255,255,255,0.9)' : 'rgba(255,255,255,0.15)';
      btn.style.color       = i===idx ? '#235328' : 'white';
      btn.style.borderColor = i===idx ? 'white' : 'rgba(255,255,255,0.3)';
    });
  }
  const cur = gfPages[idx];
  if (info) info.textContent = `Hoja ${idx+1} de ${gfPages.length}${cur.label ? ' · ' + cur.label : ''}`;
}

// ── Cerrar modal con click en backdrop
document.addEventListener('click', e => {
  const modal = document.getElementById('gf-preview-modal');
  if (modal && e.target === modal) gfClosePreviewModal();
});
document.addEventListener('keydown', e => {
  if (e.key === 'Escape') gfClosePreviewModal();
});

// ── Set template
// Auto-compute how many pages needed and rebuild gfPages accordingly
function gfAutoPages() {
  const products = gfGetProductList(gfCurrentTpl);
  const total = products.length;
  if (total === 0) {
    gfPages = [{ id:1, label:'', sector:'', rows:0, showCheckboxes:true }];
    gfPageCounter = 1;
    _saveGfPages();
    return;
  }
  // A4 = 297mm. Each page has:
  // - Header: ~52mm (logo+title+border)
  // - Info row (pg1 only): ~18mm
  // - Section label: ~10mm
  // - Table header row: ~9mm
  // - Each data row: ~7mm (height:20px = 7.5mm)
  // - Checkboxes (pg1 only): ~28mm
  // - Extra fields: ~14mm
  // - Notes 3 lines: ~16mm
  // - Footer: ~10mm
  // Margins: 13mm top + 14mm bottom = 27mm
  // Usable: 297-27 = 270mm
  //
  // Page 1 overhead: 52+18+10+9+28+14+16+10 = 157mm → rows = (270-157)/7 = 16 → use 12 (safe)
  // Cont. pages overhead: 52+10+9+14+16+10 = 111mm → rows = (270-111)/7 = 22 → use 15 (safe)
  const page1 = 12;
  const pageN = 15;
  const pages = [];
  let remaining = total;
  let pageId = 1;

  // Page 1: up to page1 real items
  pages.push({
    id: pageId++, label:'', sector:'',
    rows: 0,           // rows=0 means "don't add extra empty rows"
    showCheckboxes: true,
    _itemStart: 0,
    _itemEnd: Math.min(page1, total),
    _isCont: false,
  });
  remaining -= page1;

  // Continuation pages
  let offset = page1;
  while (remaining > 0) {
    const count = Math.min(pageN, remaining);
    pages.push({
      id: pageId++, label:'', sector:'',
      rows: 0,
      showCheckboxes: false,
      _itemStart: offset,
      _itemEnd: offset + count,
      _isCont: true,
    });
    offset += count;
    remaining -= count;
  }

  gfPages = pages;
  gfPageCounter = pageId - 1;
  gfCurrentPage = 0;
  _saveGfPages();
}

function gfSetTemplate(tplId) {
  gfCurrentTpl = tplId;
  document.querySelectorAll('.gf-tpl-btn').forEach(btn => {
    btn.classList.toggle('active', btn.id === 'gf-tpl-' + tplId);
  });
  const count = gfGetProductList(tplId).length;
  const badge = document.getElementById('gf-tpl-count-badge');
  if (badge) badge.textContent = count > 0 ? `${count} ítems del sistema` : 'Solo filas vacías';
  gfAutoPages();
  // Note: gfBuildPagesUI only renders the config UI, doesn't modify gfPages
  gfBuildPagesUI();
  if (gfPreviewVisible) gfRenderAll();
}

// ── Column toggles
function gfBuildColumnToggles() {
  const container = document.getElementById('gf-col-toggles');
  if (!container) return;
  container.innerHTML = GF_ALL_COLUMNS.map(col => `
    <span class="gf-col-chip ${gfActiveColumns.includes(col.id) ? 'on' : ''}" id="gf-chip-${col.id}" onclick="gfToggleColumn('${col.id}')">
      <span class="gf-col-chip-dot"></span>${col.label}
    </span>
  `).join('');
}

function gfToggleColumn(id) {
  if (id === 'producto') return;
  if (gfActiveColumns.includes(id)) {
    gfActiveColumns = gfActiveColumns.filter(c => c !== id);
  } else {
    gfActiveColumns = GF_ALL_COLUMNS.filter(c => gfActiveColumns.includes(c.id) || c.id === id).map(c => c.id);
  }
  document.querySelectorAll('.gf-col-chip').forEach(chip => {
    const cid = chip.id.replace('gf-chip-','');
    chip.classList.toggle('on', gfActiveColumns.includes(cid));
  });
  if (gfPreviewVisible) gfRenderAll();
}

// ── Pages UI
function gfAddPage() {
  gfPageCounter++;
  gfPages.push({ id: gfPageCounter, label:'', sector:'', rows:15, showCheckboxes:false });
  _saveGfPages();
  gfBuildPagesUI();
  gfCurrentPage = gfPages.length - 1;
  if (gfPreviewVisible) gfRenderAll();
}

function gfDeletePage(id) {
  if (gfPages.length <= 1) return;
  gfPages = gfPages.filter(p => p.id !== id);
  _saveGfPages();
  if (gfCurrentPage >= gfPages.length) gfCurrentPage = gfPages.length - 1;
  gfBuildPagesUI();
  if (gfPreviewVisible) gfRenderAll();
}

function gfBuildPagesUI() {
  const list = document.getElementById('gf-pages-list');
  if (!list) return;
  list.innerHTML = gfPages.map((p, i) => `
    <div class="gf-page-item">
      <div class="gf-page-num">${i+1}</div>
      <input type="text" class="gf-page-input" style="flex:1" placeholder="Título de la hoja (ej: Harina y lácteos, Bebidas...)"
        value="${p.label}" oninput="gfPages[${i}].label=this.value; _saveGfPages(); if(gfPreviewVisible) gfRenderAll()">
      <span style="font-size:11px;color:var(--muted);white-space:nowrap">Sector:</span>
      <input type="text" class="gf-page-input" style="width:120px" placeholder="Área / Sector"
        value="${p.sector}" oninput="gfPages[${i}].sector=this.value; _saveGfPages(); if(gfPreviewVisible) gfRenderAll()">
      <span style="font-size:11px;color:var(--muted);white-space:nowrap">Filas:</span>
      <input type="number" class="gf-page-input" style="width:60px;text-align:center" min="5" max="40" value="${p.rows}"
        oninput="gfPages[${i}].rows=parseInt(this.value)||15; _saveGfPages(); if(gfPreviewVisible) gfRenderAll()">
      ${gfPages.length > 1 ? `<button class="gf-page-del" onclick="gfDeletePage(${p.id})" title="Eliminar hoja">✕</button>` : '<div style="width:24px"></div>'}
    </div>
  `).join('');
  const badge = document.getElementById('gf-pages-badge');
  if (badge) badge.textContent = gfPages.length === 1 ? '1 hoja' : `${gfPages.length} hojas`;
}

// ── Build page nav
function gfBuildPageNav() {
  const nav = document.getElementById('gf-page-nav');
  if (!nav) return;
  nav.innerHTML = gfPages.map((p, i) => `
    <button class="gf-page-nav-btn ${i === gfCurrentPage ? 'active' : ''}" onclick="gfSetPreviewPage(${i})">
      ${p.label ? p.label.substring(0,9) + (p.label.length > 9 ? '…' : '') : `Hoja ${i+1}`}
    </button>
  `).join('');
  const info = document.getElementById('gf-preview-info');
  const cur = gfPages[gfCurrentPage];
  if (info) info.textContent = `Hoja ${gfCurrentPage+1} de ${gfPages.length}${cur.label ? ' · ' + cur.label : ''}`;
}

function gfSetPreviewPage(idx) {
  gfCurrentPage = idx;
  gfBuildPageNav();
  document.querySelectorAll('#gf-pages-container .gf-a4-page').forEach((el, i) => {
    el.style.display = (i === gfCurrentPage) ? 'block' : 'none';
  });
}

// ── Render table header
function gfRenderTableHeader() {
  return GF_ALL_COLUMNS.filter(c => gfActiveColumns.includes(c.id))
    .map(c => `<th ${c.center ? 'class="center"' : ''} style="width:${c.width}">${c.label}</th>`).join('');
}

function gfRenderProductRow(name, unit, detalle, precio) {
  return GF_ALL_COLUMNS.filter(c => gfActiveColumns.includes(c.id)).map(c => {
    if (c.id === 'producto') return `<td style="font-weight:500">${name}${detalle ? `<br><span style="font-size:6.5pt;color:#8a9a8a;font-weight:400">${detalle}</span>` : ''}</td>`;
    if (c.id === 'unidad')   return `<td class="center mono" style="color:#6b7c6c;font-size:7.5pt">${unit}</td>`;
    if (c.id === 'precio' && precio) return `<td class="center mono" style="color:#235328;font-size:7.5pt">${fmt(precio)}</td>`;
    return `<td class="${c.center ? 'center' : ''}"></td>`;
  }).join('');
}

function gfRenderEmptyRow() {
  return GF_ALL_COLUMNS.filter(c => gfActiveColumns.includes(c.id)).map((c) => {
    if (c.id === 'producto') return `<td style="border-right:1px dashed #c0d0c0">&nbsp;</td>`;
    return `<td class="${c.center ? 'center' : ''}"></td>`;
  }).join('');
}

function gfRenderPage(pageObj, pageIndex, totalPages, forPrint = false) {
  const tpl        = GF_TEMPLATES[gfCurrentTpl];
  const productList = gfGetProductList(gfCurrentTpl);  // dinámico desde INGREDIENTES/ENVASES
  const responsable = (document.getElementById('gf-responsable')?.value||'').trim();
  const fechaRaw    = document.getElementById('gf-fecha')?.value||'';
  const turno       = (document.getElementById('gf-turno')?.value||'').trim();
  const supervisor  = (document.getElementById('gf-supervisor')?.value||'').trim();
  const sector      = pageObj.sector.trim() || (document.getElementById('gf-sector')?.value||'').trim();
  const sucursal    = (document.getElementById('gf-sucursal')?.value||'').trim();
  const obsGeneral  = (document.getElementById('gf-obs')?.value||'').trim();

  let fechaDisplay = '________________________';
  if (fechaRaw) {
    const d = new Date(fechaRaw + 'T12:00:00');
    fechaDisplay = d.toLocaleDateString('es-AR', {weekday:'long', day:'numeric', month:'long', year:'numeric'});
  }

  const pageLabel      = pageObj.label.trim() || tpl.title;
  const isContinuation = pageObj._isCont === true;

  // Use auto-paginated range if available, else fallback to old logic
  let tableRows = '';
  const itemStart = pageObj._itemStart != null ? pageObj._itemStart : (isContinuation ? productList.length : 0);
  const itemEnd   = pageObj._itemEnd   != null ? pageObj._itemEnd   : (isContinuation ? productList.length : productList.length);
  const slice = productList.slice(itemStart, itemEnd);

  slice.forEach((p, i) => {
    const bg = i%2===0 ? '#f7faf7' : 'white';
    const tipoBadge = p._tipo ? `<span style="font-size:5.5pt;background:${p._tipo==='ING'?'rgba(35,83,40,0.1)':'rgba(242,140,0,0.1)'};color:${p._tipo==='ING'?'#235328':'#c07000'};padding:1px 4px;border-radius:3px;font-weight:700;margin-left:3px">${p._tipo}</span>` : '';
    const nameWithBadge = p.name + (p._tipo ? tipoBadge : '');
    tableRows += `<tr style="background:${bg}">${gfRenderProductRow(nameWithBadge, p.unit, p.detalle, p.precio)}</tr>`;
  });

  // Add empty rows to fill up to pageObj.rows
  const targetRows = pageObj.rows || 15;
  const filledRows = slice.length;
  const emptyCount = Math.max(0, targetRows - filledRows);
  for (let e = 0; e < emptyCount; e++) {
    const bg = (filledRows + e) % 2 === 0 ? '#f7faf7' : 'white';
    tableRows += `<tr style="background:${bg}">${gfRenderEmptyRow()}</tr>`;
  }

  const showChecks = !isContinuation || pageObj.showCheckboxes;
  const numLines   = isContinuation ? 4 : 3;

  return `
  <div class="gf-a4-page" style="${(!forPrint && pageIndex !== gfCurrentPage) ? 'display:none' : ''}">
    <!-- HEADER -->
    <div style="display:flex;align-items:flex-start;justify-content:space-between;padding-bottom:10px;border-bottom:3px solid #235328;margin-bottom:12px">
      <div style="display:flex;align-items:center;gap:14px">
        <svg style="width:96px;height:40px;flex-shrink:0" viewBox="0 0 1703 704" fill="none" xmlns="http://www.w3.org/2000/svg">${GF_LOGO_PATHS}</svg>
        <div>
          <div style="font-family:-apple-system,BlinkMacSystemFont,'SF Pro Display','DM Sans',sans-serif;font-size:15pt;font-weight:700;color:#235328;line-height:1.1">${pageLabel}</div>
          <div style="font-size:8.5pt;color:#6b7c6c;margin-top:3px;text-transform:uppercase;letter-spacing:0.5px">Control de Stock · Planilla de Inventario Físico</div>
          ${totalPages > 1 ? `<div style="display:inline-flex;align-items:center;background:var(--accent);color:white;border-radius:5px;padding:2px 8px;font-size:7.5pt;font-weight:700;letter-spacing:0.3px;margin-top:4px">Hoja ${pageIndex+1} de ${totalPages}</div>` : ''}
        </div>
      </div>
      <div style="text-align:right">
        <div style="display:flex;align-items:center;justify-content:flex-end;gap:6px;margin-bottom:4px;font-size:8.5pt">
          <span style="color:#6b7c6c;font-size:7.5pt;text-transform:uppercase;letter-spacing:0.3px">Fecha</span>
          <span style="font-weight:600;color:${fechaRaw?'#235328':'#1e2c1f'};min-width:110px;border-bottom:${fechaRaw?'none':'1px solid #c0c8c0'};padding-bottom:1px">${fechaRaw ? fechaDisplay : '________________________'}</span>
        </div>
        <div style="display:flex;align-items:center;justify-content:flex-end;gap:6px;margin-bottom:4px;font-size:8.5pt">
          <span style="color:#6b7c6c;font-size:7.5pt;text-transform:uppercase;letter-spacing:0.3px">Responsable</span>
          <span style="font-weight:600;color:${responsable?'#235328':'#1e2c1f'};min-width:110px;border-bottom:${responsable?'none':'1px solid #c0c8c0'};padding-bottom:1px">${responsable || '________________________'}</span>
        </div>
        <div style="display:flex;align-items:center;justify-content:flex-end;gap:6px;margin-bottom:4px;font-size:8.5pt">
          <span style="color:#6b7c6c;font-size:7.5pt;text-transform:uppercase;letter-spacing:0.3px">Turno/Período</span>
          <span style="font-weight:600;color:${turno?'#235328':'#1e2c1f'};min-width:110px;border-bottom:${turno?'none':'1px solid #c0c8c0'};padding-bottom:1px">${turno || '________________________'}</span>
        </div>
      </div>
    </div>

    <!-- INFO ROW -->
    <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:7px;margin-bottom:10px;background:#f4f9f4;border:1px solid rgba(35,83,40,0.12);border-radius:7px;padding:8px 12px">
      <div style="display:flex;flex-direction:column;gap:2px"><span style="font-size:7pt;color:#6b7c6c;text-transform:uppercase;letter-spacing:0.4px;font-weight:600">Categoría</span><span style="font-size:8.5pt;font-weight:600;color:#235328">${tpl.cat}</span></div>
      <div style="display:flex;flex-direction:column;gap:2px"><span style="font-size:7pt;color:#6b7c6c;text-transform:uppercase;letter-spacing:0.4px;font-weight:600">Sector / Área</span><span style="font-size:8.5pt;font-weight:600;color:${sector?'#235328':'#1e2c1f'};border-bottom:${sector?'none':'1px solid #b8c8b8'};min-height:15px">${sector || '______________________'}</span></div>
      <div style="display:flex;flex-direction:column;gap:2px"><span style="font-size:7pt;color:#6b7c6c;text-transform:uppercase;letter-spacing:0.4px;font-weight:600">Sucursal / Local</span><span style="font-size:8.5pt;font-weight:600;color:${sucursal?'#235328':'#1e2c1f'};border-bottom:${sucursal?'none':'1px solid #b8c8b8'};min-height:15px">${sucursal || '______________________'}</span></div>
      <div style="display:flex;flex-direction:column;gap:2px"><span style="font-size:7pt;color:#6b7c6c;text-transform:uppercase;letter-spacing:0.4px;font-weight:600">N° de Planilla</span><span style="font-size:8.5pt;font-weight:600;color:#1e2c1f;border-bottom:1px solid #b8c8b8;min-height:15px">______________________</span></div>
    </div>

    ${isContinuation ? `<div style="display:flex;align-items:center;gap:6px;font-size:7.5pt;color:#6b7c6c;font-style:italic;background:#f4f9f4;border:1px solid rgba(35,83,40,0.1);border-radius:5px;padding:5px 10px;margin-bottom:8px">ℹ️ Continuación de hoja ${pageIndex} · ${pageLabel}</div>` : ''}

    <!-- SECTION LABEL -->
    <div style="display:flex;align-items:center;gap:8px;font-size:7.5pt;font-weight:700;text-transform:uppercase;letter-spacing:0.6px;color:white;background:#235328;padding:5px 10px;border-radius:4px;margin:9px 0 5px">
      <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><rect x="3" y="3" width="18" height="18" rx="2"/><line x1="3" y1="9" x2="21" y2="9"/><line x1="9" y1="21" x2="9" y2="9"/></svg>
      ${isContinuation ? 'Continuación · ' : ''}${tpl.sectionLabel}
    </div>

    <!-- STOCK TABLE -->
    <table style="width:100%;border-collapse:collapse;font-size:8pt;flex:1">
      <thead>
        <tr style="background:#235328;color:rgba(255,255,255,0.88)">
          ${gfRenderTableHeader()}
        </tr>
      </thead>
      <tbody>${tableRows}</tbody>
    </table>

    <!-- CHECKBOXES -->
    ${showChecks ? `
    <div style="margin-top:9px;background:#f9f6ee;border:1px solid rgba(35,83,40,0.12);border-radius:7px;padding:8px 12px">
      <div style="font-size:7.5pt;font-weight:700;color:#235328;text-transform:uppercase;letter-spacing:0.5px;margin-bottom:6px;display:flex;align-items:center;gap:6px">
        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg>
        Estado general del control
      </div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:4px 16px">
        <div style="display:flex;align-items:center;gap:6px;font-size:8pt"><div style="width:13px;height:13px;border:1.5px solid #235328;border-radius:3px;flex-shrink:0"></div>Revisado <span style="font-size:7pt;color:#8a9a8a">— Control completado y verificado</span></div>
        <div style="display:flex;align-items:center;gap:6px;font-size:8pt"><div style="width:13px;height:13px;border:1.5px solid #235328;border-radius:3px;flex-shrink:0"></div>Bajo stock <span style="font-size:7pt;color:#8a9a8a">— Uno o más productos bajo mínimo</span></div>
        <div style="display:flex;align-items:center;gap:6px;font-size:8pt"><div style="width:13px;height:13px;border:1.5px solid #235328;border-radius:3px;flex-shrink:0"></div>Producto vencido <span style="font-size:7pt;color:#8a9a8a">— Detectado y retirado</span></div>
        <div style="display:flex;align-items:center;gap:6px;font-size:8pt"><div style="width:13px;height:13px;border:1.5px solid #235328;border-radius:3px;flex-shrink:0"></div>Requiere reposición <span style="font-size:7pt;color:#8a9a8a">— Solicitar compra urgente</span></div>
        <div style="display:flex;align-items:center;gap:6px;font-size:8pt"><div style="width:13px;height:13px;border:1.5px solid #235328;border-radius:3px;flex-shrink:0"></div>Sin novedades <span style="font-size:7pt;color:#8a9a8a">— Control sin incidencias</span></div>
        <div style="display:flex;align-items:center;gap:6px;font-size:8pt"><div style="width:13px;height:13px;border:1.5px solid #235328;border-radius:3px;flex-shrink:0"></div>Pendiente verificación <span style="font-size:7pt;color:#8a9a8a">— Requiere revisión</span></div>
      </div>
    </div>` : ''}

    <!-- EXTRA FIELDS -->
    <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:6px;margin-top:9px">
      <div style="display:flex;flex-direction:column;gap:2px"><span style="font-size:7pt;color:#6b7c6c;text-transform:uppercase;letter-spacing:0.4px;font-weight:600">Temperatura de almacenamiento</span><div style="border-bottom:1px solid #c0d0c0;height:16px;margin-top:2px"></div></div>
      <div style="display:flex;flex-direction:column;gap:2px"><span style="font-size:7pt;color:#6b7c6c;text-transform:uppercase;letter-spacing:0.4px;font-weight:600">Próxima reposición prevista</span><div style="border-bottom:1px solid #c0d0c0;height:16px;margin-top:2px"></div></div>
      <div style="display:flex;flex-direction:column;gap:2px"><span style="font-size:7pt;color:#6b7c6c;text-transform:uppercase;letter-spacing:0.4px;font-weight:600">N° de orden de compra</span><div style="border-bottom:1px solid #c0d0c0;height:16px;margin-top:2px"></div></div>
    </div>

    <!-- NOTES -->
    <div style="margin-top:9px">
      <div style="font-size:7.5pt;font-weight:700;text-transform:uppercase;letter-spacing:0.4px;color:#6b7c6c;margin-bottom:4px">${obsGeneral ? 'Nota: ' + obsGeneral + ' — ' : ''}Observaciones</div>
      <div style="display:flex;flex-direction:column;gap:8px">
        ${Array(numLines).fill('<div style="border-bottom:1px solid #d0dcd0;height:15px"></div>').join('')}
      </div>
    </div>

    <!-- FOOTER -->
    <div style="position:absolute;bottom:10mm;left:13mm;right:13mm;padding-top:6px;border-top:1px solid #e0e8e0;display:flex;justify-content:space-between;align-items:center">
      <div style="font-size:7pt;color:#aaa">Sahten · Control de Stock · ${fechaRaw ? fechaDisplay : ''}</div>
      <div style="display:flex;align-items:center;gap:12px">
        <div style="text-align:center"><div style="width:90px;border-bottom:1px solid #b0c0b0;margin:0 auto 3px;height:11px"></div><div style="font-size:6.5pt;color:#aaa;text-transform:uppercase;letter-spacing:0.3px">Firma responsable</div></div>
        <div style="text-align:center"><div style="width:90px;border-bottom:1px solid #b0c0b0;margin:0 auto 3px;height:11px"></div><div style="font-size:6.5pt;color:#aaa;text-transform:uppercase;letter-spacing:0.3px">${supervisor || 'Supervisado por'}</div></div>
      </div>
    </div>

  </div>`;
}

// ── Render all pages into preview
function gfRenderAll() {
  const container = document.getElementById('gf-pages-container');
  if (!container) return;
  container.innerHTML = gfPages.map((p, i) => gfRenderPage(p, i, gfPages.length)).join('\n');
  gfBuildPageNav();
}

// ── Imprimir todo
function gfImprimirTodo() {
  gfClosePreviewModal();
  // Don't call gfSetTemplate — it resets gfPages and wipes custom rows.
  // Just render with the current page configuration.
  const overlay = document.getElementById('gf-print-overlay');
  const doc     = document.getElementById('gf-print-doc');
  if (!overlay || !doc) return;

  // Generar todas las páginas con forPrint=true (sin display:none inline)
  doc.innerHTML = gfPages
    .map((p, i) => gfRenderPage(p, i, gfPages.length, true))
    .join('\n');

  // Mostrar overlay antes de imprimir
  overlay.style.display = 'block';

  // Usar beforeprint/afterprint para máxima compatibilidad
  const cleanup = () => {
    overlay.style.display = 'none';
    window.removeEventListener('afterprint', cleanup);
  };
  window.addEventListener('afterprint', cleanup);

  // Pequeño delay para asegurar que el DOM se actualice antes del print
  setTimeout(() => { document.body.classList.add('printing-inv'); window.print(); setTimeout(() => { document.body.classList.remove('printing-inv'); }, 800); }, 200);
}
// ═══════════════════════════════════════════════════════════════════════

function quickMov(id,name,tipo) {
  initStock();
  document.getElementById('sm-ing').innerHTML=INGREDIENTES.map(ing=>`<option value="${ing.id}" ${ing.id===id?'selected':''}>${ing.name}</option>`).join('');
  document.getElementById('sm-tipo').value=tipo;
  document.getElementById('sm-qty').value='1000';
  document.getElementById('sm-nota').value='';
  document.getElementById('stock-modal').classList.add('open');
}
function registrarMovimiento() {
  const ingId=document.getElementById('sm-ing').value;
  const ingName=document.getElementById('sm-ing').selectedOptions[0]?.text||ingId;
  const tipo=document.getElementById('sm-tipo').value;
  const unitSel=document.getElementById('sm-unit')?.value||'g';
  const cat=document.getElementById('sm-categoria')?.value||'ingrediente';

  let qty=parseFloat(document.getElementById('sm-qty').value)||0;

  // Convert to grams/base unit for storage
  if(unitSel==='kg') qty=qty*1000;
  else if(unitSel==='L') qty=qty*1000;

  if(tipo==='ajuste') {
    const realVal=parseFloat(document.getElementById('sm-stock-real')?.value);
    if(isNaN(realVal)) return alert('Ingresá la cantidad real para el ajuste.');
    const realQty=unitSel==='kg'||unitSel==='L' ? realVal*1000 : realVal;
    const current=STOCK[ingId]?.actual||0;
    qty=realQty-current;
    // qty can be negative (overcount) or positive (undercount)
  } else {
    if(!qty) return alert('Ingresá una cantidad mayor a 0.');
  }

  const nota=document.getElementById('sm-nota').value;
  initStock();
  if(!STOCK[ingId]) STOCK[ingId]={actual:0,minimo:0,unit:unitSel};

  const delta=(tipo==='egreso'||tipo==='merma')?-Math.abs(qty):(tipo==='ajuste'?qty:Math.abs(qty));
  STOCK[ingId].actual=Math.max(0,(STOCK[ingId].actual||0)+delta);
  const now=new Date();
  const categoria=cat==='ingrediente'?'ingrediente':cat==='envase'?'envase':'producto';
  MOVIMIENTOS.push({
    fecha:now.toLocaleDateString('es-AR')+' '+now.toLocaleTimeString('es-AR',{hour:'2-digit',minute:'2-digit'}),
    ing:ingName, tipo, qty:delta, nota, categoria, unit:unitSel
  });
  closeStockModal();
  renderStock();
}

// ═══════════════════════════════════════════════════════
// STOCK MODAL — selectMotivo, setCatModal, stepQty
// ═══════════════════════════════════════════════════════
const MOTIVO_CONFIG = {
  uso_interno: { label:'Uso Interno',     sub:'Retiro para producción o uso del local', tipo:'egreso',  icon:'🔧', color:'#235328' },
  desperdicio: { label:'Desperdicio',     sub:'Producto dañado o no utilizable',         tipo:'merma',   icon:'🗑', color:'#c0392b' },
  degustacion: { label:'Degustación',     sub:'Consumo para prueba o degustación',       tipo:'merma',   icon:'👨‍🍳', color:'#d68910' },
  vencido:     { label:'Vencido',         sub:'Producto vencido o fuera de fecha',       tipo:'merma',   icon:'⏰', color:'#c0392b' },
  ajuste:      { label:'Ajuste Manual',   sub:'Corrección del stock real vs teórico',    tipo:'ajuste',  icon:'⚖️', color:'#2980b9' },
  ingreso:     { label:'Ingreso/Compra',  sub:'Entrada de stock por compra o entrega',   tipo:'ingreso', icon:'📦', color:'#235328' },
};

function selectMotivo(motivo) {
  const cfg = MOTIVO_CONFIG[motivo] || MOTIVO_CONFIG.uso_interno;

  // Update chip active state
  document.querySelectorAll('.s2-motivo-chip').forEach(btn=>{
    btn.classList.toggle('active', btn.dataset.motivo === motivo);
  });

  // Update hidden tipo
  document.getElementById('sm-tipo').value = cfg.tipo;

  // Update modal header
  const titleEl = document.getElementById('sm-modal-title');
  const subEl = document.getElementById('sm-modal-sub');
  const iconEl = document.getElementById('sm-header-icon');
  if(titleEl) titleEl.textContent = cfg.label;
  if(subEl) subEl.textContent = cfg.sub;

  // Toggle ajuste field
  const realField = document.getElementById('sm-stock-real-field');
  if(realField) realField.style.display = motivo==='ajuste' ? '' : 'none';

  // Toggle qty field (not needed for ajuste)
  const qtyWrap = document.getElementById('sm-qty')?.closest('.s2-field');
  if(qtyWrap) qtyWrap.style.display = motivo==='ajuste' ? 'none' : '';

  // Update confirm button style/label
  const btn = document.getElementById('sm-confirm-btn');
  if(btn) {
    if(cfg.tipo==='ingreso') {
      btn.style.background = '#235328';
      btn.innerHTML = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg> Registrar ingreso`;
    } else if(cfg.tipo==='ajuste') {
      btn.style.background = '#2980b9';
      btn.innerHTML = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg> Registrar ajuste`;
    } else {
      btn.style.background = '#c0392b';
      btn.innerHTML = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg> Registrar retiro`;
    }
  }

  updateStockPreview();
}

function setCatModal(cat) {
  document.getElementById('sm-categoria').value = cat;
  ['ing','env','prod'].forEach(k=>{
    const btn=document.getElementById('cat-btn-'+k);
    if(btn) btn.classList.remove('active');
  });
  const map={ingrediente:'ing',envase:'env',producto:'prod'};
  const btn=document.getElementById('cat-btn-'+(map[cat]||'ing'));
  if(btn) btn.classList.add('active');

  // Update the label
  const labelEl=document.getElementById('sm-ing-label');
  if(labelEl) labelEl.textContent = cat==='ingrediente'?'Ingrediente':cat==='envase'?'Envase':'Producto terminado';

  // Rebuild the select options
  const sel=document.getElementById('sm-ing');
  if(!sel) return;
  if(cat==='ingrediente') {
    sel.innerHTML=INGREDIENTES.map(ing=>`<option value="${ing.id}">${ing.name}</option>`).join('');
  } else if(cat==='envase') {
    sel.innerHTML=ENVASES.map(e=>`<option value="${e.id}">${e.name}</option>`).join('');
  } else {
    sel.innerHTML=PRODUCTS.map(p=>`<option value="${p.id}">${p.name}</option>`).join('');
  }
  updateStockIndicator();
}

function updateStockIndicator() {
  const el=document.getElementById('sm-stock-indicator');
  if(!el) return;
  const id=document.getElementById('sm-ing')?.value;
  if(!id) { el.innerHTML=''; return; }
  const s=STOCK[id];
  if(!s) { el.innerHTML='<span style="font-size:11px;color:var(--muted)">Sin datos de stock</span>'; return; }
  let statusColor='#235328', statusLabel='OK';
  if(s.actual<=0) { statusColor='#c0392b'; statusLabel='Sin stock'; }
  else if(s.actual<s.minimo) { statusColor='#d68910'; statusLabel='Bajo'; }
  el.innerHTML=`<div style="display:flex;align-items:center;gap:10px;margin-top:6px;background:#f9f6ee;border-radius:8px;padding:8px 12px;border:1px solid var(--border)">
    <span style="font-size:11px;color:var(--muted)">Stock actual:</span>
    <strong style="font-family:'DM Mono',monospace;font-size:13px;color:var(--ink)">${s.actual.toLocaleString('es-AR')} ${s.unit||'g'}</strong>
    <span style="padding:2px 8px;border-radius:99px;font-size:10px;font-weight:600;background:${statusColor}22;color:${statusColor}">${statusLabel}</span>
    <span style="font-size:11px;color:var(--muted)">· mín: ${s.minimo.toLocaleString('es-AR')}</span>
  </div>`;
  updateStockPreview();
}

function updateStockPreview() {
  const prevEl=document.getElementById('sm-result-preview');
  if(!prevEl) return;
  const id=document.getElementById('sm-ing')?.value;
  const tipo=document.getElementById('sm-tipo')?.value||'egreso';
  const unitSel=document.getElementById('sm-unit')?.value||'g';
  let qty=parseFloat(document.getElementById('sm-qty')?.value)||0;
  if(unitSel==='kg'||unitSel==='L') qty=qty*1000;
  if(!id||!STOCK[id]) { prevEl.innerHTML=''; return; }
  const current=STOCK[id].actual||0;
  const delta=(tipo==='egreso'||tipo==='merma')?-Math.abs(qty):(tipo==='ajuste'?qty:Math.abs(qty));
  const result=Math.max(0,current+delta);
  const arrow=delta>=0?'↑':'↓';
  const col=delta>=0?'var(--green)':'var(--red)';
  prevEl.innerHTML=`<div style="display:flex;align-items:center;gap:10px;background:#f9f6ee;border-radius:8px;padding:10px 14px;border:1px solid var(--border)">
    <span style="font-size:12px;color:var(--muted)">Stock resultante:</span>
    <span style="font-family:'DM Mono',monospace;font-size:14px;color:var(--muted)">${current.toLocaleString('es-AR')}</span>
    <span style="color:${col};font-weight:700;font-size:14px">${arrow} ${Math.abs(delta).toLocaleString('es-AR')}</span>
    <span style="font-size:14px;color:var(--muted)">→</span>
    <span style="font-family:'DM Mono',monospace;font-size:16px;font-weight:700;color:${result===0?'var(--red)':'var(--ink)'}">${result.toLocaleString('es-AR')} ${unitSel}</span>
  </div>`;
}

function stepQty(amount) {
  const inp=document.getElementById('sm-qty');
  if(!inp) return;
  inp.value=(parseFloat(inp.value)||0)+amount;
  updateStockPreview();
}

// Override showStockModal to support motivo and category
function showStockModal(motivo='uso_interno') {
  initStock();
  // Default to ingredientes
  setCatModal('ingrediente');
  selectMotivo(motivo);
  document.getElementById('sm-qty').value='500';
  document.getElementById('sm-nota').value='';
  document.getElementById('stock-modal').classList.add('open');
  updateStockIndicator();
}

// Override quickMov to pre-select ingredient
function quickMov(id, name, tipo) {
  initStock();
  // Determine category by checking which list contains this id
  let cat='ingrediente';
  if(ENVASES.find(e=>e.id===id)) cat='envase';
  else if(PRODUCTS.find(p=>p.id===id)) cat='producto';

  setCatModal(cat);

  const sel=document.getElementById('sm-ing');
  if(sel) {
    const opt=[...sel.options].find(o=>o.value===id);
    if(opt) sel.value=id;
  }

  const motivo=tipo==='ingreso'?'ingreso':tipo==='merma'?'desperdicio':'uso_interno';
  selectMotivo(motivo);
  document.getElementById('sm-qty').value='500';
  document.getElementById('sm-nota').value='';
  document.getElementById('stock-modal').classList.add('open');
  updateStockIndicator();
}

// ═══════════════════════════════════════════════════════
// INGREDIENTES
// ═══════════════════════════════════════════════════════
let ingView = 'grilla';
function setIngView(v) {
  ingView = v;
  document.getElementById('iv-grilla').className='view-btn'+(v==='grilla'?' active':'');
  document.getElementById('iv-lista').className='view-btn'+(v==='lista'?' active':'');
  renderIngredientes();
}
function renderIngredientes() {
  const grid=document.getElementById('ing-grid');
  const list=document.getElementById('ing-list');
  if(!grid||!list) return;
  // Ensure all ingredientes have unit/cantidad normalized
  INGREDIENTES.forEach(ing => { if(!ing.unit) ing.unit='g'; if(ing.cantidad==null) ing.cantidad=ing.grPaquete; ingNormalize(ing); });
  grid.style.display = ingView==='grilla' ? '' : 'none';
  list.style.display = ingView==='lista' ? '' : 'none';
  // Apply search + sort
  const ingSearchVal = (document.getElementById('ing-search')?.value||'').toLowerCase();
  const ingSortVal   = document.getElementById('ing-sort')?.value||'';
  let ingIndices = INGREDIENTES.map((_,i)=>i);
  if(ingSearchVal) ingIndices = ingIndices.filter(i=>INGREDIENTES[i].name.toLowerCase().includes(ingSearchVal));
  if(ingSortVal==='name-asc')   ingIndices.sort((a,b)=>INGREDIENTES[a].name.localeCompare(INGREDIENTES[b].name));
  if(ingSortVal==='name-desc')  ingIndices.sort((a,b)=>INGREDIENTES[b].name.localeCompare(INGREDIENTES[a].name));
  if(ingSortVal==='price-desc') ingIndices.sort((a,b)=>ingPxBase(INGREDIENTES[b])-ingPxBase(INGREDIENTES[a]));
  if(ingSortVal==='price-asc')  ingIndices.sort((a,b)=>ingPxBase(INGREDIENTES[a])-ingPxBase(INGREDIENTES[b]));
  const UNITS = ['g','kg','u','L','ml'];
  const unitSel = (i, u) => UNITS.map(x=>`<option value="${x}" ${u===x?'selected':''}>${x}</option>`).join('');
  if(ingView==='grilla') {
    grid.innerHTML='';
    ingIndices.forEach((i)=>{
      const ing=INGREDIENTES[i];
      const u = ing.unit || 'g';
      const lbl = ingPriceLabels(ing);
      const cantLabel = u==='u' ? 'Unidades por paquete' : u==='kg'||u==='L' ? `${u} por paquete` : `${u} por paquete`;
      const d=document.createElement('div'); d.className='ing-card';
      d.innerHTML=`<div class="ing-name">${ing.name}</div>
        <div class="ing-row"><label>Precio paquete ($)</label><input class="ing-input" type="number" value="${ing.precioPkg}" min="0" onchange="INGREDIENTES[${i}].precioPkg=parseFloat(this.value)||0;ingNormalize(INGREDIENTES[${i}]);renderIngredientes()"></div>
        <div class="ing-row"><label>${cantLabel}</label><div style="display:flex;gap:4px;align-items:center">
          <input class="ing-input" type="number" value="${ing.cantidad}" min="0.001" step="any" style="width:70px" onchange="INGREDIENTES[${i}].cantidad=parseFloat(this.value)||1;ingNormalize(INGREDIENTES[${i}]);renderIngredientes()">
          <select style="border:1px solid var(--border);border-radius:5px;padding:3px 6px;font-size:12px;background:var(--card,white);color:var(--ink);outline:none;color:var(--ink)" onchange="INGREDIENTES[${i}].unit=this.value;ingNormalize(INGREDIENTES[${i}]);renderIngredientes()">${unitSel(i,u)}</select>
        </div></div>
        <div class="ing-row" style="margin-top:6px;font-size:11px;color:var(--accent);font-family:'DM Mono',monospace"><span>${lbl.a}</span><span>${lbl.b}</span></div>
        <button class="remove-row-btn" style="margin-top:6px;font-size:12px" onclick="confirmIngDel(${i})">✕ Eliminar</button>`;
      grid.appendChild(d);
    });
  } else {
    // List view - compact table
    const usd=getUSD();
    list.innerHTML=`<table class="env-table"><thead><tr>
      <th>Ingrediente</th><th>Precio paquete ($)</th><th>Cantidad</th><th>Unidad</th><th>$/base</th><th>Ref. kg/L</th><th>USD ref.</th><th></th></tr></thead>
      <tbody>${ingIndices.map((i)=>{const ing=INGREDIENTES[i];
        const u = ing.unit || 'g';
        const pxb = ingPxBase(ing);
        const lbl = ingPriceLabels(ing);
        const refPx = (u==='g'||u==='kg') ? pxb*1000 : (u==='ml'||u==='L') ? pxb*1000 : pxb;
        const refUSD = refPx/usd;
        return`<tr>
          <td><input class="env-name-input" type="text" value="${ing.name}" oninput="INGREDIENTES[${i}].name=this.value" onchange="renderIngredientes()"></td>
          <td><input class="env-input" type="number" value="${ing.precioPkg}" min="0" onchange="INGREDIENTES[${i}].precioPkg=parseFloat(this.value)||0;ingNormalize(INGREDIENTES[${i}]);renderIngredientes()"></td>
          <td><input class="env-input" type="number" value="${ing.cantidad}" min="0.001" step="any" onchange="INGREDIENTES[${i}].cantidad=parseFloat(this.value)||1;ingNormalize(INGREDIENTES[${i}]);renderIngredientes()"></td>
          <td><select style="border:1px solid var(--border);border-radius:5px;padding:3px 5px;font-size:12px;background:white;outline:none" onchange="INGREDIENTES[${i}].unit=this.value;ingNormalize(INGREDIENTES[${i}]);renderIngredientes()">${unitSel(i,u)}</select></td>
          <td style="font-family:'DM Mono',monospace;font-size:12px;color:var(--muted)">${lbl.a.split(': ')[1]}</td>
          <td style="font-family:'DM Mono',monospace;font-size:12px;color:var(--primary);font-weight:600">${u==='u'?'-':fmt(refPx)}</td>
          <td style="font-family:'DM Mono',monospace;font-size:12px;color:var(--muted)">${u==='u'?'-':'USD '+(refUSD).toFixed(2)}</td>
          <td><button class="remove-row-btn" onclick="confirmIngDel(${i})">✕</button></td>
        </tr>`;
      }).join('')}</tbody></table>`;
  }
}
function addIngrediente(){INGREDIENTES.push({id:'ing_'+Date.now(),name:'Nuevo ingrediente',precioPkg:1000,grPaquete:1000,cantidad:1000,unit:'g'});renderIngredientes();}
function confirmIngDel(i){showConfirm(`Eliminar "${INGREDIENTES[i].name}"`,`¿Eliminar "${INGREDIENTES[i].name}" de la base de ingredientes?`,()=>{INGREDIENTES.splice(i,1);renderIngredientes();});}

// ═══════════════════════════════════════════════════════
// ENVASES
// ═══════════════════════════════════════════════════════
function renderEnvases() {
  const tbody=document.getElementById('env-tbody'); tbody.innerHTML='';
  const usd=getUSD();
  // Apply search + sort
  const envSearchVal = (document.getElementById('env-search')?.value||'').toLowerCase();
  const envSortVal   = document.getElementById('env-sort')?.value||'';
  let envIndices = ENVASES.map((_,i)=>i);
  if(envSearchVal) envIndices = envIndices.filter(i=>ENVASES[i].name.toLowerCase().includes(envSearchVal));
  if(envSortVal==='name-asc')   envIndices.sort((a,b)=>ENVASES[a].name.localeCompare(ENVASES[b].name));
  if(envSortVal==='name-desc')  envIndices.sort((a,b)=>ENVASES[b].name.localeCompare(ENVASES[a].name));
  if(envSortVal==='price-desc') envIndices.sort((a,b)=>(ENVASES[b].precioPkg/ENVASES[b].cantidad)-(ENVASES[a].precioPkg/ENVASES[a].cantidad));
  if(envSortVal==='price-asc')  envIndices.sort((a,b)=>(ENVASES[a].precioPkg/ENVASES[a].cantidad)-(ENVASES[b].precioPkg/ENVASES[b].cantidad));
  envIndices.forEach((i)=>{
    const e=ENVASES[i];
    const u=e.precioPkg/e.cantidad;
    const tr=document.createElement('tr');
    tr.innerHTML=`<td><input class="env-name-input" type="text" value="${e.name}" oninput="ENVASES[${i}].name=this.value"></td>
      <td><input class="env-input" type="number" value="${e.precioPkg}" min="0" onchange="ENVASES[${i}].precioPkg=parseFloat(this.value)||0;renderEnvases()"></td>
      <td><input class="env-input" type="number" value="${e.cantidad}" min="1" onchange="ENVASES[${i}].cantidad=parseFloat(this.value)||1;renderEnvases()"></td>
      <td style="font-family:'DM Mono',monospace;color:var(--primary)">${fmt(u)}</td>
      <td style="font-family:'DM Mono',monospace;color:var(--muted)">USD ${(u/usd).toFixed(4)}</td>
      <td><button class="remove-row-btn" onclick="confirmEnvDel(${i})">✕</button></td>`;
    tbody.appendChild(tr);
  });
}
function addEnvase(){ENVASES.push({id:'env_'+Date.now(),name:'Nuevo envase',precioPkg:1000,cantidad:100});renderEnvases();}
function confirmEnvDel(i){showConfirm(`Eliminar "${ENVASES[i].name}"`,'¿Eliminar?',()=>{ENVASES.splice(i,1);renderEnvases();});}

// ═══════════════════════════════════════════════════════
// TIERS
// ═══════════════════════════════════════════════════════
function renderTiers() {
  const g=document.getElementById('tier-grid'); g.innerHTML='';
  TIERS.forEach((t,i)=>{
    const pct=Math.round((t.factor-1)*100);
    const d=document.createElement('div'); d.className='tier-card'+(i>=5?' removable':'');
    d.innerHTML=`${i>=5?`<button class="remove-tier-btn" onclick="TIERS.splice(${i},1);renderTiers();renderProductos()">×</button>`:''}<span class="tier-badge" style="background:${t.color};color:white">${t.id}</span><input class="tier-name-input" value="${t.name}" oninput="TIERS[${i}].name=this.value"><div class="tier-factor-wrap"><span class="tier-factor-label">Factor</span><input class="tier-factor-input" type="number" value="${t.factor.toFixed(2)}" step="0.05" min="1" onchange="TIERS[${i}].factor=parseFloat(this.value)||1;renderProductos();renderDashboard()"></div><div class="tier-margin">Ganancia aprox: <strong>${pct}%</strong></div>`;
    g.appendChild(d);
  });
}
function addTier(){if(TIERS.filter(t=>t.id.startsWith('TC')).length>=4) return alert('Máx 4 personalizados');customTC++;TIERS.push({id:'TC'+customTC,name:'Personalizado '+customTC,factor:1.50,color:TIER_COLORS[TIERS.length%TIER_COLORS.length]});renderTiers();}

// ═══════════════════════════════════════════════════════
// UNIFIED AJUSTES TABS (lightweight — no content moving)
// ═══════════════════════════════════════════════════════
function _renderAjustesTabs(activeTab) {
  // Tab definitions: id → panel name for showPanel
  const tabs = [
    {id:'personal', label:'🎨 Personalización', panel:'personalizacion'},
    {id:'canales', label:'🏪 Canales', panel:'canales'},
    {id:'tienda', label:'🛒 Tienda Online', panel:'ajustes'},
    {id:'tiers', label:'📊 Tiers', panel:'ajustes'},
    {id:'backup', label:'💾 Archivo y respaldo', panel:'ajustes'},
    {id:'datos', label:'⚠️ Datos', panel:'ajustes'},
  ];
  const tabBarHTML = '<div class="rep-tabs" style="margin-bottom:18px">' +
    tabs.map(t => `<button class="rep-tab ${t.id===activeTab?'active':''}" onclick="_ajNavTab('${t.id}')">${t.label}</button>`).join('') +
    '</div>';

  // Inject tab bar at top of the CURRENT active panel
  const panelName = tabs.find(t=>t.id===activeTab)?.panel || 'ajustes';
  const panel = document.getElementById('panel-' + panelName);
  if (!panel) return;

  // Remove any existing injected tab bar from ALL ajustes-related panels
  ['ajustes','canales','personalizacion'].forEach(pn => {
    const p = document.getElementById('panel-' + pn);
    if (p) { const old = p.querySelector('.aj-injected-tabs'); if (old) old.remove(); }
  });

  // Insert tab bar
  const bar = document.createElement('div');
  bar.className = 'aj-injected-tabs';
  bar.innerHTML = tabBarHTML;
  panel.insertBefore(bar, panel.firstChild);

  // For ajustes panel: toggle sub-tab content visibility
  if (panelName === 'ajustes') {
    ['tiers','backup','datos','tienda'].forEach(tid => {
      const el = document.getElementById('aj-tab-' + tid);
      if (el) el.style.display = (tid === activeTab) ? '' : 'none';
    });
  }

  // Override page title
  const titleEl = document.getElementById('page-title');
  if (titleEl) titleEl.textContent = 'Ajustes';

  // Highlight ajustes nav item
  document.querySelectorAll('.nav-item').forEach(n => {
    const onclick = n.getAttribute('onclick') || '';
    n.classList.toggle('active', onclick.includes("'ajustes'"));
  });
}

function _ajNavTab(tabId) {
  const tabMap = {personal:'personalizacion', canales:'canales', tienda:'ajustes', tiers:'ajustes', backup:'ajustes', datos:'ajustes'};
  const targetPanel = tabMap[tabId] || 'ajustes';

  // Save tab state
  if (typeof _saveTabState === 'function') _saveTabState('ajustes', tabId);

  // Navigate to the target panel (without recursion)
  window._ajSkipTabs = true;
  showPanel(targetPanel);
  window._ajSkipTabs = false;

  // Then render tabs with correct active state
  _renderAjustesTabs(tabId);

  // Trigger specific renders
  if (tabId === 'tienda' && typeof _renderTiendaOnline === 'function') _renderTiendaOnline();
  if (tabId === 'backup' && SAHTEN.projectUi) SAHTEN.projectUi.renderBackupPanel();
  if (tabId === 'tiers') renderTiers();
  if (tabId === 'canales') renderChannels();
  if (tabId === 'personal' && typeof renderCustPanel === 'function') setTimeout(renderCustPanel, 100);
}

// ═══════════════════════════════════════════════════════
// CHANNELS
// ═══════════════════════════════════════════════════════
function renderChannels() {
  const commPct = Math.round(globalComm() * 100);
  const commLabel = commPct > 0
    ? `<span style="display:inline-flex;align-items:center;gap:4px;background:rgba(242,140,0,0.1);border:1px solid rgba(242,140,0,0.35);border-radius:5px;padding:2px 7px;font-size:10px;font-weight:700;color:var(--accent)">✦ Incluye ${commPct}% com. venta global</span>`
    : '';

  // Render mostrador separately
  const mostradorCh = CHANNELS.find(c=>c.id==='mostrador');
  const mostradorEl = document.getElementById('channel-mostrador');
  if(mostradorCh && mostradorEl) {
    const i = CHANNELS.indexOf(mostradorCh);
    const ccol = chColor(mostradorCh.id);
    const precioEjemplo = channelPrice(PRODUCTS[0], mostradorCh.id) || mostradorPrice(PRODUCTS[0]);
    const basePreComm   = mostradorPrice(PRODUCTS[0]) / (1 + globalComm()) || 0;
    mostradorEl.innerHTML = `<div class="channel-card" style="border-top:3px solid ${ccol.bg};max-width:400px">
      <div style="display:flex;align-items:center;gap:8px;margin-bottom:6px">
        <div style="width:10px;height:10px;border-radius:50%;background:${ccol.bg};flex-shrink:0"></div>
        <div class="channel-name" style="margin-bottom:0">${mostradorCh.name}</div>
        <span class="ch-badge" style="background:${ccol.bg};color:${ccol.text};margin-left:auto">${mostradorCh.enabled?'Activo':'Inactivo'}</span>
      </div>
      <div class="channel-desc">${mostradorCh.desc}</div>
      <div class="channel-enabled" style="margin-top:8px"><label class="toggle"><input type="checkbox" ${mostradorCh.enabled?'checked':''} onchange="CHANNELS[${i}].enabled=this.checked;renderProductos();renderChannels()"><span class="toggle-slider" style="${mostradorCh.enabled?'background:'+ccol.bg:''}"></span></label><span style="font-size:12px;color:#888">${mostradorCh.enabled?'Activo':'Inactivo'}</span></div>
      <div class="channel-row"><label>Sobrecargo sobre costo base (%)</label><input class="channel-input" type="number" value="${Math.round(mostradorCh.surcharge*100)}" min="0" max="200" step="1" onchange="CHANNELS[${i}].surcharge=parseFloat(this.value)/100;recalcAll();renderChannels()"></div>
      <div class="channel-row"><label>Comisión de la plataforma (%)</label><input class="channel-input" type="number" value="${Math.round(mostradorCh.commission*100)}" min="0" max="100" step="1" onchange="CHANNELS[${i}].commission=parseFloat(this.value)/100;recalcAll();renderChannels()"></div>
      <div class="channel-row" style="border-top:1px dashed var(--border);margin-top:8px;padding-top:8px">
        <label style="display:flex;align-items:center;gap:6px">
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" stroke-width="2.5"><line x1="19" y1="5" x2="5" y2="19"/><circle cx="6.5" cy="6.5" r="2.5"/><circle cx="17.5" cy="17.5" r="2.5"/></svg>
          Descuento global del canal (%)
        </label>
        <input class="channel-input" type="number" value="${Math.round(mostradorCh.channelDisc||0)}" min="0" max="100" step="1"
          title="Descuento aplicado a TODOS los productos en este canal. Si el producto tiene su propio descuento, ese tiene prioridad."
          onchange="CHANNELS[${i}].channelDisc=parseFloat(this.value)||0;recalcAll();renderChannels()">
      </div>
      <div style="margin-top:10px;border-top:1px solid var(--border);padding-top:10px">
        <div style="font-size:10px;color:var(--muted);margin-bottom:4px;text-transform:uppercase;letter-spacing:0.3px">Subtotal – Pizza Muzzarella</div>
        <div style="font-family:'DM Mono',monospace;font-size:18px;font-weight:700;color:${ccol.bg}">${fmt(precioEjemplo)}</div>
        ${commPct > 0 ? `
        <div style="margin-top:5px;display:flex;flex-direction:column;gap:3px">
          ${commLabel}
          <div style="font-size:10px;color:var(--muted);margin-top:2px">
            Precio sin com. venta: ${fmt(Math.round(basePreComm/50)*50)} → +${commPct}% = <strong>${fmt(precioEjemplo)}</strong>
          </div>
        </div>` : ''}
        <div style="font-size:11px;color:var(--muted);margin-top:4px">↳ Los demás canales calculan sobre este valor</div>
        <div style="margin-top:8px;padding:8px 12px;background:rgba(242,140,0,0.08);border:1px solid rgba(242,140,0,0.2);border-radius:8px;font-size:11px;color:var(--accent);font-weight:600">📌 Este precio es el que se muestra en la página del Menú Online.</div>
      </div>
    </div>`;
  }

  // Render other channels
  const g=document.getElementById('channel-grid'); g.innerHTML='';
  CHANNELS.filter(c=>c.id!=='mostrador').forEach((c)=>{
    const i = CHANNELS.indexOf(c);
    const d=document.createElement('div'); d.className='channel-card';
    const ccol=chColor(c.id);
    d.style.borderTop=`3px solid ${ccol.bg}`;
    const p0          = PRODUCTS[0];
    const gross       = channelPrice(p0, c.id) || mostradorPrice(p0);
    const discEff     = effectiveChannelDisc(p0, c.id);
    const grossDisc   = discEff > 0 ? Math.round(gross*(1-discEff)/50)*50 : gross;
    const net         = channelNetReceivedWithDisc(p0, c.id) || Math.round(grossDisc*(1-c.commission));
    const mostrBase   = mostradorFinalPrice(PRODUCTS[0]);
    const preComm     = gross / (1 + globalComm());   // precio antes de aplicar com. venta
    d.innerHTML=`<div style="display:flex;align-items:center;gap:8px;margin-bottom:6px">
        <div style="width:10px;height:10px;border-radius:50%;background:${ccol.bg};flex-shrink:0"></div>
        <div class="channel-name" style="margin-bottom:0">${c.name}</div>
        <span class="ch-badge" style="background:${ccol.bg};color:${ccol.text};margin-left:auto">${c.enabled?'Activo':'Inactivo'}</span>
      </div>
      <div class="channel-desc">${c.desc}</div>
      <div class="channel-enabled" style="margin-top:8px"><label class="toggle"><input type="checkbox" ${c.enabled?'checked':''} onchange="CHANNELS[${i}].enabled=this.checked;renderProductos();renderChannels()"><span class="toggle-slider" style="${c.enabled?'background:'+ccol.bg:''}"></span></label><span style="font-size:12px;color:#888">${c.enabled?'Activo':'Inactivo'}</span></div>
      <div class="channel-row"><label>Sobrecargo sobre subtotal (%)</label><input class="channel-input" type="number" value="${Math.round(c.surcharge*100)}" min="0" max="200" step="1" onchange="CHANNELS[${i}].surcharge=parseFloat(this.value)/100;recalcAll();renderChannels()"></div>
      <div class="channel-row"><label>Comisión de la plataforma (%)</label><input class="channel-input" type="number" value="${Math.round(c.commission*100)}" min="0" max="100" step="1" onchange="CHANNELS[${i}].commission=parseFloat(this.value)/100;recalcAll();renderChannels()"></div>
      <div class="channel-row" style="border-top:1px dashed var(--border);margin-top:8px;padding-top:8px">
        <label style="display:flex;align-items:center;gap:6px">
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" stroke-width="2.5"><line x1="19" y1="5" x2="5" y2="19"/><circle cx="6.5" cy="6.5" r="2.5"/><circle cx="17.5" cy="17.5" r="2.5"/></svg>
          Descuento global del canal (%)
        </label>
        <input class="channel-input" type="number" value="${Math.round(c.channelDisc||0)}" min="0" max="100" step="1"
          title="Descuento aplicado a TODOS los productos en este canal. Si el producto tiene su propio descuento, ese tiene prioridad."
          onchange="CHANNELS[${i}].channelDisc=parseFloat(this.value)||0;recalcAll();renderChannels()">
      </div>
      <div style="margin-top:10px;border-top:1px solid var(--border);padding-top:10px">
        <div style="font-size:10px;color:var(--muted);margin-bottom:4px;text-transform:uppercase;letter-spacing:0.3px">Precio ejemplo – Pizza Muzzarella</div>
        <div style="display:flex;align-items:baseline;gap:6px;margin-top:4px">
          ${discEff>0?`<span style="font-family:'DM Mono',monospace;font-size:12px;opacity:0.45;text-decoration:line-through">${fmt(gross)}</span>`:''}
          <span style="font-family:'DM Mono',monospace;font-size:15px;font-weight:600;color:${ccol.bg}">${fmt(grossDisc)}</span>
          ${discEff>0?`<span style="font-size:10px;background:${ccol.bg};color:${ccol.text};border-radius:99px;padding:1px 7px;font-weight:700">−${(discEff*100).toFixed(0)}%</span>`:''}
        </div>
        <div style="font-size:10px;color:var(--muted);margin-top:3px">
          ${fmt(mostrBase)} base
          → +${Math.round(c.surcharge*100)}% sobrecargo
          ${discEff>0?`→ −${(discEff*100).toFixed(0)}% descuento`:''}
          ${commPct>0?`→ +${commPct}% com.`:''}
          = <strong>${fmt(grossDisc)}</strong>
        </div>
        <div style="font-size:11px;color:var(--green);font-weight:700;margin-top:5px">↳ Vos recibís: ${fmt(net)}</div>
        ${c.commission>0?`<div style="font-size:10px;color:var(--muted)">Comisión ${Math.round(c.commission*100)}% = −${fmt(Math.round(grossDisc*c.commission))}</div>`:''}
      </div>`;
    g.appendChild(d);
  });
}

// ═══════════════════════════════════════════════════════
// GASTOS FIJOS
// ═══════════════════════════════════════════════════════
function renderGFSection(id,data,type) {
  document.getElementById(id).innerHTML=data.map((g,i)=>`
    <div class="gf-row">
      <input class="gf-name-input" type="text" value="${String(g.name).replace(/"/g,'&quot;')}" onchange="gfEditName('${type}',${i},this.value)">
      <div class="gf-amount">
        <input class="gf-input" type="number" value="${g.amount}" onchange="gfEditAmount('${type}',${i},this.value)">
        <span style="font-size:11px;color:var(--muted)">USD ${(g.amount/getUSD()).toFixed(0)}</span>
        <button class="remove-row-btn" onclick="confirmGastoDel(${i},'${type}')">✕</button>
      </div>
    </div>`).join('')+`<div class="gf-total"><span>Total</span><span>${fmt(data.reduce((s,g)=>s+g.amount,0))}</span></div>`;
}
// v3: toda edición de gastos fijos (alta, cambio de nombre o monto, baja) queda registrada en el mes en curso


// ── Gastos fijos: la lógica vive en src/core/gf.js; acá solo se conecta con la pantalla ──
const _GF = () => SAHTEN.core, _S = () => SAHTEN.state;
function gfAfterEdit(){ renderGastos(); recalcAll(); scheduleSave(); }
function gfEditName(type,i,v){ if(_GF().gfEditName(_S(),type,i,v)) gfAfterEdit(); }
function gfEditAmount(type,i,v){ if(_GF().gfEditAmount(_S(),type,i,v)) gfAfterEdit(); }
function addGastoRow(type){ _GF().gfAddRow(_S(),type); gfAfterEdit(); }
function confirmGastoDel(i,type){ const arr=gfArr(type); const g=arr[i]; if(!g) return; showConfirm(`Eliminar "${g.name}"`,'Se quita de los gastos fijos y del mes en curso. Los meses cerrados conservan su registro.',()=>{ _GF().gfDeleteRow(_S(),type,i); gfAfterEdit(); },null,'Eliminar','Cancelar'); }
function gfmAddExtra(){ if(_GF().gfmAddExtra(_S(),gfmMonth)){ scheduleSave(); renderGastos(); } }
function gfmExtraName(i,v){ if(_GF().gfmRenameItem(_S(),gfmMonth,i,v)){ scheduleSave(); renderGFMonthly(); } }
function gfmDelExtra(i){ if(_GF().gfmDelExtra(_S(),gfmMonth,i)){ scheduleSave(); renderGastos(); } }
function gfmMarkReviewed(){ _GF().gfmMarkReviewed(_S(),gfmMonth); scheduleSave(); renderGastos(); }
function gfmSetReal(i,v){ if(_GF().gfmSetReal(_S(),gfmMonth,i,v)){ scheduleSave(); renderGastos(); } }
function gfmSyncBudget(){ if(_GF().gfmSyncBudget(_S(),gfmMonth)){ scheduleSave(); renderGastos(); } }
function gfmCopyBudgetToReal(){ if(_GF().gfmCopyBudgetToReal(_S(),gfmMonth)){ scheduleSave(); renderGastos(); } }
function gfmToggleClose(){ _GF().gfmToggleClose(_S(),gfmMonth); scheduleSave(); renderGastos(); }
function gfmApplyAverage(){
  const keys=_GF().gfmAverageKeys(_S());
  if(!keys.length) return alert('Necesitás al menos un mes cerrado con todos los gastos reales cargados.');
  showConfirm('Actualizar gastos fijos','Los montos de Gastos operativos y Sueldos se reemplazan por el promedio real de '+keys.map(gfmLabel).join(', ')+'. Esto cambia todos los precios.',()=>{
    _GF().gfmApplyAverage(_S(),keys); renderGastos(); recalcAll(); scheduleSave();
  },null,'Actualizar','Cancelar');
}

// Preview en tiempo real mientras escribís
function gfUpdatePreview() {
  const pct = parseFloat(document.getElementById('gf-disc-pct')?.value||0);
  const el  = document.getElementById('gf-disc-preview');
  if(!el) return;
  if(!pct) { el.textContent = '—'; return; }
  const raw = totalGFRaw();
  el.textContent = '− ' + fmt(raw * pct/100);
}

function gfSaveDiscNote() {
  const pct  = parseFloat(document.getElementById('gf-disc-pct')?.value||0);
  const nota = (document.getElementById('gf-disc-notes')?.value||'').trim();
  if(!pct && pct !== 0)  { alert('Ingresá un porcentaje de descuento.'); return; }
  if(!nota)              { alert('Escribí el motivo del descuento.'); return; }
  if(pct <= 0)           { alert('El descuento debe ser mayor a 0%.'); return; }
  const raw   = totalGFRaw();
  const ahorro = raw * pct/100;
  const now   = new Date();
  const fecha = now.toLocaleDateString('es-AR') + ' ' + now.toLocaleTimeString('es-AR',{hour:'2-digit',minute:'2-digit'});
  GF_DISC_HISTORY.push({ id: Date.now(), pct, nota, fecha, ahorro, active: true });
  document.getElementById('gf-disc-pct').value   = '';
  document.getElementById('gf-disc-notes').value = '';
  document.getElementById('gf-disc-preview').textContent = '—';
  renderGastos();
  recalcAll();
  scheduleSave();
}

function gfToggleDisc(id) {
  const h = GF_DISC_HISTORY.find(x => x.id===id);
  if(h) { h.active = !h.active; renderGastos(); recalcAll(); scheduleSave(); }
}

function gfRemoveDisc(id) {
  const idx = GF_DISC_HISTORY.findIndex(x => x.id===id);
  if(idx>=0) { GF_DISC_HISTORY.splice(idx,1); renderGastos(); recalcAll(); scheduleSave(); }
}

function renderDiscHistory() {
  const el = document.getElementById('gf-disc-history');
  if (!el) return;
  const raw = totalGFRaw();
  const active = GF_DISC_HISTORY.filter(h => h.active!==false);
  const totalDisc = active.reduce((s,h)=>s+(h.pct||0),0);
  const totalAhorro = raw * Math.min(totalDisc,100)/100;

  if (!GF_DISC_HISTORY.length) {
    el.innerHTML = '<div style="text-align:center;padding:14px;color:var(--muted);font-size:12px">Sin descuentos activos — agregá uno arriba</div>';
    return;
  }

  el.innerHTML = `
    <div style="font-size:11px;font-weight:700;color:var(--muted);text-transform:uppercase;letter-spacing:0.4px;margin-bottom:8px">
      Descuentos activos
      ${active.length ? `<span style="margin-left:8px;font-size:11px;font-weight:700;color:var(--green);font-family:'DM Mono',monospace">
        − ${fmt(totalAhorro)} total (${totalDisc.toFixed(1)}%)</span>` : ''}
    </div>
    <div style="display:flex;flex-direction:column;gap:6px">
    ${GF_DISC_HISTORY.map(h => {
      const isOn = h.active !== false;
      const ahorro = raw * (h.pct||0) / 100;
      return `
      <div style="background:white;border:1px solid ${isOn?'var(--green)':'var(--border)'};border-radius:8px;padding:10px 14px;display:flex;align-items:center;gap:12px;flex-wrap:wrap;opacity:${isOn?1:0.5};transition:opacity 0.2s">
        <!-- Toggle activo/inactivo -->
        <label class="toggle" title="${isOn?'Desactivar':'Activar'}" style="flex-shrink:0">
          <input type="checkbox" ${isOn?'checked':''} onchange="gfToggleDisc(${h.id})">
          <span class="toggle-slider"></span>
        </label>
        <!-- Porcentaje -->
        <span style="font-family:'DM Mono',monospace;font-size:15px;font-weight:700;color:${isOn?'var(--green)':'var(--muted)'};min-width:46px">${h.pct}%</span>
        <!-- Nota y fecha -->
        <div style="flex:1;min-width:100px">
          <div style="font-size:13px;font-weight:600;color:var(--ink)">${h.nota}</div>
          <div style="font-size:10px;color:var(--muted);margin-top:2px">${h.fecha}</div>
        </div>
        <!-- Ahorro calculado -->
        <div style="text-align:right;min-width:80px">
          <div style="font-size:10px;color:var(--muted)">Ahorro mensual</div>
          <div style="font-family:'DM Mono',monospace;font-size:13px;font-weight:600;color:${isOn?'var(--green)':'var(--muted)'}">− ${fmt(ahorro)}</div>
        </div>
        <button onclick="gfRemoveDisc(${h.id})" class="remove-row-btn" title="Eliminar descuento">✕</button>
      </div>`;
    }).join('')}
    </div>`;
}

// ═══════════════════════════════════════════════════════
// CONTROL MENSUAL DE GASTOS FIJOS (v3)
// ═══════════════════════════════════════════════════════
let gfmMonth = (()=>{const d=new Date();return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0');})();
// Nuevo mes: presupuesto = gastos fijos actuales; real precargado con el real del mes anterior (o el presupuesto)
// Mantiene sincronizados los meses abiertos (en curso y preparados) con la lista de gastos fijos
// Cierra automáticamente los meses pasados y crea el mes en curso precargado
// Recordatorio: últimos 3 días del mes (revisar el próximo) o mes en curso sin revisar
function gfmRemindToast(){
  const r=gfmReminder(); if(!r) return;
  const k='sahten_gfm_toast_'+new Date().toISOString().slice(0,10);
  try{ if(localStorage.getItem(k)) return; localStorage.setItem(k,'1'); }catch(e){}
  if(typeof _posToast==='function') _posToast('📅 '+r.text);
}
function gfmGoReview(k){ gfmGet(k,true); gfmMonth=k; scheduleSave(); if(typeof showPanel==='function') showPanel('gastos'); renderGastos(); setTimeout(()=>{const el=document.getElementById('gfm-body'); if(el){ const y=el.getBoundingClientRect().top+window.scrollY-120; window.scrollTo({top:y,behavior:'smooth'}); }},100); }
function gfmGo(d){ gfmMonth=gfmShift(gfmMonth,d); renderGFMonthly(); }
function gfmStart(){ gfmGet(gfmMonth,true); scheduleSave(); renderGastos(); }
function gfmSetNote(v){ const m=gfmGet(gfmMonth,true); m.note=v; scheduleSave(); }
// (v4) gfmEnsureMonths() y el recordatorio corren al abrir cada proyecto (src/project/app.js)
function gfmLogHtml(m){
  const L=(m.log||[]).slice().reverse(); if(!L.length) return '';
  const tp=x=>x.type==='s'?'sueldo':'gasto';
  const txt=x=>{ const n='<strong>'+String(x.name).replace(/</g,'&lt;')+'</strong>';
    if(x.action==='add') return 'Alta de '+tp(x)+' '+n;
    if(x.action==='delete') return 'Baja de '+tp(x)+' '+n+(x.from!=null?' ('+fmt(x.from)+')':'');
    if(x.action==='rename') return 'Renombrado: '+String(x.from).replace(/</g,'&lt;')+' → '+n;
    if(x.action==='amount') return n+': '+fmt(x.from)+' → '+fmt(x.to)+' <span style="color:'+(x.to>x.from?'var(--red)':'var(--green)')+'">('+(x.to>x.from?'+':'')+(x.from?((x.to-x.from)/x.from*100).toFixed(0)+'%':'nuevo')+')</span>';
    if(x.action==='extra') return 'Gasto extraordinario agregado';
    if(x.action==='extra-del') return 'Gasto extraordinario quitado: '+n;
    return n; };
  return '<div style="margin-top:14px"><div style="font-size:11px;font-weight:700;color:var(--muted);text-transform:uppercase;letter-spacing:0.4px;margin-bottom:6px">Cambios en los gastos fijos este mes</div><div style="display:flex;flex-direction:column;gap:4px;font-size:12px">'+L.slice(0,30).map(x=>'<div style="display:flex;gap:10px"><span style="color:var(--muted);font-family:\'DM Mono\',monospace;font-size:11px;min-width:92px">'+new Date(x.at).toLocaleDateString('es-AR',{day:'2-digit',month:'short'})+' '+new Date(x.at).toLocaleTimeString('es-AR',{hour:'2-digit',minute:'2-digit'})+'</span><span>'+txt(x)+'</span></div>').join('')+'</div></div>';
}
function renderGFMonthly(){
  const nav=document.getElementById('gfm-nav'), body=document.getElementById('gfm-body'), hist=document.getElementById('gfm-history');
  if(!nav||!body) return;
  const m=gfmGet(gfmMonth,false);
  const rem=gfmReminder(); const nowK=gfmNowKey();
  const remHtml=rem?`<div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap;padding:10px 14px;margin-bottom:12px;border-radius:10px;background:rgba(242,140,0,0.1);border:1px solid rgba(242,140,0,0.35);font-size:12px;color:var(--ink)"><span style="font-size:16px">📅</span><span style="flex:1;min-width:180px">${rem.text}</span>${rem.key===gfmMonth?'':`<button class="btn btn-accent" onclick="gfmGoReview('${rem.key}')">Revisar ${gfmLabel(rem.key)}</button>`}</div>`:'';
  nav.innerHTML=`<button class="btn" style="padding:4px 10px" onclick="gfmGo(-1)">‹</button><strong style="min-width:130px;text-align:center;font-size:13px">${gfmLabel(gfmMonth)}</strong><button class="btn" style="padding:4px 10px" onclick="gfmGo(1)">›</button>`;
  if(!m){
    body.innerHTML=remHtml+(gfmMonth>nowK
      ? `<div style="text-align:center;padding:20px;color:var(--muted);font-size:13px">${gfmLabel(gfmMonth)} todavía no empezó.<div style="margin-top:10px"><button class="btn btn-accent" onclick="gfmStart()">Preparar ${gfmLabel(gfmMonth)}</button></div><div style="font-size:11px;margin-top:8px">Se precarga con tus gastos fijos actuales y lo pagado el mes anterior, para que solo actualices lo que cambió.</div></div>`
      : `<div style="text-align:center;padding:20px;color:var(--muted);font-size:13px">Sin registro para ${gfmLabel(gfmMonth)}.</div>`);
  } else {
    const t=gfmTotals(m), dis=m.closed?'disabled':'';
    const row=(it,i)=>{ const has=gfmHas(it); const d=has?(+it.real-(it.budget||0)):null; const pct=has&&it.budget>0?d/it.budget*100:null; const col=d==null||d===0?'var(--muted)':(d>0?'var(--red)':'var(--green)');
      const nameCell = it.extra && !m.closed ? `<input class="stock-input" type="text" style="width:100%;min-width:120px;text-align:left" value="${String(it.name).replace(/"/g,'&quot;')}" onchange="gfmExtraName(${i},this.value)">` : it.name;
      const typeCell = it.extra ? 'Extraordinario'+(m.closed?'':` <button class="remove-row-btn" style="margin-left:4px" title="Quitar" onclick="gfmDelExtra(${i})">✕</button>`) : (it.type==='s'?'Sueldo':'Operativo');
      return `<tr><td>${nameCell}</td><td style="color:var(--muted);font-size:11px;white-space:nowrap">${typeCell}</td><td style="text-align:right;font-family:'DM Mono',monospace">${fmt(it.budget||0)}</td><td style="text-align:right"><input class="stock-input" type="number" min="0" step="1" style="width:110px;text-align:right" value="${has?it.real:''}" placeholder="—" ${dis} onchange="gfmSetReal(${i},this.value)"></td><td style="text-align:right;font-family:'DM Mono',monospace;color:${col}">${d==null?'—':(d>0?'+':'')+fmt(d)}${pct!=null?' <span style="font-size:10px">('+(pct>0?'+':'')+pct.toFixed(0)+'%)</span>':''}</td></tr>`; };
    const dT=t.real-t.budget, colT=!t.hasReal?'var(--muted)':(dT>0?'var(--red)':'var(--green)');
    const status = m.closed ? '<span style="font-size:12px;font-weight:600;color:var(--green)">✓ Cerrado'+(m.autoClosed?' automáticamente':'')+'</span>'
      : (gfmMonth<nowK ? '<span style="font-size:12px;font-weight:600;color:var(--accent)">Reabierto para corregir</span>'
      : '<span style="font-size:12px;color:var(--muted)">Abierto · se cierra solo el 1 de '+gfmLabel(gfmShift(gfmMonth,1)).split(' ')[0].toLowerCase()+'</span>');
    body.innerHTML=remHtml+`
      <div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:12px;align-items:center">
        ${status}
        ${m.closed?'':'<button class="btn" onclick="gfmAddExtra()" title="Un gasto que solo ocurre este mes (no cambia tus gastos fijos)">+ Gasto extraordinario</button><button class="btn" onclick="gfmCopyBudgetToReal()" title="Iguala todos los reales al presupuesto">Igualar real al presupuesto</button>'}
        <span style="margin-left:auto;display:flex;gap:8px">
          ${!m.closed&&!m.reviewed?'<button class="btn btn-accent" onclick="gfmMarkReviewed()">✓ Marcar como revisado</button>':(!m.closed&&m.reviewed?'<span style="font-size:12px;color:var(--green);font-weight:600;align-self:center">✓ Revisado</span>':'')}
          ${gfmMonth<nowK?'<button class="btn" onclick="gfmToggleClose()">'+(m.closed?'Reabrir para corregir':'Cerrar mes')+'</button>':''}
        </span>
      </div>
      <div style="overflow-x:auto"><table class="env-table" style="width:100%"><thead><tr><th>Concepto</th><th>Tipo</th><th style="text-align:right">Presupuesto</th><th style="text-align:right">Real</th><th style="text-align:right">Diferencia</th></tr></thead><tbody>${m.items.map(row).join('')}</tbody>
      <tfoot><tr style="font-weight:700"><td colspan="2">Total</td><td style="text-align:right;font-family:'DM Mono',monospace">${fmt(t.budget)}</td><td style="text-align:right;font-family:'DM Mono',monospace">${t.hasReal?fmt(t.real):'—'}</td><td style="text-align:right;font-family:'DM Mono',monospace;color:${colT}">${t.hasReal?(dT>0?'+':'')+fmt(dT):'—'}</td></tr></tfoot></table></div>
      <textarea class="notes-input" style="width:100%;margin-top:12px;min-height:56px;resize:vertical" placeholder="Notas del mes (aumentos, gastos extraordinarios…)" ${dis} onchange="gfmSetNote(this.value)">${(m.note||'').replace(/</g,'&lt;')}</textarea>
      ${gfmLogHtml(m)}`;
  }
  if(!hist) return;
  const keys=Object.keys(GF_MONTHS).sort().reverse();
  if(!keys.length){ hist.innerHTML='<div style="text-align:center;padding:14px;color:var(--muted);font-size:12px">Todavía no hay meses registrados.</div>'; return; }
  const max=Math.max(1,...keys.map(k=>{const x=gfmTotals(GF_MONTHS[k]);return Math.max(x.budget,x.real);}));
  hist.innerHTML=`<div style="display:flex;flex-direction:column;gap:8px">${keys.map(k=>{const mm=GF_MONTHS[k], x=gfmTotals(mm); const v=x.hasReal&&x.budget>0?(x.real-x.budget)/x.budget*100:null; const col=v==null?'var(--muted)':(v>0?'var(--red)':'var(--green)');
    return `<div style="display:grid;grid-template-columns:130px minmax(0,1fr) 110px 70px;gap:10px;align-items:center;cursor:pointer;font-size:12px" onclick="gfmMonth='${k}';renderGFMonthly()">
      <div style="font-weight:${k===gfmMonth?700:500}">${gfmLabel(k)} ${mm.closed?'<span style="color:var(--green)">✓</span>':''}</div>
      <div style="display:flex;flex-direction:column;gap:3px"><div style="height:6px;border-radius:99px;background:var(--sand2);overflow:hidden"><div style="height:100%;width:${(x.budget/max*100).toFixed(1)}%;background:var(--muted)"></div></div><div style="height:6px;border-radius:99px;background:var(--sand2);overflow:hidden"><div style="height:100%;width:${(x.real/max*100).toFixed(1)}%;background:${col}"></div></div></div>
      <div style="text-align:right;font-family:'DM Mono',monospace">${x.hasReal?fmt(x.real):'—'}</div>
      <div style="text-align:right;font-family:'DM Mono',monospace;color:${col}">${v==null?'—':(v>0?'+':'')+v.toFixed(1)+'%'}</div></div>`;}).join('')}
    <div style="display:flex;gap:14px;font-size:11px;color:var(--muted);margin-top:4px;flex-wrap:wrap;align-items:center"><span>Barra gris: presupuesto · Barra de color: real</span><button class="btn" style="margin-left:auto" onclick="gfmApplyAverage()">Usar promedio real (últimos 3 meses cerrados) como GF</button></div></div>`;
}

function renderGastos() {
  gfmEnsureMonths();
  renderGFSection('gf-operativos',GASTOS_OP,'op');
  renderGFSection('gf-sueldos',GASTOS_S,'s');
  const raw=totalGFRaw();
  const usd=getUSD();
  const lv=gfmLastVar();
  document.getElementById('gf-kpis').innerHTML=`
    <div class="kpi"><div class="kpi-label">Total GF / mes</div><div class="kpi-value gold">${fmt(raw)}</div></div>
    <div class="kpi"><div class="kpi-label">En USD</div><div class="kpi-value">USD ${(raw/usd).toFixed(0)}</div></div>
    <div class="kpi"><div class="kpi-label">Por día</div><div class="kpi-value">${fmt(raw/30)}</div></div>
    <div class="kpi"><div class="kpi-label">Sueldos</div><div class="kpi-value">${fmt(GASTOS_S.reduce((s,g)=>s+g.amount,0))}</div></div>
    <div class="kpi"><div class="kpi-label">Real vs. presupuesto</div><div class="kpi-value" style="color:${lv==null?'var(--muted)':(lv>0?'var(--red)':'var(--green)')}">${lv==null?'—':(lv>0?'+':'')+lv.toFixed(1)+'%'}</div></div>`;
  renderGFMonthly();
  const allGF=[...GASTOS_OP,...GASTOS_S];
  mkChart('chart-gf-detail',{type:'bar',data:{labels:allGF.map(g=>g.name),datasets:[{label:'$',data:allGF.map(g=>g.amount),backgroundColor:TIER_COLORS.map(c=>c+'88'),borderColor:TIER_COLORS,borderWidth:1,borderRadius:4}]},options:{responsive:true,maintainAspectRatio:false,plugins:{legend:{display:false}},scales:{x:{ticks:{font:{size:9},maxRotation:30}},y:{ticks:{callback:v=>'$'+(v/1000000).toFixed(2)+'M',font:{size:10}}}}}});
}


// ═══════════════════════════════════════════════════════
// TAGS & STAR RATING
// ═══════════════════════════════════════════════════════
const TAG_PRESETS = [
  {name:'Vegano',     color:'#27ae60'},
  {name:'Sin gluten', color:'#e67e22'},
  {name:'Picante',    color:'#c0392b'},
  {name:'Popular',    color:'#8e44ad'},
  {name:'Nuevo',      color:'#2980b9'},
  {name:'Promocion',  color:'#d68910'},
  {name:'Temporada',  color:'#16a085'},
  {name:'Sin stock',  color:'#7f8c8d'},
];
let _tagProdIdx = null;

function showTagModal(prodIdx) {
  _tagProdIdx = prodIdx;
  const p = PRODUCTS[prodIdx];
  const existing = p.tags || [];
  const presetsHtml = TAG_PRESETS.map(t => {
    const already = existing.some(e => e.name === t.name);
    return '<button onclick="addPresetTag(' + prodIdx + ',\'' + t.name + '\',\'' + t.color + '\')" ' + (already?'disabled':'') + ' style="display:inline-flex;align-items:center;gap:6px;padding:5px 12px;border-radius:99px;border:1px solid ' + t.color + ';background:' + (already?t.color+'33':'white') + ';color:' + t.color + ';font-size:12px;font-weight:600;cursor:' + (already?'default':'pointer') + ';font-family:DM Sans,sans-serif;opacity:' + (already?0.5:1) + '">' + (already?'\u2713 ':'+  ') + t.name + '</button>';
  }).join('');
  const existingHtml = existing.length ? '<div style="margin-bottom:14px"><div style="font-size:11px;text-transform:uppercase;letter-spacing:0.4px;color:var(--muted);margin-bottom:8px;font-weight:600">Etiquetas actuales</div><div style="display:flex;flex-wrap:wrap;gap:6px">' + existing.map((tag,ti)=>'<span style="display:inline-flex;align-items:center;gap:5px;padding:4px 10px;border-radius:99px;background:' + tag.color + '22;color:' + tag.color + ';border:1px solid ' + tag.color + '55;font-size:12px;font-weight:600">' + tag.name + '<button onclick="removeTag(' + prodIdx + ',' + ti + ')" style="background:none;border:none;cursor:pointer;color:' + tag.color + ';font-size:13px;line-height:1;padding:0;margin-left:2px">\u00d7</button></span>').join('') + '</div></div>' : '';
  document.getElementById('modal-title').textContent = 'Etiquetas - ' + p.name;
  document.getElementById('modal-body').innerHTML = existingHtml + '<div style="margin-bottom:14px"><div style="font-size:11px;text-transform:uppercase;letter-spacing:0.4px;color:var(--muted);margin-bottom:8px;font-weight:600">Etiquetas predefinidas</div><div style="display:flex;flex-wrap:wrap;gap:6px">' + presetsHtml + '</div></div><div style="border-top:1px solid var(--border);padding-top:14px"><div style="font-size:11px;text-transform:uppercase;letter-spacing:0.4px;color:var(--muted);margin-bottom:8px;font-weight:600">Etiqueta personalizada</div><div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap"><input id="tag-custom-name" type="text" placeholder="Nombre de etiqueta" maxlength="20" style="border:1px solid var(--border);border-radius:7px;padding:7px 11px;font-size:13px;font-family:DM Sans,sans-serif;outline:none;flex:1;min-width:120px"><input id="tag-custom-color" type="color" value="#235328" style="width:38px;height:36px;border:1px solid var(--border);border-radius:7px;cursor:pointer;padding:2px"><button onclick="addCustomTag(' + prodIdx + ')" style="background:var(--primary);color:white;border:none;border-radius:7px;padding:7px 16px;font-size:12px;font-weight:600;cursor:pointer;font-family:DM Sans,sans-serif">+ Agregar</button></div></div>';
  document.getElementById('modal-overlay').classList.add('open');
}

function addPresetTag(prodIdx, name, color) {
  if(!PRODUCTS[prodIdx].tags) PRODUCTS[prodIdx].tags = [];
  if(PRODUCTS[prodIdx].tags.some(t=>t.name===name)) return;
  PRODUCTS[prodIdx].tags.push({name, color});
  renderProductos();
  showTagModal(prodIdx);
  scheduleSave();
}

function addCustomTag(prodIdx) {
  const name = (document.getElementById('tag-custom-name')?.value||'').trim();
  const color = document.getElementById('tag-custom-color')?.value || '#235328';
  if(!name) return;
  if(!PRODUCTS[prodIdx].tags) PRODUCTS[prodIdx].tags = [];
  if(PRODUCTS[prodIdx].tags.some(t=>t.name===name)) {
    const el=document.getElementById('tag-custom-name'); if(el)el.style.borderColor='var(--red)';
    return;
  }
  PRODUCTS[prodIdx].tags.push({name, color});
  renderProductos();
  showTagModal(prodIdx);
  scheduleSave();
}

function removeTag(prodIdx, tagIdx) {
  if(!PRODUCTS[prodIdx].tags) return;
  PRODUCTS[prodIdx].tags.splice(tagIdx, 1);
  renderProductos();
  const overlay = document.getElementById('modal-overlay');
  if(overlay && overlay.classList.contains('open') && _tagProdIdx === prodIdx) showTagModal(prodIdx);
  scheduleSave();
}

function setRating(prodIdx, stars) {
  PRODUCTS[prodIdx].rating = stars;
  renderProductos();
  scheduleSave();
}
function previewRating(prodIdx, stars) {
  const rows = document.querySelectorAll('#prod-tbody tr');
  if(!rows[prodIdx]) return;
  rows[prodIdx].querySelectorAll('.sr-star').forEach((s,i)=>s.classList.toggle('filled', i<stars));
}
function resetRating(prodIdx) {
  const rows = document.querySelectorAll('#prod-tbody tr');
  if(!rows[prodIdx]) return;
  const r = PRODUCTS[prodIdx].rating||0;
  rows[prodIdx].querySelectorAll('.sr-star').forEach((s,i)=>s.classList.toggle('filled', i<r));
}

// ═══════════════════════════════════════════════════════
// COLUMN VISIBILITY
// ═══════════════════════════════════════════════════════
const COL_DEFS = [
  { key:'etiquetas',   label:'Etiquetas' },
  { key:'categoria',   label:'Categoría' },
  { key:'estrella',    label:'⭐ Estrella' },
  { key:'costo_receta',label:'Costo receta' },
  { key:'costo_total', label:'Costo total + GF' },
  { key:'tier',        label:'Tier' },
  { key:'gf_prod',     label:'GF por producto' },
  { key:'descuento',   label:'Descuento' },
  { key:'comision',    label:'Com. venta (%)' },
  { key:'subtotal',    label:'Subtotal' },
  { key:'por_canal',   label:'Por canal' },
  { key:'margen',      label:'Margen' },
];
let visibleCols = new Set(COL_DEFS.map(c=>c.key).filter(k => k !== 'descuento'));

function toggleColPanel() {
  const panel = document.getElementById('col-panel');
  const isOpen = panel.style.display !== 'none';
  if(isOpen) { panel.style.display='none'; return; }
  // Build checkboxes
  const box = document.getElementById('col-checkboxes');
  box.innerHTML = COL_DEFS.map(c=>`
    <label style="display:flex;align-items:center;gap:8px;font-size:13px;cursor:pointer;color:var(--ink)">
      <input type="checkbox" ${visibleCols.has(c.key)?'checked':''} onchange="toggleCol('${c.key}',this.checked)" style="accent-color:var(--accent);width:14px;height:14px">
      ${c.label}
    </label>`).join('');
  panel.style.display = 'block';
  // Close when clicking outside
  setTimeout(()=>{
    function closePanel(e) {
      if(!document.getElementById('col-panel')?.contains(e.target) && e.target.id!=='col-toggle-btn' && !document.getElementById('col-toggle-btn')?.contains(e.target)) {
        document.getElementById('col-panel').style.display='none';
        document.removeEventListener('click', closePanel);
      }
    }
    document.addEventListener('click', closePanel);
  }, 0);
}

function toggleCol(key, visible) {
  if(visible) visibleCols.add(key); else visibleCols.delete(key);
  applyColVisibility();
}

function setAllCols(visible) {
  COL_DEFS.forEach(c=> visible ? visibleCols.add(c.key) : visibleCols.delete(c.key));
  // Rebuild checkboxes
  document.querySelectorAll('#col-checkboxes input[type=checkbox]').forEach((cb,i)=>{ cb.checked=visible; });
  applyColVisibility();
}

function applyColVisibility() {
  COL_DEFS.forEach(c=>{
    const show = visibleCols.has(c.key);
    document.querySelectorAll(`[data-col="${c.key}"]`).forEach(el=>{
      el.style.display = show ? '' : 'none';
    });
  });
}

// ═══════════════════════════════════════════════════════
// PROYECCION — GUARDAR / EXPORTAR / IMPRIMIR
// ═══════════════════════════════════════════════════════
const PROJ_SNAPSHOTS_KEY = 'sahten_proj_snapshots_v1';

function getProjectionSnapshots() {
  try { return JSON.parse(localStorage.getItem(PROJ_SNAPSHOTS_KEY)||'[]'); } catch(e) { return []; }
}

function _buildSnapData(name) {
  const PJ = computeProjection();
  const rows = PJ.rows.map(r=>({name:r.name, units:r.units, ing:r.ing, cost:r.cost, marg:r.marg}));
  const dateLabel = new Date().toLocaleDateString('es-AR',{day:'numeric',month:'short',year:'numeric'});
  const savedAt   = new Date().toLocaleString('es-AR');
  return { gf:PJ.gf, tI:PJ.tI, tC:PJ.tC, tM:PJ.tM, resultado:PJ.resultado, dist:{...projChannelDist},
    mode: PJ.mode, manualUnits:{...projManualUnits},
    rows, name: name||dateLabel, savedAt, label: dateLabel,
    gananciaDiaria: PJ.gananciaDiaria,
    gananciaWeekly: PJ.gananciaWeekly };
}

function _commitSnap(snap) {
  const snaps = getProjectionSnapshots();
  snaps.unshift(snap);
  if(snaps.length > 30) snaps.splice(30);
  localStorage.setItem(PROJ_SNAPSHOTS_KEY, JSON.stringify(snaps));
  activeProjSnapshotId = snap.id;
  try { localStorage.setItem('sahten_active_proj', String(snap.id)); } catch(e){}
  const b = document.getElementById('proj-save-badge');
  if(b) { b.textContent='✓ Guardado: '+snap.name; b.style.opacity='1'; setTimeout(()=>b.style.opacity='0',3500); }
  renderSavedProjectionsList();
  renderProjSaveBar();
}

function saveProjectionSnapshot() {
  if (activeProjSnapshotId) {
    // Active snapshot: offer overwrite or new
    const active = getProjectionSnapshots().find(s=>s.id===activeProjSnapshotId);
    const activeName = active ? active.name : 'actual';
    showConfirm(
      'Guardar proyección',
      `¿Actualizar "${activeName}" o guardar como nueva?`,
      () => {
        // "Actualizar" = overwrite
        const snaps = getProjectionSnapshots();
        const idx = snaps.findIndex(s=>s.id===activeProjSnapshotId);
        if(idx > -1) {
          const updated = { ...snaps[idx], ..._buildSnapData(snaps[idx].name), id: snaps[idx].id, savedAt: new Date().toLocaleString('es-AR') };
          snaps[idx] = updated;
          localStorage.setItem(PROJ_SNAPSHOTS_KEY, JSON.stringify(snaps));
          const b = document.getElementById('proj-save-badge');
          if(b) { b.textContent='✓ Actualizado: '+updated.name; b.style.opacity='1'; setTimeout(()=>b.style.opacity='0',3500); }
          renderSavedProjectionsList();
          renderProjSaveBar();
        }
      },
      () => showSaveAsNew(),   // cancel = "Nueva"
      'Actualizar', 'Guardar nueva'
    );
    return;
  }
  showSaveAsNew();
}

function showSaveAsNew() {
  showNameModal('Nueva proyección', 'Nombre de la proyección:', new Date().toLocaleDateString('es-AR',{day:'numeric',month:'short',year:'numeric'}), name => {
    if(name === null) return; // cancelled
    _commitSnap({ ..._buildSnapData(name), id: Date.now() });
  });
}

// Show a simple name-input modal
function showNameModal(title, label, defaultVal, callback) {
  const overlay = document.createElement('div');
  overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.4);backdrop-filter:blur(8px);-webkit-backdrop-filter:blur(8px);z-index:500;display:flex;align-items:center;justify-content:center;padding:20px';
  overlay.innerHTML = `
    <div style="background:var(--card,white);border-radius:18px;padding:28px;width:100%;max-width:380px;box-shadow:0 20px 60px rgba(0,0,0,0.2)">
      <div style="font-size:18px;font-weight:700;color:var(--ink);margin-bottom:6px;letter-spacing:-0.02em">${title}</div>
      <div style="font-size:13px;color:var(--muted);margin-bottom:16px">${label}</div>
      <input id="name-modal-input" type="text" value="${defaultVal}"
        style="width:100%;border:1.5px solid var(--border);border-radius:12px;padding:12px 14px;font-size:15px;font-family:-apple-system,BlinkMacSystemFont,'SF Pro Display','DM Sans',sans-serif;outline:none;color:var(--ink);margin-bottom:18px;background:var(--sand);transition:all 0.2s"
        onfocus="this.style.borderColor='var(--accent)';this.style.background='var(--card,white)';this.style.boxShadow='0 0 0 3px rgba(242,140,0,0.12)'"
        onblur="this.style.borderColor='var(--border)';this.style.background='var(--sand)';this.style.boxShadow='none'">
      <div style="display:flex;gap:10px;justify-content:flex-end">
        <button id="name-modal-cancel" style="border:1px solid var(--border);background:transparent;border-radius:12px;padding:10px 20px;font-size:14px;cursor:pointer;font-family:-apple-system,BlinkMacSystemFont,'SF Pro Display','DM Sans',sans-serif;color:var(--muted);font-weight:500">Cancelar</button>
        <button id="name-modal-ok" style="background:var(--accent);color:white;border:none;border-radius:12px;padding:10px 24px;font-size:14px;font-weight:700;cursor:pointer;font-family:-apple-system,BlinkMacSystemFont,'SF Pro Display','DM Sans',sans-serif;box-shadow:0 2px 8px rgba(242,140,0,0.25)">Guardar</button>
      </div>
    </div>`;
  document.body.appendChild(overlay);
  const input = overlay.querySelector('#name-modal-input');
  const ok = overlay.querySelector('#name-modal-ok');
  overlay.querySelector('#name-modal-cancel').addEventListener('click', () => { overlay.remove(); callback(null); });
  input.select();
  input.focus();
  const submit = () => { const v=input.value.trim(); if(!v) return; overlay.remove(); callback(v); };
  ok.addEventListener('click', submit);
  input.addEventListener('keydown', e => { if(e.key==='Enter') submit(); if(e.key==='Escape') { overlay.remove(); callback(null); } });
  overlay.addEventListener('click', e => { if(e.target===overlay) { overlay.remove(); callback(null); } });
}

// Render the save bar state (active snapshot indicator)
function renderProjSaveBar() {
  const bar = document.getElementById('proj-active-snap-bar');
  if (!bar) return;
  const active = activeProjSnapshotId ? getProjectionSnapshots().find(s=>s.id===activeProjSnapshotId) : null;
  if (active) {
    bar.style.display = 'flex';
    bar.innerHTML = `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
      Viendo: <strong style="color:var(--primary)">${active.name}</strong>
      <span style="color:var(--muted);font-size:11px">${active.savedAt}</span>
      <button onclick="activeProjSnapshotId=null;localStorage.removeItem('sahten_active_proj');renderProyeccion();renderProjSaveBar()"
        style="border:1px solid var(--border);background:white;border-radius:6px;padding:2px 8px;font-size:11px;cursor:pointer;color:var(--muted);font-family:'DM Sans',sans-serif;margin-left:4px">
        ✕ Salir
      </button>`;
  } else {
    bar.style.display = 'none';
  }
}

function toggleSavedProjections() {
  const p = document.getElementById('saved-projections-panel');
  const isOpen = p.style.display !== 'none';
  p.style.display = isOpen ? 'none' : 'block';
  if(!isOpen) renderSavedProjectionsList();
}

function renderSavedProjectionsList() {
  const list = document.getElementById('proj-snapshot-list');
  if(!list) return;
  const snaps = getProjectionSnapshots();
  if(snaps.length === 0) { list.innerHTML='<div style="color:var(--muted);font-size:13px;padding:8px 0">No hay proyecciones guardadas todavía. Los cambios que hacés arriba (canales, unidades) no se guardan solos — usá "Guardar proyección" para que quede un registro fijo que podés volver a cargar después.</div>'; return; }
  list.innerHTML = snaps.map(s=>{
    const rc = s.resultado>=0;
    const isActive = s.id === activeProjSnapshotId;
    return `<div class="proj-snapshot-item" style="${isActive?'border-color:var(--primary);background:rgba(35,83,40,0.04)':''}">
      <div style="flex:1;min-width:0">
        <div class="proj-snapshot-name" style="display:flex;align-items:center;gap:6px;flex-wrap:wrap">
          <span style="font-weight:700;font-size:14px;color:var(--ink)">${s.name||s.label}</span>
          ${isActive?'<span style="font-size:9px;background:var(--primary);color:white;border-radius:99px;padding:1px 7px;font-weight:700">ACTIVA</span>':''}
          <span style="font-size:10px;color:var(--muted)">${s.mode==='manual'?'· manual':''}</span>
        </div>
        <div class="proj-snapshot-date" style="margin-top:2px">${s.savedAt} · <strong style="color:${rc?'var(--green)':'var(--red)'}">${fmt(s.resultado)}</strong> · ${fmt(s.tI)} ingresos</div>
      </div>
      <div class="proj-snapshot-actions">
        <button class="btn btn-primary" style="font-size:11px;padding:4px 10px;white-space:nowrap" onclick="loadSnapshot(${s.id})">
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="1 4 1 10 7 10"/><path d="M3.51 15a9 9 0 1 0 .49-4"/></svg>
          Cargar
        </button>
        <button class="btn" style="font-size:11px;padding:4px 9px" onclick="editSnapshotName(${s.id})" title="Renombrar">✏</button>
        <button class="btn" style="font-size:11px;padding:4px 9px" onclick="exportSnapshotJSON(${s.id})" title="Exportar esta proyección como .json para compartir o reimportar">JSON</button>
        <button class="btn" style="font-size:11px;padding:4px 9px" onclick="exportSnapshotCSV(${s.id})" title="CSV">CSV</button>
        <button class="btn btn-danger" style="font-size:11px;padding:4px 9px" onclick="deleteSnapshot(${s.id})">✕</button>
      </div>
    </div>`;
  }).join('');
}

function exportSnapshotJSON(id) {
  const s = getProjectionSnapshots().find(x=>x.id===id);
  if(!s) return;
  const a=document.createElement('a');
  a.href='data:application/json;charset=utf-8,'+encodeURIComponent(JSON.stringify(s,null,2));
  a.download=`sahten_proyeccion_${(s.name||'snapshot').replace(/[^a-z0-9]+/gi,'_')}.json`;
  a.click();
}

function importProjectionJSON(event) {
  const file = event.target.files[0];
  if(!file) return;
  const reader = new FileReader();
  reader.onload = (e) => {
    try {
      const s = JSON.parse(e.target.result);
      if(typeof s.resultado !== 'number' || typeof s.tI !== 'number') {
        alert('El archivo no parece ser una proyección válida (faltan campos como "resultado" o "tI").');
        return;
      }
      SAHTEN.project.backupBeforeImport();
      s.id = Date.now();
      s.name = (s.name||'Proyección importada') + ' (importada)';
      const snaps = getProjectionSnapshots();
      snaps.unshift(s);
      localStorage.setItem(PROJ_SNAPSHOTS_KEY, JSON.stringify(snaps));
      renderSavedProjectionsList();
      const b = document.getElementById('proj-save-badge');
      if(b) { b.textContent='✓ Proyección importada: '+s.name; b.style.opacity='1'; setTimeout(()=>b.style.opacity='0',3500); }
    } catch(err) {
      alert('No se pudo leer el archivo: ' + err.message);
    }
  };
  reader.readAsText(file);
  event.target.value = '';
}

function deleteSnapshot(id) {
  if(id === activeProjSnapshotId) { activeProjSnapshotId = null; try { localStorage.removeItem('sahten_active_proj'); } catch(e){} }
  const snaps = getProjectionSnapshots().filter(s=>s.id!==id);
  localStorage.setItem(PROJ_SNAPSHOTS_KEY, JSON.stringify(snaps));
  renderSavedProjectionsList();
  renderProjSaveBar();
}

function loadSnapshot(id) {
  const s = getProjectionSnapshots().find(x=>x.id===id);
  if(!s) return;
  // Restore channel distribution
  if(s.dist) { Object.keys(projChannelDist).forEach(k=>{ projChannelDist[k]=0; }); Object.assign(projChannelDist, s.dist); }
  // Restore manual units if saved
  if(s.manualUnits) { Object.keys(projManualUnits).forEach(k=>{ projManualUnits[k]=0; }); Object.assign(projManualUnits, s.manualUnits); }
  // Restore mode
  projManualMode = (s.mode === 'manual');
  const toggle = document.getElementById('proj-manual-toggle');
  if(toggle) toggle.checked = projManualMode;
  // Set active
  activeProjSnapshotId = id;
  try { localStorage.setItem('sahten_active_proj', String(id)); } catch(e){}
  renderProyeccion();
  renderProjSaveBar();
  renderSavedProjectionsList();
  // Close the panel after loading
  const p = document.getElementById('saved-projections-panel');
  if(p) p.style.display = 'none';
}

function editSnapshotName(id) {
  const snaps = getProjectionSnapshots();
  const snap = snaps.find(s=>s.id===id);
  if(!snap) return;
  showNameModal('Renombrar proyección', 'Nuevo nombre:', snap.name||snap.label, name => {
    if(name === null) return;
    snap.name = name;
    localStorage.setItem(PROJ_SNAPSHOTS_KEY, JSON.stringify(snaps));
    renderSavedProjectionsList();
    renderProjSaveBar();
  });
}

function clearAllProjections() {
  showConfirm('Borrar proyecciones','¿Eliminar todas las proyecciones guardadas?',()=>{
    localStorage.removeItem(PROJ_SNAPSHOTS_KEY);
    renderSavedProjectionsList();
  });
}

function exportSnapshotCSV(id) {
  const s = getProjectionSnapshots().find(x=>x.id===id);
  if(!s) return;
  const rows=[['Proyección',s.label],['Guardado',s.savedAt],[''],['Producto','Unidades','Ingreso neto','Costo','Margen','%']];
  s.rows.forEach(r=>rows.push([r.name,r.units,r.ing,r.cost,r.marg,r.ing>0?(r.marg/r.ing*100).toFixed(1)+'%':'0%']));
  rows.push(['']);
  rows.push(['TOTALES',s.rows.reduce((s,r)=>s+r.units,0),s.tI,s.tC,s.tM,s.tI>0?(s.tM/s.tI*100).toFixed(1)+'%':'']);
  rows.push(['Gastos fijos','','','','',s.gf]);
  rows.push(['Resultado operativo','','','','',s.resultado]);
  const a=document.createElement('a');
  a.href='data:text/csv;charset=utf-8,\uFEFF'+encodeURIComponent(rows.map(r=>r.join(',')).join('\n'));
  a.download=`sahten_proy_${s.label.replace(/[^a-zA-Z0-9]/g,'_')}.csv`;
  a.click();
}

function exportProjectionCSV() {
  const PJ = computeProjection();
  const activeChs = PJ.channels;
  const rows=[['Producto','Unidades',...activeChs.map(c=>c.name+' (u)'),...activeChs.map(c=>c.name+' neto/u'),...activeChs.map(c=>c.name+' precio cliente/u'),'Ingreso neto','Costo','Margen','%']];
  PJ.rows.forEach(r=>{
    const uByC=[], netByC=[], grossByC=[];
    activeChs.forEach(c=>{
      const b=r.byChannel[c.id];
      uByC.push(Math.round(b.units*10)/10); netByC.push(Math.round(b.net??0)); grossByC.push(Math.round(b.gross??0));
    });
    rows.push([r.name,r.units,...uByC,...netByC,...grossByC,r.ing,r.cost,r.marg,r.ing>0?(r.marg/r.ing*100).toFixed(1)+'%':'0%']);
  });
  const padCols = activeChs.length*3;
  rows.push(['','TOTAL',...Array(padCols).fill(''),PJ.tI,PJ.tC,PJ.tM,PJ.tI>0?(PJ.tM/PJ.tI*100).toFixed(1)+'%':'']);
  rows.push(['','Unidades totales',...Array(padCols).fill(''),PJ.totalUnits,'','','']);
  rows.push(['','Ticket promedio',...Array(padCols).fill(''),PJ.totalUnits>0?Math.round(PJ.tI/PJ.totalUnits):0,'','','']);
  rows.push(['','GF del mes',...Array(padCols).fill(''),PJ.gf,'','','']);
  rows.push(['','Resultado operativo',...Array(padCols).fill(''),PJ.resultado,'','','']);
  rows.push([]);
  rows.push(['Ticket promedio por canal','Unidades','Ticket neto/u','Ticket precio cliente/u']);
  activeChs.forEach(c=>{
    const u=PJ.chUnits[c.id]||0;
    rows.push([c.name, Math.round(u), u>0?Math.round((PJ.chIncome[c.id]||0)/u):0, u>0?Math.round((PJ.chGross[c.id]||0)/u):0]);
  });
  const a=document.createElement('a');
  const ts=new Date().toLocaleDateString('es-AR').replace(/\//g,'-');
  const _q=v=>{const s=String(v??'');return /[",\n]/.test(s)?'"'+s.replace(/"/g,'""')+'"':s;};
  a.href='data:text/csv;charset=utf-8,\uFEFF'+encodeURIComponent(rows.map(r=>r.map(_q).join(',')).join('\n'));
  a.download=`sahten_proyeccion_${ts}.csv`;
  a.click();
}

// exportProjectionPDF defined below

// ═══════════════════════════════════════════════════════
// CONFIRM + EXPORT
// ═══════════════════════════════════════════════════════
function showConfirm(title,text,cb,onCancel,confirmLabel,cancelLabel) {
  document.getElementById('confirm-title').textContent=title;
  document.getElementById('confirm-text').textContent=text;
  const okBtn = document.getElementById('confirm-ok');
  okBtn.textContent = confirmLabel || 'Aceptar';
  okBtn.onclick=()=>{document.getElementById('confirm-overlay').classList.remove('open');cb();};
  const cancelBtn = document.querySelector('#confirm-overlay .btn:not(#confirm-ok)');
  if(cancelBtn) {
    cancelBtn.textContent = cancelLabel || 'Cancelar';
    cancelBtn.onclick = () => { document.getElementById('confirm-overlay').classList.remove('open'); if(typeof onCancel==='function') onCancel(); };
  }
  document.getElementById('confirm-overlay').classList.add('open');
}
function exportCSV() {
  const rows=[['Producto','Costo Receta','Costo Total','% GF','GF Asignado','Descuento','Precio Mostrador',...CHANNELS.filter(c=>c.enabled&&c.surcharge>0).map(c=>c.name),'Margen %']];
  PRODUCTS.forEach(p=>{
    const tc=costPerUnit(p); const mp=mostradorFinalPrice(p); const gfa=gfAssigned(p);
    const chs=CHANNELS.filter(c=>c.enabled&&c.surcharge>0).map(c=>channelPrice(p,c.id)||mp);
    const disc=p.discount||0;
    rows.push([p.name,Math.round(p.receta_cost),Math.round(tc),p.gfPct+'%',Math.round(gfa),disc>=1?'$'+Math.round(disc):disc>0?(disc*100).toFixed(1)+'%':'',mp,...chs,(marginPct(mp,tc+gfa)*100).toFixed(1)+'%']);
  });
  const a=document.createElement('a');
  a.href='data:text/csv;charset=utf-8,\uFEFF'+encodeURIComponent(rows.map(r=>r.join(',')).join('\n'));
  a.download='sahten_precios.csv'; a.click();
}

// ═══════════════════════════════════════════════════════
// SAVE TO FILE (embed data in HTML and download) — legacy
// ═══════════════════════════════════════════════════════

// ═══════════════════════════════════════════════════════
// EXTERNAL JSON FILE SYSTEM
// Flujo:
//   Al inicio → intenta fetch('./data.json') automáticamente
//   "Guardar JSON" → descarga data.json (va en la misma carpeta)
//   "Cargar datos" → file picker manual como fallback
//   localStorage → backup automático de fondo (sin cambios)
// ═══════════════════════════════════════════════════════

// Recolectar estado completo en un objeto
function collectState() {
  let projSnapshots = [];
  try { projSnapshots = JSON.parse(localStorage.getItem(PROJ_SNAPSHOTS_KEY)||'[]'); } catch(e){}

  // Clon profundo de PRODUCTS incluyendo todos los sub-arrays
  const productsDeep = PRODUCTS.map(p => ({
    id:             p.id,
    name:           p.name,
    star:           p.star,
    tier:           p.tier,
    gfPct:          p.gfPct,
    gfPctOverride:  p.gfPctOverride,
    avgMes:         p.avgMes,
    discount:       p.discount,
    discountType:   p.discountType,
    receta_cost:    p.receta_cost,
    porciones:        p.porciones        ?? 1,
    merma:             p.merma             ?? 0,
    porcionesOverride: p.porcionesOverride  ?? null,
    porcionLabel:     p.porcionLabel     ?? 'porción',
    recetaOnly:       p.recetaOnly       ?? false,
    category:         p.category         ?? '',
    precioMostrador:  mostradorFinalPrice(p) || 0,
    rating:           p.rating,
    // Rendimiento automático (Opción B)
    pesoTotal:        p.pesoTotal        ?? '',
    pesoUnit:         p.pesoUnit         ?? 'g',
    porcionCant:      p.porcionCant      ?? '',
    porcionUnit:      p.porcionUnit      ?? 'g',
    pesoTotalManual:  p.pesoTotalManual  ?? false,
    weeks:          p.weeks ? [...p.weeks] : [],
    tags:           (p.tags||[]).map(t=>({...t})),
    // Receta: ingredientes indexados (ingId + qty + unit) y fallback v
    ingredients:    (p.ingredients||[]).map(r=>({
      ingId: r.ingId, qty: r.qty, unit: r.unit, v: r.v||0,
      // legacy fields por compatibilidad
      n: r.n, 
    })),
    // Packaging: envases indexados (envId + qty + unit) y fallback v
    packaging:      (p.packaging||[]).map(r=>({
      envId: r.envId, qty: r.qty, unit: r.unit, v: r.v||0,
      n: r.n,
    })),
    // Combos: sub-productos referenciados con cantidad + unidad
    combos:         (p.combos||[]).map(r=>({
      prodId:         r.prodId,
      qty:            r.qty           ?? 1,
      unit:           r.unit          ?? 'u',
      addWeight:      r.addWeight     !== false,
      addPackaging:   r.addPackaging  !== false,
      comboOverrides: r.comboOverrides ?? {},
      // legacy frac kept for old data compatibility
      ...(r.frac != null ? {frac: r.frac} : {}),
    })),
    // Descuentos por canal (v0.7+)
    channelDiscounts: p.channelDiscounts ?? {},
    absorbeGF:        p.absorbeGF ?? null,
    priceAdj:         p.priceAdj ?? 1,
  }));

  // Clon profundo de INGREDIENTES con todos sus campos
  const ingredientesDeep = INGREDIENTES.map(i=>({
    id:         i.id,
    name:       i.name,
    precioPkg:  i.precioPkg,
    grPaquete:  i.grPaquete,
    // unidad y cantidad (sistema v0.7+)
    unit:       i.unit     ?? 'g',
    cantidad:   i.cantidad ?? i.grPaquete,
    // campos extra opcionales
    ...(i.proveedor  != null ? {proveedor:  i.proveedor}  : {}),
    ...(i.notas      != null ? {notas:      i.notas}      : {}),
  }));

  // Clon profundo de ENVASES con todos sus campos
  const envasesDeep = ENVASES.map(e=>({
    id:        e.id,
    name:      e.name,
    precioPkg: e.precioPkg,
    cantidad:  e.cantidad,
    ...(e.proveedor != null ? {proveedor: e.proveedor} : {}),
    ...(e.notas     != null ? {notas:     e.notas}     : {}),
  }));

  // Helper para leer inputs del DOM sin fallar
  const domVal = id => document.getElementById(id)?.value ?? null;

  return {
    _version: 3,
    // ── Datos principales ──────────────────────────────────
    PRODUCTS:     productsDeep,
    INGREDIENTES: ingredientesDeep,
    ENVASES:      envasesDeep,
    GASTOS_OP:    GASTOS_OP.map(g=>({id:g.id, name:g.name, amount:g.amount})),
    GASTOS_S:     GASTOS_S.map(g=>({id:g.id, name:g.name,  amount:g.amount})),
    STOCK:        JSON.parse(JSON.stringify(STOCK)),
    MOVIMIENTOS:  MOVIMIENTOS.map(m=>({...m})),
    TIERS:        TIERS.map(t=>({...t})),
    CHANNELS:     CHANNELS.map(c=>({...c})),
    // ── Proyección ─────────────────────────────────────────
    projChannelDist:   {...projChannelDist},
    projChannelLocked: {...projChannelLocked},
    projManualMode,
    projManualUnits:   {...projManualUnits},
    projSnapshots,
    activeProjSnapshotId,
    // ── Gastos fijos ───────────────────────────────────────
    gfDiscHistory: GF_DISC_HISTORY.map(h=>({...h})), // legacy: ya no afecta el GF
    gfMonths: JSON.parse(JSON.stringify(GF_MONTHS)),
    project: JSON.parse(JSON.stringify(SAHTEN_PROJECT)),
    // legacy compat: preservar campos individuales por si se carga en versión vieja
    gfDiscPct:     0,
    gfDiscNotes:   '',
    // ── Generador de formato de inventario ─────────────────
    gfPages:       gfPages.map(p=>({...p})),
    gfCurrentTpl,
    gfActiveColumns: [...gfActiveColumns],
    gfResponsable: domVal('gf-responsable'),
    gfFecha:       domVal('gf-fecha'),
    gfTurno:       domVal('gf-turno'),
    gfSupervisor:  domVal('gf-supervisor'),
    gfSector:      domVal('gf-sector'),
    gfSucursal:    domVal('gf-sucursal'),
    gfObs:         domVal('gf-obs'),
    // ── Configuración global ───────────────────────────────
    usdRate:          String(SAHTEN.state.usdRate),            // v4: vive en el estado, el input solo lo refleja
    globalCommission: String(SAHTEN.state.globalCommission),
    customTC,
    // ── Estado de UI ───────────────────────────────────────
    visibleCols:   [...visibleCols],
    ingView,
    ingSearch: document.getElementById('ing-search')?.value||'',
    ingSortVal: document.getElementById('ing-sort')?.value||'',
    envSearch: document.getElementById('env-search')?.value||'',
    envSortVal: document.getElementById('env-sort')?.value||'',
    ventasView,
    stockView,
    movFilter,
    currentPanel,
    // ── Meta ───────────────────────────────────────────────
    savedAt: new Date().toLocaleString('es-AR'),
    // ── Datos adicionales (v0.9+) ────────────────────────
    customers:           (function(){ try{ return JSON.parse(localStorage.getItem('sahten_customers')||'[]'); }catch(e){ return []; } })(),
    orders:              (function(){ try{ return JSON.parse(localStorage.getItem('sahten_orders')||'[]'); }catch(e){ return []; } })(),
    mostradorDiscounts:  (function(){ try{ return JSON.parse(localStorage.getItem('sahten_mostrador_discounts')||'[]'); }catch(e){ return []; } })(),
    mostradorPayments:   (function(){ try{ return JSON.parse(localStorage.getItem('sahten_mostrador_payments')||'[]'); }catch(e){ return []; } })(),
    menuConfig:          (function(){ try{ return JSON.parse(localStorage.getItem('sahten_menu_config')||'{}'); }catch(e){ return {}; } })(),
    reportData:          (function(){ try{ return JSON.parse(localStorage.getItem('sahten_report_data')||'{}'); }catch(e){ return {}; } })(),
    tiendaConfig:        (function(){ try{ const k='sahten_tienda_'+(window.SAVE_KEY||'sahten_v4_data'); return JSON.parse(localStorage.getItem(k)||'{}'); }catch(e){ return {}; } })(),
  };
}

// Aplicar datos cargados a las variables globales y los inputs del DOM
function applyData(data) {
  const setArr = (arr, src) => { if(src && Array.isArray(src)) { arr.length=0; src.forEach(x=>arr.push(x)); } };
  const setVal = (id, val) => { if(val != null) { const el=document.getElementById(id); if(el) el.value=val; } };

  // ── Datos principales ──────────────────────────────────
  // Cargar catálogos PRIMERO para poder migrar referencias legacy en PRODUCTS
  if (data.INGREDIENTES) {
    data.INGREDIENTES.forEach(ing => {
      if (ing.unit     == null) ing.unit     = 'g';
      if (ing.cantidad == null) ing.cantidad = ing.grPaquete;
    });
  }
  setArr(INGREDIENTES, data.INGREDIENTES);
  setArr(ENVASES,      data.ENVASES);
  setArr(PRODUCTS,     data.PRODUCTS);
  // ── Normalizar campos nuevos en productos (compatibilidad con JSON viejo) ──
  PRODUCTS.forEach(p => {
    if (p.porciones       == null) p.porciones       = 1;
    if (p.porcionLabel    == null) p.porcionLabel    = 'porcion';
    if (p.recetaOnly      == null) p.recetaOnly      = false;
    if (!p.category) { const def = [{id:'pizza_muzza',c:'Pizzas'},{id:'pizza_napo',c:'Pizzas'},{id:'pizza_fuga',c:'Pizzas'},{id:'pizza_jamon',c:'Pizzas'},{id:'empanada_jyq',c:'Empanadas'},{id:'gaseosa',c:'Bebidas'},{id:'combo_fiesta',c:'Combos'}].find(d=>d.id===p.id); p.category = def ? def.c : ''; }
    if (p.tags            == null) p.tags            = [];
    if (p.combos          == null) p.combos          = [];
    if (p.ingredients     == null) p.ingredients     = [];
    if (p.packaging       == null) p.packaging       = [];
    if (p.weeks           == null) p.weeks           = [0,0,0,0];
    if (p.discountType    == null) p.discountType    = 'pct';
    if (p.discount        == null) p.discount        = 0;
    if (p.pesoTotal       == null) p.pesoTotal       = '';
    if (p.pesoUnit        == null) p.pesoUnit        = 'g';
    if (p.porcionCant     == null) p.porcionCant     = '';
    if (p.porcionUnit     == null) p.porcionUnit     = 'g';
    if (p.pesoTotalManual == null) p.pesoTotalManual = false;
    if (p.merma             == null) p.merma             = 0;
    if (p.porcionesOverride   == null) p.porcionesOverride   = null;
    if (p.channelDiscounts    == null) p.channelDiscounts    = {};
    p.combos.forEach(c => {
      if (c.frac != null && c.qty == null) {
        const fracMap = {'1':1,'2':2,'3':3,'4':4,'1/2':0.5,'1/3':1/3,'1/4':0.25,'2/3':2/3,'3/4':0.75};
        c.qty  = fracMap[c.frac] != null ? fracMap[c.frac] : (parseFloat(c.frac)||1);
        c.unit = 'u';
      }
      if (c.qty       == null) c.qty       = 1;
      if (c.unit      == null) c.unit      = 'u';
      if (c.addWeight    == null) c.addWeight    = true;
        if (c.addPackaging    == null) c.addPackaging    = true;
        if (c.comboOverrides == null) c.comboOverrides = {};
    });
  });
  INGREDIENTES.forEach(ing => {
    if (ing.unit     == null) ing.unit     = 'g';
    if (ing.cantidad == null) ing.cantidad = ing.grPaquete;
    ingNormalize(ing);
  });
  setArr(GASTOS_OP,    data.GASTOS_OP);
  setArr(GASTOS_S,     data.GASTOS_S);
  setArr(MOVIMIENTOS,  data.MOVIMIENTOS);
  setArr(TIERS,        data.TIERS);
  setArr(CHANNELS,     data.CHANNELS);
  // Ensure channelDisc field exists on all channels (v0.7+)
  CHANNELS.forEach(c => { if (c.channelDisc == null) c.channelDisc = 0; });
  if(data.STOCK) Object.assign(STOCK, data.STOCK);

  // ── Migración legacy: filas {n, v} → {ingId/envId, qty, unit, v} ──────────
  // Soporta JSON viejo (solo {n,v}), mixto, y nuevo (ingId/envId). Siempre
  // exporta en formato nuevo para compatibilidad futura.
  (function migrateLegacy() {
    // Índices por nombre (lowercase) para búsqueda rápida
    const ingByName = {};
    INGREDIENTES.forEach(x => { ingByName[x.name.trim().toLowerCase()] = x; });
    const envByName = {};
    ENVASES.forEach(x => { envByName[x.name.trim().toLowerCase()] = x; });
    const prodByName = {};
    PRODUCTS.forEach(x => { prodByName[x.name.trim().toLowerCase()] = x; });
    const prodById = {};
    PRODUCTS.forEach(x => { prodById[x.id] = x; });

    // Intenta interpretar "Nombre (Xg/kg/ml/L)" extrayendo qty y unit
    const QTY_RE = /^(.+?)\s+\((\d+(?:\.\d+)?)\s*(g|kg|ml|L|u)\)$/i;
    // Patrones de sub-producto: "Nombre x3", "Nombre 1/2", "Nombre 3"
    const COMBO_X_RE  = /^(.+?)\s+x(\d+(?:\.\d+)?)$/i;
    const COMBO_FR_RE = /^(.+?)\s+(\d+\/\d+)$/i;

    function findProd(name) {
      const nl = name.trim().toLowerCase();
      if(prodByName[nl]) return prodByName[nl];
      // Búsqueda parcial
      for(const [pn, p] of Object.entries(prodByName)) {
        if(nl.includes(pn) || pn.includes(nl)) return p;
      }
      return null;
    }

    function migrateIng(row) {
      if(row.ingId != null && row.ingId !== '') return row; // ya nuevo
      const rawName = (row.n||'').trim();
      const nl = rawName.toLowerCase();
      const v  = row.v||0;

      // 1. Coincidencia exacta en catálogo
      if(ingByName[nl]) {
        const ing = ingByName[nl];
        const pxg = ing.precioPkg / ing.grPaquete;
        const qty = pxg > 0 ? Math.round(v / pxg * 10) / 10 : 0;
        return { ingId: ing.id, qty, unit: 'g', v, n: rawName };
      }
      // 2. Nombre con cantidad entre paréntesis: "Carne (200g)"
      const mq = QTY_RE.exec(rawName);
      if(mq) {
        const baseName = mq[1].trim().toLowerCase();
        const qty      = parseFloat(mq[2]);
        const unit     = mq[3].toLowerCase() === 'l' ? 'L' : mq[3].toLowerCase();
        if(ingByName[baseName]) {
          return { ingId: ingByName[baseName].id, qty, unit, v, n: rawName };
        }
        // Coincidencia parcial del nombre base
        for(const [iname, ing] of Object.entries(ingByName)) {
          if(iname.startsWith(baseName) || baseName.startsWith(iname)) {
            return { ingId: ing.id, qty, unit, v, n: rawName };
          }
        }
      }
      // 3. Es un sub-producto tipo combo: "Gaseosa x1", "Pizza Napolitana 1/2"
      const mx = COMBO_X_RE.exec(rawName);
      const mf = !mx ? COMBO_FR_RE.exec(rawName) : null;
      if(mx || mf) {
        const base = (mx ? mx[1] : mf[1]).trim();
        const frac = mx ? mx[2] : mf[2];
        const prod = findProd(base);
        if(prod) return { __combo__: true, prodId: prod.id, frac, v, n: rawName };
      }
      // 4. Fallback: mantener n+v visible en vista Costo Receta
      return { ingId: '', qty: 0, unit: 'g', v, n: rawName };
    }

    function migrateEnv(row) {
      if(row.envId != null && row.envId !== '') return row; // ya nuevo
      const rawName = (row.n||'').trim();
      const nl = rawName.toLowerCase();
      const v  = row.v||0;
      if(envByName[nl]) {
        return { envId: envByName[nl].id, qty: 1, unit: 'u', v, n: rawName };
      }
      // Plurales / variantes: "Servilleta" ↔ "Servilletas"
      for(const [ename, env] of Object.entries(envByName)) {
        if(nl.startsWith(ename) || ename.startsWith(nl)) {
          return { envId: env.id, qty: 1, unit: 'u', v, n: rawName };
        }
      }
      // Patrones con multiplicador: "Envase salsa x2"
      const mx = COMBO_X_RE.exec(rawName);
      if(mx) {
        const base = mx[1].trim().toLowerCase();
        const qty  = parseFloat(mx[2]);
        if(envByName[base]) return { envId: envByName[base].id, qty, unit: 'u', v, n: rawName };
      }
      return { envId: '', qty: 1, unit: 'u', v, n: rawName };
    }

    PRODUCTS.forEach(p => {
      const newCombos = Array.isArray(p.combos) ? [...p.combos] : [];
      const newIngs   = [];
      (p.ingredients||[]).forEach(row => {
        const m = migrateIng(row);
        if(m.__combo__) {
          // Evitar duplicados en combos
          if(!newCombos.find(c => c.prodId === m.prodId && c.frac === m.frac))
            { // v4: la fracción ("x4", "1/2") se convierte a cantidad acá mismo. Antes quedaba sin qty y el costo del combo
              // daba 0 en la 1.ª carga y otro valor en la 2.ª (collectState le ponía qty=1): los combos no sobrevivían a guardar/cargar.
              const fm = {'1':1,'2':2,'3':3,'4':4,'1/2':0.5,'1/3':1/3,'1/4':0.25,'2/3':2/3,'3/4':0.75};
              const q = fm[m.frac] != null ? fm[m.frac] : (parseFloat(m.frac)||1);
              newCombos.push({ prodId: m.prodId, frac: m.frac, qty: q, unit: 'u', addWeight: true, addPackaging: true, comboOverrides: {} });
            }
        } else {
          newIngs.push(m);
        }
      });
      p.ingredients = newIngs;
      p.packaging   = (p.packaging||[]).map(migrateEnv);
      p.combos      = newCombos;
    });
  })();

  // ── Proyección ─────────────────────────────────────────
  if(data.projChannelDist)   Object.assign(projChannelDist,   data.projChannelDist);
  if(data.projChannelLocked) Object.assign(projChannelLocked, data.projChannelLocked);
  if(data.projManualMode   != null) projManualMode = data.projManualMode;
  if(data.projManualUnits)   Object.assign(projManualUnits, data.projManualUnits);
  if(data.projSnapshots && data.projSnapshots.length) {
    try { localStorage.setItem(PROJ_SNAPSHOTS_KEY, JSON.stringify(data.projSnapshots)); } catch(e){}
  }
  if(data.activeProjSnapshotId != null) {
    activeProjSnapshotId = data.activeProjSnapshotId;
    try { localStorage.setItem('sahten_active_proj', String(data.activeProjSnapshotId)); } catch(e){}
  }

  // ── Gastos fijos ───────────────────────────────────────
  if(data.project && typeof data.project==='object') { Object.keys(SAHTEN_PROJECT).forEach(k=>delete SAHTEN_PROJECT[k]); Object.assign(SAHTEN_PROJECT, data.project); }
  if(data.gfMonths && typeof data.gfMonths==='object') { Object.keys(GF_MONTHS).forEach(k=>delete GF_MONTHS[k]); Object.assign(GF_MONTHS, data.gfMonths); }
  if(data.gfDiscHistory && Array.isArray(data.gfDiscHistory)) {
    GF_DISC_HISTORY.length=0;
    data.gfDiscHistory.forEach(h=>{
      // Migrar entradas legacy {pct, nota, fecha, raw, net} al nuevo formato {id, pct, nota, fecha, ahorro, active}
      if(!h.id) h.id = Date.now() + Math.random();
      if(h.active == null) h.active = true;
      if(h.ahorro == null) h.ahorro = totalGFRaw() * (h.pct||0) / 100;
      GF_DISC_HISTORY.push(h);
    });
  } else if(data.gfDiscPct && parseFloat(data.gfDiscPct) > 0) {
    // Migrar descuento único legacy (gfDiscPct) a la lista nueva
    GF_DISC_HISTORY.length=0;
    GF_DISC_HISTORY.push({
      id: Date.now(), pct: parseFloat(data.gfDiscPct),
      nota: data.gfDiscNotes || 'Descuento importado',
      fecha: new Date().toLocaleDateString('es-AR'),
      ahorro: totalGFRaw() * parseFloat(data.gfDiscPct) / 100,
      active: true
    });
  }

  // ── Generador de formato de inventario ─────────────────
  if(data.gfPages && Array.isArray(data.gfPages)) {
    gfPages = data.gfPages.map(p=>({...p}));
    gfPageCounter = Math.max(...gfPages.map(p=>p.id||0), 0) + 1;
    gfBuildPagesUI();
  }
  if(data.gfCurrentTpl) { gfCurrentTpl = data.gfCurrentTpl; gfSetTemplate(data.gfCurrentTpl); }
  if(data.gfActiveColumns && Array.isArray(data.gfActiveColumns)) {
    gfActiveColumns = [...data.gfActiveColumns];
    gfBuildColumnToggles();
  }
  setVal('gf-responsable', data.gfResponsable);
  setVal('gf-fecha',       data.gfFecha);
  setVal('gf-turno',       data.gfTurno);
  setVal('gf-supervisor',  data.gfSupervisor);
  setVal('gf-sector',      data.gfSector);
  setVal('gf-sucursal',    data.gfSucursal);
  setVal('gf-obs',         data.gfObs);

  // ── Configuración global ───────────────────────────────
  if(data.usdRate != null) SAHTEN.state.usdRate = parseFloat(data.usdRate) || 1200;
  if(data.globalCommission != null) SAHTEN.state.globalCommission = parseFloat(data.globalCommission) || 0;
  setVal('usd-rate',          data.usdRate);
  setVal('usd-rate-mobile',    data.usdRate);
  setVal('usd-rate-drawer',    data.usdRate);
  setVal('global-commission', data.globalCommission);
  if(data.customTC != null) customTC = data.customTC;

  // ── Estado de UI ───────────────────────────────────────
  if(data.visibleCols && Array.isArray(data.visibleCols)) {
    visibleCols = new Set(data.visibleCols);
    applyColVisibility();
  }
  if(data.ingView)      ingView     = data.ingView;
  if(data.ingSearch   != null) { const el=document.getElementById('ing-search');   if(el) el.value=data.ingSearch; }
  if(data.ingSortVal  != null) { const el=document.getElementById('ing-sort');     if(el) el.value=data.ingSortVal; }
  if(data.envSearch   != null) { const el=document.getElementById('env-search');   if(el) el.value=data.envSearch; }
  if(data.envSortVal  != null) { const el=document.getElementById('env-sort');     if(el) el.value=data.envSortVal; }
  if(data.ventasView)   ventasView  = data.ventasView;
  if(data.stockView)    stockView   = data.stockView;
  if(data.movFilter)    movFilter   = data.movFilter;
  if(data.currentPanel) { currentPanel = data.currentPanel; }

  // ── Sync toggles de UI ─────────────────────────────────
  const tog = document.getElementById('proj-manual-toggle');
  if(tog) tog.checked = projManualMode;
  const lv = document.getElementById('lbl-ventas-mode');
  const lm = document.getElementById('lbl-manual-mode');
  if(lv) lv.classList.toggle('active', !projManualMode);
  if(lm) lm.classList.toggle('active', projManualMode);

  // ── Datos adicionales (v0.9+) — con defaults para legacy ──
  if(data.customers && Array.isArray(data.customers)) {
    try{ localStorage.setItem('sahten_customers', JSON.stringify(data.customers)); }catch(e){}
    if(typeof SAHTEN_CUSTOMERS !== 'undefined') { SAHTEN_CUSTOMERS.length=0; data.customers.forEach(c=>SAHTEN_CUSTOMERS.push(c)); }
  }
  if(data.orders && Array.isArray(data.orders)) {
    try{ localStorage.setItem('sahten_orders', JSON.stringify(data.orders)); }catch(e){}
    if(typeof SAHTEN_ORDERS !== 'undefined') { SAHTEN_ORDERS.length=0; data.orders.forEach(o=>SAHTEN_ORDERS.push(o)); }
  }
  if(data.mostradorDiscounts && Array.isArray(data.mostradorDiscounts)) {
    try{ localStorage.setItem('sahten_mostrador_discounts', JSON.stringify(data.mostradorDiscounts)); }catch(e){}
    if(typeof MOSTRADOR_DISCOUNTS !== 'undefined') { MOSTRADOR_DISCOUNTS.length=0; data.mostradorDiscounts.forEach(d=>MOSTRADOR_DISCOUNTS.push(d)); }
  }
  if(data.mostradorPayments && Array.isArray(data.mostradorPayments)) {
    try{ localStorage.setItem('sahten_mostrador_payments', JSON.stringify(data.mostradorPayments)); }catch(e){}
    if(typeof MOSTRADOR_PAYMENTS !== 'undefined') { MOSTRADOR_PAYMENTS.length=0; data.mostradorPayments.forEach(p=>MOSTRADOR_PAYMENTS.push(p)); }
  }
  if(data.menuConfig && typeof data.menuConfig === 'object') {
    try{ localStorage.setItem('sahten_menu_config', JSON.stringify(data.menuConfig)); }catch(e){}
    if(typeof MENU_CONFIG !== 'undefined') Object.assign(MENU_CONFIG, data.menuConfig);
  }
  if(data.reportData && typeof data.reportData === 'object') {
    try{ localStorage.setItem('sahten_report_data', JSON.stringify(data.reportData)); }catch(e){}
    if(typeof REP !== 'undefined') Object.assign(REP, data.reportData);
  }
  if(data.tiendaConfig && typeof data.tiendaConfig === 'object' && Object.keys(data.tiendaConfig).length > 0) {
    try{ const k='sahten_tienda_'+(window.SAVE_KEY||'sahten_v4_data'); localStorage.setItem(k, JSON.stringify(data.tiendaConfig)); }catch(e){}
  }

  // ── Marcar recetas como ya aplicadas (no sobreescribir con defaults) ──
  window._recetasApplied = true;
}

// ── Guardar como data.json (descarga al mismo directorio)

// ── Cargar desde file picker (botón manual)

// ── Auto-detección: intenta cargar ./data.json de la misma carpeta al arrancar
// Solo funciona cuando el HTML está servido por un servidor local (file:// lo bloquea
// por CORS, pero desde cualquier servidor —incluso python -m http.server— funciona).

// ═══════════════════════════════════════════════════════
// AUTO-SAVE a localStorage (backup de fondo, sin cambios)
// ═══════════════════════════════════════════════════════
const SAVE_KEY = 'sahten_v4_data';
let saveTimeout = null;





// ── Guardado (v4): el proyecto es un archivo .sahten; la sesión (src/project/) guarda 2 s después del último cambio ──
function saveToJson() { SAHTEN.project.save(); }
function loadFromJsonFile() { SAHTEN.project.open(); }
function saveData() { SAHTEN.project.markDirty(); }
function scheduleSave() { SAHTEN.project.markDirty(); }
function showSaveBadge() { /* el indicador de guardado lo dibuja src/project/ui.js */ }

function autoSaveWrap(fn) {
  return function(...args) { fn.apply(this,args); scheduleSave(); };
}

// ═══════════════════════════════════════════════════════
// INIT — con auto-detección de data.json externo
// ═══════════════════════════════════════════════════════
initStock();
// v3: copia de los datos de ejemplo (los proyectos nuevos arrancan vacíos)
window.SAHTEN_DEMO_DATA = (()=>{ try { return JSON.parse(JSON.stringify({PRODUCTS,INGREDIENTES,ENVASES,GASTOS_OP,GASTOS_S,TIERS,CHANNELS})); } catch(e) { return null; } })();

// Prioridad de carga:
//   1. data.json externo (misma carpeta, auto-fetch)
//   2. Snapshot embebido en el HTML (legacy saveToFile)
//   3. localStorage (autosave de fondo)
function wkTab(btn, sectionId) {
            const container = btn.closest('#panel-wiki');
            container.querySelectorAll('.wk-tab').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            container.querySelectorAll('.wk-section').forEach(s => s.classList.remove('active'));
            const sec = container.querySelector('#' + sectionId);
            if (sec) sec.classList.add('active');
          }
          function wkCalc() {
            const ing  = parseFloat(document.getElementById('wk-c-ing').value) || 0;
            const gf   = parseFloat(document.getElementById('wk-c-gf').value)  || 0;
            const tier = parseFloat(document.getElementById('wk-c-tier').value) || 1;
            const sur  = (parseFloat(document.getElementById('wk-c-sur').value) || 0) / 100;
            const base   = Math.round(((ing + gf) * tier) / 50) * 50;
            const canal  = Math.round((base * (1 + sur)) / 50) * 50;
            const margin = canal > 0 ? ((canal - (ing + gf)) / canal * 100) : 0;
            const fmtN = n => '$' + Math.round(n).toLocaleString('es-AR');
            document.getElementById('wk-r-base').textContent   = fmtN(base);
            document.getElementById('wk-r-canal').textContent  = fmtN(canal);
            document.getElementById('wk-r-margin').textContent = fmtN(canal - (ing + gf));
            document.getElementById('wk-r-pct').textContent    = margin.toFixed(1) + '%';
            const fill = document.getElementById('wk-margin-fill');
            fill.style.width      = Math.min(100, Math.max(0, margin)) + '%';
            fill.style.background = margin >= 45 ? '#235328' : margin >= 30 ? '#F28C00' : '#c0392b';
            const mv = document.getElementById('wk-r-margin');
            mv.className = 'rval ' + (margin >= 45 ? 'good' : margin >= 30 ? 'orange' : 'bad');
          }
          // Run calc on load if the panel is visible

(async function initApp() {
  // v4: no hay proyecto hasta que se abre uno (o se crea). La app arranca en blanco y muestra la bienvenida.
  initStock();
  projWeeks = [];
  SAHTEN.project.resetApp();
  SAHTEN.projectUi.mount();
  renderDashboard();
  SAHTEN.projectUi.showWelcome();

  // Autosave en cualquier cambio de input
  document.addEventListener('input', scheduleSave);
  document.addEventListener('change', scheduleSave);

  // Mobile USD widget: show/hide based on screen size and keep in sync
  (function initMobileUSD() {
    const mw = document.querySelector('.usd-widget-mobile');
    const dw = document.getElementById('usd-rate-drawer');
    const sr = document.getElementById('usd-rate');
    if (mw) {
      const show = () => { mw.style.display = window.innerWidth <= 768 ? 'flex' : 'none'; };
      window.addEventListener('resize', show);
      show();
    }
    // Sync drawer USD to sidebar value on init
    if (dw && sr) dw.value = sr.value;
  })();
})();
