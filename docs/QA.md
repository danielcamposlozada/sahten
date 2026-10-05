# QA final · checklist manual

Estado de cada punto y cómo se verificó. Lo automático corre con `npm test` (la app real en jsdom, sin red). Lo que necesita un navegador o equipo real figura aparte.

| # | Punto | Verificación |
|---|---|---|
| 1 | Proyecto nuevo → asistente de configuración → próximos pasos | `tests/qa-checklist.test.js` (asistente de 10 pasos, gastos, ventas estimadas, tiers, guía) |
| 2 | Producto desde cero (ingrediente → envase → receta → tier → precio) y «¿De dónde sale?» | `tests/qa-checklist.test.js`: el precio coincide con la cuenta a mano y el desglose lo muestra |
| 3 | Control mensual de GF: editar, eliminar, extraordinario; cierre automático y recordatorio | `tests/qa-checklist.test.js` + `tests/gf.test.js` (fechas fijas) |
| 4 | Mostrador: retiro y delivery con dirección, zona y envío gratis; descontar y revertir stock | `tests/qa-checklist.test.js` + `tests/stock.test.js` |
| 5 | Estrategia: aplicar → deshacer → el archivo queda idéntico | `tests/project-app.test.js` y `tests/session.test.js` (idéntico byte a byte) |
| 6 | Abrir un `.sahten` con datos online en el build sin online y guardar sin perderlos | `tests/online-app.test.js` (build con `SAHTEN_ONLINE=false`) |
| 7 | Publicar menú (WhatsApp) y conectar Supabase con dos proyectos y dos tiendas | WhatsApp: probado en un navegador real con el redirect de `wa.me` (ver abajo). Dos tiendas: `tests/qa-checklist.test.js` contra Postgres real (PGlite) |
| 8 | Modo oscuro en todos los paneles | Navegador real: se recorrieron los 17 paneles y 7 ventanas (detalle de producto, ¿De dónde sale?, confirmación, estrategia, carrito, receta, asistente) buscando fondos claros con texto. Sin hallazgos (las dos coincidencias son la muestra del selector de tema y botones translúcidos) |

## Lo que solo se puede probar a mano

- **Selectores de archivo reales** (Chrome: abrir y guardar `.sahten`; escritorio: diálogos del sistema).
- **Supabase real**: conectar con un proyecto gratis y recibir un pedido (la app, el esquema y el cliente se probaron contra Postgres real y simulaciones, no contra los servicios de Supabase).
- **Instaladores**: los genera el CI de GitHub al publicar una etiqueta `v*`; el código de Rust no se compiló en este equipo.
- **WhatsApp**: `wa.me` redirige bien con el número y el texto, pero ver el mensaje armado en el celular lo tenés que hacer vos.

## Cómo repetirlo

```bash
npm test                      # todo lo automático
npm run baseline              # regenera el baseline de precios desde reference/ (si se tocan fórmulas)
npm run demo                  # regenera el proyecto de ejemplo
SAHTEN_ONLINE=false npm run build
```
