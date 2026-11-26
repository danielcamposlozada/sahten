// Sugerencias visuales en el carrito del Mostrador.
// Usan las MISMAS reglas que la tienda web (bebida + acompañamiento a precio normal),
// las que se crean, pausan y editan en Promociones › Recomendaciones.
// No aplican descuentos, no firman ofertas y no envían datos de clientes.
import { recommendCartAddons } from '../core/cart-recommendations.js';
import { kv } from '../project/kv.js';
import '../styles/pos-upsell.css';

const esc = v => String(v ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const CACHE = 'sahten-pos-recommendations:';
const MAX_AGE = 60000;

/** Política local (sin tienda conectada), con la misma forma que publica menuJson. */
export function localRecommendationPolicy(promotions) {
  const p = promotions?.cartRecommendationPolicy;
  if (p?.enabled !== true) return { enabled: false };
  const bev = promotions.beverageUpsellPolicy?.enabled === true ? promotions.beverageUpsellPolicy.contexts || [] : [];
  return {
    enabled: true,
    beverageContexts: bev.filter(g => g && g.enabled !== false),
    complements: (p.complements || []).filter(g => g && g.enabled !== false),
  };
}

export function installPosUpsell(w = window, { fetchImpl = (...a) => w.fetch(...a), now = () => Date.now() } = {}) {
  let policy = null, policyStore = null, loadedAt = 0, loading = null, source = 'none';
  let dismissed = new Set(), shown = new Map(), accepted = [], lastKey = '', rerender = null;
  const conn = () => w.SAHTEN_SUPABASE || {};
  const storeKey = () => { const c = conn(); return c.url && c.anonKey && c.storeId ? c.storeId : null; };

  function readCache(store) { try { const v = JSON.parse(w.localStorage.getItem(CACHE + store) || 'null'); return v?.enabled === true || v?.enabled === false ? v : null; } catch (e) { return null; } }
  function writeCache(store, value) { try { w.localStorage.setItem(CACHE + store, JSON.stringify(value)); } catch (e) { /* sin almacenamiento: solo memoria */ } }

  /** Reglas publicadas de la tienda conectada (lo mismo que ve la web); sin conexión, las locales. */
  function current() {
    const store = storeKey();
    if (!store) { source = 'local'; return localRecommendationPolicy(kv.json('sahten_promotions', {})); }
    if (policyStore !== store) { policy = readCache(store); policyStore = store; loadedAt = 0; source = policy ? 'cache' : 'none'; }
    if (!loading && now() - loadedAt > MAX_AGE) {
      const c = conn();
      loading = fetchImpl(c.url + '/rest/v1/menus?select=rec:json->cartRecommendations&store_id=eq.' + encodeURIComponent(store), { headers: { apikey: c.anonKey, Authorization: 'Bearer ' + c.anonKey } })
        .then(r => (r.ok ? r.json() : Promise.reject(new Error('HTTP ' + r.status))))
        .then(rows => {
          if (storeKey() !== store) return;
          const value = rows?.[0]?.rec && typeof rows[0].rec === 'object' ? rows[0].rec : { enabled: false };
          const changed = JSON.stringify(value) !== JSON.stringify(policy);
          policy = value; source = 'published'; writeCache(store, value);
          if (changed) rerender?.();
        })
        .catch(() => { /* se conserva la última copia publicada */ })
        .finally(() => { loadedAt = now(); loading = null; });
    }
    return policy || { enabled: false };
  }

  function suggestions(products, cart) {
    const list = recommendCartAddons({ products, cart, policy: current(), showPrices: true });
    return list.filter(s => !dismissed.has(s.id));
  }

  /**
   * Dibuja las sugerencias. `products`: catálogo del Mostrador {id,name,price,category,salesAvailability}.
   * `cart`: [{productId, qty}]. `add(id)` suma una unidad. `image(id)` devuelve la foto (promesa).
   */
  function render(root, { products, cart, add, image, onRender } = {}) {
    if (!root) return;
    rerender = onRender || rerender;
    const items = cart?.length ? suggestions(products || [], cart) : [];
    const key = JSON.stringify(items.map(s => [s.id, s.price, s.headline]));
    if (!items.length) { root.replaceChildren(); root.hidden = true; lastKey = key; return; }
    root.hidden = false;
    if (key === lastKey && root.childElementCount) return;
    lastKey = key;
    root.innerHTML = '<div class="pos-upsell-title">Sugerencias para este pedido</div>' + items.map(s =>
      '<article class="pos-upsell-card" data-pos-upsell="' + esc(s.id) + '">'
      + '<div class="pos-upsell-img" data-pos-upsell-img="' + esc(s.id) + '" aria-hidden="true"><span>' + (s.kind === 'beverage' ? '🥤' : '✦') + '</span></div>'
      + '<div class="pos-upsell-text"><span class="pos-upsell-kicker">' + esc(s.headline) + '</span>'
      + '<strong>' + esc(s.name) + '</strong>'
      + (s.contextProduct ? '<small>Va bien con ' + esc(s.contextProduct) + '</small>' : '') + '</div>'
      + '<div class="pos-upsell-actions"><button type="button" class="pos-upsell-add" data-pos-upsell-add="' + esc(s.id) + '" aria-label="Agregar ' + esc(s.name) + ' por $' + esc(Number(s.price).toLocaleString('es-AR')) + '">Agregar · $' + esc(Number(s.price).toLocaleString('es-AR')) + '</button>'
      + '<button type="button" class="pos-upsell-skip" data-pos-upsell-skip="' + esc(s.id) + '" aria-label="No ofrecer ' + esc(s.name) + ' en este pedido">No, gracias</button></div>'
      + '</article>').join('');
    items.forEach(s => {
      if (!shown.has(s.id)) shown.set(s.id, { productId: s.id, kind: s.kind, headline: s.headline });
      Promise.resolve(image?.(s.id)).then(src => {
        const slot = root.querySelector('[data-pos-upsell-img="' + CSS.escape(s.id) + '"]');
        if (src && slot) { const img = w.document.createElement('img'); img.src = src; img.alt = ''; slot.replaceChildren(img); }
      }).catch(() => {});
    });
    root.querySelectorAll('[data-pos-upsell-add]').forEach(b => b.addEventListener('click', () => {
      const s = items.find(x => x.id === b.dataset.posUpsellAdd); if (!s) return;
      accepted.push({ productId: s.id, kind: s.kind, headline: s.headline });
      add?.(s.id);
    }));
    root.querySelectorAll('[data-pos-upsell-skip]').forEach(b => b.addEventListener('click', () => {
      dismissed.add(b.dataset.posUpsellSkip); lastKey = ''; rerender?.();
    }));
  }

  /** Registro para el pedido: qué se ofreció y qué se aceptó (medición; sin datos personales). */
  function snapshot(cart) {
    const inCart = new Set((cart || []).map(l => l.productId));
    const acc = accepted.filter(a => inCart.has(a.productId)).filter((a, i, arr) => arr.findIndex(x => x.productId === a.productId) === i);
    if (!shown.size) return null;
    return { channel: 'mostrador', source, shown: [...shown.values()], accepted: acc };
  }
  function reset() { dismissed = new Set(); shown = new Map(); accepted = []; lastKey = ''; }
  return { render, snapshot, reset, policy: current, _suggestions: suggestions };
}
