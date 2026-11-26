// Guion de los videos para la pantalla vertical del local (1080 × 1920).
// Los textos de promociones copian las condiciones PUBLICADAS (menú y programas de Supabase al 26/11/2026).
// Precios, fotos y disponibilidad se leen del menú publicado al renderizar: si un producto se pausa
// o desaparece, el render se detiene en lugar de anunciar algo que no se vende.
// Si cambia una promoción en Sahten, actualizar el texto acá y volver a renderizar.

export const PALETTE = { green: '#235328', deep: '#183d23', darker: '#112d1b', cream: '#FFF4D6', paper: '#FAF8F5', orange: '#EF8E23', pale: '#E3F1DD', ink: '#213326' };

export const VIDEOS = [
  {
    id: '01-10-off', title: '10 % OFF pagando en efectivo o transferencia',
    // Beneficio de pago publicado: 10 %, canales online y mostrador.
    requires: { paymentBenefit: 10 },
    scenes: [
      { type: 'hook', dur: 4.2, bg: 'orange', kicker: 'Un beneficio para tu mesa', photos: ['shawarma_carne', 'hummus', 'baklava'], lines: ['10 % OFF'], italic: 'en productos', badge: null, tag: true },
      { type: 'duo', dur: 5.4, bg: 'pale', banners: ['banner-tortas', 'banner-plato'], kicker: 'Pagando en', heavy: ['Efectivo o', 'transferencia'], note: 'En el local y en sahten.online' },
      { type: 'terms', dur: 4.2, bg: 'green', heading: ['10 %', 'de descuento'], italic: 'en productos', lines: ['Pagando en efectivo o transferencia.', 'Envío sin descuento.', 'No acumulable: se aplica el beneficio mayor.'] },
    ],
  },
  {
    id: '02-lunes-a-miercoles', title: 'Lunes a miércoles · Platos seleccionados',
    requires: { campaign: 'weekly-meals' },
    scenes: [
      { type: 'hook', dur: 4.0, bg: 'green', kicker: 'Lunes a miércoles', photos: ['p1779467294622', 'sandwich_falafel', 'arabe_clasico'], lines: ['HASTA', '15 %'], italic: 'en platos seleccionados', badge: { top: 'LUN', mid: 'MAR', bottom: 'MIÉ' } },
      { type: 'spot', dur: 3.0, bg: 'orange', product: 'p1779467294622', heavy: 'Promo Fatay', italic: '(3 unidades)', kicker: 'Platos seleccionados', price: false, allowUnpublished: true },
      { type: 'spot', dur: 3.0, bg: 'cream', product: 'shawarma_pollo', heavy: 'Shawarma', italic: 'de pollo', kicker: 'Platos seleccionados', price: false, mirror: true },
      { type: 'spot', dur: 3.0, bg: 'green', product: 'sandwich_falafel', heavy: 'Sandwich', italic: 'de falafel', kicker: 'Platos seleccionados', price: false },
      { type: 'spot', dur: 3.0, bg: 'orange', product: 'arabe_clasico', heavy: 'Árabe', italic: 'clásico', kicker: 'Platos seleccionados', price: false, mirror: true },
      { type: 'spot', dur: 3.0, bg: 'cream', product: 'p1779997171373', heavy: 'Promo Compartir', italic: 'clásico', kicker: 'Platos seleccionados', price: false },
      { type: 'terms', dur: 4.0, bg: 'green', heading: ['Hasta 15 %'], italic: 'lunes, martes y miércoles', lines: ['Con efectivo o transferencia', 'en platos seleccionados.', 'En el local y en sahten.online.'] },
    ],
  },
  {
    id: '03-tablas-fin-de-semana', title: 'Tablas para compartir · Fines de semana centrales',
    requires: { campaign: 'central-tables' },
    scenes: [
      { type: 'hook', dur: 4.2, bg: 'cream', kicker: 'Segundo y tercer viernes y sábado', photos: ['tabla_celebrar', 'p1779997050112'], lines: ['HASTA', '15 %'], italic: 'en tablas seleccionadas', badge: { top: 'VIE', mid: '&', bottom: 'SÁB' } },
      { type: 'spot', dur: 3.6, bg: 'green', product: 'tabla_celebrar', heavy: 'Tabla para', italic: 'celebrar', kicker: 'Tablas seleccionadas', price: false, allowUnpublished: true },
      { type: 'spot', dur: 3.6, bg: 'orange', product: 'p1779997050112', heavy: 'Compartir', italic: 'para dos', kicker: 'Tablas seleccionadas', price: false, mirror: true },
      { type: 'terms', dur: 4.0, bg: 'green', heading: ['Hasta 15 %'], italic: 'en tablas seleccionadas', lines: ['Segundo y tercer viernes', 'y sábado de cada mes.', 'En el local y en sahten.online.'] },
    ],
  },
  {
    id: '04-pedi-online', title: 'Pedí online: primera y segunda compra web',
    requires: { loyalty: ['first_online', 'second_online'] },
    scenes: [
      { type: 'hook', dur: 4.0, bg: 'orange', kicker: 'Tu primer pedido web', photos: ['shawarma_mixto', 'p1779997171373', 'torta_de_chocolate'], lines: ['HASTA', '15 %'], italic: 'en sahten.online', badge: null, tag: true },
      { type: 'benefit', dur: 5.2, bg: 'pale', kicker: 'Bienvenida web', big: 'Hasta 15 %', text: 'con efectivo o transferencia, en productos participantes.', second: { big: '5 %', text: 'pagando con Mercado Pago.' }, foot: 'Desde $30.000 en productos. Envío aparte.' },
      { type: 'benefit', dur: 5.2, bg: 'cream', kicker: 'Segunda compra web', big: 'Hasta 20 %', text: 'con efectivo o transferencia, en productos participantes.', second: { big: '10 %', text: 'pagando con Mercado Pago.' }, foot: 'Desde $40.000 en productos. Tope adicional $4.000. Envío aparte.' },
      { type: 'qr', dur: 5.0, bg: 'green', heavy: 'Escaneá', italic: 'y pedí online', url: 'https://sahten.online/?utm_source=local&utm_medium=pantalla&utm_campaign=pedi-online', label: 'sahten.online' },
    ],
  },
  {
    id: '05-los-mas-pedidos', title: 'Los más pedidos',
    // Ranking por unidades: pedidos del proyecto 26/10–08/11 y web 29/10–26/11.
    scenes: [
      { type: 'hook', dur: 3.6, bg: 'green', kicker: 'Elegidos por nuestros clientes', photos: ['shawarma_pollo', 'shawarma_carne', 'shawarma_mixto'], lines: ['LOS MÁS'], italic: 'pedidos', badge: null, tag: true },
      { type: 'spot', dur: 3.6, bg: 'orange', product: 'shawarma_carne', heavy: 'Shawarma', italic: 'de carne', kicker: 'El más pedido', rank: 1 },
      { type: 'spot', dur: 3.2, bg: 'cream', product: 'shawarma_mixto', heavy: 'Shawarma', italic: 'mixto', kicker: 'Carne y pollo', rank: 2, mirror: true },
      { type: 'spot', dur: 3.2, bg: 'green', product: 'shawarma_pollo', heavy: 'Shawarma', italic: 'de pollo', kicker: 'Favorito', rank: 3 },
      { type: 'spot', dur: 3.2, bg: 'orange', product: 'p1779299917243', heavy: 'Supermix', italic: 'carne, pollo y falafel', kicker: 'Para los que quieren todo', rank: 4, mirror: true },
      { type: 'board', dur: 5.0, bg: 'cream', heavy: 'Los más', italic: 'pedidos', items: ['shawarma_carne', 'shawarma_mixto', 'shawarma_pollo', 'p1779299917243'] },
    ],
  },
  {
    id: '06-para-compartir', title: 'Para compartir en la mesa',
    // Mayor ganancia por unidad y poca venta: tablas y promos para compartir.
    scenes: [
      { type: 'hook', dur: 3.6, bg: 'orange', kicker: 'Una mesa, muchas historias', photos: ['p1779997171373', 'tabla_compartir', 'p1779997050112'], lines: ['PARA'], italic: 'compartir', badge: null, tag: true },
      { type: 'spot', dur: 3.8, bg: 'green', product: 'tabla_compartir', heavy: 'Tabla para', italic: 'compartir', kicker: 'Lo mejor de nuestra cocina' },
      { type: 'spot', dur: 3.6, bg: 'cream', product: 'p1779997171373', heavy: 'Promo Compartir', italic: 'clásico', kicker: 'Yabra, kibbe y hummus', mirror: true },
      { type: 'spot', dur: 3.6, bg: 'orange', product: 'p1779997050112', heavy: 'Compartir', italic: 'para dos', kicker: 'Falafel y hummus' },
      { type: 'board', dur: 5.0, bg: 'green', heavy: 'Para', italic: 'compartir', items: ['tabla_compartir', 'p1779997171373', 'p1779997050112'] },
    ],
  },
  {
    id: '07-sumale', title: 'Sumale algo rico',
    // Complementos con buen margen (tabulé) y foco comercial (hummus, falafel, postres). Sin pan árabe (decisión del dueño).
    scenes: [
      { type: 'hook', dur: 3.4, bg: 'cream', kicker: 'Para acompañar', photos: ['hummus', 'falafel', 'tabule_grd'], lines: ['SUMALE'], italic: 'algo rico', badge: null, tag: true },
      { type: 'spot', dur: 3.0, bg: 'green', product: 'hummus', heavy: 'Hummus', italic: 'con tahini', kicker: 'Crema de garbanzos', mirror: true },
      { type: 'spot', dur: 3.0, bg: 'orange', product: 'falafel', heavy: 'Falafel', italic: 'seis croquetas', kicker: 'Para compartir' },
      { type: 'spot', dur: 3.0, bg: 'green', product: 'tabule_grd', heavy: 'Tabulé', italic: 'fresco', kicker: 'Ensalada', mirror: true },
      { type: 'hook', dur: 3.0, bg: 'orange', kicker: 'Un cierre dulce', photos: ['baklava', 'torta_de_chocolate', 'mamul_nuez'], lines: ['¿Y DE'], italic: 'postre?', badge: null },
      { type: 'board', dur: 5.4, bg: 'cream', heavy: 'Dulces', italic: 'árabes', items: ['baklava', 'mamul_nuez', 'torta_de_chocolate'] },
    ],
  },
];
