# Revisión de home · 29/10/2026

## Criterio de diseño

**Fuente:** las skills de maestro de diseño y motion-design separan retícula, identidad y comportamiento; piden jerarquía legible, contraste, pruebas a distintos anchos y movimientos breves con alternativa reducida.

**Aplicación aprobada por el dueño:** conservar marca, logos originales y las dos fotos entregadas. Composición editorial asimétrica: columnas 2:1, separación de 24 px y grupo 40 px más abajo. En celular, una columna, separación de 32 px y retrato de hasta 320 px alineado a la derecha. Son decisiones para este contenido, no medidas atribuidas a los autores de la bibliografía. No hay parallax ni fotografías flotando continuamente.

**Contenido aprobado:** Marcel Kamisso habla en primera persona; nombre de su Sitto, Marcelle Wakil, confirmado por el dueño. María Teresa aparece como responsable de la cocina. Los nombres completos del equipo se reservan para la página Nuestra historia. Se preservan precios, promociones, horarios y configuración comercial. Los textos antiguos de envío mínimo/gratuidad continúan pendientes de aprobación específica y no forman parte de esta edición.

## Verificación

- Chrome a 360, 390, 640 px y escritorio: fotos originales completas, captions visibles, sin desbordamiento horizontal. Los logos mantienen sus signos y el hero su color #FAF8F5.
- Pares de color de la revisión: texto secundario #536256 sobre crema #FAF8F5 = 6,10:1; etiqueta verde #235328 sobre crema = 8,47:1; botón naranja #F28C00 con texto #1C1C1E = 6,91:1. Se corrige el texto pequeño naranja de las etiquetas y el texto blanco de los botones naranjas de páginas informativas.
- Chrome DevTools: preferencias clara y oscura emuladas a 360/390/640 px, fotos cargadas y sin desbordamiento. La paleta de marca fija mantiene los mismos colores legibles. Las emulaciones se restauraron al terminar.
- Movimiento: tabla de duraciones/curvas y evidencia en MOVIMIENTO-WEB.md. Máximo 280 ms, 196 ms para el diálogo en celular. Sin cinta infinita. Regla prefers-reduced-motion presente para elementos y pseudoelementos; simulación en Chrome confirma botón a 0s y diálogo sin animación.
- 683 pruebas / 75 archivos aprobados. Build Vite, scripts clásicos, versiones y contraste de marca correctos. La revisión no certifica una auditoría integral de accesibilidad, métricas de Core Web Vitals ni hardware.

## Publicación

Se autoriza publicar la web el 29/10/2026. Paquete reconstruido con el catálogo público actual de 33 productos; se comprueba igualdad de productos, precios, pagos, delivery y conexión. No se escriben menus/projects/orders en Supabase ni se envían pedidos o pagos.

La variante con fondo generado fue descartada por el dueño y está excluida de los archivos publicables. Solo se incluyen los dos JPEG originales optimizados de docs/brand/sahten/photos/.

Publicación completada: PR #37, merge normal 621778aa68caab4a7f52ab56dbd9fd4970baf2b6; CI 40932262930 correcto. Cloudflare Production 084bb1d6-9cf8-4c3f-9992-2620c6540056, 29/10/2026 a las 15:41 de Argentina. Los 19 archivos públicos coinciden por SHA-256 con la carpeta revisada; catálogo público de Supabase sin cambios, 33 productos y cuatro fotos de productos comprobadas. Chrome muestra relato, fotos originales, captions y navegación, sin errores de consola.
