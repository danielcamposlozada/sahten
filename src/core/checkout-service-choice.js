// Decide el servicio del checkout según la disponibilidad real, sin depender de estilos.
// Sin opciones operativas conservamos el tipo interno solo para dar un mensaje de horario;
// la interfaz no marca ningún botón y el servidor nunca acepta una venta fuera de horario.
export function preferredCheckoutService(deliveryAvailable, pickupAvailable) {
  if (deliveryAvailable) return 'delivery';
  if (pickupAvailable) return 'pickup';
  return 'delivery';
}

/** Si el cliente eligió un servicio disponible, respetar su elección durante el checkout. */
export function resolveCheckoutServiceChoice({
  current = 'delivery', manual = false, reset = false,
  deliveryAvailable = false, pickupAvailable = false,
} = {}) {
  const preferred = preferredCheckoutService(deliveryAvailable, pickupAvailable);
  if (reset || !manual) return preferred;
  if (current === 'delivery' && deliveryAvailable) return 'delivery';
  if (current === 'pickup' && pickupAvailable) return 'pickup';
  return preferred;
}
