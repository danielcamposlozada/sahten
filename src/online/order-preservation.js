// Los pedidos son registros operativos: una descarga parcial nunca los borra.
// Conservamos los IDs locales y remotos, los estados pendientes de transmitir y
// las instantáneas de precio/ticket que ya existen en un equipo.
const arr = v => Array.isArray(v) ? v : [];
const stamp = row => Date.parse(row?.updatedAt || row?.completedAt || row?.createdAt || '') || 0;
export const orderIdentity = row => row?.remoteId ? 'web:' + row.remoteId :
  row?.id ? 'local:' + row.id : null;

export function mergeOrderHistory(localOrders = [], cloudOrders = []) {
  const byKey = new Map();
  const aliases = new Map();
  const insert = (row, origin) => {
    if (!row || typeof row !== 'object' || (!row.id && !row.remoteId)) return;
    const key = orderIdentity(row);
    const second = row.id ? 'id:' + row.id : null;
    const first = row.remoteId ? 'remote:' + row.remoteId : null;
    const existingKey = [first, second, key].map(k => aliases.get(k)).find(Boolean) || key;
    const current = byKey.get(existingKey);
    if (!current) byKey.set(existingKey, { ...row });
    else {
      // Una modificación local de estado pendiente de publicar no se revierte.
      const protectLocal = current.remoteStatusPending && origin === 'cloud';
      const remoteIsNewer = stamp(row) > stamp(current);
      const winner = protectLocal ? current : remoteIsNewer ? row :
        stamp(row) === stamp(current) && origin === 'cloud' ? row : current;
      const loser = winner === row ? current : row;
      byKey.set(existingKey, { ...loser, ...winner });
    }
    if (first) aliases.set(first, existingKey);
    if (second) aliases.set(second, existingKey);
    aliases.set(key, existingKey);
  };
  arr(localOrders).forEach(o => insert(o, 'local'));
  arr(cloudOrders).forEach(o => insert(o, 'cloud'));
  return [...byKey.values()].sort((a,b) => stamp(b)-stamp(a) ||
    String(a.id||a.remoteId).localeCompare(String(b.id||b.remoteId)));
}

export function preserveLocalSales(localFile, downloadedFile) {
  const out = { ...downloadedFile, sales: { ...(downloadedFile.sales || {}) } };
  const local = localFile?.sales || {};
  out.sales.orders = mergeOrderHistory(local.orders, out.sales.orders);
  const clients = new Map(arr(out.sales.customers).map(x => [x.id,x]));
  arr(local.customers).forEach(x => {
    if (!x?.id) return;
    const existing = clients.get(x.id);
    if (!existing || stamp(x) >= stamp(existing)) clients.set(x.id,{ ...existing,...x });
  });
  out.sales.customers = [...clients.values()];
  return out;
}

export const recoveredOrderCount = (localFile, downloadedFile) => {
  const remote = new Set(arr(downloadedFile?.sales?.orders).map(orderIdentity));
  return arr(localFile?.sales?.orders).filter(o=>orderIdentity(o) && !remote.has(orderIdentity(o))).length;
};
