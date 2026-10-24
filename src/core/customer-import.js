// Importación local, sin red. El teléfono puede pertenecer a varias personas.
const text = (v, max = 500) => String(v ?? '').trim().slice(0, max);
const key = v => text(v).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
const digits = v => text(v).replace(/\D/g, '');
const sameName = (a, b) => !!key(a) && key(a) === key(b);
export const IMPORT_FIELDS = {
  name: ['nombre', 'nombre completo', 'cliente', 'name', 'full name'], surname: ['apellido', 'last name', 'surname'],
  phone: ['telefono', 'telefono movil', 'celular', 'whatsapp', 'phone', 'tel'], email: ['email', 'e mail', 'correo', 'correo electronico'],
  secondaryEmail: ['email secundario', 'correo secundario'], address: ['direccion', 'domicilio', 'address'],
  externalId: ['id', 'id cliente', 'identificador', 'codigo cliente', 'external id'],
  purchaseCount: ['cant compras', 'cantidad de compras', 'compras', 'cantidad compras'], lastPurchase: ['ultima compra', 'fecha ultima compra'],
  active: ['activo', 'active'], origin: ['origen', 'fuente'], street: ['calle', 'street'], number: ['numero', 'nro', 'number', 'altura'],
  floor: ['piso depto', 'piso departamento', 'piso', 'depto', 'departamento'], city: ['ciudad', 'localidad', 'city'], reference: ['referencia', 'observaciones', 'reference'], primary: ['es principal', 'principal'],
};
export function guessCustomerColumns(headers) {
  return Object.fromEntries(Object.entries(IMPORT_FIELDS).map(([field, aliases]) => [field, headers.findIndex(h => aliases.includes(key(h)))]));
}
export function normalizeImportPhone(value, country = 'keep') {
  const original = text(value, 80);
  if (!original) return { phone: '', warning: '' };
  let n = digits(original);
  if (country === 'AR') {
    if (n.startsWith('0054')) n = n.slice(4);
    else if (n.startsWith('54') && n.length >= 12) n = n.slice(2);
    if (n.startsWith('9') && n.length === 11) n = n.slice(1);
    if (n.startsWith('0')) n = n.slice(1);
    if (n.length === 12) {
      const options = [2, 3, 4].filter(len => n.slice(len, len + 2) === '15');
      if (options.length === 1) n = n.slice(0, options[0]) + n.slice(options[0] + 2);
    }
    if (n.length !== 10 || n.startsWith('15')) return { phone: '', warning: 'Teléfono argentino incompleto o ambiguo; revisar código de área', original };
    return { phone: '+549' + n, warning: '' };
  }
  if (n.length < 6 || n.length > 15) return { phone: '', warning: 'Teléfono para revisar', original };
  return { phone: original, warning: '' };
}
const streetKey = value => key(value).replace(/\b(av|avda)\b/g, 'avenida').replace(/\bgral\b/g, 'general');
const addressKey = a => [streetKey(a.street || a.address), key(a.number), key(a.floor), key(a.city)].join('|');
export const addressText = a => a.address || [a.street, a.number, a.floor, a.city].filter(Boolean).join(', ');

/** Devuelve un plan revisable; no modifica los clientes existentes. */
export function planCustomerImport({ rows, mapping, addresses = [], addressMapping = null, existing = [], country = 'keep', source = 'customer-import' }) {
  if (rows.length > 10000 || addresses.length > 20000) throw new Error('La lista supera el límite: 10.000 clientes o 20.000 direcciones por importación.');
  const cell = (row, field, map = mapping) => map[field] >= 0 ? text(row[map[field]]) : '';
  const seen = [...existing], result = [];
  rows.forEach((row, index) => {
    if (row.every(v => !text(v))) return;
    const name = [cell(row, 'name'), cell(row, 'surname')].filter(Boolean).join(' ').replace(/\s+/g, ' ');
    const normalized = normalizeImportPhone(cell(row, 'phone'), country);
    const email = cell(row, 'email'), externalId = cell(row, 'externalId');
    const warnings = normalized.warning ? [normalized.warning] : [];
    const candidate = { name: name || (normalized.phone || email ? 'Sin nombre' : ''), phone: normalized.phone, email,
      address: cell(row, 'address'), externalId, externalSource: source, secondaryEmail: cell(row, 'secondaryEmail'),
      importedPurchaseCount: Math.max(0, Number.parseInt(cell(row, 'purchaseCount'), 10) || 0), importedLastPurchase: cell(row, 'lastPurchase'),
      active: !['no', 'false', '0', 'inactivo'].includes(key(cell(row, 'active'))), origin: cell(row, 'origin'), addresses: [],
      ...(normalized.original ? { importPhoneOriginal: normalized.original } : {}) };
    const addAddress = (line, map, lineNumber) => {
      const a = Object.fromEntries(['street', 'number', 'floor', 'city', 'reference', 'address'].map(f => [f, cell(line, f, map)]));
      if (!a.street && !a.address) return;
      a.source = cell(line, 'origin', map) || 'Importado';
      a.isPrimary = ['si', 'yes', 'true', '1'].includes(key(cell(line, 'primary', map)));
      const duplicate = candidate.addresses.find(x => addressKey(x) === addressKey(a));
      if (duplicate) { if (!duplicate.reference) duplicate.reference = a.reference; duplicate.isPrimary ||= a.isPrimary; }
      else candidate.addresses.push({ ...a, importRow: lineNumber });
    };
    addAddress(row, mapping, index + 2);
    if (externalId && addressMapping) addresses.forEach((line, i) => { if (cell(line, 'externalId', addressMapping) === externalId) addAddress(line, addressMapping, i + 2); });
    if (candidate.addresses.length) {
      if (candidate.addresses.filter(a => a.isPrimary).length > 1) warnings.push('Más de una dirección principal: se conserva la primera marcada');
      const primary = candidate.addresses.findIndex(a => a.isPrimary);
      candidate.addresses.forEach((a, i) => { a.isPrimary = i === (primary < 0 ? 0 : primary); });
      candidate.address = addressText(candidate.addresses.find(a => a.isPrimary));
    }
    let status = 'new', message = '';
    if (!candidate.name) { status = 'invalid'; message = 'Falta nombre, teléfono o correo'; }
    else if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { status = 'invalid'; message = 'Correo inválido'; }
    else {
      const duplicate = seen.find(c => (externalId && c.externalId === externalId && c.externalSource === source) ||
        (sameName(c.name, candidate.name) && ((candidate.phone && digits(c.phone) === digits(candidate.phone)) || (email && c.email?.toLowerCase() === email.toLowerCase()))));
      if (duplicate) { status = 'duplicate'; message = 'Ya existe por ID de origen o por nombre y contacto; se omite'; }
      else {
        if (candidate.phone && seen.some(c => digits(c.phone) === digits(candidate.phone))) warnings.push('Teléfono compartido; se conserva como persona distinta');
        if (email && seen.some(c => c.email?.toLowerCase() === email.toLowerCase())) warnings.push('Correo compartido; revisar');
        if (!candidate.phone && !email) warnings.push('Sin teléfono ni correo');
        seen.push(candidate);
      }
    }
    result.push({ row: index + 2, customer: candidate, status, message, warnings });
  });
  const linked = new Set(result.map(r => r.customer.externalId).filter(Boolean));
  const orphanAddresses = addressMapping ? addresses.filter(row => row.some(v => text(v)) && !linked.has(cell(row, 'externalId', addressMapping))).length : 0;
  return { rows: result, orphanAddresses, newCount: result.filter(r => r.status === 'new').length, duplicateCount: result.filter(r => r.status === 'duplicate').length, invalidCount: result.filter(r => r.status === 'invalid').length };
}

export function materializeCustomerImport(plan, { now = new Date(), id = () => globalThis.crypto?.randomUUID?.() || Date.now().toString(36) + Math.random().toString(36).slice(2) } = {}) {
  return plan.rows.filter(r => r.status === 'new').map(({ customer }) => ({ ...JSON.parse(JSON.stringify(customer)), id: 'cust_' + id(), importedAt: now.toISOString(),
    addresses: customer.addresses.map(a => ({ ...a, id: 'addr_' + id() })) }));
}
