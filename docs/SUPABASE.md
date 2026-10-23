# Conectar Sahten a Supabase (opcional, plan gratis)

Todo lo de esta guía es **opcional**. Sin Supabase, Sahten funciona igual con el archivo `.sahten`, y el menú publicado
manda los pedidos por WhatsApp ([PUBLICAR.md](PUBLICAR.md)).

Con Supabase sumás:

| Qué | Para qué |
|---|---|
| **Pedidos en tiempo real** | los pedidos del menú web entran solos a Mostrador › Delivery, con aviso |
| **Menú en vivo** | cambiás precios y tocás «Sincronizar menú»: la web se actualiza sin volver a subir archivos |
| **Proyecto en la nube** | copia sincronizada del proyecto (el `.sahten` sigue siendo lo primero), con cola si no hay internet |
| **Usuarios y roles** | dueño, administrador, encargado, cajero y solo lectura; auditoría |
| **Vista remota** | el dueño mira el negocio en tiempo real desde otro lugar (solo lectura) |

## 1. Crear el proyecto

1. Cuenta gratis en <https://supabase.com> › **New project** (elegí una región cercana, p. ej. São Paulo).
2. **SQL Editor › New query**, pegá todo [`supabase/schema.sql`](../supabase/schema.sql) y **Run**. Se puede correr más de una vez.
3. **Project Settings › API**: copiá la **Project URL** y la **anon public key**.
   **Nunca uses ni pegues la `service_role`**: da acceso total a la base. La app la detecta y la rechaza.
4. **Authentication › Providers › Email**: dejá activado. Para empezar rápido podés desactivar *Confirm email*; si no, cada persona confirma su email.

## 2. Conectar el proyecto desde Sahten

**Nube y usuarios › Conexión con Supabase**: pegá la URL y la anon key, elegí el nombre de tu tienda en la web (`mi-local`),
poné tu email y una contraseña (marcá *Crear una cuenta nueva* la primera vez) y **Conectar proyecto**.

- La URL, la anon key y el id de tienda se guardan en el `.sahten` (`online.supabase`). **La contraseña no se guarda.**
- **Sincronizar menú** sube el menú actual a la tabla `menus`.
- **Subir este proyecto a la nube** crea el proyecto en la tabla `projects` y lo vincula con la tienda.

## 3. Publicar la web con la conexión cargada

Con el proyecto conectado, **Publicar menú** incluye en `menu.json` la URL, la anon key (pública) y el id de tienda.
La web lee el menú en vivo por nombre de tienda (`?store=mi-local`, o un subdominio `mi-local.tudominio.com`) y **escribe los pedidos** en `orders`.

- Si el cliente no tiene conexión, la web **se lo avisa** y le ofrece pedir por WhatsApp. Un pedido nunca se da por enviado si no llegó.
- Cada tienda es independiente: proyecto 1 → tienda 1, proyecto 2 → tienda 2.

## 4. Usuarios y roles

El dueño, en **Nube y usuarios › Equipo y permisos**, invita por email y elige el rol. La persona crea su cuenta con ese email,
conecta la app (misma URL y anon key, nombre de la tienda) y usa **Abrir proyecto de la nube**.
La invitación empieza como **Vendedor / Caja** y explica los permisos antes de crearla. La app no envía un email: el dueño debe avisarle a la persona. El rol de dueño no se puede asignar por invitación.

| Rol | Ve y hace |
|---|---|
| **Dueño** | todo, incluido gestionar usuarios |
| **Administrador** | todo menos usuarios |
| **Encargado** | Mostrador, Stock y Pedidos; **sin costos ni márgenes** |
| **Vendedor / Caja** | Mostrador: pedidos, cobros, historial y clientes; sin costos ni márgenes |
| **Solo lectura** | Reportes, Gastos y Proyección; no cambia nada |

El identificador interno de Vendedor / Caja sigue siendo `cajero`, para conservar las membresías, invitaciones y políticas existentes. Este cambio no requiere una migración de Supabase.

**Cómo se hace cumplir.** No es solo ocultar pantallas:

- Los datos completos del proyecto (con costos) **no se pueden leer con `SELECT`**: solo con funciones del servidor que verifican el rol
  (`get_project_data`: dueño, administrador y lectura). El encargado y el cajero reciben `get_project_public`: precios ya calculados, sin costos,
  sin comisiones ni recargos.
- Guardar el proyecto completo (`save_project`) es solo de dueño y administrador, con **control de versión**: si alguien guardó antes, avisa en lugar de pisar.
- Encargado y cajero escriben pedidos y stock en `project_ops` (el cajero, solo pedidos), sin chocar con los cambios del dueño.
- La invitación no usa claves de servicio: es una fila en `project_invites`; al iniciar sesión con ese email se convierte en membresía.
- Todo se registra en `audit_log` (altas, invitaciones, accesos, cambios de rol, guardados). Lo ven el dueño y el administrador.

> Los pedidos web llegan con la anon key, así que cualquiera con la dirección de tu menú puede crear pedidos (pendientes, de tu tienda, de tamaño limitado).
> No pueden leer nada. Si recibís spam, activá CAPTCHA en **Authentication › Attack Protection** o filtrá los pedidos en la app.

## 5. Sincronización y conflictos

- **Local primero**: el `.sahten` siempre se guarda en tu equipo. Cada guardado programa una sincronización 5 s después.
- Si no hay internet queda **pendiente** y se reintenta solo (30 s, 1 min, 2 min, 5 min) y apenas vuelve la conexión.
- Si cambió **solo un lado**, se sube o se baja solo. Si cambiaron **los dos**, la app **avisa** y elegís: *quedarme con la mía* o *usar la de la nube*.
- Las fotos viajan como archivos de Storage; el proyecto guarda sus direcciones. Al abrirlo en otro equipo se descargan dentro del `.sahten`, que conserva la copia local. Ver la configuración de fotos más abajo.

## 6. Que Supabase no se pause (plan gratis)

Supabase **pausa** los proyectos gratis tras 7 días sin actividad. El workflow
[`.github/workflows/supabase-keepalive.yml`](../.github/workflows/supabase-keepalive.yml) hace una consulta de solo lectura por día:

1. Subí este repositorio a GitHub.
2. **Settings › Secrets and variables › Actions** › creá `SUPABASE_URL` y `SUPABASE_ANON_KEY` (solo la anon key).
3. **Actions › Supabase keep-alive › Run workflow** para probarlo. Corre solo todos los días.

GitHub desactiva los workflows programados si el repositorio queda 60 días sin actividad: entrá a Actions y reactivalo, o hacé un commit.
Si se pausa igual, **Restore project** desde el panel de Supabase recupera todo.

## Alternativa: Cloudflare D1 + Workers

Si preferís no usar Supabase: Cloudflare ofrece gratis **D1** (SQLite) y **Workers**. Un Worker puede exponer `POST /orders`, `GET /menu/:slug` y
`GET /orders?since=` sobre D1; no se pausa por inactividad. La diferencia: D1 no trae **tiempo real** ni **autenticación** listos, así que habría que
agregar consulta periódica (o Durable Objects / WebSockets) y un login propio, y la app ya trae el cliente pensado para Supabase. Es viable, pero es más trabajo.

## Fotos en la nube (desde 0.4.8)

1. En SQL Editor ejecutá `supabase/photos.sql` después de `supabase/schema.sql`. Es idempotente y se puede aplicar a la instalación existente.
2. Instalá la app actualizada y **volvé a publicar la carpeta de la web una vez**. La web anterior descartaba fotos nuevas que no existían en su carpeta.
3. En **Nube y usuarios**, tocá **Sincronizar menú**: primero sube las fotos y luego publica los datos con sus direcciones.
4. Opcionalmente activá **Actualizar fotos automáticamente en la web**. Al cargar o quitar una foto se guarda el archivo local (si tiene ubicación) y se publica el menú completo, incluidos precios y textos. Se mantiene la protección que impide vaciar o reducir mucho el menú publicado.

Las fotos de productos, categorías, portada e historia se suben al bucket público `sahten-photos`. El proyecto sincronizado puede incluir también fotos de productos ocultos: **no uses este bucket para documentos ni imágenes privadas**. Solo dueño y administrador de la tienda pueden escribir en su carpeta; encargado, cajero, lectura y visitantes no pueden hacerlo. Nunca se necesita la clave de servicio en la app.

Las fotos mantienen la compresión de la app (productos/categorías hasta 800 px, portada/historia hasta 1600 px). Se admiten JPEG, PNG y WebP hasta 5 MB por archivo. Cada contenido tiene una dirección distinta para que el navegador no siga mostrando la foto anterior. Fotos idénticas se reutilizan dentro de la misma tienda.

Si falla una subida, el menú publicado no se reemplaza con referencias incompletas. La foto local sigue guardada. El estado aparece en Nube y usuarios; los errores de red se reintentan y el botón **Reintentar fotos** permite hacerlo manualmente. Al volver a abrir un proyecto con la opción activada se intenta publicar otra vez. Los errores de permisos o configuración requieren corregirlos antes de reintentar.

Al abrir o sincronizar el proyecto desde otro equipo se descargan las imágenes y se verifica su contenido. Si falla una descarga no se aplica el proyecto incompleto. Los proyectos antiguos sin referencias de fotos conservan las imágenes locales.

Si una instalación anterior guarda el proyecto sin el protocolo de fotos, Supabase conserva las referencias existentes y actualiza los demás datos. Esto evita que una app antigua deje sin fotos al resto de los equipos. Para descargar y administrar las fotos, todas las instalaciones deben usar la versión actualizada. La eliminación explícita de fotos desde una app compatible sigue funcionando. Si ya aplicaste una versión anterior de `photos.sql`, volvé a ejecutarlo para instalar esta protección.

Quitar una foto elimina la referencia del menú/proyecto en la próxima sincronización. Las versiones anteriores del archivo en Storage se conservan para no romper respaldos ni menús estáticos anteriores; consumen cuota y su limpieza es manual una vez que ya no se usan.
