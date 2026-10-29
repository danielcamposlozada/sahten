# Movimiento de la web · preparado, sin publicar · 29/10/2026

Aplicación de la skill motion-design. Sin librerías nuevas, cambios en importes ni esperas en el envío de pedidos. Se conserva el foco del diálogo y su cierre inmediato (0 ms). El lema pasa de cinta continua a texto fijo legible, una sola vez, también para lectores de pantalla.

| Elemento | Escritorio | Celular ≤760 px | Curva |
|---|---:|---:|---|
| Pulsación de botones de acción, cantidad, modalidad y pago | 140 ms | 100 ms | cubic-bezier(.4,0,1,1) |
| Liberación de esos botones | 200 ms | 140 ms | cubic-bezier(0,0,.2,1) |
| Sombra de tarjetas de producto/categoría | 220 ms | 154 ms | cubic-bezier(0,0,.2,1) |
| Barra de pedido y menú de navegación desplegable | 200 ms | 140 ms | cubic-bezier(0,0,.2,1) |
| Entrada del diálogo de pedido | 280 ms | 196 ms | cubic-bezier(0,0,.2,1) |
| Fondo del diálogo | 200 ms | 140 ms | cubic-bezier(0,0,.2,1) |
| Contenido de FAQ, campos opcionales y resumen desplegado | 180 ms | 126 ms | cubic-bezier(0,0,.2,1) |
| Borde de campos al enfocar | 150 ms | 105 ms | cubic-bezier(.4,0,.2,1) |
| Ancho del progreso de incentivo de envío | 200 ms | 140 ms | cubic-bezier(.4,0,.2,1) |
| Colores al pasar el puntero, cierre y navegación por anclas | 0 ms | 0 ms | inmediato |

Ningún movimiento regular supera 280 ms. No hay movimiento infinito ni curvas lineales en el nuevo sistema. `prefers-reduced-motion: reduce` desactiva animaciones y transiciones (incluidos pseudoelementos), elimina el escalado de pulsación y mantiene contenido, foco, controles, estado y progreso. No se altera el envío ni se retrasa la acción por esperar un efecto.

## Evidencia

- Chrome, vista local aislada de Supabase: imágenes cargadas (1024×768 y 1065×1600), retícula 2:1 en escritorio y una columna a 360, 390 y 640 px, sin desplazamiento horizontal de la página.
- Abrir pedido a 390 px: estilo calculado `animation-duration: 0.196s`, `animation-timing-function: cubic-bezier(0, 0, 0.2, 1)`, rol dialog y foco dentro. Agregar/quitar un producto conserva el total; carrito de prueba vaciado. No se enviaron pedidos ni mensajes.
- Alternativa de movimiento reducido verificada en la regla CSS; no se afirma haber cambiado la preferencia del sistema del dueño.
- 683 pruebas / 75 archivos aprobados. Compilación Vite correcta. El verificador existente de contraste de marca pasa 288 pares; no equivale a una auditoría completa de contraste de todas las secciones de la web.
- Imágenes y copy de la vista local son una propuesta, pendiente de aprobación del dueño y de publicación. No se ha actualizado la app instalada ni el proyecto dueño.
