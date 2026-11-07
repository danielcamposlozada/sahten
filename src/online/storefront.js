// Compartido con la plantilla publicada: sin DOM, imports ni datos privados.
export function storefrontHref(menu, baseURI, search = '', category = '') {
  const hash = '#pedido' + (category ? '/' + encodeURIComponent(category) : '');
  if (!menu.site?.enabled || !menu.site.orderPage) return hash;
  const url = new URL('pedir/', baseURI);
  url.search = search;
  url.hash = hash;
  return url.href;
}

/** El catálogo sigue en vivo; el diseño publicado cambia al volver a publicar. */
export function publishedMenuWithLiveCatalog(base, live) {
  if (!base.site?.enabled || !base.site.orderPage) return live;
  return { ...live, site: base.site, store: { ...live.store, name: base.store.name, address: base.store.address } };
}

export function storefrontCartKey(menu, baseURI) {
  const sitePath = new URL('./', baseURI).pathname;
  return 'sahten-cart:' + sitePath + ':' + (menu.supabase?.storeId || menu.store.name || 'menu');
}

export function parseStorefrontCart(raw, now = Date.now()) {
  let saved;
  try { saved = JSON.parse(raw); } catch { return null; }
  if (!saved || !Number.isFinite(saved.at) || now - saved.at > 86400000) return null;
  const items = Object.create(null);
  let total = 0;
  for (const [id, quantity] of Object.entries(saved.items || {}).slice(0, 500)) {
    if (id.length > 200 || !Number.isInteger(quantity) || quantity <= 0 || quantity > 999) continue;
    items[id] = quantity;
    total += quantity;
  }
  // El menú guarda el total de los productos reconocidos. Las sesiones anteriores solo guardaban cantidades.
  const count = Number.isInteger(saved.count) && saved.count >= 0 && saved.count <= total ? saved.count : total;
  return { items, count, fatayUpgradeAccepted: saved.fatayUpgradeAccepted === true };
}

export function storefrontCartLabel(count) {
  return count ? 'Mi pedido, ' + count + (count === 1 ? ' producto' : ' productos') : 'Mi pedido';
}
