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
