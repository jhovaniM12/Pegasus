# Sincronización e importación FEDEQUINAS

Las rutas están en `packages/functions/src/domains/sync/sync.routes.ts`, bajo `/api/sync`. La importación FEDEQUINAS separa `preview` y `apply` por tipo de archivo. También permite consultar estado de feria, lotes y errores. La interfaz está en `packages/web/src/components/sync/` y las llamadas en `packages/web/src/services/sync.service.ts`.

- `fedequinas-xlsx.service.ts`: lectura de archivos.
- `fedequinas-import-rules.ts`: interpretación y validación.
- `fedequinas-sync.service.ts` y `sync.service.ts`: aplicación y seguimiento.
- `fedequinas-sync.schema.ts`: contratos.
- `packages/core/src/domains/sync/`: entidades de lotes, errores y mapeos.

Al cambiar una importación, revisa vista previa, aplicación, errores y efecto sobre datos existentes. Hay pruebas de reglas y casos de aceptación junto al código del dominio.
