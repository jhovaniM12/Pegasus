# Algoritmo de consolidación F2

Este documento describe cómo está implementado actualmente el cálculo del resultado F2 en Pegasus.

El objetivo es que una persona o un modelo como ChatGPT pueda entender la lógica sin leer el código fuente.

Implementación principal:

- `packages/functions/src/services/judging/scoring.ts`
- Función: `computeF2(cards, judgeCount)`

Pruebas relacionadas:

- `packages/functions/src/services/judging/scoring.test.ts`

Reglamento base:

- `docs/REGLAMENTO_FEDEQUINAS.md:4913-4960`

## Conceptos

### Tarjeta de juez

Cada juez entrega una tarjeta F2 con:

- Puestos asignados a ejemplares.
- Puestos declarados desiertos, si aplica.
- Lista de ejemplares elegibles de la ronda.

Ejemplo:

```ts
{
  judgeUserId: "j1",
  positions: [
    { participantId: "p2", position: 1 },
    { participantId: "p8", position: 2 },
    { participantId: "p4", position: 3 },
    { participantId: "p3", position: 4 },
    { participantId: "p9", position: 5 }
  ],
  desertedPositions: [],
  eligibleParticipantIds: ["p1", "p2", "p3", "p4", "p5", "p6", "p8", "p9"]
}
```

### Puestos premiables

El sistema maneja cinco puestos premiables:

1. Primer puesto
2. Segundo puesto
3. Tercer puesto
4. Cuarto puesto
5. Quinto puesto

La constante usada es:

```ts
MAX_AWARD_POSITIONS = 5
```

### Voto de castigo

Si un juez no asigna puesto a un ejemplar elegible, a ese ejemplar se le suma un puesto de castigo.

Para F2 regular, el castigo es:

```ts
MAX_AWARD_POSITIONS + 1 = 6
```

Ejemplo con tres jueces:

| Ejemplar | J1 | J2 | J3 | Suma |
|---|---:|---:|---:|---:|
| #1 | 1 | no considerado | no considerado | 1 + 6 + 6 = 13 |

El voto de castigo cuenta para la suma, pero no cuenta como "considerado por el juez".

## Reglas del reglamento implementadas

### 1. La suma menor ordena el resultado

Regla base del reglamento:

> La consideración primordial será la suma total, siendo el número menor el primer lugar, y así en orden ascendente.

El sistema suma los puestos de todos los jueces:

- Puestos reales asignados.
- Puestos de castigo para ejemplares no considerados por un juez.

Luego ordena por suma ascendente.

### 2. Mayoría de primeros puestos gana el primer lugar

Si un ejemplar obtiene mayoría de primeros puestos, gana el primer lugar aunque su suma no sea la menor.

Umbrales:

| Número de jueces | Mayoría requerida |
|---:|---:|
| 1 | 1 |
| 2 | 2 |
| 3 | 2 |
| 5 | 3 |

Esta regla solo se usa para resolver el primer puesto.

### 3. Empates por suma bloquean si afectan puestos premiables

Si dos o más ejemplares tienen la misma suma, el sistema marca empate.

El empate bloquea el cierre del resultado oficial si afecta puestos premiables, es decir, si el bloque empatado empieza en puesto 1 a 5.

Ejemplos:

- Empate en puestos 2 y 3: bloquea.
- Empate en puestos 5 y 6: bloquea.
- Empate en puestos 6 y 7: no bloquea.

### 4. Puestos desiertos explícitos

Un puesto solo queda desierto explícitamente si lo declara la mayoría de jueces.

Umbrales:

| Número de jueces | Votos para declarar desierto |
|---:|---:|
| 3 | 2 |
| 5 | 3 |

Ejemplo:

| Juez | 3.º |
|---|---|
| J1 | Desierto |
| J2 | Desierto |
| J3 | #4 |

Resultado:

- El 3.º queda desierto porque 2 de 3 jueces lo declararon desierto.

### 5. Consideración mínima para premiación

Para que un ejemplar sea premiado, debe haber sido considerado por un mínimo de jueces.

Umbrales:

| Número de jueces | Consideración mínima |
|---:|---:|
| 3 | 2 jueces |
| 5 | 3 jueces |

Importante:

- "Considerado" significa que el juez le asignó un puesto real.
- El puesto de castigo no cuenta como consideración.

Ejemplo:

| Ejemplar | J1 | J2 | J3 | Suma | Considerado |
|---|---:|---:|---:|---:|---:|
| #1 | 1 | 6 | 6 | 13 | 1 juez |
| #6 | 6 | 5 | 4 | 15 | 2 jueces |

Aunque `#1` tiene mejor suma que `#6`, `#1` no puede recibir cinta porque solo fue considerado por un juez. `#6` sí puede recibir cinta porque fue considerado por dos jueces.

## Orden actual del algoritmo

La función `computeF2` ejecuta estos pasos:

1. Recibe las tarjetas cerradas de los jueces.
2. Construye el listado completo de ejemplares elegibles.
3. Para cada ejemplar:
   - Suma el puesto asignado por cada juez.
   - Si un juez no lo asignó, suma castigo `6`.
   - Cuenta cuántos jueces lo consideraron realmente.
   - Cuenta cuántos primeros puestos recibió.
4. Calcula el umbral de mayoría según el número de jueces.
5. Detecta si hay ganador por mayoría de primeros puestos.
6. Ordena los ejemplares:
   - Ganador por mayoría de primeros, si existe, primero.
   - Luego por suma ascendente.
   - Luego por cantidad de primeros puestos.
   - Luego por `participantId` para tener orden estable.
7. Cuenta desiertos explícitos por puesto.
8. Asigna puestos premiables 1 a 5:
   - Si el puesto fue declarado desierto por mayoría, lo marca desierto.
   - Si no, busca en el orden de suma al siguiente ejemplar que cumpla consideración mínima.
   - Si el ejemplar no cumple consideración mínima, lo difiere como "sin cinta".
   - Para el quinto puesto aplica una regla especial descrita abajo.
9. Los ejemplares que no recibieron cinta quedan desde el puesto 6 en adelante.
10. Detecta grupos empatados por suma.
11. Marca `hasBlockingTie` si un empate afecta puestos premiables.

## Regla especial actual para el quinto puesto

El reglamento dice:

> Cuando ninguno de los Jueces declare el quinto puesto desierto en sus tarjetas, sino que cada uno de ellos seleccione un ejemplar diferente para el quinto lugar, los ejemplares tomados en cuenta por los Jueces en su Formato volverán a la pista a desempate para definir el quinto puesto.

Interpretación implementada actualmente:

- El quinto puesto también exige consideración mínima.
- Un ejemplar considerado por un solo juez no puede recibir quinto puesto.
- Si no queda ningún candidato restante que cumpla consideración mínima, el quinto queda desierto.
- Si ningún juez declaró explícitamente quinto desierto y varios jueces seleccionaron ejemplares diferentes para quinto, el sistema revisa si esos candidatos cumplen consideración mínima.
- Si hay dos o más candidatos válidos de quinto, se marcan como empate bloqueante para quinto y deben ir a desempate.

En la práctica:

- No asigna quinto automáticamente por un único voto real de quinto.
- Marca desempate de quinto solo si hay varios candidatos válidos.
- Declara quinto desierto si los candidatos restantes no cumplen consideración mínima.

## Ejemplo trabajado: caso reportado

Tarjetas:

| Juez | 1.º | 2.º | 3.º | 4.º | 5.º |
|---|---|---|---|---|---|
| J1 | #2 | #8 | #4 | #3 | #9 |
| J2 | #1 | #3 | #2 | #4 | #6 |
| J3 | #2 | #4 | #3 | #6 | sin asignar |

Se usa castigo `6` cuando un juez no consideró al ejemplar.

| Ejemplar | J1 | J2 | J3 | Suma | Considerado |
|---|---:|---:|---:|---:|---:|
| #2 | 1 | 3 | 1 | 5 | 3 |
| #3 | 4 | 2 | 3 | 9 | 3 |
| #4 | 3 | 4 | 2 | 9 | 3 |
| #1 | 6 | 1 | 6 | 13 | 1 |
| #8 | 2 | 6 | 6 | 14 | 1 |
| #6 | 6 | 5 | 4 | 15 | 2 |
| #9 | 5 | 6 | 6 | 17 | 1 |
| #5 | 6 | 6 | 6 | 18 | 0 |

Orden por suma pura:

1. #2
2. #3 / #4 empatados
3. #1
4. #8
5. #6
6. #9
7. #5

Aplicando consideración mínima:

- `#1` no puede recibir cinta porque solo fue considerado por 1 juez.
- `#8` no puede recibir cinta porque solo fue considerado por 1 juez.
- `#6` sí puede recibir cinta porque fue considerado por 2 jueces.

Resultado actual:

| Puesto | Ejemplar | Motivo |
|---:|---|---|
| 1.º | #2 | Menor suma y mayoría de primeros |
| 2.º | #3 | Empatado por suma con #4 |
| 3.º | #4 | Empatado por suma con #3 |
| 4.º | #6 | Siguiente elegible con consideración mínima |
| 5.º | Desierto | Ningún candidato restante cumple consideración mínima |
| 6.º | #1 | Sin cinta, no cumple consideración mínima |
| 7.º | #8 | Sin cinta, no cumple consideración mínima |
| 8.º | #9 | Sin cinta, no cumple consideración mínima |
| 9.º | #5 | Sin cinta, no fue considerado |

Estado esperado:

- `#3` y `#4` deben quedar como empate bloqueante.
- No debe poder cerrarse el resultado oficial hasta resolver el empate.

## Salida del algoritmo

La función devuelve:

```ts
{
  participants: ScoredParticipant[],
  desertedResults: DesertedPositionResult[],
  hasTie: boolean,
  hasBlockingTie: boolean,
  tiedGroups: TiedGroup[],
  majorityWinnerId: string | null
}
```

### `participants`

Contiene todos los ejemplares elegibles con:

- `participantId`
- `positionSum`
- `firstPlaceVotes`
- `cardsCount`
- `finalPosition`
- `tied`

### `desertedResults`

Contiene puestos desiertos.

Puede tener:

- Desiertos explícitos por mayoría.
- Desiertos por agotamiento, cuando no queda ningún candidato que pueda ocupar el puesto.

### `tiedGroups`

Contiene grupos empatados por suma.

Cada grupo incluye:

- IDs de participantes empatados.
- Suma compartida.
- Puesto inicial del bloque.
- Puesto final del bloque.
- Si bloquea el cierre del resultado oficial.

## Decisiones importantes y puntos a revisar

### Decisión actual: saltar ejemplares sin consideración mínima

Si un ejemplar tiene buena suma pero no cumple consideración mínima, no consume puesto premiable.

Ejemplo:

- `#1` suma 13.
- `#6` suma 15.
- Pero `#1` solo fue considerado por 1 juez.
- Entonces `#6` puede ocupar el puesto premiable.

### Decisión actual: quinto puesto estricto

El quinto puesto no se asigna por el simple hecho de existir un voto real de quinto.

Para recibir quinto, el ejemplar debe cumplir consideración mínima.

Si no queda ningún candidato con consideración mínima, el quinto queda desierto.

### Desempate especial para quinto

El texto del reglamento habla de volver a pista para definir quinto cuando los jueces seleccionan ejemplares diferentes para quinto.

El algoritmo actual:

1. Detecta todos los ejemplares con voto real de quinto.
2. Excluir los que ya recibieron puesto 1 a 4.
3. Excluir los que no cumplen consideración mínima.
4. Si quedan dos o más candidatos, marca empate bloqueante para quinto.
5. El flujo debe abrir desempate de quinto.
6. No se considera definitivo hasta resolverlo.

## Comandos de verificación

```bash
pnpm --filter @pegasus/functions exec vitest run src/services/judging/scoring.test.ts
pnpm --filter @pegasus/functions build
pnpm -C packages/web run build
```
