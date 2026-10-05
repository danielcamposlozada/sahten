// ═══════════════════════════════════════════════════════════
// SAHTEN — UX (v3): "¿De dónde sale este precio?" + red de seguridad de modo oscuro
// ═══════════════════════════════════════════════════════════
(function(){
const css=`
.why-btn{width:18px;height:18px;border-radius:50%;border:1px solid var(--border);background:transparent;color:var(--muted);font-size:11px;font-weight:700;line-height:1;cursor:pointer;margin-left:6px;vertical-align:middle;font-family:inherit;padding:0}
.why-btn:hover{border-color:var(--accent);color:var(--accent)}
.why-ov{position:fixed;inset:0;z-index:9200;background:rgba(10,20,12,.45);display:flex;align-items:center;justify-content:center;padding:14px}
.why-box{background:var(--card,#fff);color:var(--ink);border-radius:18px;width:100%;max-width:520px;max-height:calc(100vh - 28px);overflow-y:auto;box-shadow:0 24px 80px rgba(0,0,0,.35);padding:20px 22px}
.why-box h3{margin:0 0 2px;font-size:17px;letter-spacing:-.02em}.why-sub{font-size:12px;color:var(--muted);margin-bottom:14px}
.why-grp{font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.5px;color:var(--muted);margin:14px 0 6px}
.why-r{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:10px;padding:5px 0;font-size:13px;border-bottom:1px dashed var(--border)}
.why-r span:last-child{font-family:'DM Mono',monospace;white-space:nowrap}.why-r.t{font-weight:700;border-bottom:1px solid var(--border)}.why-r.t span:last-child{color:var(--primary)}
.why-r small{display:block;font-size:11px;color:var(--muted);font-weight:400}
.why-r a{color:var(--accent);cursor:pointer;text-decoration:none;font-size:11px;margin-left:6px}
.why-ch{display:grid;grid-template-columns:minmax(0,1fr) repeat(3,auto);gap:4px 12px;font-size:12px;align-items:baseline}.why-ch b{font-weight:600}.why-ch span{font-family:'DM Mono',monospace;text-align:right;white-space:nowrap}.why-ch .h{font-family:inherit;font-size:10px;color:var(--muted);text-transform:uppercase;letter-spacing:.4px}
/* Modo oscuro: elementos con fondo claro puesto inline desde JS */
[data-theme="dark"] :is([style*="background:white"],[style*="background: white"],[style*="background:#fff"],[style*="background: #fff"],[style*="background:#FFF"],[style*="background:#fafafa"],[style*="background:#e8e8e8"],[style*="background:#f5f5f5"]):not(#print-overlay *):not(#print-overlay):not(.leaflet-tile):not(img){background:var(--card,#162019)!important;color:var(--ink)}
[data-theme="dark"] :is([style*="color:#333"],[style*="color: #333"],[style*="color:#222"],[style*="color:#444"],[style*="color:#555"],[style*="color:#000"],[style*="color: #000"]):not(#print-overlay *){color:var(--ink)!important}
[data-theme="dark"] :is([style*="color:#888"],[style*="color:#999"],[style*="color:#666"]):not(#print-overlay *){color:var(--muted)!important}
[data-theme="dark"] :is([style*="border:1px solid #ccc"],[style*="border:1px solid #ddd"],[style*="border:1px solid #eee"]){border-color:var(--border)!important}
[data-theme="dark"] :is(.leaflet-popup-content-wrapper,.leaflet-popup-tip){background:var(--card,#162019);color:var(--ink)}
[data-theme="dark"] .leaflet-control-zoom a{background:var(--card,#162019);color:var(--ink);border-color:var(--border)}
[data-theme="dark"] .leaflet-container{background:#1d2a20}
[data-theme="dark"] :is(select,input,textarea):not([type=checkbox]):not([type=radio]):not([type=range]):not([type=color]){color-scheme:dark}
.nav-section{margin-top:6px}`;
const st=document.createElement('style'); st.textContent=css; document.head.appendChild(st);
const esc=s=>String(s??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[m]));
const P=v=>(v*100).toFixed(v*100%1?1:0)+'%';

window.sahtenWhy=function(id){
  const i=PRODUCTS.findIndex(x=>x.id===id); const p=PRODUCTS[i]; if(!p) return;
  const ingRaw=(p.ingredients||[]).reduce((s,r)=>s+calcIngCost(r),0); const manual=ingRaw<=0&&(p.receta_cost||0)>0;
  const ing=ingRaw>0?ingRaw:(p.receta_cost||0); const pack=packCost(p); const combo=comboCost(p); const tot=totalCost(p); const porc=getPorc(p); const cpu=costPerUnit(p);
  const absorbs=typeof absorbsGF==='function'?absorbsGF(p):true; const gfu=gfPerUnit(); const gfa=gfAssigned(p);
  const ub=typeof gfUnitsBase==='function'?gfUnitsBase():0; const est=+(window.SAHTEN_PROJECT||SAHTEN_PROJECT||{}).estUnitsMonth||0;
  const tier=getTier(p.tier); const adj=p.priceAdj||1; const base=cpu+gfa; const afterTier=base*tier.factor*adj;
  const disc=p.discount||0, dtype=p.discountType||'pct'; const afterDisc=disc>0?(dtype==='pct'?afterTier*(1-disc):afterTier-disc):afterTier;
  const mp=mostradorPrice(p); const most=CHANNELS.find(c=>c.id==='mostrador'); const gc=globalComm(); const mfp=mostradorFinalPrice(p);
  const margin=mfp-base; const mPct=mfp>0?margin/mfp:0;
  const row=(l,v,sub,link,t)=>`<div class="why-r${t?' t':''}"><span>${l}${link||''}${sub?`<small>${sub}</small>`:''}</span><span>${v}</span></div>`;
  const go=(panel,extra)=>`<a onclick="document.getElementById('why-ov').remove();${extra||`showPanel('${panel}')`}">ir ›</a>`;
  const chs=CHANNELS.filter(c=>c.enabled&&c.id!=='mostrador');
  let ov=document.getElementById('why-ov'); if(ov) ov.remove();
  ov=document.createElement('div'); ov.id='why-ov'; ov.className='why-ov'; ov.addEventListener('click',e=>{ if(e.target===ov) ov.remove(); });
  ov.innerHTML=`<div class="why-box"><div style="display:flex;align-items:flex-start;gap:10px"><div style="flex:1"><h3>¿De dónde sale este precio?</h3><div class="why-sub">${esc(p.name)}</div></div><button class="why-btn" style="width:28px;height:28px;font-size:14px" onclick="this.closest('.why-ov').remove()">✕</button></div>
  <div class="why-grp">1 · Costo por unidad</div>
  ${row(manual?'Costo de receta (manual)':'Ingredientes',fmt(ing),manual?'No hay ingredientes vinculados; se usa el costo cargado a mano.':(p.ingredients||[]).filter(r=>r.ingId).length+' ingrediente(s)',go('',`openRecipe(${i})`))}
  ${pack?row('Envases',fmt(pack)):''}${combo?row('Sub-recetas / combos',fmt(combo)):''}
  ${row('Costo total de la receta',fmt(tot))}
  ${porc!==1?row('÷ Porciones que rinde','÷ '+(Math.round(porc*100)/100),p.merma?'Incluye merma de '+p.merma+'%':''):''}
  ${row('Costo por unidad',fmt(cpu),'',null,true)}
  <div class="why-grp">2 · Gasto fijo asignado</div>
  ${absorbs?row('GF por unidad',fmt(gfu),ub>0?'GF total '+fmt(totalGF())+' ÷ '+ub.toLocaleString('es-AR')+' u./mes de productos que absorben GF':(est>0?'GF total '+fmt(totalGF())+' ÷ '+est.toLocaleString('es-AR')+' u. estimadas (setup)':'Sin ventas cargadas: no se reparte GF'),go('ventas')):row('Este producto no absorbe GF','—','Se activa en Ventas + GF',go('ventas'))}
  ${absorbs&&p.gfPctOverride!=null?row('Ajuste de GF del producto','× '+P(p.gfPctOverride/100)):''}
  ${row('Costo + GF',fmt(base),'',null,true)}
  <div class="why-grp">3 · Precio mostrador</div>
  ${row('× Tier '+esc(tier.name||tier.id),'× '+tier.factor.toFixed(2),'',go('ajustes'))}
  ${adj!==1?row('× Ajuste de precio (estrategia)','× '+adj.toFixed(3),'Editable en Ventas + GF'):''}
  ${disc>0?row('− Descuento del producto',dtype==='pct'?'− '+P(disc):'− '+fmt(disc)):''}
  ${row('Redondeo','→ '+fmt(mp),'Calculado: '+fmt(afterDisc))}
  ${most&&most.surcharge?row('× Sobrecargo mostrador','× '+(1+most.surcharge).toFixed(2)):''}
  ${gc?row('× Comisión global','× '+(1+gc).toFixed(3),'',go('gastos')):''}
  ${row('Precio mostrador',fmt(mfp),'Margen sobre costo + GF: '+fmt(margin)+' ('+P(mPct)+')',null,true)}
  ${chs.length?`<div class="why-grp">4 · Por canal</div><div class="why-ch"><span class="h" style="text-align:left">Canal</span><span class="h">Cliente paga</span><span class="h">Comisión</span><span class="h">Recibís</span>
    ${chs.map(c=>{ const g=channelPriceWithDisc(p,c.id)??channelPrice(p,c.id); const n=channelNetReceivedWithDisc(p,c.id); const d=typeof effectiveChannelDisc==='function'?effectiveChannelDisc(p,c.id):0;
      return `<b>${esc(c.name)}<small style="display:block;font-weight:400;color:var(--muted);font-size:10px">+${P(c.surcharge||0)} sobre mostrador${gc?' · +'+P(gc)+' com. global':''}${d?' · −'+P(d)+' desc.':''}</small></b><span>${fmt(g||0)}</span><span>${P(c.commission||0)}</span><span style="color:${(n||0)>=mfp*0.95?'var(--green)':'var(--accent)'}">${fmt(n||0)}</span>`; }).join('')}</div>`:''}
  </div>`;
  document.body.appendChild(ov);
};
})();
