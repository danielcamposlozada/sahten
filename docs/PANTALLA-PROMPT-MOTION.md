# Prompt maestro — Videos para la pantalla del local de Sahten (v2, nivel motion design profesional)

> Para pegar en un agente (o entregar a un motion designer). Reemplaza el enfoque v1 de `tools/pantalla/`, que queda como base técnica y de datos.
> Español rioplatense. Nada se inventa: cada precio, condición, horario o zona sale de la configuración publicada de Sahten o de una confirmación del dueño.

---

## 0. Rol

Sos **director de arte y motion designer senior**, con más de 10 años en publicidad gastronómica (menu boards de QSR tipo Starbucks o McDonald's, spots de delivery) y dominio de **3D en tiempo real (Three.js / WebGL)**, tipografía cinética y composición en grilla. Tu trabajo tiene que verse **hecho por un estudio**, no por una plantilla: profundidad, luz, timing con intención, transiciones que conectan y una sola idea por plano.

## 1. Pantalla y contexto de uso

- **Tele de 32" en vertical**, dentro del local, vista a **1,5–4 m**, por clientes que esperan o deciden en el mostrador. Sin sonido.
- **Formato maestro:** 1080 × 1920 (9:16), 30 fps. Se entregan además:
  - **1920 × 1080 rotado 90°**, para teles colgadas en vertical que reproducen por USB y no rotan el video (un archivo 16:9 que se ve vertical);
  - **2160 × 3840** (4K) solo si la tele lo soporta.
- **Códec:** H.264 High, yuv420p, nivel 4.2, CRF 18, `+faststart`. Opcional: HEVC.
- **Loop perfecto:** el último cuadro empalma con el primero. Cada video dura entre 12 y 20 s. `00-loop-completo.mp4` encadena todos en el orden de la playlist.
- **Zona segura:** 90 px en los laterales, 140 px arriba y abajo (las teles recortan bordes).

## 2. Reglas de legibilidad (no negociables, por el feedback del dueño)

1. **Máximo 7 palabras de texto principal por plano**, más el precio. **Sin descripciones de platos.**
2. Tamaños mínimos en 1080 × 1920:
   - titular: 140 px o más;
   - nombre de producto: 110 px o más;
   - precio: 90 px o más;
   - secundario: 44 px o más;
   - letra chica legal: 40 px o más, solo en el plano final.
3. **Contraste:** 4,5:1 como mínimo para todo texto (7:1 en el secundario).
4. Detrás del texto nunca hay patrón ni foto sin velo. El patrón geométrico vive en los bordes o sobre zonas de color plano, al **6–10 % de opacidad**, con una máscara radial que deja limpio el centro.
5. Cada texto queda en pantalla al menos 2,2 s después de terminar su entrada. Regla práctica: 0,3 s por palabra + 1 s.
6. **Un solo foco en movimiento por plano** (el plato, o el texto, o el mapa); lo demás va en movimiento secundario lento.
7. Test obligatorio: ver cada video reducido al 25 % y desde 3 m. Si no se entiende en 2 segundos, se simplifica.

## 3. Sistema de marca (fuente: sahten.online y `docs/brand/sahten/README.md`)

- **Colores:**
  - verde `#235328`, verde profundo `#183d23`, verde muy oscuro `#112d1b`;
  - naranja `#EF8E23`;
  - crema `#FFF4D6`, papel `#FAF8F5`, verde claro `#E3F1DD`;
  - tinta `#213326`.
- **Combinaciones aprobadas** de fondo / letras: verde / crema (acento naranja), naranja / verde (acento crema), crema / verde (acento naranja).
- **Tipografía:**
  - DM Sans 900 en mayúscula con tracking −0,05 em para titulares;
  - **Lora itálica** para la palabra emocional («historias», «pedidos», «compartir»);
  - DM Sans 700 para el resto.
  - Archivos en `media/sahten-editorial/fonts/`.
- **Logo y caligrafía:** solo los SVG originales (`media/sahten-editorial/logo-verde-crema-naranja.svg`, `caligrafia.svg`), sin redibujar ni deformar. El árabe va siempre con vocales: **صَحْتَيْن**.
- **Ornamentos propios**, siempre vectoriales y sobrios: estrella de 8 puntas (khatam), arco ogival, rosetón, celosía (mashrabiya), festón de arcos. Inspiración islámica geométrica, no clip-art.
- **Fotos:** las aprobadas de cada producto (mesa de madera clara, vajilla blanca, luz cálida, 3/4), que se leen del menú publicado.
  - Las 2 fotos `banner-tortas` y `banner-plato` se usan **solo en el 10 % OFF**.
  - `catering-mesa` se usa **solo para catering**.

## 4. Stack técnico y calidad de imagen

- **Motor:** página HTML de 1080 × 1920 con **un reloj maestro determinista** (`seek(t)`), renderizada cuadro a cuadro con Playwright y codificada con ffmpeg (base existente en `tools/pantalla/`).
- **3D:** **Three.js (r160, local)**, con WebGL en Chromium headless (SwiftShader o GPU). Lo que se hace con él:
  - **Platos recortados** (sin fondo) sobre una tarjeta 3D con luz direccional cálida, sombra suave de contacto y un leve giro y paralaje de cámara. Es el aspecto «producto flotando» de los menu boards.
    - Recorte con `rembg` (u2net) o similar, ejecutado localmente y revisado a mano.
    - Si el recorte de un plato no sale limpio, se usa la foto completa en un marco (arco o círculo). Nunca se publica un recorte sucio.
  - **Partículas:** sésamo, perejil y pimentón cayendo en cámara lenta. Vapor con un shader de ruido sobre los platos calientes, al 15–25 % de opacidad.
  - **Ornamentos 3D:** estrella de 8 puntas y arcos extruidos (ExtrudeGeometry) con material mate de color de marca, como piezas de escenografía que giran lento.
  - **Mapa 3D** del delivery: ver el video 09.
- **Post:**
  - motion blur por acumulación de 4 subcuadros por cuadro;
  - grano de película del 2 %;
  - viñeta suave;
  - grading cálido (LUT leve);
  - bloom muy leve solo en luces.
  - Prohibido: aberración cromática, glitch y lens flares.
- **Timing:**
  - easing de entrada `cubic-bezier(.16,1,.3,1)`;
  - cambios de estado `cubic-bezier(.65,0,.35,1)`;
  - rebote solo en sellos y precios (`cubic-bezier(.34,1.56,.64,1)`, una vez).
  - Animación con anticipación, solapamiento y follow-through: nada empieza ni termina junto; stagger de 60–120 ms.
- **Cámara:** algo siempre se mueve (push-in del 3–6 %, deriva o paralaje), pero sin marear. Nunca hay un cuadro estático.
- **Transiciones** con identidad, una por tipo:
  1. cortina de arcos (festón ogival);
  2. iris en estrella de 8 puntas;
  3. match-cut: el plato sale por un lado y el siguiente entra por el mismo eje;
  4. barrido de celosía.
  - Duración entre 0,45 y 0,6 s.

## 5. Un marco distinto por tipo de promoción (no repetir layout)

| Tipo | Videos | Marco o composición propia |
|---|---|---|
| **Beneficio de pago** | 01 10 % OFF | **Tipografía cinética XXL.** El «10 %» se construye en 3D con piezas de estrella que encajan; las 2 fotos del banner aparecen en ventanas de celosía. |
| **Días de semana** | 02 Lunes a miércoles | **Tira semanal:** 7 casillas (L a D) y se iluminan L, M y M. Cada plato entra «sentado» en su día, en un plato recortado sobre un mantel de color. |
| **Fines de semana del mes** | 03 Tablas | **Calendario mensual** que marca el 2.º y 3.er viernes y sábado; la tabla aparece en vista cenital (top-down) sobre madera, con zoom. |
| **Programas web** | 04 Pedí online | **Celular 3D** que gira con la web real en pantalla; los sellos de % salen del teléfono. |
| **Ranking** | 05 Los más pedidos | **Podio y numeración gigante** (1, 2, 3, 4) en Lora itálica detrás del plato recortado; contador animado. |
| **Para compartir** | 06 Para compartir | **Mesa cenital:** las tablas se deslizan sobre la mesa de madera y unas manos ilustradas sugieren compartir. |
| **Complementos** | 07 Sumale | **Órbita:** el plato principal al centro y los complementos orbitan y se «suman» con un +. |
| **Cómo comprar** | 08 Nuevo | **Mockup de celular con grabación real** de sahten.online. |
| **Delivery** | 09 Nuevo | **Mapa vivo con moto.** |

Los platos no repiten el mismo cuadro: cada producto aparece **una sola vez en todo el loop** como protagonista, salvo en el ranking. El arco ogival queda reservado a un solo video.

## 6. Guion por video (copys exactos y datos)

Todos los videos:
- abren con un **gancho de 1 s** (movimiento fuerte + palabra clave);
- se desarrollan en 2–4 planos;
- cierran con la **firma**: logo y caligrafía sobre verde, festón de arcos, «sahten.online». La firma es idéntica en todos para dar unidad.

**01 · 10 % OFF (14 s)**
- Gancho: «10 %» que se arma en 3D.
- Plano: «en productos» + «Efectivo o transferencia».
- Fotos del banner en celosía.
- Cierre legal: «Envío sin descuento. No acumulable: se aplica el beneficio mayor.»
- Fuente: `payments.benefit` = 10 %, canales online y mostrador.

**02 · Lunes a miércoles (16 s)**
- Copy: «Hasta 15 %» · «en platos seleccionados» · «con efectivo o transferencia».
- Platos de la campaña `weekly-meals` publicados en la web (máximo 3 en pantalla): Sandwich de Falafel, Shawarma de Pollo, Árabe Clásico. Promo Compartir Clásico como alternativa.
- **Sin Promo Fatay (3U)**: no está en el menú web publicado (decisión del dueño, 26/11).
- Sin precios de lista: el descuento depende del medio de pago.

**03 · Tablas · 2.º y 3.er viernes y sábado (14 s)**
- Copy: «Hasta 15 %» · «en tablas seleccionadas».
- Producto: Promo Compartir para Dos (campaña `central-tables`).
- **Sin Tabla para Celebrar**: no está en el menú web publicado (decisión del dueño, 26/11).

**04 · Pedí online (16 s)**
- «Tu primer pedido web: hasta 15 %» (5 % con Mercado Pago, desde $30.000 en productos).
- «Segunda compra web: hasta 20 %» (10 % con Mercado Pago, desde $40.000, tope adicional $4.000).
- QR a `https://sahten.online/?utm_source=local&utm_medium=pantalla&utm_campaign=pedi-online`, de 600 px o más y con zona de silencio.

**05 · Los más pedidos (15 s)**
- N.º 1 Shawarma de Carne, N.º 2 Mixto, N.º 3 Pollo, N.º 4 Supermix, con precio publicado.
- Ranking por unidades vendidas: se recalcula antes de cada render.

**06 · Para compartir (14 s)**
- Tabla para Compartir, Promo Compartir Clásico y Compartir para Dos, con precio.
- Motivo: son los productos con **mayor ganancia por unidad** y baja venta. El margen nunca se muestra.

**07 · Sumale (14 s)**
- Hummus, Croquetas de Falafel, Tabulé; cierre dulce con Baklava, Mamul de Nuez y Torta de Chocolate.
- **Sin pan árabe** (decisión del dueño).

**08 · Cómo comprar en la web (18 s) — NUEVO**
- Celular 3D (bisel fino verde profundo) que gira de 3/4 a frente.
- En la pantalla del celular va una **grabación real** de sahten.online, capturada con Playwright en un iPhone 14 emulado, **sin confirmar pedidos**. Pasos exactos de la web:
  1. **«01 Elegí tus platos»**: scroll de la tienda y toque en un plato; aparece un «+1» y la bolsa salta.
  2. **«02 Revisá tu pedido»**: se abre el carrito y se ajusta la cantidad.
  3. **«03 Elegí entrega y pago»**: retiro o delivery y efectivo, transferencia o Mercado Pago. La grabación se corta antes de confirmar.
- Un cursor-dedo (círculo crema) marca cada toque. La cámara hace zoom de 1,0 a 1,6 sobre cada acción con seguimiento amortiguado (tipo Screen Studio).
- Número de paso gigante (01, 02, 03) en Lora itálica al costado.
- Cierre: QR + «sahten.online».

**09 · Tenemos delivery (18 s) — NUEVO, pieza estrella**
- **Mapa 3D real** con MapLibre GL y estilo propio con colores de marca:
  - agua en verde claro, calles en crema, manzanas en verde profundo;
  - edificios extruidos sutiles;
  - inclinación de 50–60° y rotación lenta de cámara.
- **Origen:** el local, General Julio Argentino Roca 1489, Vicente López (lat −34.5264314, lng −58.4818959). Pin con la estrella de 8 puntas y un pulso.
- **Anillos de zona** que se dibujan desde el centro: 2 / 3,5 / 5 / 6,5 / 8 km (Zonas 1 a 5 publicadas).
  - Solo se rotula «Hasta 8 km»; no se muestran tarifas.
- **Moto:** ilustración vectorial propia, plana, colores de marca, con la caja térmica naranja y la estrella.
  - Sale del local y recorre una **ruta real por calles** hasta un destino de ejemplo dentro de la Zona 3.
  - Va orientada según la tangente de la ruta; deja una estela naranja y la cámara la sigue en tercera persona.
  - Al llegar, una casa-pin rebota y aparece el texto «¡Llegó!».
- **Barrios:** aparecen como etiquetas sobre el mapa. La lista se toma del texto publicado y **está confirmada por el dueño**: Vicente López, Olivos, Florida, La Lucila, Martínez, Núñez y Belgrano.
- **Horario:** «Lunes a sábado · 18 a 22 h» (`deliveryV2.hours` publicado).
- **Envío gratis** (decisión del dueño): se anuncia «Envío gratis*» con una **aclaración chica al pie**, de 40 px como mínimo: «*Según zona y monto del pedido. Validá tu dirección en sahten.online.» No se muestra una cifra única.
- Cierre: QR + «Pedí delivery en sahten.online».

## 7. Datos y veracidad

- Precios, fotos, disponibilidad, campañas, programas, zonas y horarios se leen **del menú publicado** con la clave publicable y en solo lectura. Si algo cambió (campaña despublicada, producto pausado, precio faltante), el render **se detiene**.
- Rankings y márgenes: agregados por producto, **sin datos personales**. Los costos nunca aparecen en pantalla.
- Inconsistencias que hay que resolver antes de publicar:
  1. Texto de delivery de la web («Envío gratis desde $45.000», «Pedido mínimo $15.000») contra las zonas publicadas (gratis desde $25.000, $35.000, $50.000 o $80.000 según la zona; mínimos de $15.000 a $45.000).
  2. La Promo Fatay (3U) y la Tabla para Celebrar están en campañas del local pero no en el menú web publicado. **Resuelto:** quedan fuera de los videos.

## 8. Requisitos técnicos del entorno

Hosts que hay que habilitar en la red del entorno para el v2:
- `tiles.openfreemap.org`: teselas del mapa, las mismas que usa la web;
- `router.project-osrm.org` u otro proveedor: ruta real de la moto;
- `github.com/danielgatis/rembg` releases: modelo u2net para recortar platos (o subir el modelo a mano);
- `cdn.jsdelivr.net`: Three.js y MapLibre si no se usan las copias locales.

## 9. Checklist de aceptación (por video)

- [ ] Loop exacto: la diferencia entre el primer y el último cuadro es solo ruido de compresión.
- [ ] Ningún plano tiene más de 7 palabras más el precio; las letras respetan los mínimos de la sección 2.
- [ ] Contraste ≥ 4,5:1; el centro de la pantalla queda limpio de patrón.
- [ ] Un solo foco por plano; nada estático; el motion blur está activo.
- [ ] Ningún layout se repite entre videos; cada plato es protagonista una sola vez (salvo el ranking).
- [ ] Datos verificados contra el menú publicado el día del render (`out/informe.json`).
- [ ] QR probado con un celular real desde 1,5 m.
- [ ] Prueba en la tele real del local (USB): rotación, recorte de bordes y fluidez.
- [ ] Se entregan el maestro 1080 × 1920, la versión rotada 1920 × 1080 y `00-loop-completo.mp4`.
