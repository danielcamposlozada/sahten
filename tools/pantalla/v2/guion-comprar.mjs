// Guion único de «Cómo comprar» (tele y web). Tiempos en segundos, tomados de la transcripción de la voz
// original del tutorial de la web:
//  0,0–2,6 «De la cocina de nuestra familia a tu mesa»
//  2,6–6,3 «Entrá en sahten.online y tocá Pedir online»
//  6,3–10,0 «Elegí tus platos · hoy, una tabla para compartir»
// 10,0–12,9 «Revisá tu pedido y seguí con la entrega»
// 12,9–16,3 «Elegí la opción que prefieras: delivery o retiro en tienda»
// 16,9–18,9 «Sumá tu nombre y tu teléfono»
// 19,4–23,1 «Pagando en efectivo o transferencia tenés un 10 % de descuento»
// 23,1–25,7 «Te escribimos por WhatsApp para confirmar tu pedido»
// 25,7–29,4 «Sahten, gastronomía árabe, te esperamos en sahten.online»
export const web = {
  calm: true, total: 31.12, outro: 'web', bumper: false, rise: [2.3, 3.1], exitAt: 24.75,
  hook: { kicker: 'De la cocina de nuestra familia', l1: 'a tu', l1b: 'mesa', ital: 'así de fácil', a: .15, b: 2.65 },
  steps: [
    { n: '01', t: 'Entrá a sahten.online', a: 2.6, b: 6.3 },
    { n: '02', t: 'Elegí tus platos', a: 6.3, b: 10.0 },
    { n: '03', t: 'Revisá tu pedido', a: 10.0, b: 12.9 },
    { n: '04', t: 'Elegí delivery o retiro', a: 12.9, b: 23.1 },
    { n: '05', t: 'Enviá tu pedido', a: 23.1, b: 24.9 },
  ],
  subs: [
    { text: 'y tocá «Pedir online»', a: 3.6, b: 6.3 },
    { text: 'Hoy, una tabla para compartir', a: 7.8, b: 10.0 },
    { text: 'y seguí con la entrega', a: 10.9, b: 12.9 },
    { text: 'Sumá tu nombre y tu teléfono', a: 16.9, b: 19.35 },
    { text: '10 % de descuento con efectivo o transferencia', a: 19.4, b: 23.1 },
  ],
  // [inicio, captura] o [inicio, 'seq:secuencia', duración]
  plan: [[0, 'portada'], [5.0, 'carta'], [6.4, 'seq:scroll-carta', 1.9], [8.3, 'antes-agregar'], [8.85, 'agregado'], [9.9, 'carrito'],
    [12.6, 'entrega'], [15.5, 'retiro'], [16.2, 'seq:scroll-datos', .8], [17.0, 'seq:nombre', .9], [17.95, 'seq:telefono', 1.0],
    [19.4, 'seq:scroll-pago', 1.1], [20.5, 'pago'], [23.0, 'enviar']],
  taps: [[4.7, 'portada'], [8.75, 'antes-agregar', 'tabla_compartir'], [9.75, 'carrito'], [12.25, 'antes-continuar'], [15.15, 'antes-retiro'],
    [17.0, 'nombre'], [17.95, 'telefono'], [21.0, 'pago'], [24.0, 'enviar']],
  listo: { a: 24.25, b: 25.8 },
};

// Tele: mismo recorrido, corrido 0,9 s por la tarjeta del logo y con cierre de QR (sin audio).
export function tv() {
  const d = .9, sh = x => +(x + d).toFixed(2);
  return {
    ...web, outro: 'qr', bumper: true, total: sh(web.total) + 3.6, rise: web.rise.map(sh), exitAt: sh(web.exitAt),
    hook: { ...web.hook, a: sh(web.hook.a), b: sh(web.hook.b) },
    steps: web.steps.map(s => ({ ...s, a: sh(s.a), b: sh(s.b) })),
    subs: web.subs.map(s => ({ ...s, a: sh(s.a), b: sh(s.b) })),
    plan: web.plan.map(([a, ...r]) => [sh(a), ...r]),
    taps: web.taps.map(([a, ...r]) => [sh(a), ...r]),
    listo: { a: sh(web.listo.a), b: sh(web.listo.b) },
  };
}
