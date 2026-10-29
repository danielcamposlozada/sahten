# Mercadería — disponible desde 0.4.30

La sección Mercadería separa los productos terminados comprados a terceros de los ingredientes y envases. Se publicó el 28/10/2026 para Windows y Mac junto con las mejoras de inventarios y Productos. La publicación no creó artículos ni trasladó ingredientes del negocio automáticamente.

## Cargar un artículo

1. Abrir **Mercadería → Nuevo**.
2. Completar nombre, presentación de compra, unidades por paquete y costo del paquete; el proveedor es opcional.
3. El costo unitario se calcula como costo del paquete / unidades. Ejemplo ficticio: docena de 12 latas por $12.000 → $1.000/u. Cambiar presentación o costo no registra por sí solo una compra ni suma stock.
4. Usar el buscador por nombre, presentación o proveedor y las vistas de tarjetas/lista. Se conserva la preferencia al guardar el proyecto.

La cantidad del paquete es un entero mayor a cero. El costo admite cero y decimales. Se utiliza la moneda configurada en el proyecto.

## Vender sin crear una receta

**Crear producto de venta** crea un producto de reventa vinculado al artículo. Si ya hay uno, el botón **Ver producto de venta** abre el existente. Se eligen nombre público, categoría y unidades por venta (una lata, un pack de seis, etc.); la docena es la presentación de compra, no el rendimiento de una receta. Se puede duplicar el producto desde Productos para ofrecer otra presentación de venta que siga usando el mismo artículo.

El editor permite foto y envases adicionales, sin ingredientes, merma ni rendimiento de elaboración. **Ajustar precio por canal** abre el mismo editor de precio automático/fijado y costos bloqueados del resto de la app. Favoritos, canales, descuentos y reportes usan el producto normal.

El nuevo producto comienza **pausado y oculto en la tienda**. Revisar su precio, reactivar ventas desde **Productos**, y elegir si se muestra desde **Tienda online**. Después publicar el catálogo por el flujo habitual. Crear mercadería no publica ni vende automáticamente.

## Usar en una preparación o combo

Abrir una receta → **Mercadería → Agregar mercadería**. Elegir artículo y unidades utilizadas para el lote completo. Su costo se suma antes de dividir por las porciones de la receta. Un producto de reventa también puede seleccionarse como subproducto de un combo; se conserva la opción de incluir/excluir su envase.

Una unidad de Mercadería no aporta peso/volumen al rendimiento automático: no se deduce el peso de una lata a partir de su nombre. Si se necesita esa equivalencia, se carga el rendimiento explícitamente en la receta.

## Stock

**Ingresar stock** abre el registro normal de movimientos, con Mercadería seleccionada y unidad `u`. Para una docena que entra se registran 12 unidades; el costo de compra se mantiene en la ficha del artículo. También se puede usar **Stock → Mercadería** para consultar cantidades, mínimos, valoración, retiros y ajustes. El generador de inventario incluye una plantilla propia.

Vender una lata sola o dentro de un combo consume el mismo artículo. El producto de reventa no crea una segunda existencia independiente. La devolución de stock sigue las reglas actuales de las órdenes, sin devolver dos veces la misma venta.

## Trasladar artículos existentes

En Ingredientes, los artículos cuya unidad es `u` muestran **Mover a Mercadería**. La confirmación conserva ID, presentación, costo, proveedor, stock y referencias en recetas; las referencias se convierten en componentes de Mercadería. No crea un producto de venta automáticamente. El traslado no reescribe ventas anteriores.

No se trasladan automáticamente ingredientes medidos en gramos, kilos o litros: no hay una equivalencia segura entre volumen/peso y cantidad de productos. No cambiar su unidad sin revisar antes presentación, costo y cantidades utilizadas.

Un artículo vinculado a productos o con stock positivo no se puede eliminar desde Mercadería. Se deben quitar las referencias o registrar primero el ajuste correspondiente. Los movimientos y los costos históricos permanecen.

## Guardado y privacidad

El proyecto guarda `catalog.mercaderia`; los productos guardan `productType: resale` y/o componentes `{merchId, qty}`. Archivos anteriores sin Mercadería abren con la sección vacía. Al cambiar de proyecto no se mezclan artículos. El archivo completo, sus respaldos y la sincronización privada del proyecto conservan los nuevos campos; actualizar los equipos antes de editar esos proyectos con versiones anteriores.

La web recibe el producto de venta y su precio final, sin proveedor, presentación de compra ni costos. Las vistas de Caja/Encargado siguen recibiendo el catálogo público sin costos, y Mercadería se administra con permisos de Dueño/Administrador. El guardado histórico de una venta captura el costo vigente; cambios posteriores no recalculan esa venta. Los bloqueos por canal existentes siguen teniendo prioridad.

## Interfaz compartida — ampliación solicitada el 28/10/2026

Ingredientes y Envases reciben el mismo tratamiento de campos, costos destacados, búsqueda por proveedor/nombre, lista/tarjetas y menú de tres puntos. En Mercadería ese menú agrupa crear/ver producto de venta, ingresar stock y eliminar; las acciones no ocupan una fila de botones permanente. Los menús se cierran al elegir una acción, pulsar Escape o tocar afuera, con alternativa para motores sin popover nativo.

Stock conserva sus categorías, filtros, movimientos y generador. Las nuevas vistas muestran existencias y mínimos en la unidad base correspondiente (g, ml o u), estado textual y valoración al costo de compra/producción, con ingresos y retiros desde el menú. Una ficha de costo no registra entradas de inventario. Las cantidades existentes no se convierten automáticamente.

La Tabla avanzada de Productos conserva el selector de columnas y sus valores, con encabezado fijo y columnas de producto/selección y acciones fijas al desplazar. Las flechas y el área navegable por teclado permiten recorrer todos los datos. En pantallas estrechas sigue existiendo desplazamiento horizontal: no se ocultan columnas para hacerlas entrar.
