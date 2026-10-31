# Integración del rediseño Terra (31/10/2026)

**Estado:** trabajo en rama aislada, NO publicar, NO fusionar ni cambiar catálogo/órdenes/pagos.
**Base:** `main` 0.4.33 / `63b2fb31`.
**Fuente visual:** ZIP aportado por el dueño `rediseno-home-2026-10-30.zip`, directorio `tipografia/`, especialmente `tipo-3-home-pulida.html`, `tipo-3-carta-pulida.html`, `pulido.css` y `pulido-criterios.md`.
La carpeta completa de Terra NO es un export de producción ni una fuente de precios. No subir las maquetas como sitio de pedidos.

## Decisiones del dueño

- Dirección C unificada, sistema tipográfico 3: DM Sans para UI/títulos y Lora Italic auténtica solo como acento editorial; conservar logos vectoriales originales.
- Textos legibles de principio a fin: encabezados de sección 44 px desktop / 34 px móvil; textos principales 18/16 px; secciones de 72 px; FAQ y footer con contenido completo.
- Barra verde #235328; acción principal beige #FFF4D6 con texto verde; contador verde/beige. Sobre naranja usar texto verde oscuro #213326, sobre beige verde #235328.
- Carta con imágenes de 180 px desktop / 155 px móvil. No usar productos, precios, categorías ni descuentos del prototipo.
- Fotografías originales de familia sin distorsión ni cambio de rostros. Tutorial con importes/horarios antiguos no puede publicarse sin nueva edición.
- Crédito: `Diseñado y desarrollado por Noamdan`.

## Fuente de verdad y puntos de integración

| Tema | Fuente de verdad | Regla |
| --- | --- | --- |
| Productos, 28 actuales al cierre de 0.4.33 | catálogo live de Supabase + generador `src/online/publish.js` | No incrustar el `catalogo.json` de Terra (31 ítems de muestra) |
| Pedidos, carrito, disponibilidad, pagos/MP | `src/online/web/index.html` y backend existente | No usar `tipografia/menu-3.js`: checkout de muestra |
| Horarios, mínimos, coberturas, beneficios | configuración comercial verificada desde la app 0.4.33 | Guardado en vivo sin republicar ni inventar valores en FAQ |
| FAQ | `docs/brand/sahten/sitio-publicado-2026-10-30.json` (`site.faq.items`: 11) | Conservar preguntas, actualizar respuestas comerciales con información real y aprobación; home, HTML sin JS y JSON-LD iguales |
| Páginas informativas | `src/online/pages.js` y `site` publicado | Conservar menú, delivery/retiro, catering e historia, canonical y breadcrumbs |
| SEO/GEO/AEO | `src/online/seo.js`, `pages.js`, robots y sitemap | Mantener Restaurant, Menu, FAQPage donde corresponda; noindex solo para previews o /pedir según implementación |

## Riesgos comprobados

1. Las FAQ publicadas todavía mencionan **$45.000** de envío gratis y **~6 km**. No asumir que estén vigentes: contrastar contra la configuración real, preferentemente redactar FAQ sin montos fijos cuando sean dinámicos y sincronizar contenido visible + JSON-LD.
2. El snapshot anterior de SEO dice `Fr-Sa 18:00-23:00` y el horario actual de delivery es **lun-sáb 18:00–22:00, domingo cerrado**; no mezclar apertura/retiro con delivery.
3. Maquetas de Terra contienen solamente **dos FAQ** y una reseña de ejemplo; no sustituir contenido real por muestras.
4. MP4 definitivos del dueño ausentes del ZIP. No inventar enlaces ni poner carteles que prometan reproducción; mantener placeholders hasta proveer los originales.
5. Los prototipos tienen `noindex`; al publicar debe conservarse el SEO real, sin desindexar la home.

## Etapas y condiciones para aprobar

- [x] Recuperar las maquetas y decisiones de diseño aprobadas.
- [x] Crear rama aislada desde 0.4.33 sin tocar producción.
- [ ] Adaptar la presentación con el generador actual en modo opt-in para Sahten (sin alterar por defecto otros negocios).
- [ ] Incorporar todos los módulos reales y las 11 FAQ; mantener un origen de contenido común para página y JSON-LD.
- [ ] Revisar **cada** FAQ que describa importe, zona, horario o política: no usar valores históricos sin cotejo.
- [ ] Revisar metadatos, datos estructurados, canonical y sitemap de páginas completas.
- [ ] Validar responsive 320/390/640/1024/1440 y reduced-motion; comprobar textos largos, FAQ expandida y footer.
- [ ] Validar tests/build y flujo carrito → retiro/delivery → pago sin compras reales.
- [ ] Solicitar revisión visual y comercial del dueño; recién entonces preparar publicación separada.

**Prohibido desplegar desde esta rama sin aprobación posterior del dueño.**
