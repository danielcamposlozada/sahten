// ═══════════════════════════════════════════════════════
// DASHBOARD — PROYECCIÓN ACTIVA
// ═══════════════════════════════════════════════════════
let activeProjSnapshotId = null;

function setActiveProjection(id) {
  activeProjSnapshotId = id;
  // persist
  try { localStorage.setItem('sahten_active_proj', String(id)); } catch(e) {}
  renderDashboard();
  // close the saved projections panel if open
  const p = document.getElementById('saved-projections-panel');
  if(p) p.style.display = 'none';
  showPanel('dashboard');
}

function clearActiveProjection() {
  activeProjSnapshotId = null;
  try { localStorage.removeItem('sahten_active_proj'); } catch(e) {}
  renderDashboard();
}

function getActiveSnapshot() {
  if(!activeProjSnapshotId) return null;
  return getProjectionSnapshots().find(s => s.id === activeProjSnapshotId) || null;
}

function renderDashProjBanner() {
  const banner = document.getElementById('dash-proj-banner');
  if(!banner) return;
  const snap = getActiveSnapshot();
  if(!snap) { banner.style.display = 'none'; return; }
  banner.style.display = 'block';
  const rc = snap.resultado >= 0;
  const mPct = snap.tI > 0 ? (snap.tM / snap.tI * 100).toFixed(1) : '0';
  const oPct = snap.tI > 0 ? (snap.resultado / snap.tI * 100).toFixed(1) : '0';

  banner.innerHTML = `
    <div style="background:var(--primary);border-radius:12px;padding:16px 20px;color:white;margin-bottom:4px">
      <div style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:10px;margin-bottom:14px">
        <div>
          <div style="font-size:10px;text-transform:uppercase;letter-spacing:1px;opacity:0.5;margin-bottom:3px">Proyección activa</div>
          <div style="font-family:-apple-system,BlinkMacSystemFont,'SF Pro Display','DM Sans',sans-serif;font-size:17px;font-weight:600">${snap.label}</div>
          <div style="font-size:11px;opacity:0.55;margin-top:2px">Guardada ${snap.savedAt} · ${snap.mode === 'manual' ? 'Modo manual' : 'Desde Ventas+GF'}</div>
        </div>
        <button onclick="clearActiveProjection()" style="background:rgba(255,255,255,0.1);border:1px solid rgba(255,255,255,0.2);color:rgba(255,255,255,0.7);border-radius:7px;padding:6px 13px;font-size:11px;cursor:pointer;font-family:'DM Sans',sans-serif">✕ Quitar</button>
      </div>
      <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(130px,1fr));gap:10px">
        ${[
          {l:'Ingresos netos', v:fmt(snap.tI), c:'#F28C00'},
          {l:'Costos variables', v:fmt(snap.tC), c:'rgba(255,255,255,0.7)'},
          {l:'Margen bruto', v:fmt(snap.tM)+' ('+mPct+'%)', c:'#6fcf6f'},
          {l:'Gastos fijos', v:fmt(snap.gf), c:'rgba(255,255,255,0.7)'},
          {l:'Resultado operativo', v:fmt(snap.resultado), c:rc?'#6fcf6f':'#f28080'},
          {l:'Rentabilidad', v:oPct+'%', c:rc?'#6fcf6f':'#f28080'},
        ].map(k=>`<div style="background:rgba(255,255,255,0.07);border-radius:8px;padding:10px 13px">
          <div style="font-size:10px;opacity:0.5;text-transform:uppercase;letter-spacing:0.3px;margin-bottom:4px">${k.l}</div>
          <div style="font-family:'DM Mono',monospace;font-size:15px;font-weight:700;color:${k.c}">${k.v}</div>
        </div>`).join('')}
      </div>
      ${snap.rows && snap.rows.length ? `
      <div style="margin-top:14px;border-top:1px solid rgba(255,255,255,0.1);padding-top:12px">
        <div style="font-size:10px;opacity:0.4;text-transform:uppercase;letter-spacing:0.5px;margin-bottom:8px">Por producto</div>
        <div style="display:flex;flex-wrap:wrap;gap:6px">
          ${snap.rows.map(r=>{
            const pct = r.ing > 0 ? (r.marg/r.ing*100).toFixed(0) : 0;
            const col = pct >= 45 ? '#6fcf6f' : pct >= 30 ? '#F28C00' : '#f28080';
            return `<div style="background:rgba(255,255,255,0.07);border-radius:7px;padding:7px 11px;min-width:120px">
              <div style="font-size:11px;font-weight:600;margin-bottom:3px">${r.name}</div>
              <div style="font-size:10px;opacity:0.55">${r.units} u · ${fmt(r.ing)}</div>
              <div style="font-size:11px;font-weight:700;color:${col};margin-top:2px">${pct}% margen</div>
            </div>`;
          }).join('')}
        </div>
      </div>` : ''}
    </div>`;

  // mini chart for projection
  setTimeout(() => {
    if(!snap.rows || !snap.rows.length) return;
    const existing = document.getElementById('dash-proj-chart');
    if(existing) existing.remove();
    const wrap = document.createElement('div');
    wrap.style.cssText = 'display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:18px';
    wrap.innerHTML = `
      <div class="chart-card" style="background:white">
        <div class="chart-card-title">Ingresos vs Costos (proyección)</div>
        <div class="chart-container" style="height:200px"><canvas id="chart-dash-proj-bar"></canvas></div>
      </div>
      <div class="chart-card" style="background:white">
        <div class="chart-card-title">Distribución de ingresos por producto</div>
        <div class="chart-container" style="height:200px"><canvas id="chart-dash-proj-pie"></canvas></div>
      </div>`;
    wrap.id = 'dash-proj-chart';
    banner.after(wrap);
    const labels = snap.rows.map(r => r.name.length > 13 ? r.name.slice(0,12)+'…' : r.name);
    mkChart('chart-dash-proj-bar', {type:'bar', data:{labels, datasets:[
      {label:'Ingreso', data:snap.rows.map(r=>r.ing), backgroundColor:'#F28C0088', borderColor:'#F28C00', borderWidth:1, borderRadius:3},
      {label:'Costo',   data:snap.rows.map(r=>r.cost), backgroundColor:'#c0392b55', borderColor:'#c0392b', borderWidth:1, borderRadius:3},
      {label:'Margen',  data:snap.rows.map(r=>r.marg), backgroundColor:'#23532855', borderColor:'#235328', borderWidth:1, borderRadius:3},
    ]}, options:{responsive:true,maintainAspectRatio:false,plugins:{legend:{display:true,position:'top',labels:{boxWidth:10,font:{size:10}}}},scales:{x:{ticks:{font:{size:9},maxRotation:40}},y:{ticks:{callback:v=>'$'+(v/1000).toFixed(0)+'k',font:{size:10}}}}}});
    const pc = ['#F28C00','#235328','#c0392b','#2980b9','#8e44ad','#16a085','#e67e22','#d68910'];
    mkChart('chart-dash-proj-pie', {type:'doughnut', data:{labels:snap.rows.map(r=>r.name), datasets:[{data:snap.rows.map(r=>r.ing), backgroundColor:pc, borderWidth:2, borderColor:'white'}]}, options:{responsive:true,maintainAspectRatio:false,cutout:'55%',plugins:{legend:{display:true,position:'right',labels:{boxWidth:10,font:{size:10}}},tooltip:{callbacks:{label:ctx=>`${ctx.label}: ${fmt(ctx.parsed)}`}}}}});
  }, 80);
}

// ═══════════════════════════════════════════════════════
// PRINT OVERLAY — A4 rich format
// ═══════════════════════════════════════════════════════
function closePrintOverlay() {
  document.getElementById('print-overlay').style.display = 'none';
  document.body.classList.remove('printing-proj');
}

function exportProjectionPDF() {
  const data = computeCurrentProjData();
  buildPrintContent(data);
  const po = document.getElementById('print-overlay'); po.style.display = 'flex';
  setTimeout(() => { renderPrintCharts(data); }, 200);
}

function closePrintOverlayAndPrint() {
  document.body.classList.add('printing-proj');
  window.print();
  setTimeout(() => document.body.classList.remove('printing-proj'), 1000);
}

function computeCurrentProjData() {
  initProjDist();
  const PJ = computeProjection();
  return {
    name:  'Proyección actual',
    label: new Date().toLocaleDateString('es-AR', {month:'long', year:'numeric'}),
    savedAt: new Date().toLocaleString('es-AR'),
    gf: PJ.gf, tI: PJ.tI, tC: PJ.tC, tM: PJ.tM, resultado: PJ.resultado, totalUnits: PJ.totalUnits, ticketProm: PJ.ticketProm,
    channelBreakdown: PJ.channelBreakdown,
    gananciaDiaria:  PJ.gananciaDiaria,
    gananciaWeekly:  PJ.gananciaWeekly,
    dist: {...projChannelDist},
    mode: PJ.mode,
    rows: PJ.rows.map(r=>({name:r.name, units:r.units, ing:r.ing, cost:r.cost, marg:r.marg})),
    live: true
  };
}

function buildPrintContent(data) {
  const rc   = data.resultado >= 0;
  const mPct = data.tI > 0 ? (data.tM / data.tI * 100).toFixed(1) : '0';
  const oPct = data.tI > 0 ? (data.resultado / data.tI * 100).toFixed(1) : '0';
  const now  = new Date().toLocaleDateString('es-AR', {day:'numeric', month:'long', year:'numeric'});
  const gananciaDiaria = data.gananciaDiaria != null ? data.gananciaDiaria : data.resultado / 30;
  const gananciaWeekly = data.gananciaWeekly != null ? data.gananciaWeekly : data.resultado / 4.33;
  const rdColor = rc ? '#235328' : '#c0392b';

  // ── A4 page wrapper: explicit white background, fixed dimensions ──────────
  // 210mm wide, min 297mm tall, forced white bg to override any container color
  const PAGE = (body, pgNum, total) => `
    <div style="
      width:210mm; min-height:297mm; box-sizing:border-box;
      padding:14mm 14mm 14mm; background:#ffffff !important;
      font-family:'DM Sans',sans-serif; color:#1e2c1f;
      page-break-after:always; break-after:page;
      border-radius:4px; box-shadow:0 4px 20px rgba(0,0,0,0.2);
    ">
      ${body}
      <!-- footer -->
      <div style="margin-top:28px;padding-top:8px;border-top:1px solid #e0d8c8;display:flex;justify-content:space-between;align-items:center">
        <div style="font-size:8px;color:#aaa;font-family:'DM Mono',monospace">Sahten · Gestión de Costos · Página ${pgNum} de ${total}</div>
        <div style="font-size:8px;color:#aaa">${now}</div>
      </div>
    </div>`;

  // ── HEADER (shared between pages) ────────────────────────────────────────
  // Use a table for the header — tables don't get clipped by page-break
  const HEADER = (title) => `
    <table style="width:100%;border-collapse:collapse;margin-bottom:14px;border-bottom:2.5px solid #235328;padding-bottom:10px" cellpadding="0" cellspacing="0">
      <tr>
        <td style="vertical-align:middle;width:1%;white-space:nowrap;padding-bottom:10px;padding-right:10px">
          <svg style="width:96px;height:40px;display:block" viewBox="0 0 1703 704" fill="none" xmlns="http://www.w3.org/2000/svg">${GF_LOGO_PATHS}</svg>
        </td>
        <td style="vertical-align:middle;padding-bottom:10px">
          <div style="font-size:8px;color:#6b7c6c;text-transform:uppercase;letter-spacing:0.8px;font-family:'DM Sans',sans-serif">Sistema de Gestión · Beta v${window.SAHTEN_VERSION}</div>
        </td>
        <td style="text-align:right;vertical-align:middle;padding-bottom:10px">
          <div style="font-size:14px;font-weight:700;color:#1e2c1f">${title}</div>
          <div style="font-size:10px;color:#6b7c6c;margin-top:2px">${data.label} · ${data.live ? 'Generado' : 'Guardado'} ${data.savedAt}</div>
        </td>
      </tr>
    </table>`;

  // ── KPI CARD ─────────────────────────────────────────────────────────────
  const KPI = (l, v, sub, c) => `
    <div style="border:1px solid #e0d8c8;border-radius:8px;padding:10px 12px;border-left:3px solid ${c};background:#fafaf8;min-width:0">
      <div style="font-size:8px;text-transform:uppercase;letter-spacing:0.4px;color:#6b7c6c;margin-bottom:4px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${l}</div>
      <div style="font-family:'DM Mono',monospace;font-size:16px;font-weight:700;color:${c};line-height:1.1;white-space:nowrap">${v}</div>
      <div style="font-size:9px;color:#aaa;margin-top:3px">${sub}</div>
    </div>`;

  // ═══════════════════════════════════════════════════════
  // PAGE 1 — KPIs + Charts
  // A4 usable height ~269mm. Budget:
  //   Header:   ~18mm
  //   KPIs 2×4: ~50mm (2 rows × 25mm each)
  //   Charts:   ~120mm (2 side by side)
  //   Waterfall:~60mm
  //   Footer:   ~10mm  → Total: ~258mm ✓
  // ═══════════════════════════════════════════════════════
  const kpis1 = [
    {l:'Ingresos netos', v:fmt(data.tI), sub:'Después de comisiones', c:'#F28C00'},
    {l:'Costos variables', v:fmt(data.tC), sub:'Producción × unidades', c:'#c0392b'},
    {l:'Margen bruto', v:fmt(data.tM), sub:mPct+'% sobre ingresos', c:'#235328'},
    {l:'Gastos fijos', v:fmt(data.gf), sub:'Operativos + sueldos neto', c:'#2980b9'},
    {l:'Resultado operativo', v:fmt(data.resultado), sub:rc?'Período rentable':'Período con pérdida', c:rdColor},
    {l:'Rentabilidad', v:oPct+'%', sub:'Resultado / Ingresos', c:rdColor},
    {l:'⚡ Ganancia diaria', v:fmt(Math.round(gananciaDiaria)), sub:'Resultado ÷ 30 días', c:rdColor},
    {l:'📅 Ganancia semanal', v:fmt(Math.round(gananciaWeekly)), sub:'Resultado ÷ 4.33 semanas', c:rdColor},
    {l:'Ticket promedio', v:fmt(data.ticketProm||0), sub:'Ingreso neto ÷ unidades', c:'#F28C00'},
    {l:'Total unidades', v:(data.totalUnits||0)+' u.', sub:'Suma de todos los productos', c:'#235328'},
  ];

  const page1Body = `
    ${HEADER(data.name && data.name !== data.label ? data.name + ' — Resumen' : 'Proyección Mensual — Resumen')}

    <!-- KPIs: 5 cols × 2 rows -->
    <div style="display:grid;grid-template-columns:repeat(5,1fr);gap:6px;margin-bottom:12px;flex-shrink:0">
      ${kpis1.map(k=>KPI(k.l,k.v,k.sub,k.c)).join('')}
    </div>

    <!-- Charts: side by side -->
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:10px">
      <div style="border:1px solid #e0d8c8;border-radius:8px;padding:10px 12px">
        <div style="font-size:9px;font-weight:700;color:#1e2c1f;text-transform:uppercase;letter-spacing:0.3px;margin-bottom:8px">Ingresos vs Costos por Producto</div>
        <div style="height:170px;position:relative"><canvas id="print-chart-bar"></canvas></div>
      </div>
      <div style="border:1px solid #e0d8c8;border-radius:8px;padding:10px 12px">
        <div style="font-size:9px;font-weight:700;color:#1e2c1f;text-transform:uppercase;letter-spacing:0.3px;margin-bottom:8px">Distribución de Ingresos por Canal</div>
        <div style="height:170px;position:relative"><canvas id="print-chart-doughnut"></canvas></div>
      </div>
    </div>

    <!-- Result strip -->
    <div style="background:${rc?'#d6eed7':'#fde8e6'};border-radius:8px;padding:10px 14px;border-left:4px solid ${rdColor};display:flex;align-items:center;justify-content:space-between;flex-shrink:0">
      <div style="font-size:11px;font-weight:700;color:${rdColor}">${rc?'✓ Período rentable':'⚠ Período con pérdida'}</div>
      <div style="display:flex;gap:20px;align-items:center">
        <div style="text-align:right"><div style="font-size:8px;color:${rdColor};opacity:0.7">Resultado operativo</div><div style="font-family:'DM Mono',monospace;font-size:15px;font-weight:700;color:${rdColor}">${fmt(data.resultado)}</div></div>
        <div style="text-align:right"><div style="font-size:8px;color:${rdColor};opacity:0.7">Rentabilidad</div><div style="font-family:'DM Mono',monospace;font-size:15px;font-weight:700;color:${rdColor}">${oPct}%</div></div>
      </div>
    </div>`;

  // ═══════════════════════════════════════════════════════
  // PAGE 2 — Products table
  // A4 usable: ~269mm. Budget:
  //   Header:  ~18mm
  //   Title:   ~8mm
  //   Table header: ~8mm
  //   Rows: N × ~7mm (compact)
  //   Summary: ~24mm
  //   Footer:  ~10mm
  // Max rows per page ~28. If more, table auto-overflows to page 3.
  // ═══════════════════════════════════════════════════════
  const mPctTot = data.tI > 0 ? (data.tM / data.tI * 100).toFixed(1) : '0';
  const tableRows = (data.rows||[]).map((r,i) => {
    const pct = r.ing > 0 ? (r.marg/r.ing*100) : 0;
    const rc2 = pct >= 45 ? '#235328' : pct >= 30 ? '#d68910' : '#c0392b';
    const bg2 = pct >= 45 ? '#d6eed7' : pct >= 30 ? '#fef9e7' : '#fde8e6';
    return `<tr style="background:${i%2===0?'#fafaf8':'white'}">
      <td style="padding:5px 7px;font-size:10px;font-weight:600;border-bottom:1px solid #f0ebe0">${r.name}</td>
      <td style="padding:5px 7px;font-size:10px;text-align:center;font-family:'DM Mono',monospace;color:#6b7c6c;border-bottom:1px solid #f0ebe0">${r.units}</td>
      <td style="padding:5px 7px;font-size:10px;text-align:right;font-family:'DM Mono',monospace;font-weight:600;color:#F28C00;border-bottom:1px solid #f0ebe0">${fmt(r.ing)}</td>
      <td style="padding:5px 7px;font-size:10px;text-align:right;font-family:'DM Mono',monospace;color:#6b7c6c;border-bottom:1px solid #f0ebe0">${fmt(r.cost)}</td>
      <td style="padding:5px 7px;font-size:10px;text-align:right;font-family:'DM Mono',monospace;font-weight:700;color:${rc2};border-bottom:1px solid #f0ebe0">${fmt(r.marg)}</td>
      <td style="padding:5px 7px;font-size:10px;text-align:center;border-bottom:1px solid #f0ebe0">
        <span style="font-family:'DM Mono',monospace;font-size:9px;font-weight:700;padding:2px 6px;border-radius:99px;background:${bg2};color:${rc2}">${pct.toFixed(1)}%</span>
      </td>
    </tr>`;
  }).join('');

  // Channel dist section
  const distHtml = Object.entries(data.dist||{}).filter(([,v])=>v>0).map(([chId,pct])=>{
    const ch  = CHANNELS.find(c=>c.id===chId);
    const col = chColor(chId);
    const cb  = (data.channelBreakdown||[]).find(x=>x.id===chId);
    return `<div style="display:flex;align-items:center;gap:6px;margin-bottom:4px">
      <div style="width:8px;height:8px;border-radius:50%;background:${col.bg};flex-shrink:0"></div>
      <span style="font-size:9px;flex:1;color:#1e2c1f">${ch?ch.name:chId}</span>
      <div style="width:40px;height:4px;background:#e0d8c8;border-radius:2px;overflow:hidden"><div style="width:${pct}%;height:100%;background:${col.bg};border-radius:2px"></div></div>
      <span style="font-family:'DM Mono',monospace;font-size:9px;font-weight:600;width:26px;text-align:right">${pct}%</span>
      <span style="font-family:'DM Mono',monospace;font-size:8px;color:#6b7c6c;width:60px;text-align:right">${cb?fmt(cb.ticketNeto):'—'} neto</span>
      <span style="font-family:'DM Mono',monospace;font-size:8px;color:#aaa;width:60px;text-align:right">${cb?fmt(cb.ticketCliente):'—'} cli.</span>
    </div>`;
  }).join('');

  const page2Body = `
    ${HEADER(data.name && data.name !== data.label ? data.name + ' — Detalle' : 'Proyección Mensual — Detalle')}

    <!-- Title -->
    <div style="font-size:10px;font-weight:700;color:#235328;text-transform:uppercase;letter-spacing:0.5px;padding-bottom:6px;border-bottom:2px solid #235328;margin-bottom:10px;flex-shrink:0">Detalle por Producto</div>

    <!-- Table -->
    <div style="flex:1;overflow:visible">
      <table style="width:100%;border-collapse:collapse;font-size:10px">
        <thead>
          <tr style="background:#235328;color:white">
            <th style="padding:6px 7px;text-align:left;font-weight:600;font-size:9px">Producto</th>
            <th style="padding:6px 7px;text-align:center;font-weight:600;font-size:9px">Unid.</th>
            <th style="padding:6px 7px;text-align:right;font-weight:600;font-size:9px">Ingreso neto</th>
            <th style="padding:6px 7px;text-align:right;font-weight:600;font-size:9px">Costo</th>
            <th style="padding:6px 7px;text-align:right;font-weight:600;font-size:9px">Margen $</th>
            <th style="padding:6px 7px;text-align:center;font-weight:600;font-size:9px">Margen %</th>
          </tr>
        </thead>
        <tbody>${tableRows}</tbody>
        <tfoot>
          <tr style="background:#235328;color:white;font-weight:700">
            <td style="padding:6px 7px;font-size:9px;font-weight:700">TOTALES</td>
            <td style="padding:6px 7px;text-align:center;font-family:'DM Mono',monospace;font-size:9px">${(data.rows||[]).reduce((s,r)=>s+r.units,0)}</td>
            <td style="padding:6px 7px;text-align:right;font-family:'DM Mono',monospace;font-size:9px">${fmt(data.tI)}</td>
            <td style="padding:6px 7px;text-align:right;font-family:'DM Mono',monospace;font-size:9px">${fmt(data.tC)}</td>
            <td style="padding:6px 7px;text-align:right;font-family:'DM Mono',monospace;font-size:9px">${fmt(data.tM)}</td>
            <td style="padding:6px 7px;text-align:center;font-family:'DM Mono',monospace;font-size:9px">${mPctTot}%</td>
          </tr>
        </tfoot>
      </table>
    </div>

    <!-- Summary + Dist row -->
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-top:12px;flex-shrink:0">
      <div style="background:${rc?'#d6eed7':'#fde8e6'};border-radius:8px;padding:10px 12px;border-left:3px solid ${rdColor}">
        <div style="font-size:8px;text-transform:uppercase;letter-spacing:0.4px;color:${rdColor};margin-bottom:4px">Resultado Operativo</div>
        <div style="font-family:'DM Mono',monospace;font-size:20px;font-weight:700;color:${rdColor}">${fmt(data.resultado)}</div>
        <div style="font-size:9px;color:${rdColor};margin-top:2px">${rc?'✓ Período rentable':'⚠ Período con pérdida'} · ${oPct}%</div>
      </div>
      <div style="border:1px solid #e0d8c8;border-radius:8px;padding:10px 12px">
        <div style="font-size:8px;text-transform:uppercase;letter-spacing:0.4px;color:#6b7c6c;margin-bottom:8px;font-weight:600">Distribución de Canales</div>
        ${distHtml}
      </div>
    </div>`;

  document.getElementById('print-content').innerHTML = PAGE(page1Body, 1, 2) + PAGE(page2Body, 2, 2);

  // Update modal info
  const infoEl = document.getElementById('print-modal-info');
  if (infoEl) infoEl.textContent = (data.name || 'Proyección') + ' · ' + data.label;
}


function renderPrintCharts(data) {
  const labels = data.rows.map(r => r.name.length > 13 ? r.name.slice(0,12)+'…' : r.name);
  const pc = ['#F28C00','#235328','#c0392b','#2980b9','#8e44ad','#16a085','#e67e22','#d68910','#E91E63','#795548'];

  destroyChart('print-chart-bar');
  const barEl = document.getElementById('print-chart-bar');
  if(barEl) charts['print-chart-bar'] = new Chart(barEl, {
    type:'bar', data:{labels, datasets:[
      {label:'Ingreso', data:data.rows.map(r=>r.ing), backgroundColor:'#F28C0077', borderColor:'#F28C00', borderWidth:1.5, borderRadius:3},
      {label:'Costo',   data:data.rows.map(r=>r.cost), backgroundColor:'#c0392b55', borderColor:'#c0392b', borderWidth:1.5, borderRadius:3},
      {label:'Margen',  data:data.rows.map(r=>r.marg), backgroundColor:'#23532855', borderColor:'#235328', borderWidth:1.5, borderRadius:3},
    ]},
    options:{responsive:true, maintainAspectRatio:false, plugins:{legend:{display:true, position:'top', labels:{boxWidth:10, font:{size:9}}}}, scales:{x:{ticks:{font:{size:8}, maxRotation:40}}, y:{ticks:{callback:v=>'$'+(v/1000).toFixed(0)+'k', font:{size:9}}}}}
  });

  destroyChart('print-chart-doughnut');
  const dEl = document.getElementById('print-chart-doughnut');
  if(dEl) charts['print-chart-doughnut'] = new Chart(dEl, {
    type:'doughnut', data:{labels: data.rows.map(r=>r.name), datasets:[{data: data.rows.map(r=>r.ing), backgroundColor:pc, borderWidth:2, borderColor:'white'}]},
    options:{responsive:true, maintainAspectRatio:false, cutout:'55%', plugins:{legend:{display:true, position:'right', labels:{boxWidth:9, font:{size:9}}}, tooltip:{callbacks:{label:ctx=>`${ctx.label}: ${fmt(ctx.parsed)}`}}}}
  });

  destroyChart('print-chart-waterfall');
  const wEl = document.getElementById('print-chart-waterfall');
  if(wEl) charts['print-chart-waterfall'] = new Chart(wEl, {
    type:'bar',
    data:{labels:['Ingresos netos','Costos variables','Margen bruto','Gastos fijos','Resultado'], datasets:[{
      data:[data.tI, data.tC, data.tM, data.gf, data.resultado],
      backgroundColor:['#F28C0077','#c0392b55','#23532855','#2980b955', data.resultado>=0?'#23532888':'#c0392b88'],
      borderColor:['#F28C00','#c0392b','#235328','#2980b9', data.resultado>=0?'#235328':'#c0392b'],
      borderWidth:2, borderRadius:5
    }]},
    options:{indexAxis:'y', responsive:true, maintainAspectRatio:false, plugins:{legend:{display:false}, tooltip:{callbacks:{label:ctx=>`${fmt(ctx.parsed.x)}`}}}, scales:{x:{ticks:{callback:v=>'$'+(v/1000000).toFixed(1)+'M', font:{size:9}}}, y:{ticks:{font:{size:10}}}}}
  });
}
