# Comandas en impresoras térmicas

En **Ajustes → Personalización → Logo para impresión**, elegí **Papel de la comendera en este equipo**. La selección se guarda en esta computadora; cada caja puede usar su propia impresora.

| Papel | Ancho máximo del documento | Uso |
|---|---|---|
| 58 mm (predeterminado) | 48 mm | Térmica de 58 mm |
| 48 mm | 40 mm | Papel angosto |
| 80 mm | 72 mm | Tiquetera ancha |

El documento deja además 1 mm de espacio interno a cada lado. Los nombres e importes se presentan en líneas separadas en los formatos estrechos. El QR ocupa 30 × 30 mm y queda dentro del área útil.

En el diálogo de impresión seleccioná la impresora correcta, el mismo ancho del rollo, escala 100 % y desactivá encabezados/pies del navegador. Si el controlador muestra A4 u otro tamaño, configurá primero el papel en las preferencias de la impresora de Windows.

La comprobación de diseño en Chrome incluye textos largos, importes grandes y el QR, en 48 y 58 mm. **La validación física con la IT01 todavía requiere imprimir un ticket desde el equipo donde está conectada** y comprobar el borde derecho y el escaneo del QR. Una vista previa correcta no confirma cómo está configurado el controlador de Windows.

Esta corrección está publicada en Sahten 0.4.16. Es necesario instalar esa versión en la caja; la app 0.4.15 no recibe cambios por republicar sahten.online.

## Perfil IT01 y calibración (preparado, sin publicar)

El dueño confirmó posteriormente que usa **48 mm seleccionados en Sahten** y necesita escala **88 % en el controlador** para evitar el corte. Se prepara el perfil **IT01 · 48 mm · calibración 88 %**, que reorganiza el contenido en **35,2 mm** (40 × 0,88), conservando texto de 14 px y QR de 30 mm. No aplica una transformación que encoja todo el ticket.

Elegí el perfil en el mismo bloque de ajustes. El perfil manual permite papel 48/58/80 mm y calibración horizontal 80–110 %. También hay perfil normal A4/Carta. La calibración se aplica una vez sobre el ancho base, no se acumula al guardar. Preferencias locales por equipo; no instala ni detecta el controlador.

Al usar este perfil, seleccionar **escala 100 % en el diálogo del sistema**; mantener 88 % allí aplicaría una segunda reducción. La app no puede configurar ese diálogo por el usuario. Hace falta una nueva versión instalada y repetir prueba física de importes, borde derecho y escaneo del QR. No se afirma validación de hardware desde este equipo.

## Escala de la interfaz (preparado, sin publicar)

En **Ajustes → Personalización → Tema visual**, escala de interfaz 80–125 %, con accesos 85/90/100 %. En escritorio usa el zoom del WebView de Tauri; en el navegador de desarrollo, zoom CSS. La preferencia queda en el equipo, no en el proyecto ni la tienda. El ticket sigue usando sus medidas físicas propias. Es necesario comprobar también en Windows, porque el zoom nativo y el controlador de la IT01 no se ejecutan en la prueba de Chrome.
