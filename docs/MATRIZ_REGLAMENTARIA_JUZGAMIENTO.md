# Matriz reglamentaria del juzgamiento Pegasus

Contrato verificable entre el Reglamento FEDEQUINAS (Art. 15 / Cap. XI) y la implementación digital.

Estados de regla:

- `CONFIRMADA`: texto inequívoco; implementada y cubierta por prueba.
- `DECISIÓN_OPERATIVA`: no literal en el reglamento; decisión explícita de producto documentada aquí.
- `REQUIERE_EXPERTO`: ambigua; no se habilita silenciosamente.
- `EXCEPCIÓN_CONOCIDA`: desviación deliberada respecto al texto (p. ej. FA=10 / castigo=6 en todas las categorías).

Parámetros vigentes (decisión de producto):

- FA máximo por juez: **10** (texto: 15 en Campeonato Joven → `EXCEPCIÓN_CONOCIDA`).
- Voto de castigo: **6** siempre (texto: 6 o 7 según categoría → `EXCEPCIÓN_CONOCIDA`).
- Las categorías alcanzadas por cualquiera de estas excepciones **no pueden declararse con
  certificación reglamentaria completa**; el resultado debe identificarse como operación Pegasus
  con excepción conocida.

| ID | Regla | PDF / MD | Comportamiento esperado | Estado | Prueba |
|----|-------|----------|-------------------------|--------|--------|
| R-F1-THRESHOLD | F1 si >8 sobrevivientes FA | Art. 15 §3.b | `resolveNextRoundType` → F1 | CONFIRMADA | `flow-rules` + fixtures |
| R-F1-MAX | Máx. 7 selecciones F1 | Art. 15 §3.b | Validación cierre/update F1 | CONFIRMADA | `round.service` / scenarios |
| R-F2-SUM | Menor suma gana | Art. 15 §4.a | Orden por `positionSum` | CONFIRMADA | `scoring.test` / fixtures |
| R-F2-PENALTY | Castigo a no puntuados | Art. 15 §4.d | Posición 6 (perfil actual) | EXCEPCIÓN_CONOCIDA | `scoring.test` |
| R-F2-MAJ1 | Mayoría de 1.os → 1.er puesto | Nota 5.a | 2/3 o 3/5 primeros | CONFIRMADA | fixtures 3j/5j |
| R-F2-DESERT | Desierto por mayoría explícita | Nota 5.b | 2/3 o 3/5 votos `deserted`, aunque otro juez asigne el puesto | CONFIRMADA | `scoring.test` |
| R-F2-MIN | Consideración mínima para premiar | Nota 5.c | `cardsCount >= threshold` | CONFIRMADA | fixtures |
| R-F2-UNAWARDED | Sin ejemplar con consideración mínima y sin mayoría de desierto | Nota 5.b–5.c | `UNAWARDED_INSUFFICIENT_CONSIDERATION`; nunca convertir por agotamiento en desierto | DECISIÓN_OPERATIVA | fixtures / `scoring.test` |
| R-F2-TIE-SUM | Empate por suma igual | §4.b / Nota 5.d | Bloque `SUM_EQUALITY` | CONFIRMADA | fixtures |
| R-F2-5E | Quintos distintos → desempate 5.º | Nota 5.e | Bloque `FIFTH_PLACE_EXCEPTION_5E` | CONFIRMADA | fixtures |
| R-F2-5E-EXCL | Excluir del 5.e a quienes ya tienen 1.º–4.º provisional | Nota 5.e (no literal) | Solo disputan el 5.º quienes no están en 1–4 | DECISIÓN_OPERATIVA | `scoring.test` 5.e exclusión |
| R-F2-SUM-5E-PRECEDENCE | Precedencia SUM + 5.e | Decisión escrita 2026-07-24 | Resolver primero empates ordinarios que afecten 1.º–4.º; después 5.e; nunca mezclar causas | DECISIÓN_OPERATIVA | `tie-blocks` / scenarios |
| R-F2-DESERT-EXHAUST | Puesto agotado sin mayoría explícita de desierto | Decisión escrita 2026-07-24 | `UNAWARDED_INSUFFICIENT_CONSIDERATION`; no `DESERTED` ni eliminación | DECISIÓN_OPERATIVA | `scoring.test` |
| R-CLOSE-OFFICIAL | Cierre fusiona desempates | Nota 5.d | `closeResults` reescribe F2 a FINAL | CONFIRMADA | `close-results-pipeline` / `official-f2-close` |
| R-TIE-TESTS | Pruebas opcionales de desempate | Art. 13 / 15 | El Director Técnico habilita la ronda eligiendo una prueba permitida por número de ejemplares; ejecución trazable; Montar solo tras agotar anteriores | CONFIRMADA | `workflow-guards.test` / contrato de pruebas |
| R-JUDGE-PANELS | Conformación del panel | Art. 15 / decisión escrita 2026-07-24 | Panel simultáneo 1/3/5; prohibidos 2/4. Dos solo Grado B alternada sin consolidación conjunta | DECISIÓN_OPERATIVA | `workflow-guards.test` |
| R-RESET-TEST | Reinicio de categoría | Decisión operativa 2026-07-24 | Disponible en todos los entornos (incl. producción); restringido al Director Técnico | DECISIÓN_OPERATIVA | `access-control.test` |
| R-DQ-MULTI | Reportes de descalificación | Art. 15 | Una denuncia para toda causal salvo hiperflexión; hiperflexión queda provisional hasta 2/3 o 3/5 | CONFIRMADA | `disqualification-reports` |

## Gate CI

El script `packages/functions/scripts/check-regulatory-matrix.mjs` falla si:

1. Una regla `CONFIRMADA` o `DECISIÓN_OPERATIVA` no declara prueba.
2. Una regla `REQUIERE_EXPERTO` aparece marcada como implementada sin decisión.
