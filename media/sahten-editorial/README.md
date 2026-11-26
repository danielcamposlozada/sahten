# Fuentes de la web editorial de Sahten

Diseño aprobado de Codex: entregables/rediseno-home-2026-10-30/beneficio-10/home-combinada.html y hojas de estilo asociadas, con C, tipografía 3, menú de fotos cortas y último mapa A ajustado. Este archivo aprobado es una fuente de composición. El empaquetador reemplaza sus datos y controles de muestra; no se publica como HTML directo.

Logo y caligrafía: vectores completos de las maquetas aprobadas, procedentes del panel original del dueño. No se redibujan ni se aplican filtros monocromáticos al logo completo.

Fotos de banner y catering: rama assets/fotos-sahten-2026-10-31, media/sahten-fotos. Solo banner-tortas.webp y banner-plato.webp alternan en el 10% habilitado. Catering-mesa.webp es fija y exclusiva para esa sección. Las familias usan los JPEG originales del sitio, conservados en img/.

Videos: cuatro archivos entregados por el dueño en Pictures/Sahten/Videos/Ads, convertidos a MP4 H.264/AAC a 540 px de ancho, con faststart. Pósteres de los mismos videos conservados de la propuesta de Codex. No autoplay, preload none y un video reproduciéndose a la vez.

MapLibre, licencia incluida. Estilo claro de la propuesta aprobada con datos OpenFreeMap/OpenMapTiles/OpenStreetMap; créditos visibles. Fuentes DM Sans y Lora con sus licencias OFL en fonts/.

El cliente web solo consulta datos públicos. El checkout conserva su validación de servidor. No hay claves privadas ni datos de pedidos en estos recursos.

Tutorial (26/11/2026): `tutorial.mp4` y `tutorial.jpg` se rehicieron con imágenes nuevas: celular 3D y la interfaz actual de la tienda, capturada sin enviar pedidos. El **audio original no se modificó**: es la misma voz y la misma música, idénticas bit a bit. Se generan con `tools/pantalla/v2/render-tutorial-web.mjs`. `videos.json` guarda la duración que muestra la portada y la fecha de subida del VideoObject. Las URLs de los videos llevan una versión calculada a partir del contenido para evitar copias viejas en caché.
