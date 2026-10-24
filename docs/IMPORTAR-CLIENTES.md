# Importar clientes y direcciones (preparado, sin publicar)

En **Mostrador → Clientes → Importar CSV / Excel**, elegí el archivo y revisá la vista previa. Nada se incorpora hasta pulsar **Importar N clientes**. Cancelar descarta la preparación. El guardado y sincronización habituales del proyecto se aplican después de confirmar dentro de la app.

Admite `.csv` UTF-8 (coma o punto y coma), `.xlsx` y `.xls`, hasta 5 MB, 10.000 clientes y 20.000 direcciones. Los encabezados van en la primera fila. Si hay varias hojas, se puede elegir la de clientes y otra de direcciones. La asignación automática reconoce encabezados habituales en español/inglés y se puede corregir.

## Datos

Clientes: Nombre, Apellido opcional, Teléfono, Email, ID, Dirección, Email secundario, Cant_compras, Última compra, Activo y Origen. Las columnas opcionales están en **Más datos de clientes**. Calle, Número, Piso/Depto, Ciudad y Referencia pueden venir en esa misma hoja.

Direcciones: **Id Cliente**, Calle, Número, Piso/Depto, Ciudad, Referencia, Es principal y Origen. El ID debe estar asignado en ambas hojas. Se conserva como `externalId`; el ID interno de la app es independiente. Los clientes anteriores sin ID externo siguen siendo válidos.

Las direcciones van dentro de cada cliente, con IDs propios y un único `isPrimary`. Se conserva `address` con el texto de la principal para las pantallas anteriores. Se muestran desplegables en la lista interna. No se geocodifica ni se completa ciudad/número por suposición. Si varias direcciones diferentes están marcadas principales, la vista previa avisa y conserva la primera marcada; sin marca, se usa la primera.

**Conservar texto del archivo** mantiene el `+` y ceros de teléfonos. El modo opcional **Argentina** normaliza números no ambiguos a `+549` + 10 dígitos. Un teléfono incompleto/ambiguo queda vacío, conserva el original en `importPhoneOriginal` y muestra una advertencia para revisión. No se agrega un código de área supuesto. Las celdas de teléfono deberían ser texto en Excel; un cero perdido previamente en un número sin formato no se puede recuperar.

## Duplicados y validación

- Mismo ID externo del importador, o mismo nombre y contacto: duplicado omitido. No reemplaza ni fusiona al cliente existente.
- Mismo teléfono con otro nombre: se conserva como persona distinta y se avisa. El teléfono no es una clave única.
- Direcciones del mismo cliente: se unifican solo si coinciden calle normalizada (incluye Av./Avda.), número, piso y ciudad. Pisos diferentes o un piso vacío frente a otro identificado se conservan separados para evitar fusionar departamentos distintos. Ciudad vacía se conserva vacía.
- Correo inválido o ausencia total de identidad: fila inválida omitida. La vista previa indica totales y primeras 40 filas; importa todas las nuevas válidas, no solamente las visibles.
- Direcciones con ID no encontrado: se avisan y no se incorporan a otra persona. Reimportar un cliente ya existente no incorpora nuevas direcciones automáticamente; se omite el registro completo para evitar sobrescrituras silenciosas.

`importedPurchaseCount` e `importedLastPurchase` conservan antecedentes de la lista. No crean pedidos, no suman ingresos y no acreditan pagos. Campos desconocidos como balance, datos fiscales u hojas de auditoría no se incorporan por suposición.

Las cifras 248 clientes / 205 direcciones / 220 compras provienen de las notas entregadas por el dueño. **No se verificaron contra `Clientes_limpio.xlsx`, que no se importó en esta tarea.** Las pruebas usan exclusivamente datos ficticios.

## Próxima etapa elegida por el dueño

La identificación del cliente y selección de direcciones durante el checkout quedan pendientes. La web no busca ni revela direcciones por ingresar un teléfono. Esa función requiere verificación de identidad y controles de acceso antes de conectar datos personales.
