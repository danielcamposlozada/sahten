// ═══════════════════════════════════════════════════════════
// Delivery por zonas (puro). Lo usan el Mostrador, el menú publicado y la web: una sola cuenta.
// Este archivo se inyecta tal cual en la web publicada (sin imports): no usar nada fuera de él.
//   tienda = { lat, lng, zones: [{ id, name, type:'circle'|'polygon', radiusKm, points:[[lat,lng],…], baseCost }],
//              freeShippingMin, deliveryMinOrder }
// ═══════════════════════════════════════════════════════════

export const DEFAULT_STORE_POINT = { lat: -34.6037, lng: -58.3816 };

export function haversineKm(lat1, lon1, lat2, lon2) {
  const R = 6371, rad = Math.PI / 180;
  const dLat = (lat2 - lat1) * rad, dLon = (lon2 - lon1) * rad;
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * rad) * Math.cos(lat2 * rad) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

/** Punto dentro de un polígono [[lat,lng],…] (ray casting). */
export function pointInPolygon(lat, lng, polygon) {
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const [yi, xi] = polygon[i], [yj, xj] = polygon[j];
    if (((yi > lat) !== (yj > lat)) && (lng < (xj - xi) * (lat - yi) / (yj - yi) + xi)) inside = !inside;
  }
  return inside;
}

/** Zona de una dirección: las circulares se prueban de menor a mayor radio; los polígonos por contención. */
export function zoneFor(tienda, lat, lng) {
  const t = tienda || {};
  const sLat = t.lat != null ? t.lat : DEFAULT_STORE_POINT.lat, sLng = t.lng != null ? t.lng : DEFAULT_STORE_POINT.lng;
  const distKm = haversineKm(sLat, sLng, lat, lng);
  const zones = [...(t.zones || [])].sort((a, b) => (a.radiusKm || 999) - (b.radiusKm || 999));
  for (const z of zones) {
    if (z.type === 'polygon' && (z.points || []).length >= 3) { if (pointInPolygon(lat, lng, z.points)) return { zone: z, distKm }; }
    else if (distKm <= (z.radiusKm || 0)) return { zone: z, distKm };
  }
  return { zone: null, distKm, out: true };
}

/**
 * Envío de un pedido: costo de la zona, gratis desde `freeShippingMin` y mínimo de pedido para delivery.
 * → { ok, out, zone, distKm, cost, free, belowMin, minOrder }
 */
export function shippingFor(tienda, lat, lng, subtotal) {
  const t = tienda || {};
  const z = zoneFor(t, lat, lng);
  if (!z.zone) return { ok: false, out: true, zone: null, distKm: z.distKm, cost: 0, free: false, belowMin: false, minOrder: t.deliveryMinOrder || 0 };
  const freeMin = t.freeShippingMin || 0;
  const free = freeMin > 0 && subtotal >= freeMin;
  const minOrder = t.deliveryMinOrder || 0;
  const belowMin = minOrder > 0 && subtotal < minOrder;
  return { ok: !belowMin, out: false, zone: z.zone, distKm: z.distKm, cost: free ? 0 : (z.zone.baseCost || 0), free, belowMin, minOrder };
}
