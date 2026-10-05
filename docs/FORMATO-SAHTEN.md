# Formato `.sahten`

Un proyecto (un negocio) es **un archivo JSON** con extensión `.sahten`. Cada proyecto es independiente: nombre, moneda,
catálogo, costos, ventas, proyecciones, menú online e imágenes viajan juntos.

```json
{
 "format": "sahten",
 "schemaVersion": 2,
 "appVersion": "4.0.0-alpha.2",
 "modifiedAt": "2026-10-05T14:03:11.000Z",
 "project":     { "id": "…", "name": "La Esquina", "type": "…", "currencySymbol": "$", "roundTo": 50, "locale": "es-AR",
                  "estUnitsMonth": 900, "targetMargin": 40, "online": false, "lastStrategy": {…}, "strategyLog": […] },
 "settings":    { "theme": "dark" | "light" | null, "customization": { "brandName": "…", "paletteId": "…", … } },
 "catalog":     { "ingredientes": […], "envases": […], "productos": […], "categorias": ["Sandwich", …], "tiers": […] },
 "costs":       { "gastosOp": [{ "id", "name", "amount" }], "gastosS": […], "gfMonths": { "2026-10": {…} }, "gfDiscHistory": [],
                  "globalCommission": 0, "usdRate": 1200, "customTC": 0 },
 "channels":    [{ "id": "rappi", "name": "Rappi", "surcharge": 0.45, "commission": 0.3, "enabled": true, "channelDisc": 0 }],
 "stock":       { "items": { "<id>": { "actual": 0, "minimo": 0, "unit": "g" } }, "movements": […] },
 "sales":       { "orders": […], "customers": […], "discounts": […], "payments": […], "reportData": {} },
 "projections": { "snapshots": […], "activeId": null, "channelDist": {…}, "channelLocked": {…}, "manualMode": false, "manualUnits": {…} },
 "online":      { "menuConfig": {…}, "tiendaConfig": { "lat", "lng", "geoOk", "zonas": […] },
                  "supabase": { "url": "", "anonKey": "", "storeId": "", "slug": "", "projectId": "" } },
 "images":      { "<productId>": "data:image/jpeg;base64,…" },
 "ui":          { "currentPanel": "…", "tabState": {…}, "gfPages": […], … }
}
```

- **Productos** incluyen `absorbeGF` (si absorben gasto fijo) y `priceAdj` (ajuste de precio que escribe el asistente de estrategia).
- **Gastos** tienen `id` estable; el control mensual (`gfMonths`) guarda presupuesto y real por concepto, cierre, revisión y registro de cambios.
- **`ui`** guarda vistas y pestañas. No cuenta como «cambio» para el guardado automático.
- **Credenciales**: `online.supabase` guarda la URL, la **anon key** pública, el id y el nombre (`slug`) de la tienda y el id del proyecto en la nube (`projectId`). Nunca va una service key ni una contraseña: la app rechaza la `service_role`.

## Mismo formato con o sin online

Una instalación sin online puede abrir un archivo con datos online y guardarlo **sin perderlos**: al guardar se mezclan las claves
de primer nivel y de sección que esta versión no conoce, y `online.supabase` (lo que el usuario ya configuró no se pisa con vacíos).

## Migraciones (`migrate(data)`, `src/project/schema.js`)

| Entrada | Resultado |
|---|---|
| `.sahten` con `schemaVersion` menor | se actualiza (`1 → 2` completa todas las secciones) |
| `.sahten` con `schemaVersion` mayor | se abre con aviso y se conserva lo desconocido |
| JSON de `collectState()` de Sahten v2 / v3 (`.json`) | se convierte a `.sahten`; queda «sin guardar» hasta «Guardar como…» |
| `Proyeccion_*.json` (una o varias proyecciones) | se agrega al historial del proyecto abierto |
| cualquier otra cosa | error en español, sin tocar nada |

Al cargar un proyecto antiguo, las filas de receta `{n, v}` se vinculan a ingredientes y envases, y las filas de combo («Pizza Muzzarella x4»,
«Pizza Napolitana 1/2») se convierten a cantidad. **Esto corrige un bug de v3**: la fracción se perdía y el costo del combo daba 0 en la primera
carga y otro valor en la segunda.

## Guardado

- **Automático**: 2 s después del último cambio, solo si el contenido del negocio cambió (hash que ignora `modifiedAt`, `appVersion` y `ui`).
  Abrir un proyecto y no tocar nada no reescribe el archivo.
- **Atómico**: `File System Access` escribe a un archivo temporal y lo reemplaza al cerrar; en escritorio (Fase D), temporal + renombrado.
- **Indicador**: «Guardando…», «Guardado hace X s», «Error al guardar» (con el motivo).
- **Acciones**: Abrir, Recientes, Nuevo (abre el asistente de configuración), Guardar como, Duplicar, Exportar copia.
- **Navegadores sin acceso a archivos** (Safari, Firefox): «Guardar» descarga el `.sahten`; el indicador avisa y se pide confirmar al cerrar con cambios.
- **Sin `localStorage` para datos del negocio**: los módulos viejos escriben en memoria (`src/project/kv.js`) y eso va al archivo. En el navegador
  solo quedan preferencias de la app (recientes, guías vistas, tema).

## Respaldos

Se guardan por proyecto (carpeta del `id`) con estos nombres; en escritorio van junto al `.sahten`, en la web en el almacenamiento privado del navegador (OPFS).

| Archivo | Cuándo | Se conserva |
|---|---|---|
| `.<nombre>.backup-AAAA-MM-DD.sahten` | al abrir el proyecto por primera vez en el día | solo el último |
| `.<nombre>.pre-estrategia.sahten` | antes de aplicar una estrategia o importar una proyección | solo el último |
| `.<nombre>.pre-restauracion.sahten` | antes de restaurar un respaldo | solo el último |

En **Ajustes › Archivo y respaldo**: «Restaurar respaldo de ayer» y «Deshacer última estrategia», con un resumen de diferencias (precios, costos y
gastos fijos) antes de confirmar. Restaurar escribe el respaldo **tal cual**: aplicar una estrategia y deshacerla deja el archivo idéntico, byte a byte.
