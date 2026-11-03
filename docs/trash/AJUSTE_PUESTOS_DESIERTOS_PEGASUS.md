# Ajuste de puestos desiertos y no adjudicados en Pegasus

## Objetivo

Corregir la consolidación y presentación de los resultados de juzgamiento para evitar que Pegasus clasifique como **desierto** un puesto que sí fue asignado por uno o más jueces.

La implementación debe distinguir claramente entre:

1. Un puesto **desierto**.
2. Un puesto **no adjudicado por consideración mínima insuficiente**.
3. Un puesto que requiere **desempate**.
4. Un puesto **adjudicado**.

---

## Regla principal obligatoria

El término **“puesto desierto” solo aplica cuando ningún juez asignó ese puesto a un ejemplar**.

Por lo tanto:

- Si al menos un juez asignó el puesto a un ejemplar, Pegasus **no puede** mostrarlo ni persistirlo como desierto.
- Que ningún ejemplar alcance la consideración mínima para recibir el premio **no convierte el puesto en desierto**.
- Si hubo asignaciones, pero ningún ejemplar cumple la consideración mínima y tampoco corresponde realizar un desempate, el puesto debe quedar **no adjudicado**.
- La ausencia de un ejemplar asignado en una tarjeta individual no debe convertirse automáticamente en un voto de puesto desierto.

### Invariante

```text
DESERTED(position) ⇔ ningún juez asignó position a un ejemplar
```

Y, de manera obligatoria:

```text
si assignedVotes(position) > 0, entonces outcome(position) != DESERTED
```

---

## Definición de resultados

### 1. Puesto adjudicado

El puesto se asigna a un ejemplar cuando el resultado consolidado cumple las reglas de consideración mínima y ordenamiento previstas por FEDEQUINAS.

Estado sugerido:

```ts
"AWARDED"
```

### 2. Puesto desierto

El puesto se considera desierto únicamente cuando **ninguno de los jueces lo asignó a un ejemplar**.

Estado sugerido:

```ts
"DESERTED"
```

Este resultado debe cumplir:

```ts
assignedVotes === 0
```

No debe existir un resultado `DESERTED` cuando `assignedVotes > 0`.

### 3. Puesto no adjudicado

Aplica cuando uno o más jueces asignaron el puesto, pero ningún ejemplar puede recibirlo porque no cumple la consideración mínima exigida.

Estado sugerido:

```ts
"UNAWARDED_MINIMUM_CONSIDERATION"
```

Texto recomendado en la interfaz:

> No adjudicado: ningún ejemplar alcanzó la consideración mínima.

Este estado no debe mostrarse como “Puesto desierto”.

### 4. Puesto pendiente de desempate

Aplica cuando las asignaciones de los jueces producen un empate que, según el reglamento, debe resolverse mediante una prueba de desempate.

Estado sugerido:

```ts
"TIE_BREAK_REQUIRED"
```

El algoritmo no debe convertir un empate ni la falta de coincidencia entre jueces en un puesto desierto.

---

## Problemas que se deben corregir

### 1. No generar puestos desiertos automáticamente al cerrar una tarjeta

Revisar:

```text
packages/functions/src/services/judging/round.service.ts
```

En el cierre del formulario F2 no se deben tomar los puestos sin ejemplar y guardarlos automáticamente como desiertos.

Debe eliminarse cualquier lógica equivalente a:

```ts
const autoDeserted = puestosNoAsignados;
```

También debe evitarse reemplazar las decisiones reales del juez por una lista calculada a partir de posiciones vacías.

El cierre de una tarjeta debe conservar exactamente:

- Las posiciones asignadas por el juez.
- Las decisiones explícitas registradas por la interfaz, si el flujo las maneja.
- Los puestos que simplemente quedaron vacíos, sin fabricar una asignación ni modificar la intención del juez.

La clasificación definitiva del puesto como desierto debe realizarse durante la consolidación, verificando que su cantidad total de asignaciones sea cero.

### 2. No utilizar `desertedResults` para puestos no adjudicados

Revisar:

```text
packages/functions/src/services/judging/scoring.ts
```

Actualmente no debe agregarse a `desertedResults` un puesto que tuvo asignaciones, pero quedó sin un candidato con consideración mínima.

Debe eliminarse cualquier comportamiento equivalente a:

```ts
desertedResults.push({
  finalPosition: position,
  votesCount: 0
});
```

cuando la causa real sea la falta de consideración mínima.

Los resultados deben separarse por su significado:

```ts
type PositionOutcomeType =
  | "AWARDED"
  | "DESERTED"
  | "UNAWARDED_MINIMUM_CONSIDERATION"
  | "TIE_BREAK_REQUIRED";
```

### 3. Calcular primero cuántos jueces asignaron cada puesto

Antes de decidir el resultado de una posición, el algoritmo debe calcular:

```ts
const assignmentsForPosition = judgeCards.filter(
  (card) => card.assignedPosition === position
);

const assignedVotes = assignmentsForPosition.length;
```

La decisión debe seguir este orden conceptual:

```ts
if (assignedVotes === 0) {
  return {
    finalPosition: position,
    outcomeType: "DESERTED"
  };
}

if (requiresTieBreak(position, assignmentsForPosition, context)) {
  return {
    finalPosition: position,
    outcomeType: "TIE_BREAK_REQUIRED"
  };
}

const eligibleCandidate = resolveCandidateWithMinimumConsideration(...);

if (!eligibleCandidate) {
  return {
    finalPosition: position,
    outcomeType: "UNAWARDED_MINIMUM_CONSIDERATION"
  };
}

return {
  finalPosition: position,
  outcomeType: "AWARDED",
  participantId: eligibleCandidate.participantId
};
```

La implementación final debe respetar las reglas completas del algoritmo actual y del reglamento; este pseudocódigo define la clasificación del resultado, no reemplaza los criterios de puntuación ni desempate.

---

## Persistencia recomendada

La opción preferida es utilizar una entidad de resultados por posición:

```text
judging_round_position_outcomes
```

Campos mínimos:

```text
id
round_id
final_position
outcome_type
participant_id        nullable
assigned_votes
minimum_required      nullable
created_at
updated_at
```

Restricciones recomendadas:

```text
UNIQUE (round_id, final_position)
```

Reglas de integridad:

- `participant_id` es obligatorio cuando `outcome_type = AWARDED`.
- `participant_id` debe ser nulo para `DESERTED` y `UNAWARDED_MINIMUM_CONSIDERATION`.
- `assigned_votes` debe ser `0` cuando `outcome_type = DESERTED`.
- `assigned_votes` debe ser mayor que `0` cuando `outcome_type = UNAWARDED_MINIMUM_CONSIDERATION`.

Si no se desea realizar una migración unificada, se puede:

- Conservar `judging_round_deserted_results` exclusivamente para puestos realmente desiertos.
- Crear `judging_round_unawarded_results` para posiciones no adjudicadas.
- Mantener los empates en la estructura existente.

En ningún caso se debe persistir un puesto no adjudicado dentro de la colección o tabla de puestos desiertos.

---

## Respuesta del backend

La API debe devolver el tipo real de resultado por posición. Ejemplo:

```json
{
  "finalPosition": 4,
  "outcomeType": "UNAWARDED_MINIMUM_CONSIDERATION",
  "participantId": null,
  "assignedVotes": 3,
  "minimumRequired": 2
}
```

Ejemplo de un puesto desierto:

```json
{
  "finalPosition": 5,
  "outcomeType": "DESERTED",
  "participantId": null,
  "assignedVotes": 0
}
```

No se debe inferir el texto mostrado al usuario solamente a partir de que `participantId` sea nulo.

---

## Ajuste en el frontend

La interfaz debe presentar cada resultado según `outcomeType`:

| Tipo | Etiqueta | Descripción |
|---|---|---|
| `AWARDED` | Puesto adjudicado | Mostrar ejemplar y resultado |
| `DESERTED` | Puesto desierto | Ningún juez asignó este puesto |
| `UNAWARDED_MINIMUM_CONSIDERATION` | Puesto no adjudicado | Ningún ejemplar alcanzó la consideración mínima |
| `TIE_BREAK_REQUIRED` | Desempate requerido | El puesto debe resolverse mediante desempate |

No utilizar una condición genérica como:

```ts
if (!participantId) {
  return "Puesto desierto";
}
```

Debe utilizarse el tipo explícito:

```ts
switch (outcomeType) {
  case "DESERTED":
    return "Puesto desierto";
  case "UNAWARDED_MINIMUM_CONSIDERATION":
    return "Puesto no adjudicado";
  case "TIE_BREAK_REQUIRED":
    return "Desempate requerido";
  default:
    return renderAwardedParticipant();
}
```

---

## Casos de aceptación obligatorios

### Caso 1: ningún juez asignó el puesto

| Juez 1 | Juez 2 | Juez 3 | Resultado |
|---|---|---|---|
| Sin asignación | Sin asignación | Sin asignación | `DESERTED` |

Resultado visible:

> Puesto desierto.

### Caso 2: solo un juez asignó el puesto

| Juez 1 | Juez 2 | Juez 3 | Resultado |
|---|---|---|---|
| Ejemplar #7 | Sin asignación | Sin asignación | Nunca `DESERTED` |

Si el ejemplar no cumple la consideración mínima:

```text
UNAWARDED_MINIMUM_CONSIDERATION
```

Resultado visible:

> Puesto no adjudicado: ningún ejemplar alcanzó la consideración mínima.

### Caso 3: dos jueces asignaron el puesto al mismo ejemplar

| Juez 1 | Juez 2 | Juez 3 | Resultado |
|---|---|---|---|
| Ejemplar #7 | Ejemplar #7 | Sin asignación | `AWARDED` al #7 |

### Caso 4: los tres jueces asignaron el puesto a ejemplares diferentes

| Juez 1 | Juez 2 | Juez 3 | Resultado |
|---|---|---|---|
| Ejemplar #1 | Ejemplar #2 | Ejemplar #3 | Evaluar `TIE_BREAK_REQUIRED`; nunca `DESERTED` |

### Caso 5: existen asignaciones, pero ningún ejemplar cumple el mínimo

| Puesto | Asignaciones totales | Candidato elegible | Resultado |
|---|---:|---|---|
| 4.º | Mayor que 0 | No | `UNAWARDED_MINIMUM_CONSIDERATION` |

### Caso 6: cierre de tarjeta con posiciones vacías

Al cerrar una tarjeta:

- No se deben crear votos automáticos de desierto.
- No se deben borrar decisiones explícitas previamente guardadas.
- Las posiciones vacías deben permanecer vacías.
- La consolidación posterior debe decidir el resultado con base en las tarjetas de todos los jueces.

---

## Pruebas automatizadas requeridas

Agregar o actualizar pruebas unitarias y de integración para validar:

1. `assignedVotes === 0` produce `DESERTED`.
2. `assignedVotes > 0` nunca produce `DESERTED`.
3. Una sola asignación sin consideración mínima produce `UNAWARDED_MINIMUM_CONSIDERATION`.
4. Dos de tres jueces asignando el mismo ejemplar permiten adjudicarlo cuando cumple las demás reglas.
5. Tres asignaciones a ejemplares distintos activan la regla de desempate correspondiente.
6. Cerrar una tarjeta con puestos vacíos no crea registros automáticos de desierto.
7. La API diferencia `DESERTED` de `UNAWARDED_MINIMUM_CONSIDERATION`.
8. El frontend muestra etiquetas distintas para ambos resultados.
9. La persistencia rechaza o evita un `DESERTED` con `assigned_votes > 0`.
10. Recalcular una ronda es idempotente y no duplica resultados por posición.

---

## Criterios de finalización

El ajuste se considera terminado cuando:

- Ningún puesto asignado por al menos un juez aparece como desierto.
- Los puestos sin consideración mínima aparecen como no adjudicados.
- Los puestos que requieren desempate no aparecen como desiertos.
- El cierre de una tarjeta no fabrica votos de desierto.
- Backend, persistencia y frontend utilizan el mismo significado para cada estado.
- Las pruebas cubren los escenarios definidos en este documento.
- Se conserva el comportamiento correcto de puntuación, sumatoria, desempates y adjudicación existente.

---

## Instrucción final para Codex

Revisa la implementación actual en la rama `main` del repositorio Pegasus, identifica todos los puntos donde una posición vacía o sin candidato elegible se convierte en “desierta” y realiza el ajuste completo.

No limites el cambio al texto del frontend. Corrige el origen del estado en:

1. Cierre de tarjetas.
2. Consolidación F2.
3. Persistencia.
4. Contrato de la API.
5. Presentación en el frontend.
6. Pruebas automatizadas.

La regla que no puede violarse es:

> **Si al menos un juez asignó el puesto a un ejemplar, ese puesto no es desierto.**

