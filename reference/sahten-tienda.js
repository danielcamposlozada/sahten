// ═══════════════════════════════════════════════════════
// SAHTEN — TIENDA ONLINE SETTINGS v2
// Leaflet map with polygon + circle zone editor
// ═══════════════════════════════════════════════════════

const TIENDA_KEY_PREFIX = 'sahten_tienda_';
let _leafletMap = null;
let _leafletLayers = [];

function _getTiendaKey() {
  // Use project-specific key based on SAVE_KEY
  return TIENDA_KEY_PREFIX + (window.SAVE_KEY || 'sahten_v4_data');
}

function _loadTiendaConfig() {
  try { return JSON.parse(localStorage.getItem(_getTiendaKey()) || '{}'); } catch(e) { return {}; }
}
function _saveTiendaConfig(cfg) {
  localStorage.setItem(_getTiendaKey(), JSON.stringify(cfg));
}
function _defaultTiendaConfig() {
  return {
    address: 'Av. Siempreviva 742, C1000 Buenos Aires',
    lat: -34.6037, lng: -58.3816,
    costPerKm: 1500,
    freeShippingMin: 45000,
    zones: [
      { id:'z1', name:'Zona A', type:'circle', radiusKm:2, baseCost:1500, color:'#4CAF50', points:[] },
      { id:'z2', name:'Zona B', type:'circle', radiusKm:4, baseCost:3000, color:'#FF9800', points:[] },
      { id:'z3', name:'Zona C', type:'circle', radiusKm:6, baseCost:4500, color:'#F44336', points:[] },
    ],
    paymentMethods: { efectivo:true, transferencia:true, mercadopago:false, tarjeta:false },
    bankDetails: { bankName:'', accountHolder:'', cbu:'', alias:'', notes:'' },
    deliveryMinOrder: 15000,
  };
}
function _getTiendaConfig() {
  const saved = _loadTiendaConfig();
  const def = _defaultTiendaConfig();
  return { ...def, ...saved, paymentMethods:{...def.paymentMethods,...(saved.paymentMethods||{})}, bankDetails:{...def.bankDetails,...(saved.bankDetails||{})} };
}

// ─── Main render ─────────────────────────────────────
function _renderTiendaOnline() {
  const el = document.getElementById('tienda-online-content');
  if (!el) return;
  const cfg = _getTiendaConfig();

  // Clean up old map before destroying container
  if (_leafletMap) { try { _leafletMap.remove(); } catch(e) {} _leafletMap = null; }
  _leafletLayers = [];

  el.innerHTML = `
    <div class="info-banner" style="margin-bottom:16px">
      <strong>Tienda Online:</strong> Configurá tu tienda web — zonas de delivery, métodos de pago y datos bancarios.
    </div>

    <!-- UBICACIÓN + MAPA -->
    <div class="card" style="margin-bottom:16px">
      <div class="card-header"><div class="card-title" style="display:flex;align-items:center;gap:8px">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z"/><circle cx="12" cy="9" r="2.5"/></svg>
        Ubicación y zonas de delivery
      </div></div>
      <div class="card-body">
        <div style="display:flex;gap:10px;align-items:flex-end;margin-bottom:12px">
          <div style="flex:1">
            <label style="font-size:11px;font-weight:600;color:var(--muted);text-transform:uppercase;letter-spacing:0.5px;margin-bottom:4px;display:block">Dirección del local</label>
            <div style="position:relative">
              <input type="text" class="form-input" id="tienda-addr" autocomplete="off" value="${_esc(cfg.address)}" style="width:100%;box-sizing:border-box" oninput="_tiendaAddrInput(this.value)" onkeydown="if(event.key==='Enter'){event.preventDefault();_tiendaSaveAddr();}" onblur="setTimeout(()=>{const b=document.getElementById('tienda-addr-sugs');if(b)b.style.display='none';},200)">
              <div id="tienda-addr-sugs" style="display:none;position:absolute;left:0;right:0;top:100%;margin-top:4px;z-index:1000;background:var(--card,#fff);border:1px solid var(--border);border-radius:10px;box-shadow:0 8px 24px rgba(0,0,0,0.15);overflow:hidden"></div>
            </div>
          </div>
          <button class="btn btn-accent" onclick="_tiendaSaveAddr()" style="white-space:nowrap">📍 Guardar</button>
        </div>
        <!-- Leaflet Map -->
        <div id="tienda-map" style="width:100%;height:380px;border-radius:12px;overflow:hidden;border:1px solid var(--border);background:#e8e8e8;position:relative;z-index:1"></div>
        <div style="margin-top:8px;font-size:11px;color:var(--muted);display:flex;gap:10px;flex-wrap:wrap;justify-content:space-between"><span>Arrastrá el pin verde si la ubicación del local no es exacta. Hacé click en una zona para editarla.</span><span id="tienda-coords" style="font-family:'DM Mono',monospace">${cfg.lat!=null?Number(cfg.lat).toFixed(5)+', '+Number(cfg.lng).toFixed(5):''}${cfg.geoOk?'':' · <span style="color:var(--accent)">ubicación sin confirmar</span>'}</span></div>
      </div>
    </div>

    <!-- ZONA LIST + ACTIONS -->
    <div class="card" style="margin-bottom:16px">
      <div class="card-header"><div class="card-title" style="display:flex;align-items:center;gap:8px">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/></svg>
        Zonas de delivery
      </div></div>
      <div class="card-body">
        <div id="tienda-zones-list">
          ${cfg.zones.map((z,i) => `
            <div style="display:flex;align-items:center;gap:10px;padding:12px 14px;background:var(--card);border:1px solid var(--border);border-radius:10px;margin-bottom:8px;border-left:4px solid ${z.color};cursor:pointer" onclick="_tiendaFocusZone(${i})">
              <div style="width:10px;height:10px;border-radius:50%;background:${z.color};flex-shrink:0"></div>
              <div style="flex:1">
                <div style="font-size:14px;font-weight:700">${_esc(z.name)}</div>
                <div style="font-size:12px;color:var(--muted);margin-top:2px">${z.type==='polygon'?'Polígono ('+((z.points||[]).length)+' nodos)':'Radio: '+z.radiusKm+' km'} · Costo: $${_fmtN(z.baseCost)}</div>
              </div>
              <button class="btn" style="padding:4px 8px;font-size:11px" onclick="event.stopPropagation();_tiendaEditZone(${i})">✏️</button>
              <button class="btn" style="padding:4px 8px;font-size:11px;color:var(--danger)" onclick="event.stopPropagation();_tiendaDeleteZone(${i})">🗑</button>
            </div>
          `).join('')}
        </div>
        <div style="display:flex;gap:8px;margin-top:8px">
          <button class="btn btn-accent" onclick="_tiendaAddZone('circle')" style="flex:1">⭕ Zona por radio</button>
          <button class="btn btn-accent" onclick="_tiendaAddZone('polygon')" style="flex:1">📐 Zona por polígono</button>
        </div>
      </div>
    </div>

    <!-- SHIPPING SETTINGS -->
    <div class="card" style="margin-bottom:16px">
      <div class="card-header"><div class="card-title">🚛 Costos de envío</div></div>
      <div class="card-body">
        <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:12px">
          <div>
            <label style="font-size:11px;font-weight:600;color:var(--muted);text-transform:uppercase;letter-spacing:0.5px;margin-bottom:4px;display:block">Costo por km ($)</label>
            <input type="number" class="form-input" value="${cfg.costPerKm}" style="width:100%;box-sizing:border-box" onchange="_tiendaSaveField('costPerKm',parseInt(this.value)||0)">
          </div>
          <div>
            <label style="font-size:11px;font-weight:600;color:var(--muted);text-transform:uppercase;letter-spacing:0.5px;margin-bottom:4px;display:block">Envío gratis desde ($)</label>
            <input type="number" class="form-input" value="${cfg.freeShippingMin}" style="width:100%;box-sizing:border-box" onchange="_tiendaSaveField('freeShippingMin',parseInt(this.value)||0)">
          </div>
          <div>
            <label style="font-size:11px;font-weight:600;color:var(--muted);text-transform:uppercase;letter-spacing:0.5px;margin-bottom:4px;display:block">Pedido mínimo ($)</label>
            <input type="number" class="form-input" value="${cfg.deliveryMinOrder}" style="width:100%;box-sizing:border-box" onchange="_tiendaSaveField('deliveryMinOrder',parseInt(this.value)||0)">
          </div>
        </div>
      </div>
    </div>

    <!-- MÉTODOS DE PAGO -->
    <div class="card" style="margin-bottom:16px">
      <div class="card-header"><div class="card-title" style="display:flex;align-items:center;gap:8px">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="1" y="4" width="22" height="16" rx="2"/><line x1="1" y1="10" x2="23" y2="10"/></svg>
        Métodos de pago
      </div></div>
      <div class="card-body">
        <div style="font-size:12px;color:var(--muted);margin-bottom:14px">Activá los métodos de pago disponibles en tu tienda online.</div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px">
          ${Object.entries({efectivo:'💵 Efectivo',transferencia:'🏦 Transferencia',mercadopago:'📱 Mercado Pago',tarjeta:'💳 Tarjeta'}).map(([k,label])=>`
            <div style="display:flex;align-items:center;justify-content:space-between;padding:12px 16px;border:1px solid var(--border);border-radius:10px;background:var(--card)">
              <span style="font-size:13px;font-weight:600">${label}</span>
              <label style="position:relative;width:44px;height:24px;display:inline-block;cursor:pointer">
                <input type="checkbox" ${cfg.paymentMethods[k]?'checked':''} onchange="_tiendaTogglePay('${k}',this.checked)" style="opacity:0;width:0;height:0;position:absolute">
                <span style="position:absolute;top:0;left:0;right:0;bottom:0;background:${cfg.paymentMethods[k]?'var(--primary)':'#ccc'};border-radius:24px;transition:0.2s">
                  <span style="position:absolute;height:18px;width:18px;left:${cfg.paymentMethods[k]?'22px':'3px'};bottom:3px;background:white;border-radius:50%;transition:0.2s;box-shadow:0 1px 3px rgba(0,0,0,0.2)"></span>
                </span>
              </label>
            </div>
          `).join('')}
        </div>
      </div>
    </div>

    <!-- DATOS BANCARIOS -->
    <div class="card" style="margin-bottom:16px">
      <div class="card-header"><div class="card-title" style="display:flex;align-items:center;gap:8px">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 21h18"/><path d="M3 7V5a2 2 0 012-2h14a2 2 0 012 2v2"/><path d="M3 7h18v4H3z"/></svg>
        Datos bancarios (transferencia)
      </div></div>
      <div class="card-body">
        <div style="font-size:12px;color:var(--muted);margin-bottom:14px">Se muestran al cliente cuando elige pagar por transferencia.</div>
        <div style="display:grid;gap:12px">
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">
            <div>
              <label style="font-size:11px;font-weight:600;color:var(--muted);text-transform:uppercase;letter-spacing:0.5px;margin-bottom:4px;display:block">Banco</label>
              <input type="text" class="form-input" value="${_esc(cfg.bankDetails.bankName)}" placeholder="Ej: Banco Galicia" style="width:100%;box-sizing:border-box" onchange="_tiendaSaveBank('bankName',this.value)">
            </div>
            <div>
              <label style="font-size:11px;font-weight:600;color:var(--muted);text-transform:uppercase;letter-spacing:0.5px;margin-bottom:4px;display:block">Titular</label>
              <input type="text" class="form-input" value="${_esc(cfg.bankDetails.accountHolder)}" placeholder="Nombre del titular" style="width:100%;box-sizing:border-box" onchange="_tiendaSaveBank('accountHolder',this.value)">
            </div>
          </div>
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">
            <div>
              <label style="font-size:11px;font-weight:600;color:var(--muted);text-transform:uppercase;letter-spacing:0.5px;margin-bottom:4px;display:block">CBU</label>
              <input type="text" class="form-input" value="${_esc(cfg.bankDetails.cbu)}" placeholder="CBU" style="width:100%;box-sizing:border-box" onchange="_tiendaSaveBank('cbu',this.value)">
            </div>
            <div>
              <label style="font-size:11px;font-weight:600;color:var(--muted);text-transform:uppercase;letter-spacing:0.5px;margin-bottom:4px;display:block">Alias</label>
              <input type="text" class="form-input" value="${_esc(cfg.bankDetails.alias)}" placeholder="Alias" style="width:100%;box-sizing:border-box" onchange="_tiendaSaveBank('alias',this.value)">
            </div>
          </div>
          <div>
            <label style="font-size:11px;font-weight:600;color:var(--muted);text-transform:uppercase;letter-spacing:0.5px;margin-bottom:4px;display:block">Nota adicional</label>
            <textarea class="form-input" rows="2" placeholder="Ej: Enviar comprobante por WhatsApp" style="width:100%;box-sizing:border-box" onchange="_tiendaSaveBank('notes',this.value)">${_esc(cfg.bankDetails.notes)}</textarea>
          </div>
        </div>
      </div>
    </div>

    <!-- PREVIEW -->
    <div class="card">
      <div class="card-header"><div class="card-title">🔗 Abrir tienda</div></div>
      <div class="card-body" style="text-align:center">
        <button class="btn btn-accent" onclick="window.open('Sahten Menu v2.html','_blank')" style="padding:12px 24px">
          Abrir Sahten Menu Online ↗
        </button>
      </div>
    </div>
  `;

  // Init Leaflet map after DOM is ready
  setTimeout(_initLeafletMap, 100);
}

// ─── Leaflet Map ─────────────────────────────────────
function _loadLeaflet(cb) {
  if (window.L) { cb(); return; }
  // Load Leaflet CSS
  const link = document.createElement('link');
  link.rel = 'stylesheet';
  link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
  document.head.appendChild(link);
  // Load Leaflet JS
  const script = document.createElement('script');
  script.src = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';
  script.onload = cb;
  document.head.appendChild(script);
}

function _initLeafletMap() {
  const container = document.getElementById('tienda-map');
  if (!container) return;

  _loadLeaflet(() => {
    const cfg = _getTiendaConfig();
    const center = [cfg.lat || -34.6037, cfg.lng || -58.3816];

    // Destroy previous map safely
    if (_leafletMap) { try { _leafletMap.remove(); } catch(e) {} _leafletMap = null; }
    _leafletLayers = [];

    _leafletMap = L.map('tienda-map', { zoomControl: true }).setView(center, 13);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '© OpenStreetMap'
    }).addTo(_leafletMap);

    // Store marker (arrastrable para ajustar la ubicación exacta)
    const storeMk = L.marker(center, {
      draggable: true,
      icon: L.divIcon({
        className: '',
        html: '<svg width="32" height="42" viewBox="0 0 30 40" style="filter:drop-shadow(0 2px 3px rgba(0,0,0,.35));display:block"><path d="M15 1C7.3 1 1 7.2 1 14.9 1 25.4 15 39 15 39s14-13.6 14-24.1C29 7.2 22.7 1 15 1z" fill="#235328" stroke="#fff" stroke-width="2"/><path d="M9 12l1-3h10l1 3M10 12v7h10v-7M13.5 19v-3.5h3V19" fill="none" stroke="#fff" stroke-width="1.6" stroke-linejoin="round"/></svg>',
        iconSize: [32, 42],
        iconAnchor: [16, 41]
      })
    }).addTo(_leafletMap).bindPopup('<strong>' + _esc(cfg.storeName || 'Local') + '</strong><br>' + _esc(cfg.address));
    storeMk.on('dragend', () => { const ll = storeMk.getLatLng(); _tiendaSetLocation(ll.lat, ll.lng, null, true); });

    // Draw zones
    _drawZonesOnMap(cfg);

    // Fix map size
    setTimeout(() => _leafletMap.invalidateSize(), 200);
  });
}

function _drawZonesOnMap(cfg) {
  if (!_leafletMap) return;
  // Clear existing
  _leafletLayers.forEach(l => _leafletMap.removeLayer(l));
  _leafletLayers = [];

  const center = [cfg.lat || -34.6037, cfg.lng || -58.3816];

  cfg.zones.forEach((z, i) => {
    let layer;
    if (z.type === 'polygon' && z.points && z.points.length >= 3) {
      layer = L.polygon(z.points, {
        color: z.color, fillColor: z.color, fillOpacity: 0.12,
        weight: 2, dashArray: '6 4'
      });
    } else {
      // Circle
      layer = L.circle(center, {
        radius: (z.radiusKm || 2) * 1000,
        color: z.color, fillColor: z.color, fillOpacity: 0.1,
        weight: 2, dashArray: '6 4'
      });
    }
    layer.bindPopup(`<strong>${_esc(z.name)}</strong><br>Costo: $${_fmtN(z.baseCost)}<br><button onclick="_tiendaEditZone(${i})" style="margin-top:6px;padding:4px 12px;border:1px solid #ccc;border-radius:6px;cursor:pointer;font-size:12px">✏️ Editar</button>`);
    layer.addTo(_leafletMap);
    _leafletLayers.push(layer);
  });
}

function _tiendaFocusZone(i) {
  if (!_leafletMap || !_leafletLayers[i]) return;
  const layer = _leafletLayers[i];
  if (layer.getBounds) {
    _leafletMap.fitBounds(layer.getBounds(), { padding: [40, 40] });
  } else if (layer.getLatLng) {
    _leafletMap.setView(layer.getLatLng(), 14);
  }
  layer.openPopup();
}

// ─── Save helpers ────────────────────────────────────
let _tiendaAddrTimer = null, _tiendaAddrSugs = [];
function _tiendaShortAddr(d){ const a=d.address||{}; const street=[a.road||a.pedestrian, a.house_number].filter(Boolean).join(' '); const area=a.suburb||a.neighbourhood||a.city_district||a.town||a.city||a.village||''; const st=a.state||''; return [street||(d.display_name||'').split(',').slice(0,2).join(','), area, st].filter(Boolean).join(', '); }
function _tiendaSetLocation(lat, lng, address, fromDrag) {
  const cfg = _getTiendaConfig();
  cfg.lat = lat; cfg.lng = lng; cfg.geoOk = true;
  if (address) cfg.address = address;
  _saveTiendaConfig(cfg);
  if (typeof scheduleSave === 'function') scheduleSave();
  if (fromDrag) {
    _drawZonesOnMap(cfg);
    const c = document.getElementById('tienda-coords'); if (c) c.textContent = lat.toFixed(5) + ', ' + lng.toFixed(5);
    if (window._posToast) _posToast('Ubicación del local ajustada');
  } else {
    _renderTiendaOnline();
    if (window._posToast) _posToast('Dirección guardada y ubicada en el mapa');
  }
}
function _tiendaAddrInput(v) {
  clearTimeout(_tiendaAddrTimer);
  const box = document.getElementById('tienda-addr-sugs');
  if (!v || v.trim().length < 4) { if (box) box.style.display = 'none'; return; }
  _tiendaAddrTimer = setTimeout(async () => {
    try {
      const r = await fetch('https://nominatim.openstreetmap.org/search?format=json&addressdetails=1&limit=5&countrycodes=ar&accept-language=es&q=' + encodeURIComponent(v));
      const data = await r.json();
      _tiendaAddrSugs = (data || []).map(x => ({ label: _tiendaShortAddr(x), full: x.display_name, lat: +x.lat, lng: +x.lon, exact: !!(x.address && x.address.house_number) }));
      const b = document.getElementById('tienda-addr-sugs'); if (!b) return;
      b.innerHTML = _tiendaAddrSugs.length ? _tiendaAddrSugs.map((s, i) => '<div onmousedown="_tiendaPickSug(' + i + ')" style="padding:9px 12px;cursor:pointer;border-bottom:1px solid var(--border)" onmouseover="this.style.background=\'var(--sand)\'" onmouseout="this.style.background=\'\'"><div style="font-size:13px;font-weight:600;color:var(--ink)">' + _esc(s.label) + (s.exact ? '' : ' <span style="font-size:10px;color:var(--accent);font-weight:500">· sin altura exacta</span>') + '</div><div style="font-size:10px;color:var(--muted);white-space:nowrap;overflow:hidden;text-overflow:ellipsis">' + _esc(s.full) + '</div></div>').join('') : '<div style="padding:10px 12px;font-size:12px;color:var(--muted)">Sin resultados. Probá con calle, altura y localidad.</div>';
      b.style.display = 'block';
    } catch (e) {}
  }, 400);
}
function _tiendaPickSug(i) { const s = _tiendaAddrSugs[i]; if (s) _tiendaSetLocation(s.lat, s.lng, s.label, false); }
// Guardar: geocodifica el texto para obtener coordenadas reales (antes solo guardaba el texto y el mapa usaba coordenadas por defecto)
async function _tiendaSaveAddr() {
  const val = (document.getElementById('tienda-addr')?.value || '').trim();
  if (!val) return;
  if (_tiendaAddrSugs.length && _tiendaAddrSugs[0].label === val) { _tiendaPickSug(0); return; }
  try {
    const r = await fetch('https://nominatim.openstreetmap.org/search?format=json&addressdetails=1&limit=1&countrycodes=ar&accept-language=es&q=' + encodeURIComponent(val));
    const d = await r.json();
    if (d && d[0]) { _tiendaSetLocation(+d[0].lat, +d[0].lon, val, false); return; }
    alert('No se encontró esa dirección. Probá con calle, altura y localidad, o arrastrá el pin en el mapa.');
  } catch (e) {
    const cfg = _getTiendaConfig(); cfg.address = val; _saveTiendaConfig(cfg);
    alert('Sin conexión: se guardó el texto pero no la ubicación. Arrastrá el pin en el mapa cuando tengas internet.');
  }
}
function _tiendaSaveField(key, val) {
  const cfg = _getTiendaConfig();
  cfg[key] = val;
  _saveTiendaConfig(cfg);
}
function _tiendaTogglePay(method, enabled) {
  const cfg = _getTiendaConfig();
  cfg.paymentMethods[method] = enabled;
  _saveTiendaConfig(cfg);
  _renderTiendaOnline();
}
function _tiendaSaveBank(field, val) {
  const cfg = _getTiendaConfig();
  cfg.bankDetails[field] = val;
  _saveTiendaConfig(cfg);
}

// ─── Zone CRUD ────────────────────────────────────────
function _tiendaAddZone(type) {
  const cfg = _getTiendaConfig();
  const colors = ['#4CAF50','#FF9800','#F44336','#2196F3','#9C27B0','#00BCD4','#795548','#E91E63'];
  const idx = cfg.zones.length;
  const newZone = {
    id: 'z' + Date.now().toString(36),
    name: 'Zona ' + String.fromCharCode(65 + idx),
    type: type,
    radiusKm: type === 'circle' ? (idx + 1) * 2 : 0,
    baseCost: (idx + 1) * 1500,
    color: colors[idx % colors.length],
    points: []
  };

  if (type === 'polygon') {
    // Create default polygon around store
    const lat = cfg.lat || -34.6037;
    const lng = cfg.lng || -58.3816;
    const d = 0.01 * (idx + 1);
    newZone.points = [
      [lat + d, lng - d], [lat + d, lng + d],
      [lat - d, lng + d], [lat - d, lng - d]
    ];
  }

  cfg.zones.push(newZone);
  _saveTiendaConfig(cfg);
  _renderTiendaOnline();
}

function _tiendaDeleteZone(i) {
  if (!confirm('¿Eliminar esta zona?')) return;
  const cfg = _getTiendaConfig();
  cfg.zones.splice(i, 1);
  _saveTiendaConfig(cfg);
  _renderTiendaOnline();
}

function _tiendaEditZone(i) {
  const cfg = _getTiendaConfig();
  const z = cfg.zones[i];
  if (!z) return;

  const ov = document.createElement('div');
  ov.className = 'modal-overlay open';
  ov.onclick = e => { if (e.target === ov) ov.remove(); };
  ov.innerHTML = `
    <div class="modal" style="max-width:520px">
      <div class="modal-header">
        <div class="modal-title">Editar ${_esc(z.name)}</div>
        <button class="modal-close" onclick="this.closest('.modal-overlay').remove()">&times;</button>
      </div>
      <div class="modal-body" style="display:flex;flex-direction:column;gap:14px">
        <div style="display:grid;grid-template-columns:2fr 1fr;gap:12px">
          <div>
            <label style="font-size:11px;font-weight:600;color:var(--muted);text-transform:uppercase;margin-bottom:4px;display:block">Nombre</label>
            <input type="text" class="form-input" id="tz-name" value="${_esc(z.name)}" style="width:100%;box-sizing:border-box">
          </div>
          <div>
            <label style="font-size:11px;font-weight:600;color:var(--muted);text-transform:uppercase;margin-bottom:4px;display:block">Costo base ($)</label>
            <input type="number" class="form-input" id="tz-cost" value="${z.baseCost}" step="100" style="width:100%;box-sizing:border-box">
          </div>
        </div>
        
        <div>
          <label style="font-size:11px;font-weight:600;color:var(--muted);text-transform:uppercase;margin-bottom:4px;display:block">Tipo de zona</label>
          <div style="display:flex;gap:8px">
            <button class="btn ${z.type==='circle'?'btn-accent':''}" id="tz-type-circle" onclick="_tzSwitchType('circle')" style="flex:1">⭕ Radio</button>
            <button class="btn ${z.type==='polygon'?'btn-accent':''}" id="tz-type-polygon" onclick="_tzSwitchType('polygon')" style="flex:1">📐 Polígono</button>
          </div>
        </div>

        <div id="tz-type-config">
          ${z.type === 'circle' ? `
            <div>
              <label style="font-size:11px;font-weight:600;color:var(--muted);text-transform:uppercase;margin-bottom:4px;display:block">Radio (km)</label>
              <input type="number" class="form-input" id="tz-radius" value="${z.radiusKm}" step="0.5" min="0.5" style="width:100%;box-sizing:border-box">
            </div>
          ` : `
            <div>
              <label style="font-size:11px;font-weight:600;color:var(--muted);text-transform:uppercase;margin-bottom:4px;display:block">Nodos del polígono</label>
              <div id="tz-polygon-editor" style="width:100%;height:280px;border-radius:10px;border:1px solid var(--border);overflow:hidden"></div>
              <div style="font-size:11px;color:var(--muted);margin-top:4px">Arrastrá los nodos para ajustar la zona. Click en el borde para agregar nodos.</div>
            </div>
          `}
        </div>

        <div>
          <label style="font-size:11px;font-weight:600;color:var(--muted);text-transform:uppercase;margin-bottom:4px;display:block">Color</label>
          <div style="display:flex;gap:8px;flex-wrap:wrap">
            ${['#4CAF50','#FF9800','#F44336','#2196F3','#9C27B0','#795548','#00BCD4','#E91E63'].map(c=>
              `<div onclick="document.getElementById('tz-color').value='${c}';this.parentElement.querySelectorAll('div').forEach(d=>d.style.outline='none');this.style.outline='2px solid var(--ink)'" 
                style="width:32px;height:32px;border-radius:8px;background:${c};cursor:pointer;${c===z.color?'outline:2px solid var(--ink)':''}"></div>`
            ).join('')}
            <input type="hidden" id="tz-color" value="${z.color}">
          </div>
        </div>

        <button class="btn btn-accent" style="width:100%;padding:12px;margin-top:4px" onclick="_tiendaSaveZone(${i})">Guardar zona</button>
      </div>
    </div>
  `;
  document.body.appendChild(ov);

  // Init polygon editor if needed
  if (z.type === 'polygon') {
    setTimeout(() => _initPolygonEditor(z), 200);
  }
}

let _polyEditMap = null;
let _polyEditLayer = null;

function _tzSwitchType(type) {
  document.getElementById('tz-type-circle')?.classList.toggle('btn-accent', type==='circle');
  document.getElementById('tz-type-polygon')?.classList.toggle('btn-accent', type==='polygon');
  const cfg = _getTiendaConfig();
  const container = document.getElementById('tz-type-config');
  if (!container) return;

  if (type === 'circle') {
    if (_polyEditMap) { _polyEditMap.remove(); _polyEditMap = null; }
    container.innerHTML = `
      <div>
        <label style="font-size:11px;font-weight:600;color:var(--muted);text-transform:uppercase;margin-bottom:4px;display:block">Radio (km)</label>
        <input type="number" class="form-input" id="tz-radius" value="2" step="0.5" min="0.5" style="width:100%;box-sizing:border-box">
      </div>`;
  } else {
    container.innerHTML = `
      <div>
        <label style="font-size:11px;font-weight:600;color:var(--muted);text-transform:uppercase;margin-bottom:4px;display:block">Nodos del polígono</label>
        <div id="tz-polygon-editor" style="width:100%;height:280px;border-radius:10px;border:1px solid var(--border);overflow:hidden"></div>
        <div style="font-size:11px;color:var(--muted);margin-top:4px">Arrastrá los nodos para ajustar la zona.</div>
      </div>`;
    const lat = cfg.lat || -34.6037;
    const lng = cfg.lng || -58.3816;
    const defaultPoints = [[lat+0.01,lng-0.01],[lat+0.01,lng+0.01],[lat-0.01,lng+0.01],[lat-0.01,lng-0.01]];
    setTimeout(() => _initPolygonEditor({ points: defaultPoints, color: document.getElementById('tz-color')?.value || '#4CAF50' }), 200);
  }
  // Store current type
  container.dataset.type = type;
}

function _initPolygonEditor(zone) {
  const container = document.getElementById('tz-polygon-editor');
  if (!container || !window.L) return;

  if (_polyEditMap) { _polyEditMap.remove(); _polyEditMap = null; }

  const cfg = _getTiendaConfig();
  const center = [cfg.lat || -34.6037, cfg.lng || -58.3816];
  const points = (zone.points && zone.points.length >= 3) ? zone.points : [
    [center[0]+0.01, center[1]-0.01],
    [center[0]+0.01, center[1]+0.01],
    [center[0]-0.01, center[1]+0.01],
    [center[0]-0.01, center[1]-0.01]
  ];

  _polyEditMap = L.map('tz-polygon-editor').setView(center, 14);
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '© OSM'
  }).addTo(_polyEditMap);

  // Store marker
  L.marker(center, {
    icon: L.divIcon({
      className: '',
      html: '<div style="width:14px;height:14px;background:#235328;border:2px solid white;border-radius:50%;box-shadow:0 1px 4px rgba(0,0,0,0.3)"></div>',
      iconSize: [14, 14], iconAnchor: [7, 7]
    })
  }).addTo(_polyEditMap);

  // Editable polygon with draggable vertices
  _polyEditLayer = L.polygon(points, {
    color: zone.color || '#4CAF50',
    fillColor: zone.color || '#4CAF50',
    fillOpacity: 0.15,
    weight: 2
  }).addTo(_polyEditMap);

  // Enable editing (vertex drag)
  if (_polyEditLayer.editing) {
    _polyEditLayer.editing.enable();
  }

  // Add vertex markers manually for drag support
  _addDraggableVertices(points, zone.color || '#4CAF50');

  _polyEditMap.fitBounds(_polyEditLayer.getBounds(), { padding: [20, 20] });
  setTimeout(() => _polyEditMap.invalidateSize(), 100);
}

function _addDraggableVertices(points, color) {
  if (!_polyEditMap) return;
  points.forEach((p, i) => {
    const marker = L.marker(p, {
      draggable: true,
      icon: L.divIcon({
        className: '',
        html: `<div style="width:14px;height:14px;background:white;border:3px solid ${color};border-radius:50%;cursor:grab;box-shadow:0 1px 4px rgba(0,0,0,0.3)"></div>`,
        iconSize: [14, 14], iconAnchor: [7, 7]
      })
    }).addTo(_polyEditMap);

    marker.on('drag', () => {
      const latlngs = _polyEditLayer.getLatLngs()[0];
      const pos = marker.getLatLng();
      latlngs[i] = pos;
      _polyEditLayer.setLatLngs(latlngs);
    });

    _leafletLayers.push(marker);
  });

  // Click on polygon edge to add new node
  _polyEditLayer.on('click', (e) => {
    const latlngs = _polyEditLayer.getLatLngs()[0];
    // Find closest edge
    let minDist = Infinity, insertAt = latlngs.length;
    for (let j = 0; j < latlngs.length; j++) {
      const next = (j + 1) % latlngs.length;
      const d = e.latlng.distanceTo(L.latLng(
        (latlngs[j].lat + latlngs[next].lat) / 2,
        (latlngs[j].lng + latlngs[next].lng) / 2
      ));
      if (d < minDist) { minDist = d; insertAt = next; }
    }
    latlngs.splice(insertAt, 0, e.latlng);
    _polyEditLayer.setLatLngs(latlngs);
    // Re-render vertices
    _leafletLayers.forEach(l => { if (l instanceof L.Marker && l !== _polyEditLayer) _polyEditMap.removeLayer(l); });
    _addDraggableVertices(latlngs.map(ll => [ll.lat, ll.lng]), color);
  });
}

function _tiendaSaveZone(i) {
  const cfg = _getTiendaConfig();
  const typeConfig = document.getElementById('tz-type-config');
  const type = typeConfig?.dataset?.type || (document.getElementById('tz-radius') ? 'circle' : cfg.zones[i].type);

  cfg.zones[i].name = document.getElementById('tz-name')?.value || cfg.zones[i].name;
  cfg.zones[i].baseCost = parseInt(document.getElementById('tz-cost')?.value) || cfg.zones[i].baseCost;
  cfg.zones[i].color = document.getElementById('tz-color')?.value || cfg.zones[i].color;
  cfg.zones[i].type = type;

  if (type === 'circle') {
    cfg.zones[i].radiusKm = parseFloat(document.getElementById('tz-radius')?.value) || cfg.zones[i].radiusKm;
    cfg.zones[i].points = [];
  } else if (type === 'polygon' && _polyEditLayer) {
    const latlngs = _polyEditLayer.getLatLngs()[0];
    cfg.zones[i].points = latlngs.map(ll => [ll.lat, ll.lng]);
    cfg.zones[i].radiusKm = 0;
  }

  _saveTiendaConfig(cfg);
  if (_polyEditMap) { _polyEditMap.remove(); _polyEditMap = null; }
  document.querySelector('.modal-overlay')?.remove();
  _renderTiendaOnline();
  if (window._posToast) _posToast('Zona "' + cfg.zones[i].name + '" actualizada');
}
