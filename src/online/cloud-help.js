export const PROJECT_ACTION='Actualizar proyecto entre equipos';
export const CATALOG_ACTION='Publicar catálogo en la tienda';
export const PROJECT_HELP='Sube o descarga la copia de trabajo del proyecto: recetas, costos, clientes, pedidos y ajustes, según tu rol. No publica el catálogo de la web. Si cambian ambos equipos, pide elegir qué versión conservar.';
export const CATALOG_HELP='Reemplaza el catálogo que ven tus clientes: productos, precios, fotos y condiciones de venta. No descarga cambios de otro equipo ni reemplaza sus costos, clientes o pedidos. Requiere confirmación. Conserva las pausas de ventas vigentes.';
export const FILES_HELP='Genera una carpeta o ZIP para subir a Cloudflare. Actualiza diseño, logos, secciones, páginas para buscadores y una copia de respaldo del catálogo. No sube los archivos al hosting por sí solo.';
const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export const cloudHelp=(label,text)=>`<details class="cloud-action-help"><summary aria-label="Ayuda: ${esc(label)}" title="${esc(text)}">ⓘ</summary><p>${esc(text)}</p></details>`;
