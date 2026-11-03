# Juzgamiento

El flujo de competencia se expone bajo `/api/staff/fair-categories/:id` en `packages/functions/src/domains/judging/staged-flow.routes.ts`. Incluye la etapa previa al ingreso a pista, revisión veterinaria, fase FA, rondas F1/F2, desempates y cierre de resultados. Los servicios y las guardas determinan cuándo se permite cada acción.

## Mapa del código

- `staged-flow.service.ts` y `round.service.ts`: etapas y rondas.
- `workflow-guards.ts`, `flow-rules.ts` y `category-flow-rules.ts`: condiciones de avance.
- `scoring.ts`, `official-f2-close.ts`, `f2-deserted-positions.ts` y `tie-break-residual.ts`: cálculos y resultados.
- `staged-flow.schema.ts` y `staged-flow.routes.ts`: contratos y rutas.
- `packages/core/src/domains/judging/`: entidades y persistencia.

Antes de modificar una regla, localiza su fundamento en el [Reglamento FEDEQUINAS](../REGLAMENTO-FEDEQUINAS.md), revisa los tests vecinos y ejecuta `pnpm verify:regulatory`. Contrasta los análisis históricos de `docs/trash/` con el comportamiento actual.
