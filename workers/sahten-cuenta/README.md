# Sahten · Portal de cuentas en Cloudflare

## URLs
- **Portal:** https://sahten.online/cuenta/
- **JS:** https://sahten.online/cuenta/app.js
- **Workers route:** rutas exactas `sahten.online/cuenta` y `sahten.online/cuenta/*` (equivalentes para `www`)
- **Servicio:** `sahten-cuenta`, aislado del Pages `sahten-menu`. La portada, carrito, pagos y catálogo no se redepliegan.

Este portal **no almacena contraseñas, sesiones, enlaces ni códigos**. Las llamadas van del navegador a Supabase Auth mediante la clave **pública** `sb_publishable_`; no se exponen `service_role` ni secretos.

## Configuración obligatoria en Supabase Auth

En [URL Configuration](https://supabase.com/dashboard/project/dtnbokdrxojdcvguuidk/auth/url-configuration) del proyecto **sahten**:

1. **Site URL:** `https://sahten.online/cuenta/` — reemplazar cualquier `http://localhost:3000`.
2. **Redirect URLs:** agregar exactamente `https://sahten.online/cuenta/`. Si se usa `www`, agregar también `https://www.sahten.online/cuenta/`.
3. Conservar otros destinos de producción existentes. No añadir destinos `*` ni localhost a producción.

En [Email Templates](https://supabase.com/dashboard/project/dtnbokdrxojdcvguuidk/auth/templates), en **Magic Link** y **Reset Password**, incluir las **dos alternativas**:

```html
<p>Tu código Sahten: <strong>{{ .Token }}</strong></p>
<p>O abrí el acceso seguro desde este enlace:</p>
<p><a href="{{ .ConfirmationURL }}">Continuar en Sahten</a></p>
```

**Las plantillas son independientes**; cada correo contendrá el código correspondiente al motivo. El link irá al portal porque el `Site URL` y `redirect_to` apuntan allí. Revisar el proveedor SMTP y límites de envíos para usuarios fuera de la organización.

> Nota: el conector Supabase del proyecto permite consultar SQL y desplegar Edge Functions, **no permite modificar Auth URL Configuration ni Email Templates**. Estos ajustes necesitan acceso al Dashboard. No es correcto declarar el clic en el enlace solucionado hasta comprobarlos.

## Experiencia
- **Recuperar contraseña:** email → correo → clic o código → nueva contraseña → volver a iniciar sesión en la app.
- **Acceso rápido:** email → código o clic → cuenta confirmada en la web. **No transfiere automáticamente la sesión a la app**: para la app, ingresar con contraseña o solicitar el código dentro de Sahten.
- **Compatibilidad temporal:** si el correo todavía termina en localhost, el portal acepta copiar el **enlace original sin abrirlo** y validarlo directamente contra Supabase.

### Seguridad
- Control de origen exacto al pegar enlaces; no redirecciona a localhost.
- Tokens en fragmentos `#` eliminados inmediatamente con `history.replaceState`.
- Access token solo en memoria durante la actualización; no LocalStorage, cookies, analytics, parámetros de salida ni sesiones compartidas con la tienda.
- Headers de Cloudflare: no-store, no-referrer, CSP estricta (Supabase Auth y JS del mismo dominio), HSTS, noindex, anti-iframe.
- Rate limits aplicados por Supabase Auth; no generar cuentas nuevas en login.
- Web no expone inventario, precios, pedidos ni RPC de gestión, y no altera políticas RLS.

## Despliegue y verificación
```sh
node scripts/deploy/build-sahten-cuenta.mjs
node --check .sahten-cuenta-deploy/worker.mjs
npx vitest run tests/sahten-cuenta-portal.test.js
```
El `worker.mjs` generado se puede subir mediante Cloudflare Workers API; crear solo las rutas `/cuenta` y `/cuenta/*`. **No publicar** una nueva versión de `sahten-menu` para incorporar este portal.

Prueba final: GET /cuenta/ → 200; GET /cuenta/app.js → 200; GET /pedir/ y /menu.json siguen iguales. Después de configurar las plantillas: solicitar correo real, verificar clic/OTP, comprobar cambio de contraseña, e iniciar sesión con contraseña nueva en Sahten.
