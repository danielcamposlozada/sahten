# Sahten

Gestión de costos, precios, proyección, mostrador y stock para gastronomía.

```bash
npm install
npm run dev      # http://localhost:5173
npm test
npm run build
```

Instaladores (Mac/Windows): [docs/INSTALACION.md](docs/INSTALACION.md). Publicar el menú: [docs/PUBLICAR.md](docs/PUBLICAR.md). Supabase opcional: [docs/SUPABASE.md](docs/SUPABASE.md).

Arquitectura y estado de la migración: [docs/ARQUITECTURA.md](docs/ARQUITECTURA.md). Auditoría de la lógica: [docs/AUDITORIA.md](docs/AUDITORIA.md).

## Protocolo obligatorio para agentes de IA

Este protocolo es permanente y aplica a cualquier agente (Claude, OpenAI Codex u otro) en **todas** sus intervenciones. Antes de modificar nada, leé en este orden:

1. [AGENTS.md](AGENTS.md): reglas obligatorias.
2. [docs/AI_CONTEXT.md](docs/AI_CONTEXT.md): qué es Sahten, arquitectura, reglas comerciales y estado verificado.
3. La **entrada más reciente** de [docs/AI_HANDOFF.md](docs/AI_HANDOFF.md) (la bitácora se escribe de más nueva a más vieja).
4. La documentación específica de la funcionalidad que vas a modificar (índice en la sección 8 de `docs/AI_CONTEXT.md`).
5. El código fuente relacionado y sus pruebas.

Antes de empezar, explicá brevemente qué entendiste, cuál es el estado actual y qué pensás modificar. Al terminar: revisá los cambios reales, corré las pruebas aplicables, actualizá la documentación afectada y agregá una entrada nueva al principio de `docs/AI_HANDOFF.md`, separando lo implementado, lo probado, lo publicado y lo pendiente. No se declaran exitosas pruebas que no se ejecutaron ni despliegues que no se verificaron, y no se publica nada en producción sin autorización del dueño.

## Licencia

AGPL-3.0-or-later (ver `LICENSE`). Podés usar, estudiar y modificar Sahten libremente. Si distribuís una versión modificada, o la ofrecés como servicio por red, tenés que publicar su código fuente bajo la misma licencia. Para usos comerciales sin esa obligación, consultá al autor por una licencia aparte.
