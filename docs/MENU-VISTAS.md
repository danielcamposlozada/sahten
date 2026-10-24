# Vistas de precios del Menú

Preparado para la próxima actualización de la app; todavía no publicado en instaladores.

En **Menú → Vista** se elige:

- **Lista esencial**: producto con su categoría, precio final del canal, estado automático/fijado y **Editar precio**.
- **Lista con editor lateral**: elegir un producto abre el editor completo al lado; en pantallas estrechas se coloca debajo. Costos, bloqueos y desglose son desplegables. Un aviso evita descartar un borrador al cambiar de producto, canal o vista.
- **Tarjetas de productos**: precio destacado, estado, edición y costos/resultados desplegables.
- **Comparador de canales**: hasta tres canales activos elegidos por el usuario; cada precio abre el editor de ese producto/canal. En móvil se apilan los canales bajo el nombre.
- **Tabla avanzada**: conserva las columnas y acciones anteriores, incluido el selector de columnas.

El selector de vista, el canal y los canales comparados se recuerdan en el equipo con las preferencias de navegación del proyecto. No se envían a la tienda. La búsqueda y el orden se conservan al alternar vistas. El buscador acepta nombre o categoría, con o sin tildes. Los productos de solo receta quedan fuera.

Pulsar el nombre abre la ficha del producto; pulsar **Editar precio** o el precio en el comparador abre directamente el editor existente. Los roles sin acceso a costos no reciben controles de edición ni desglose privado en estas vistas. La selección de productos sigue habilitando las acciones en lote.

Todas las vistas leen el precio efectivo del mismo núcleo. No agregan fórmulas ni modifican los precios al cambiar de presentación. Guardar utiliza las políticas e historial existentes por canal; conserva el registro de ventas anteriores. Para actualizar precios de la tienda sigue siendo necesario sincronizar/publicar según su configuración.

La cobertura de gasto fijo y proyección se consulta en **Cobertura y proyección de costos**, arriba del listado.

## Validación

- Suite completa: 528 pruebas en 55 archivos; compilación, scripts clásicos y versiones correctos.
- Chrome con negocio ficticio, sin conexión a Supabase: cuatro vistas a 1366 × 768, 1024 × 600 y 320 × 640; sin desborde horizontal en los doce casos. El comparador anula el ancho mínimo global de las tablas y apila sus celdas en móvil.
- Guardado desde una celda del comparador, etiqueta de precio fijado compartida con las demás vistas y revisión de modo oscuro. No se modificó el catálogo del negocio real ni la web publicada.
- Pruebas de integración: selección de canal correcta, historial, conservación y descarte confirmado de borradores, búsqueda por categoría, selección en lote, preferencias y restricciones de acceso a costos.
