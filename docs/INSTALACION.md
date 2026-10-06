# Instalar Sahten (Mac y Windows)

Sahten de escritorio es la misma app que la versión web, empaquetada con **Tauri**: abre y guarda tus proyectos `.sahten` como archivos comunes,
**funciona sin internet** (solo el mapa y la búsqueda de direcciones necesitan red) y se actualiza sola.

## Descargar

En **Releases** del repositorio de GitHub:

| Sistema | Archivo |
|---|---|
| macOS (Apple Silicon e Intel) | `Sahten_x.y.z_universal.dmg` |
| Windows 10/11 | `Sahten_x.y.z_x64-setup.exe` (o `Sahten_x.y.z_x64_en-US.msi`) |

Doble clic en cualquier `.sahten` abre el proyecto en Sahten (la instalación asocia la extensión).

## Los avisos del sistema (la app no está firmada)

Firmar las apps cuesta dinero (Apple) o es un trámite (Windows). Sahten viene **sin firmar** por defecto, así que el sistema muestra un aviso la primera vez. No significa que sea peligrosa; así se abre igual:

### macOS · Gatekeeper
- Si dice *«Sahten no se puede abrir porque no se puede verificar al desarrollador»*:
  1. Arrastrá Sahten a **Aplicaciones**.
  2. **Clic derecho (o Control+clic) sobre Sahten › Abrir › Abrir**. Solo hace falta la primera vez.
- Si dice *«Sahten está dañado y no puede abrirse»* (macOS recientes con descargas por navegador): en **Terminal**
  ```bash
  xattr -dr com.apple.quarantine /Applications/Sahten.app
  ```
- Alternativa: **Ajustes del Sistema › Privacidad y seguridad**, bajá hasta el aviso de Sahten y tocá **Abrir de todos modos**.

### Windows · SmartScreen
- Si aparece *«Windows protegió su PC»*: **Más información › Ejecutar de todas formas**.
- Si lo bloquea el antivirus de la empresa, pedí que lo habiliten o usá la versión web.

### ¿Firmarla? (opcional)
- **Apple**: el programa Apple Developer cuesta **USD 99 por año**. Con eso la app se firma y se notariza y desaparece el aviso de Gatekeeper.
  Cargá en el repositorio los secretos `APPLE_CERTIFICATE`, `APPLE_CERTIFICATE_PASSWORD`, `APPLE_SIGNING_IDENTITY`, `APPLE_ID`, `APPLE_PASSWORD` y `APPLE_TEAM_ID`
  (el workflow ya los usa si existen). No hace falta tocar nada más.
- **Windows**: un certificado de firma de código también se paga cada año; SmartScreen además aprende la reputación con las descargas. Es opcional.

## Actualizaciones automáticas

La app busca versiones nuevas al abrir (como mucho una vez por día) y en **Ajustes › Esta app › Buscar actualizaciones** (y, al abrir la app, un aviso en las notificaciones 🔔). Pregunta antes de instalar y
se reinicia; los proyectos no se tocan. Las actualizaciones vienen de GitHub Releases y **van firmadas** (clave propia, distinta de la firma de Apple/Windows).

### Dejarlo listo en tu repositorio (una sola vez)
1. En `src-tauri/tauri.conf.json`, ya apunta a `danielcamposlozada/sahten` (cambialo si movés el repositorio).updater.endpoints` por tu usuario y repositorio de GitHub.
2. El par de claves ya está generado: la **pública** está en `tauri.conf.json` y la **privada** quedó en `~/.tauri/sahten-updater.key` de la computadora donde se generó.
   Copiá su contenido a **Settings › Secrets and variables › Actions** como `TAURI_SIGNING_PRIVATE_KEY` (y `TAURI_SIGNING_PRIVATE_KEY_PASSWORD` vacío).
   **Guardá una copia de la privada en un lugar seguro**: si la perdés, las apps instaladas no podrán actualizarse. Para usar otra clave: `npx tauri signer generate -w ~/.tauri/otra.key` y reemplazá la pública.

## Publicar una versión nueva

1. Subí la versión en los 3 lugares (tienen que coincidir; `npm run check:versions` lo verifica): `package.json`, `src-tauri/tauri.conf.json`, `src-tauri/Cargo.toml` (y `APP_VERSION` en `src/project/schema.js`).
2. `git tag v4.0.1 && git push --tags`.
3. GitHub Actions (`Release`) corre los tests, arma el `.dmg` universal y el `.msi`/`.exe`, y deja un **borrador de Release** con los instaladores y `latest.json`.
4. Revisá el borrador y **Publish release**. Las apps instaladas se actualizan solas.

## Compilar en tu computadora

Necesitás Node 22 y [Rust](https://www.rust-lang.org/tools/install) (en Windows, además las *Build Tools de Visual Studio*).

```bash
npm install
npm run desktop:dev     # ventana de desarrollo
npm run desktop:build   # instaladores en src-tauri/target/release/bundle/
```

## Dónde se guarda cada cosa

| Qué | Dónde |
|---|---|
| Tus proyectos | donde los guardes (`.sahten`), como cualquier archivo |
| Respaldos | **junto al proyecto**: `.<nombre>.backup-AAAA-MM-DD.sahten`, `.<nombre>.pre-estrategia.sahten` (archivos ocultos) |
| Proyectos recientes y preferencias | configuración de la app (no son datos del negocio) |

## Versión web y PWA

El mismo código compila a una web estática (`npm run build` › `dist/`) que se puede alojar en cualquier hosting y **instalar como PWA** desde el navegador (funciona sin internet).
En navegadores sin acceso a archivos (Safari, Firefox) se guarda descargando el `.sahten`; Chrome y Edge guardan directo en el archivo.


## ¿Dónde se guardan mis proyectos?

- **Escritorio**: en la carpeta que elijas al crear/guardar. Por defecto se propone `Documentos/Sahten`. Se cambia en Ajustes › Proyecto › Archivo y proyectos › «Carpeta de proyectos». Los respaldos automáticos están al lado del archivo, ocultos (`.<nombre>.backup-AAAA-MM-DD.sahten`).
- **Navegador (Chrome/Edge)**: en el archivo que elijas; respaldos en el almacenamiento del navegador.
- Para ver o mover un proyecto: Ajustes › Proyecto › Archivo y proyectos › «Dónde está guardado» (Mostrar en carpeta / Cambiar ubicación).

## Recuperar datos de un `.json` antiguo

- **Abrir** un `.json` lo convierte en un proyecto nuevo `.sahten` y pide dónde guardarlo.
- **Importar datos › Reemplazar los datos de este proyecto** vuelca el `.json` dentro del proyecto abierto (conserva archivo y ubicación; guarda antes un respaldo para deshacer).

**Historial**: cada día se guarda una copia automática junto al proyecto y se conservan los últimos 14 días. Al cambiar la ubicación, el historial se copia a la carpeta nueva.
