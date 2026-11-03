# Pruebas del flujo de juzgamiento FEDEQUINAS

Fecha de ejecución: 22 de julio de 2026  
Rama: `fix/fedequinas-tie-break-rules`

## Objetivo

Validar de forma automatizada y repetible la coherencia del flujo:

`FA → F1 opcional → F2 → detección de empate → desempate → posiciones definitivas`

Las pruebas cubren exclusión de ejemplares descalificados, selección de la ronda posterior,
sumas F2, consideración mínima, empates que afectan puestos premiables y la excepción 5.e.

## Alcance de esta ejecución

Estas son pruebas integradas del dominio: combinan reglas de FA/F1 con el mismo algoritmo
`computeF2` usado por el backend y simulan la aplicación de los resultados del desempate.

No sustituyen todavía una prueba de integración con PostgreSQL, endpoints HTTP, sesiones,
notificaciones push ni navegación PWA. Esas fronteras requieren una base aislada configurada
mediante `TEST_DATABASE_URL`; nunca deben ejecutarse contra producción.

Archivo automatizado:

`packages/functions/src/services/judging/judging-flow-scenarios.test.ts`

Comando:

```bash
pnpm --filter @pegasus/functions test -- src/services/judging/judging-flow-scenarios.test.ts
```

Resultado obtenido:

```text
Test Files  1 passed (1)
Tests       8 passed (8)
```

Suite completa del backend después de excluir las copias compiladas de `dist`:

```text
Test Files  5 passed (5)
Tests       50 passed (50)
```

## Escenario 1 — FA sin sobrevivientes

Preparación:

- Un ejemplar elegible no recibe selección.
- Otro ejemplar seleccionado está descalificado.

Resultado esperado:

- Ningún ejemplar sobrevive.
- No se puede abrir F1 ni F2.
- En el flujo persistido, la categoría debe pasar a `JUDGING_DESERTED`.

Resultado obtenido:

- `0` sobrevivientes.
- La regla de ronda posterior rechaza la apertura por falta de sobrevivientes.
- Aprobado.

## Escenario 2 — Descalificado excluido y paso directo de FA a F2

Preparación:

- Siete ejemplares.
- Seis elegibles y uno descalificado.
- Los jueces incluyen accidentalmente al descalificado en una selección FA.

Resultado esperado:

- El descalificado no aparece en el consolidado.
- Sobreviven seis ejemplares.
- Al ser ocho o menos, la siguiente ronda es F2.
- Una votación F2 coincidente no produce empate.

Resultado obtenido:

- Sobrevivientes: `p1..p6`.
- Siguiente ronda: `F2`.
- `p1` obtiene primero; `p6` queda sexto y sin cinta.
- No se detecta empate bloqueante.
- Aprobado.

## Escenario 3 — FA, F1, empate triple y resolución

Preparación:

- Diez ejemplares iniciales; uno está descalificado.
- Nueve sobreviven al FA, por lo que corresponde F1.
- Siete ejemplares sobreviven al F1 y pasan a F2.
- Las tarjetas F2 reproducen el caso operativo:
  - `p2 = 12`
  - `p3 = 12`
  - `p5 = 12`
  - dos jueces coinciden en el mismo quinto.

Resultado esperado:

- Abrir F1 por existir más de ocho sobrevivientes.
- Después de F1, abrir F2.
- Crear un único bloque por igualdad de suma con `p2`, `p3` y `p5`.
- El bloque disputa los puestos tercero, cuarto y quinto.
- No activar la excepción 5.e.
- Una tarjeta de desempate decisiva asigna tercero, cuarto y quinto.

Resultado obtenido:

- Flujo detectado: `FA → F1 → F2`.
- Bloque: `SUM_EQUALITY`, suma `12`, participantes `p2,p3,p5`, rango `3..5`.
- No se creó bloque `FIFTH_PLACE_EXCEPTION_5E`.
- Resultado del desempate: `p2=3`, `p3=4`, `p5=5`.
- Aprobado.

## Escenario 4 — Descalificación posterior al FA

Preparación:

- Nueve ejemplares sobreviven al FA y pasan a F1.
- `p9` es descalificado antes de consolidar F1.
- Las tarjetas F1 todavía contienen una selección previa de `p9`.

Resultado esperado:

- `p9` debe quedar excluido de los sobrevivientes F1.
- Los otros seis seleccionados pasan a F2.

Resultado obtenido:

- Sobrevivientes F1: `p1..p6`.
- `p9` fue excluido.
- Siguiente ronda: `F2`.
- Aprobado.

## Escenario 5 — No aplica la excepción 5.e por coincidencia

Preparación:

- Juez 1 selecciona `E` como quinto.
- Juez 2 selecciona `E` como quinto.
- Juez 3 selecciona `F` como quinto.

Resultado esperado:

- No aplicar 5.e porque no todos escogieron ejemplares diferentes.
- Resolver el resultado mediante suma y reglas ordinarias.

Resultado obtenido:

- No se creó un bloque `FIFTH_PLACE_EXCEPTION_5E`.
- Aprobado.

## Escenario 6 — Excepción 5.e válida

Preparación:

- Juez 1 selecciona `E` como quinto.
- Juez 2 selecciona `F` como quinto.
- Juez 3 selecciona `G` como quinto.
- Ningún juez declara desierto el quinto.

Resultado esperado:

- Crear un bloque especial único con `E`, `F` y `G`.
- El bloque define el quinto puesto y extiende su rango operativo hasta séptimo.
- Después del desempate solo un ejemplar ocupa quinto.

Resultado obtenido:

- Bloque: `FIFTH_PLACE_EXCEPTION_5E`, participantes `E,F,G`, rango `5..7`.
- Resultado decisivo simulado: `F=5`, `E=6`, `G=7`.
- Aprobado.

## Escenario 7 — El desempate persiste

Preparación:

- Dos ejemplares intercambian tercero y cuarto entre dos jueces.
- La primera tarjeta de desempate conserva la igualdad.
- Una segunda tarjeta obtiene coincidencia de los jueces.

Resultado esperado:

- El primer intento continúa marcado como empate bloqueante.
- No debe cerrarse el resultado oficial.
- El siguiente intento puede resolver las posiciones.

Resultado obtenido:

- Primer intento: empate bloqueante entre `A` y `B`.
- Segundo intento: `A=3`, `B=4`.
- Aprobado.

## Escenario 8 — Empate completamente fuera de premiación

Preparación:

- Los cinco primeros puestos están definidos.
- `F` y `G` tienen la misma suma para sexto y séptimo.

Resultado esperado:

- Registrar la igualdad como información de cálculo.
- No bloquear el cierre y no abrir una ronda de desempate.

Resultado obtenido:

- Grupo ubicado desde el sexto puesto.
- `hasBlockingTie = false`.
- Aprobado.

## Conclusión

Los ocho escenarios produjeron los resultados esperados. El caso operativo que originó el
ajuste quedó cubierto expresamente: la igualdad de suma `12` se conserva como un único bloque
de tres ejemplares y no se crea un desempate especial del quinto cuando dos jueces coinciden.

## Siguiente nivel de validación

Para verificar todo el flujo persistido se recomienda agregar una suite aislada que ejecute:

1. Creación de feria, categoría, personal y ejemplares en una base de pruebas.
2. Inicio y cierre de las tres tarjetas FA.
3. Consolidación FA y validación del estado siguiente.
4. Apertura y consolidación F1 cuando corresponda.
5. Descalificación antes y durante las rondas.
6. Apertura, diligenciamiento y consolidación F2.
7. Creación idempotente del bloque de desempate.
8. Diligenciamiento y consolidación de una o más rondas de desempate.
9. Cierre oficial y validación de resultados, eventos y trazabilidad.

La suite debe abortar si `TEST_DATABASE_URL` no está definida o si apunta a la misma base
configurada en `DATABASE_URL`.
