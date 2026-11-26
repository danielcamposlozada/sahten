// Guion de los videos para la pantalla vertical del local (1080 × 1920).
// Los textos de promociones copian las condiciones PUBLICADAS (menú y programas de Supabase al 26/11/2026).
// Precios, fotos y disponibilidad se leen del menú publicado al renderizar: si un producto se pausa
// o desaparece, el render se detiene en lugar de anunciar algo que no se vende.
// Si cambia una promoción en Sahten, actualizar el texto acá y volver a renderizar.
// Decisión del dueño (26/11): solo productos publicados en la web (sin Promo Fatay 3U ni Tabla para Celebrar).

// Ritmo pensado para leer en la tele: todo el reloj corre 1,5× más lento al renderizar
// (un plato queda ~6,3 s en pantalla; un tablero ~9 s). Decisión del dueño (26/11).
export const PACE = 1.5;

export const PALETTE = { green: '#235328', deep: '#183d23', darker: '#112d1b', cream: '#FFF4D6', paper: '#FAF8F5', orange: '#EF8E23', pale: '#E3F1DD', ink: '#213326' };

export const VIDEOS = [
  {
    id: '01-10-off', title: '10 % OFF pagando en efectivo o transferencia',
    // Beneficio de pago publicado: 10 %, canales online y mostrador.
    requires: { paymentBenefit: 10 },
    scenes: [
      { type: 'kinetic', dur: 5.4, bg: 'orange', banners: ['banner-tortas', 'banner-plato'], italic: 'en productos', kicker: 'Pagando en', heavy: 'Efectivo o transferencia' },
      { type: 'duo', dur: 5.8, bg: 'pale', banners: ['banner-plato', 'banner-tortas'], kicker: 'Pagando en', heavy: ['Efectivo o', 'transferencia'], note: 'En el local y en sahten.online' },
      { type: 'terms', dur: 5.0, bg: 'green', heading: ['10 %', 'de descuento'], italic: 'en productos', lines: ['Pagando en efectivo o transferencia.', 'Envío sin descuento.', 'No acumulable: se aplica el beneficio mayor.'] },
    ],
  },
  {
    id: '02-lunes-a-miercoles', title: 'Lunes a miércoles · Platos seleccionados',
    requires: { campaign: 'weekly-meals' },
    scenes: [
      { type: 'hook', dur: 4.4, bg: 'green', kicker: 'Lunes a miércoles', photos: ['sandwich_falafel', 'shawarma_pollo', 'arabe_clasico'], lines: ['HASTA', '15 %'], italic: 'en platos seleccionados', badge: { top: 'LUN', mid: 'MAR', bottom: 'MIÉ' } },
      { type: 'weekstrip', dur: 10.5, bg: 'cream', kicker: 'Lunes a miércoles', heavy: 'Hasta 15 %', italic: 'en platos seleccionados', days: [0, 1, 2], products: ['sandwich_falafel', 'shawarma_pollo', 'arabe_clasico'] },
      { type: 'terms', dur: 5.0, bg: 'green', heading: ['Hasta 15 %'], italic: 'lunes, martes y miércoles', lines: ['Con efectivo o transferencia', 'en platos seleccionados.', 'En el local y en sahten.online.'] },
    ],
  },
  {
    id: '03-tablas-fin-de-semana', title: 'Tablas para compartir · Fines de semana centrales',
    requires: { campaign: 'central-tables' },
    scenes: [
      { type: 'calendar', dur: 6.6, bg: 'cream', kicker: 'Segundo y tercer viernes y sábado', heavy: 'Hasta 15 %', italic: 'en tablas seleccionadas', product: 'p1779997050112', price: false },
      { type: 'spot', dur: 4.2, bg: 'orange', product: 'p1779997050112', heavy: 'Compartir', italic: 'para dos', kicker: 'Tablas seleccionadas', price: false },
      { type: 'terms', dur: 5.0, bg: 'green', heading: ['Hasta 15 %'], italic: 'en tablas seleccionadas', lines: ['Segundo y tercer viernes', 'y sábado de cada mes.', 'En el local y en sahten.online.'] },
    ],
  },
  {
    id: '04-pedi-online', title: 'Pedí online: primera y segunda compra web',
    requires: { loyalty: ['first_online', 'second_online'] },
    scenes: [
      { type: 'hook', dur: 4.4, bg: 'orange', kicker: 'Tu primer pedido web', photos: ['shawarma_mixto', 'p1779997171373', 'torta_de_chocolate'], lines: ['HASTA', '15 %'], italic: 'en sahten.online', badge: null, tag: true },
      { type: 'benefit', dur: 5.4, bg: 'pale', kicker: 'Bienvenida web', big: 'Hasta 15 %', text: 'con efectivo o transferencia, en productos participantes.', second: { big: '5 %', text: 'pagando con Mercado Pago.' }, foot: 'Desde $30.000 en productos. Envío aparte.' },
      { type: 'benefit', dur: 5.4, bg: 'cream', kicker: 'Segunda compra web', big: 'Hasta 20 %', text: 'con efectivo o transferencia, en productos participantes.', second: { big: '10 %', text: 'pagando con Mercado Pago.' }, foot: 'Desde $40.000 en productos. Tope adicional $4.000. Envío aparte.' },
      { type: 'qr', dur: 5.4, bg: 'green', heavy: 'Escaneá', italic: 'y pedí online', url: 'https://sahten.online/?utm_source=local&utm_medium=pantalla&utm_campaign=pedi-online', label: 'sahten.online' },
    ],
  },
  {
    id: '05-los-mas-pedidos', title: 'Los más pedidos',
    // Ranking por unidades: pedidos del proyecto 26/10–08/11 y web 29/10–26/11.
    scenes: [
      { type: 'hook', dur: 4.4, bg: 'green', kicker: 'Elegidos por nuestros clientes', photos: ['shawarma_pollo', 'shawarma_carne', 'shawarma_mixto'], lines: ['LOS MÁS'], italic: 'pedidos', badge: null, tag: true },
      { type: 'podium', dur: 4.2, bg: 'orange', product: 'shawarma_carne', heavy: 'Shawarma', italic: 'de carne', kicker: 'El más pedido', rank: 1 },
      { type: 'podium', dur: 4.2, bg: 'cream', product: 'shawarma_mixto', heavy: 'Shawarma', italic: 'mixto', kicker: 'Carne y pollo', rank: 2, mirror: true },
      { type: 'podium', dur: 4.2, bg: 'green', product: 'shawarma_pollo', heavy: 'Shawarma', italic: 'de pollo', kicker: 'Favorito', rank: 3 },
      { type: 'podium', dur: 4.2, bg: 'orange', product: 'p1779299917243', heavy: 'Supermix', italic: 'carne, pollo y falafel', kicker: 'Para los que quieren todo', rank: 4, mirror: true },
      { type: 'board', dur: 6.2, bg: 'cream', heavy: 'Los más', italic: 'pedidos', items: ['shawarma_carne', 'shawarma_mixto', 'shawarma_pollo', 'p1779299917243'] },
    ],
  },
  {
    id: '06-para-compartir', title: 'Para compartir en la mesa',
    // Mayor ganancia por unidad y poca venta: tablas y promos para compartir.
    scenes: [
      { type: 'hook', dur: 4.4, bg: 'orange', kicker: 'Una mesa, muchas historias', photos: ['p1779997171373', 'tabla_compartir', 'p1779997050112'], lines: ['PARA'], italic: 'compartir', badge: null, tag: true },
      { type: 'spot', dur: 4.2, bg: 'green', product: 'tabla_compartir', heavy: 'Tabla para', italic: 'compartir', kicker: 'Lo mejor de nuestra cocina' },
      { type: 'spot', dur: 4.2, bg: 'cream', product: 'p1779997171373', heavy: 'Promo Compartir', italic: 'clásico', kicker: 'Yabra, kibbe y hummus', mirror: true },
      { type: 'spot', dur: 4.2, bg: 'orange', product: 'p1779997050112', heavy: 'Compartir', italic: 'para dos', kicker: 'Falafel y hummus' },
      { type: 'board', dur: 6.2, bg: 'green', heavy: 'Para', italic: 'compartir', items: ['tabla_compartir', 'p1779997171373', 'p1779997050112'] },
    ],
  },
  {
    id: '07-sumale', title: 'Sumale algo rico',
    // Complementos con buen margen (tabulé) y foco comercial (hummus, falafel, postres). Sin pan árabe (decisión del dueño).
    scenes: [
      { type: 'orbit', dur: 6.6, bg: 'cream', kicker: 'Para acompañar', heavy: 'Sumale', italic: 'algo rico', products: ['hummus', 'falafel', 'tabule_grd'] },
      { type: 'orbit', dur: 6.6, bg: 'orange', kicker: 'Un cierre dulce', heavy: '¿Y de', italic: 'postre?', products: ['baklava', 'mamul_nuez', 'torta_de_chocolate'] },
    ],
  },
];
