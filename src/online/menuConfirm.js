// Publicar el menú reemplaza lo que ven los clientes y no tiene historial: siempre se confirma dos veces.
/** Pide doble confirmación y sube el menú. Devuelve la cantidad de productos, o null si se canceló. */
export async function publishMenuConfirmed(online, w = window) {
  const info = await online.controller.previewMenu();
  if (!info.local) { await w.sahtenAlert('Este proyecto no tiene productos para publicar, así que no se sube: vaciaría el menú publicado' + (info.slug ? ' de «' + info.slug + '»' : '') + '. Revisá que tengas abierto el proyecto correcto («Abrir proyecto de la nube…»).'); return null; }
  const donde = info.slug ? ' de la tienda «' + info.slug + '»' : '';
  const antes = info.remote == null ? 'No pude ver cuántos productos hay publicados ahora.' : info.remote ? `Ahora hay ${info.remote} productos publicados.` : 'Todavía no hay un menú publicado.';
  if (!await w.sahtenConfirm(`Vas a publicar el menú${donde}: ${info.local} productos${info.name ? ' del proyecto «' + info.name + '»' : ''}. ${antes}`, { title: 'Sincronizar menú', okLabel: 'Continuar', cancelLabel: 'Cancelar' })) return null;
  const achica = info.remote > 0 && info.local < info.remote;
  const msg = info.remote
    ? `Esto reemplaza el menú que ven tus clientes (${info.remote} productos) por uno de ${info.local}${achica ? ' — tiene MENOS productos' : ''}. No hay forma de deshacerlo. ¿Es el proyecto correcto?`
    : `Esto publica el menú para tus clientes (${info.local} productos). ¿Es el proyecto correcto?`;
  if (!await w.sahtenConfirm(msg, { title: '¿Seguro?', okLabel: 'Sí, publicar', cancelLabel: 'No, cancelar', danger: true })) return null;
  return online.controller.syncMenu({ force: true });
}
