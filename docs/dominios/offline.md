# Soporte para operaciones sin conexión

La web registra `packages/web/public/service-worker.js` desde `packages/web/src/app/layout.tsx`. Algunas mutaciones de juzgamiento admiten un sobre con `operationId`, `baseRevision` y `payload`, definido en `packages/functions/src/domains/judging/offline-mutation.schema.ts`. `offline-idempotency.service.ts` registra operaciones procesadas para tratar reintentos; los servicios de etapas y rondas validan revisiones según la operación.

- Contrato HTTP: `offline-mutation.schema.ts` y `staged-flow.schema.ts`.
- Procesamiento: `staged-flow.service.ts`, `round.service.ts` y `round-entry-annotations.service.ts`.
- Persistencia de recibos: `OfflineOperationReceipt` en `packages/core/src/domains/judging/`.
- Web: `service-worker.js` y los servicios que invocan rutas de juzgamiento.

Antes de ampliar el funcionamiento sin conexión, confirma en la web qué se guarda localmente y cuándo se reenvía. El contrato del servidor por sí solo no demuestra que exista una cola local de mutaciones.
