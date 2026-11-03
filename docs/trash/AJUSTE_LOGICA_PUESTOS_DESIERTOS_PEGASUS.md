# Ajuste de la lógica de puestos desiertos en Pegasus

## 1. Objetivo

Corregir la consolidación de la ronda F2 para que Pegasus respete los puestos que los jueces dejan sin asignar y evite ascender o compactar ejemplares mediante el ordenamiento por suma.

Este documento debe utilizarse como requerimiento funcional y técnico para implementar y verificar el ajuste.

## 2. Contexto funcional

En F2, el juez asigna únicamente los puestos que considera que los ejemplares merecen. No debe existir una acción adicional llamada **“Declarar puesto desierto”**.

El comportamiento esperado es:

- Mientras la tarjeta está abierta, un puesto vacío todavía puede ser editado.
- Al cerrar F2, todo puesto sin ejemplar asignado se convierte automáticamente en un voto de puesto desierto dentro de la tarjeta de ese juez.
- Durante la consolidación, un puesto solamente se asigna cuando un ejemplar cumple la consideración mínima reglamentaria.
- Si ninguna asignación alcanza la consideración mínima, el puesto queda oficialmente **desierto**.
- La suma de puntos no puede llenar un puesto desierto ni ascender a un ejemplar desde un puesto inferior.

### Consideración mínima

| Número de jueces | Consideración mínima |
|---:|---:|
| 1 | 1 juez |
| 3 | 2 jueces |
| 5 | 3 jueces |

## 3. Definiciones

### Puesto asignado

Un puesto está asignado cuando un ejemplar alcanza la consideración mínima necesaria para ocuparlo.

### Puesto desierto en la tarjeta de un juez

Es un puesto que el juez dejó sin ejemplar al cerrar su F2. No requiere un botón ni una acción independiente.

### Puesto oficialmente desierto

Es un puesto para el cual ninguna asignación alcanza la consideración mínima durante la consolidación.

La interfaz debe utilizar el término **“Desierto”**. No debe mostrar “No adjudicado” ni “Sin ejemplar premiable” como resultado oficial.

## 4. Defecto actual

La implementación actual permite cerrar F2 con posiciones vacías, pero estas no se materializan correctamente como votos de puesto desierto. Posteriormente, la consolidación ordena los ejemplares elegibles por suma y los ubica en los espacios disponibles.

Esto produce una compactación incorrecta de los puestos.

### Escenario que demuestra el defecto

Se tienen cuatro ejemplares y tres jueces:

| Juez | 1.º puesto | 2.º puesto |
|---|---|---|
| Juez 1 | Vacío | Ejemplar #1 |
| Juez 2 | Vacío | Ejemplar #1 |
| Juez 3 | Vacío | Vacío |

El ejemplar #1 obtiene:

```text
2 + 2 + 6 = 10
```

El valor `6` corresponde a no haber sido considerado por el tercer juez.

### Resultado incorrecto actual

| Puesto | Resultado |
|---:|---|
| 1.º | Ejemplar #1 |
| 2.º | Vacío o ausente |

El algoritmo interpreta al #1 como el mejor ejemplar elegible y lo asciende al primer puesto.

### Resultado correcto

| Puesto | Resultado |
|---:|---|
| 1.º | **Desierto** |
| 2.º | **Ejemplar #1** |
| 3.º | **Desierto** |
| 4.º | **Desierto** |

El #1 cumple la consideración mínima de 2 de 3 jueces para el segundo puesto y debe permanecer allí. Su suma se conserva para auditoría, pero no autoriza su ascenso al primer puesto.

## 5. Regla de negocio principal

> El juez asigna solamente los puestos que considera merecidos. Al cerrar F2, los puestos sin asignación se registran automáticamente como votos de puesto desierto en su tarjeta. Durante la consolidación, un puesto permanece desierto si ninguna asignación alcanza la consideración mínima. La suma nunca puede llenar, eliminar ni compactar un puesto desierto.

## 6. Flujo esperado

### 6.1 Edición de F2

Mientras la tarjeta se encuentre abierta:

- El juez puede asignar, cambiar o retirar un ejemplar de un puesto.
- Un puesto vacío no debe consolidarse todavía.
- El autoguardado puede conservarlo como vacío o pendiente.
- No debe existir un botón para declarar individualmente el puesto desierto.

### 6.2 Cierre de F2

Antes de cerrar, la interfaz debe informar cuáles puestos quedaron sin asignación.

Mensaje sugerido:

> Los puestos 1.º, 3.º, 4.º y 5.º no tienen ejemplar asignado y se registrarán como desiertos en tu tarjeta. ¿Deseas cerrar F2?

Cuando el juez confirma:

1. El servidor identifica los puestos permitidos de la ronda.
2. Identifica los puestos que sí tienen un ejemplar.
3. Deriva los puestos omitidos.
4. Registra esas omisiones como votos de puesto desierto de la tarjeta cerrada.
5. Conserva la decisión para auditoría.

Este cálculo debe realizarse en el backend, que será la fuente de verdad.

### 6.3 Consolidación

Para cada puesto, en orden:

1. Obtener las decisiones cerradas de todos los jueces.
2. Contar las asignaciones por ejemplar para ese puesto.
3. Determinar si algún ejemplar alcanza la consideración mínima.
4. Si un ejemplar la alcanza, adjudicarle exactamente ese puesto.
5. Si ninguno la alcanza, registrar el puesto como `DESERTED`.
6. Mantener la posición en el resultado oficial, aunque esté desierta.
7. Aplicar las reglas de suma y desempate sin desplazar resultados entre posiciones.

## 7. Ajustes técnicos requeridos

### 7.1 Materializar los puestos omitidos al cerrar F2

En el servicio responsable del cierre de la ronda —actualmente identificado en:

```text
packages/functions/src/services/judging/round.service.ts
```

derivar los puestos sin asignación únicamente al cerrar la tarjeta:

```ts
const assignedPositions = new Set(
  positions.map((item) => item.position),
);

const implicitDesertedPositions = allowedPositions.filter(
  (position) => !assignedPositions.has(position),
);
```

Consideraciones:

- No materializarlos durante cada autoguardado.
- No depender exclusivamente de `desertedPositions` enviado por el frontend.
- Validar que las posiciones asignadas pertenezcan a `allowedPositions`.
- Hacer que el cierre sea idempotente.
- Conservar quién dejó vacío cada puesto y en qué momento cerró la tarjeta.

### 7.2 Backend como fuente de verdad

El frontend puede enviar las asignaciones actuales, pero el backend debe derivar los puestos omitidos comparándolas con el conjunto completo de posiciones permitidas.

Esto evita inconsistencias por:

- Manipulación del payload.
- Omisiones del cliente.
- Diferencias entre operación conectada y offline.
- Versiones antiguas de la interfaz.
- Reintentos del cierre.

### 7.3 Consolidar por posición

Revisar la lógica de:

```text
packages/functions/src/services/judging/scoring.ts
```

La consolidación no debe:

```ts
eligibleHorses
  .sort((a, b) => a.totalScore - b.totalScore)
  .forEach((horse, index) => {
    horse.finalPosition = index + 1;
  });
```

Debe construir el resultado conservando todas las posiciones:

```ts
[
  {
    finalPosition: 1,
    outcomeType: "DESERTED",
    participantId: null,
  },
  {
    finalPosition: 2,
    outcomeType: "AWARDED",
    participantId: "horse-1",
  },
];
```

Reglas:

- No utilizar el índice de una lista ordenada como posición final.
- No eliminar posiciones desiertas.
- No buscar el “siguiente espacio disponible” para insertar un ejemplar.
- No ascender resultados de posiciones inferiores.
- Conservar las sumas originales de F2.
- Mantener separada la excepción reglamentaria 5.e para el quinto puesto.

### 7.4 Modelo de resultados

El resultado oficial puede conservar un modelo como:

```ts
type PositionOutcome =
  | {
      outcomeType: "AWARDED";
      finalPosition: number;
      participantId: string;
      assignedVotes: number;
      minimumRequired: number;
    }
  | {
      outcomeType: "DESERTED";
      finalPosition: number;
      participantId: null;
      reason:
        | "NO_ASSIGNMENTS"
        | "INSUFFICIENT_CONSIDERATION";
      assignedVotes: number;
      minimumRequired: number;
    };
```

La causa puede conservarse internamente para auditoría, pero el término visible debe ser **“Desierto”**.

### 7.5 Eliminar el término “No adjudicado”

Revisar referencias a:

```text
UNAWARDED_INSUFFICIENT_CONSIDERATION
Puesto no adjudicado
No adjudicado
Sin ejemplar premiable
```

Archivos inicialmente identificados:

```text
packages/core/src/entities/judging-rounds.entity.ts
packages/functions/src/services/judging/scoring.ts
packages/functions/src/services/judging/management-contract.ts
packages/web/src/app/staff/categories/[id]/_components/official-result-board.tsx
```

Opciones de migración:

- Eliminar `UNAWARDED_INSUFFICIENT_CONSIDERATION`; o
- Conservar la consideración insuficiente como `reason`, pero utilizar `DESERTED` como `outcomeType`.

Antes de eliminar un valor persistido, revisar migraciones, datos existentes, contratos API, tipos compartidos y compatibilidad con resultados históricos.

### 7.6 Interfaz

La interfaz de F2 debe:

- Permitir que el juez cierre dejando puestos vacíos.
- No incluir una acción llamada “Declarar puesto desierto”.
- Mostrar una confirmación con los puestos omitidos antes del cierre.
- Diferenciar visualmente tarjeta abierta de tarjeta cerrada.
- Mostrar **“Desierto”** en el tablero oficial.
- Permitir consultar, como detalle de auditoría, por qué el puesto quedó desierto.

La acción **“Declarar competencia desierta”** del Director Técnico, si existe y aplica a toda la categoría, es un flujo distinto y no debe confundirse con los puestos individuales de F2.

## 8. Consideraciones sobre la suma

La suma sigue siendo parte del cálculo y debe conservarse. Sin embargo:

- No reemplaza la consideración mínima.
- No define por sí sola la posición final.
- No puede adjudicar un puesto que los jueces no concedieron con la consideración requerida.
- No puede mover al mejor ejemplar disponible hacia el primer puesto.
- Debe utilizarse dentro de los límites de las posiciones realmente concedidas y de las reglas reglamentarias de desempate.

## 9. Casos de prueba obligatorios

### Caso 1: primer puesto desierto y segundo asignado

**Datos**

- 3 jueces.
- 4 ejemplares.
- Los 3 jueces dejan vacío el primer puesto.
- 2 jueces ubican al #1 en segundo.
- El tercer juez no considera al #1.
- Ningún otro ejemplar recibe asignación.

**Resultado esperado**

- 1.º: `DESERTED`.
- 2.º: #1.
- 3.º y 4.º: `DESERTED`.
- Suma del #1: `10`.
- Consideración del #1: `2/3`.
- El #1 no asciende.
- No se abre desempate.

### Caso 2: un juez deja vacío y dos coinciden

| Juez | 1.º puesto |
|---|---|
| Juez 1 | Vacío |
| Juez 2 | #2 |
| Juez 3 | #2 |

**Resultado esperado:** el #2 ocupa el primer puesto porque alcanza consideración de 2/3.

### Caso 3: tres asignaciones diferentes

| Juez | 3.º puesto |
|---|---|
| Juez 1 | #1 |
| Juez 2 | #2 |
| Juez 3 | #3 |

**Resultado esperado:** el tercer puesto queda desierto porque ningún ejemplar alcanza consideración de 2/3, sujeto a cualquier regla reglamentaria especial que aplique expresamente a ese escenario.

### Caso 4: todos dejan vacío

Los tres jueces dejan vacío el cuarto puesto.

**Resultado esperado:** cuarto puesto desierto, con tres votos derivados de las tarjetas cerradas.

### Caso 5: tarjeta abierta

Un juez todavía no ha cerrado su F2 y dejó puestos vacíos.

**Resultado esperado:**

- Los puestos continúan pendientes en esa tarjeta.
- No se consolidan como votos definitivos.
- La categoría no puede cerrarse oficialmente si faltan decisiones requeridas.

### Caso 6: cinco jueces

- Cinco jueces.
- Un ejemplar es asignado al puesto por tres jueces.
- Los otros dos lo dejan vacío.

**Resultado esperado:** el ejemplar ocupa el puesto porque cumple consideración de 3/5.

Repetir con solo dos asignaciones.

**Resultado esperado:** puesto desierto por consideración insuficiente.

### Caso 7: reintento del cierre

Enviar dos veces la misma solicitud de cierre.

**Resultado esperado:**

- No duplicar votos de desierto.
- No duplicar posiciones.
- No alterar sumas.
- Obtener el mismo resultado consolidado.

### Caso 8: convivencia con la regla 5.e

Crear un escenario específico de quinto puesto que active la excepción 5.e.

**Resultado esperado:**

- El ajuste general de puestos desiertos no elimina ni sustituye la regla 5.e.
- La excepción se activa únicamente bajo sus condiciones reglamentarias.
- Los demás puestos conservan su posición.

## 10. Criterios de aceptación

La implementación se considera correcta cuando:

- El juez no necesita una acción adicional para declarar un puesto desierto.
- Los puestos omitidos se derivan al cerrar F2.
- El backend es la fuente de verdad de esas omisiones.
- Un ejemplar solamente recibe un puesto si cumple la consideración mínima para ese puesto.
- Un puesto sin asignación suficiente se muestra oficialmente como **Desierto**.
- La clasificación por suma no compacta los resultados.
- Un ejemplar asignado al segundo puesto no asciende al primero si este quedó desierto.
- Los puestos inferiores tampoco ascienden.
- El resultado oficial conserva todas las posiciones, incluidas las desiertas.
- Las sumas originales permanecen disponibles para auditoría.
- Se conserva la decisión individual de cada juez.
- El cierre y la consolidación son idempotentes.
- Las pruebas cubren escenarios con 1, 3 y 5 jueces.
- La regla 5.e continúa funcionando de manera independiente.
- No se muestran los términos “No adjudicado” o “Sin ejemplar premiable” como resultado oficial.

## 11. Alcance recomendado de la implementación

1. Actualizar y ampliar las pruebas automatizadas antes de modificar el algoritmo.
2. Ajustar el cierre de F2 para materializar las posiciones omitidas.
3. Refactorizar la consolidación para trabajar por posición.
4. Actualizar entidades, tipos, contratos y migraciones.
5. Actualizar el tablero oficial y los mensajes de confirmación.
6. Ejecutar pruebas unitarias, de integración y regresión.
7. Verificar manualmente el caso crítico con los datos reales de Pegasus.

## 12. Fuera de alcance

Este ajuste no debe modificar sin una revisión reglamentaria independiente:

- Las fórmulas de suma.
- La penalización aplicada a ejemplares no considerados.
- La mayoría de primeros puestos.
- El procedimiento y las pruebas opcionales de desempate.
- La excepción 5.e del quinto puesto.
- La declaración de toda la competencia como desierta por parte del Director Técnico.

## 13. Instrucción resumida para Codex

> Corrige la lógica de F2 para que los puestos que un juez deja sin ejemplar al cerrar su tarjeta se registren automáticamente como votos de puesto desierto. Consolida cada posición por separado y adjudícala únicamente cuando un ejemplar alcance la consideración mínima reglamentaria. Si ninguno la alcanza, conserva la posición como `DESERTED`. No ordenes una lista de ejemplares y le asignes posiciones consecutivas, porque esto compacta el resultado y asciende ejemplares incorrectamente. Elimina “No adjudicado” del lenguaje visible, conserva las causas internas para auditoría y añade pruebas con 1, 3 y 5 jueces, incluyendo el caso donde el primer puesto queda desierto y un ejemplar permanece correctamente en el segundo.

