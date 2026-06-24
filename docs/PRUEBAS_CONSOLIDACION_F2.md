# Pruebas de consolidación F2

Este documento lista pruebas manuales para validar que la consolidación F2 esté alineada con `docs/REGLAMENTO_FEDEQUINAS.md`, especialmente las notas aclaratorias del Artículo 15:

- Menor suma gana.
- Mayoría de primeros puestos prevalece para el primer lugar.
- Puestos desiertos solo por mayoría de jueces.
- Un ejemplar premiado debe haber sido considerado por mínimo 2 de 3 jueces, o 3 de 5 jueces.
- Si el quinto puesto no fue declarado desierto por mayoría y hay ejemplares tomados en cuenta para quinto, no debe quedar desierto automáticamente.

## Preparación general

1. Crear o usar una categoría con al menos 8 ejemplares elegibles.
2. Abrir F2.
3. Entrar con cada juez, iniciar tarjeta F2, asignar los puestos indicados y cerrar la tarjeta.
4. Entrar como Director Técnico y consolidar F2.
5. Verificar la tabla `Resultado F2`: puesto, distintivo, suma, primeros y estado.
6. Si el resultado no cambia después de corregir lógica, abrir una ronda/categoría nueva o reconsolidar limpiando el resultado previo, porque los resultados consolidados quedan persistidos.

## Caso 1: captura reportada, quinto no debe quedar desierto

Objetivo: validar la nota especial del quinto puesto.

Tarjetas:

| Juez | 1.º | 2.º | 3.º | 4.º | 5.º |
|---|---|---|---|---|---|
| J1 | #2 | #8 | #4 | #3 | #9 |
| J2 | #1 | #3 | #2 | #4 | #6 |
| J3 | #2 | #4 | #3 | #6 | Desierto/sin asignar |

Cálculo esperado:

| Ejemplar | Suma | Considerado | Resultado esperado |
|---|---:|---:|---|
| #2 | 5 | 3 | 1.º |
| #3 | 9 | 3 | 2.º o 3.º, empatado con #4 |
| #4 | 9 | 3 | 2.º o 3.º, empatado con #3 |
| #1 | 13 | 1 | Sin cinta |
| #8 | 14 | 1 | Sin cinta |
| #6 | 15 | 2 | 4.º |
| #9 | 17 | 1 | 5.º por voto real de quinto, no desierto |

Validaciones:

- El puesto 4 debe ser `#6`.
- El puesto 5 debe ser `#9`.
- No deben aparecer 4.º ni 5.º como desiertos.
- Debe marcar empate bloqueante entre `#3` y `#4`.
- El sistema debe permitir abrir desempate para resolver el 2.º/3.º.

## Caso 2: desierto explícito por mayoría

Objetivo: validar que un puesto solo queda desierto si lo declara la mayoría.

Tarjetas:

| Juez | 1.º | 2.º | 3.º | 4.º | 5.º |
|---|---|---|---|---|---|
| J1 | #1 | #2 | Desierto | #3 | #4 |
| J2 | #1 | #2 | Desierto | #3 | #4 |
| J3 | #1 | #2 | #3 | #4 | #5 |

Resultado esperado:

- 3.º debe quedar desierto con 2 votos.
- `#3` debe bajar al siguiente puesto disponible.
- La fila desierta debe mostrar distintivo de tercer puesto desierto.

## Caso 3: un juez declara desierto, no hay mayoría

Objetivo: validar que un solo voto de desierto no basta.

Tarjetas:

| Juez | 1.º | 2.º | 3.º | 4.º | 5.º |
|---|---|---|---|---|---|
| J1 | #1 | #2 | Desierto | #3 | #4 |
| J2 | #1 | #2 | #3 | #4 | #5 |
| J3 | #1 | #2 | #3 | #4 | #5 |

Resultado esperado:

- 3.º no debe quedar desierto.
- `#3` debe quedar premiado si cumple consideración mínima.

## Caso 4: candidato con baja suma pero sin consideración mínima

Objetivo: validar que un ejemplar considerado por un solo juez no recibe cinta en puestos 1.º a 4.º.

Tarjetas:

| Juez | 1.º | 2.º | 3.º | 4.º | 5.º |
|---|---|---|---|---|---|
| J1 | #8 | #1 | #2 | #3 | #4 |
| J2 | #1 | #2 | #3 | #4 | #5 |
| J3 | #1 | #2 | #3 | #4 | #5 |

Resultado esperado:

- `#8` no debe recibir 1.º aunque su voto de J1 sea alto, porque solo fue considerado por un juez.
- El sistema debe saltar `#8` para premiación y seguir con el siguiente ejemplar elegible.

## Caso 5: mayoría de primeros puestos prevalece

Objetivo: validar la excepción reglamentaria del primer lugar.

Tarjetas:

| Juez | 1.º | 2.º | 3.º |
|---|---|---|---|
| J1 | #1 | #2 | #3 |
| J2 | #1 | #2 | #3 |
| J3 | #2 | #3 | #1 |

Resultado esperado:

- `#1` debe quedar 1.º por tener dos primeros puestos, aunque exista empate o diferencia de suma cercana.
- La columna `1.os` de `#1` debe mostrar `2`.

## Caso 6: empate por suma dentro del top 5

Objetivo: validar que el empate bloquea el cierre oficial.

Tarjetas:

| Juez | 1.º | 2.º | 3.º |
|---|---|---|---|
| J1 | #1 | #2 | #3 |
| J2 | #2 | #1 | #3 |
| J3 | #3 | #1 | #2 |

Resultado esperado:

- Los ejemplares empatados por suma deben aparecer con estado `Empate`.
- El Director Técnico no debe poder cerrar resultado oficial hasta resolver el empate.
- Debe estar disponible la acción para abrir desempate.

## Caso 7: empate fuera de premiación no bloquea cierre

Objetivo: validar que empates completamente fuera del top 5 no bloquean.

Tarjetas:

| Juez | 1.º | 2.º | 3.º | 4.º | 5.º | 6.º | 7.º |
|---|---|---|---|---|---|---|---|
| J1 | #1 | #2 | #3 | #4 | #5 | #6 | #7 |
| J2 | #1 | #2 | #3 | #4 | #5 | #7 | #6 |

Resultado esperado:

- `#6` y `#7` pueden quedar empatados fuera de cinta.
- El resultado oficial debe poder cerrarse si el top 5 está definido.

## Caso 8: cinco jueces, umbral de tres

Objetivo: validar que con 5 jueces el umbral cambia a 3.

Tarjetas:

| Juez | 1.º | 2.º |
|---|---|---|
| J1 | #1 | #2 |
| J2 | #1 | #2 |
| J3 | #1 | Desierto |
| J4 | #2 | Desierto |
| J5 | #2 | Desierto |

Resultado esperado:

- Mayoría requerida: 3 votos.
- `#1` debe ganar 1.º por tres primeros puestos.
- El 2.º debe quedar desierto si tres jueces lo declararon desierto.
- `#2` no debe recibir 2.º si no alcanza la regla aplicable por desierto mayoritario.

## Validaciones de regresión en UI

Revisar en cada prueba:

- Las tarjetas cerradas muestran exactamente los puestos asignados por cada juez.
- Un puesto no asignado no debe confundirse visualmente con una declaración explícita de desierto, salvo que el flujo lo haya guardado como desierto.
- La tabla consolidada no debe mostrar distintivos desiertos sin mayoría reglamentaria, excepto casos documentados y esperados.
- Los ejemplares sin cinta deben aparecer desde el puesto 6 o posterior.
- La columna `Suma` debe reflejar castigo `6` para cada juez que no tuvo en cuenta al ejemplar.
- La columna `1.os` debe contar solo primeros lugares reales.

## Comandos automatizados recomendados

```bash
pnpm --filter @pegasus/functions exec vitest run src/services/judging/scoring.test.ts
pnpm --filter @pegasus/functions build
```

