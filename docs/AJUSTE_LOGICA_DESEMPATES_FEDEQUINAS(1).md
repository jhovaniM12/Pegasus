# Ajuste integral de la lógica de desempates FEDEQUINAS

## Instrucción para Codex

Antes de modificar código, crea una rama nueva a partir de la versión más reciente de `dev` del repositorio `jhovaniM12/Pegasus`.

Nombre sugerido:

```text
fix/fedequinas-tie-break-rules
```

Revisa la implementación actual que detecta y crea los desempates del formato F2. Corrige de manera independiente:

1. Los empates por igualdad de suma que afectan puestos premiables.
2. La excepción especial del quinto puesto prevista en el literal 5.e.

No cambies las reglas de cálculo de la suma original ni otros flujos de juzgamiento que no estén relacionados con este problema.

## Problema actual

La implementación filtra individualmente los ejemplares cuya posición provisional es superior al quinto puesto antes de construir el grupo de desempate.

Esto produce un resultado incorrecto cuando varios ejemplares tienen la misma suma y el grupo completo disputa al menos un puesto premiable.

Caso real:

| Ejemplar | Suma original | Posición provisional |
|---|---:|---:|
| #2 | 12 | 3.º |
| #3 | 12 | 4.º |
| #5 | 12 | 5.º o 6.º, según el orden provisional |

Los tres ejemplares pertenecen a la misma igualdad. El grupo disputa los puestos 3.º, 4.º y 5.º, por lo que los tres deben participar en una única ronda de desempate.

No es correcto incluir solamente a `#2` y `#3` por haber quedado provisionalmente dentro del top 5 y excluir a `#5`.

## Regla que debe implementar el sistema

Se deben abrir únicamente los desempates que afecten la asignación de alguno de los puestos premiables del 1.º al 5.º.

Sin embargo, cuando una igualdad afecta al menos uno de esos puestos, deben participar **todos los ejemplares elegibles que integran el mismo grupo de igualdad**, incluso si alguno recibió provisionalmente una posición superior al quinto puesto.

En términos técnicos:

1. Aplicar primero las reglas de elegibilidad y consideración mínima que correspondan.
2. Ordenar los resultados según la lógica vigente.
3. Agrupar todos los ejemplares elegibles que tengan la misma suma original.
4. Determinar el rango completo de posiciones ocupado por cada grupo:
   - `posiciónInicial`
   - `posiciónFinal = posiciónInicial + cantidadDeIntegrantes - 1`
5. Crear un desempate si el rango del grupo intersecta los puestos premiables `1..5`.
6. Cuando exista intersección, incluir al grupo completo en la ronda.
7. No crear desempates para grupos cuyo rango se encuentre completamente desde el sexto puesto en adelante.

La condición conceptual es:

```ts
const afectaPuestoPremiable =
  posicionInicial <= 5 &&
  posicionFinal >= 1;
```

No debe utilizarse una condición que filtre previamente cada participante con algo equivalente a:

```ts
participante.posicionProvisional <= 5
```

Ese filtro individual es la causa del error.

## Regla independiente: excepción 5.e del quinto puesto

La excepción especial del quinto puesto no es un empate por suma y debe detectarse mediante los votos individuales de los jueces.

No basta con comprobar:

```ts
fifthPlaceVoteIds.size > 1
```

Esa condición también se cumple en escenarios donde dos jueces coinciden en el mismo ejemplar y otro juez elige uno diferente. En ese caso no debe abrirse el desempate especial del literal 5.e; el resultado se determina mediante la suma y las demás reglas ordinarias, sin adjudicar automáticamente el quinto puesto por esa coincidencia.

La excepción solamente aplica cuando se cumplen simultáneamente todas estas condiciones:

1. Ningún juez declaró desierto el quinto puesto.
2. Todos los jueces diligenciaron o seleccionaron un ejemplar para el quinto puesto.
3. Cada juez seleccionó un ejemplar diferente.
4. La cantidad de ejemplares distintos votados para quinto es igual a la cantidad total de jueces que debían votar.
5. La ronda especial incluye exactamente a todos los ejemplares seleccionados por los jueces para el quinto puesto.

Condición conceptual:

```ts
const todosLosJuecesVotaronQuinto =
  votosQuinto.length === cantidadTotalJueces;

const cadaJuezEligioUnEjemplarDiferente =
  fifthPlaceVoteIds.size === cantidadTotalJueces;

const aplicaExcepcionQuintoPuesto =
  declaratoriasDesiertoQuinto === 0 &&
  todosLosJuecesVotaronQuinto &&
  cadaJuezEligioUnEjemplarDiferente;
```

La implementación debe validar además que exista como máximo un voto de quinto puesto por cada juez y que `cantidadTotalJueces` provenga de la composición real de la ronda, no del número de votos recibidos.

### Ejemplos de la excepción 5.e

| Votos de quinto puesto | Resultado esperado |
|---|---|
| J1 → A, J2 → B, J3 → C | Crear una ronda especial con A, B y C |
| J1 → A, J2 → A, J3 → B | No aplicar 5.e; A tiene coincidencia de dos jueces |
| J1 → A, J2 → B, J3 → desierto | No aplicar 5.e |
| J1 → A, J2 → B, J3 sin voto | No aplicar 5.e |
| J1 → A, J2 → A, J3 → A | No aplicar 5.e; adjudicar según la lógica ordinaria |

### Separación respecto de los empates por suma

El bloque especial del literal 5.e debe mantenerse separado de cualquier grupo generado por igualdad de suma:

- No inferir la excepción 5.e a partir de la suma consolidada.
- No añadir al bloque otros ejemplares que no hayan sido votados específicamente para quinto.
- No fusionar el bloque 5.e con un empate por suma, aunque compartan uno o más participantes.
- No agrupar filas únicamente porque tengan estado `TIED`.
- No agrupar filas `TIED` solo por aparecer consecutivas.
- No utilizar la posición visual, el orden de la consulta o la consecutividad de identificadores como identidad del bloque.

Si en la misma categoría existen un empate por suma y la excepción 5.e, se deben representar como grupos independientes, con su tipo, causa e integrantes explícitos. Antes de crear dos rondas que compartan participantes, la implementación debe respetar el orden reglamentario del flujo y evitar que un ejemplar quede simultáneamente asignado a rondas incompatibles. Si el código actual no define esa precedencia, Codex debe reportarlo como supuesto y limitar el cambio a la separación de los grupos, sin inventar una regla reglamentaria.

## Comportamiento esperado

### Caso 1: igualdad que atraviesa el límite del quinto puesto

```text
#2 → suma 12
#3 → suma 12
#5 → suma 12

Rango disputado: 3.º a 5.º
Resultado: abrir una sola ronda con #2, #3 y #5.
```

Si por la forma de numerar posiciones provisionales el último integrante aparece momentáneamente como 6.º, esto no debe excluirlo mientras pertenezca al mismo grupo de suma que comenzó dentro del top 5.

### Caso 2: igualdad en quinto y sexto

```text
#6 → suma 14
#7 → suma 14

Rango disputado: 5.º a 6.º
Resultado: abrir una sola ronda con #6 y #7.
```

La igualdad afecta el quinto puesto; por tanto, ambos participan.

### Caso 3: igualdad completamente fuera de puestos premiables

```text
#6 → suma 14
#7 → suma 14

Rango disputado: 6.º a 7.º
Resultado: no abrir desempate.
```

### Caso 4: igualdad interna al top 5

```text
#2 → suma 10
#3 → suma 10

Rango disputado: 2.º a 3.º
Resultado: abrir una sola ronda con #2 y #3.
```

## Evitar rondas duplicadas

Después de formar el grupo completo, verifica que la lógica no cree simultáneamente:

- una ronda con todos los integrantes del grupo; y
- otra ronda parcial con los integrantes que quedaron provisionalmente dentro del top 5.

Para una misma igualdad por suma y una misma etapa de juzgamiento debe existir una sola ronda pendiente.

La deduplicación debe usar una identidad estable del grupo, por ejemplo:

- feria;
- categoría;
- etapa o ronda de origen;
- suma empatada;
- conjunto normalizado de identificadores de participantes.

No dependas únicamente del orden recibido de los participantes. Normaliza sus identificadores antes de comparar o construir la clave.

La identidad debe incluir también el tipo de desempate, por ejemplo:

```text
SUM_EQUALITY
FIFTH_PLACE_EXCEPTION_5E
```

Esto evita tratar como equivalente un empate por suma y una excepción 5.e que casualmente tengan los mismos participantes.

## Conservación de resultados y trazabilidad

- No modificar la suma obtenida en el F2 original.
- Conservar el F2 original como trazabilidad del resultado que produjo el empate.
- La ronda de desempate debe decidir únicamente el orden definitivo entre los participantes empatados.
- Los ejemplares no incluidos en la igualdad deben conservar su orden relativo.
- No sobrescribir ni eliminar rondas históricas ya resueltas.
- La creación de la ronda debe continuar siendo idempotente: ejecutar nuevamente la detección no puede crear otra ronda equivalente.

## Tratamiento de rondas erróneas ya existentes

La corrección del código resolverá la detección de casos futuros, pero no reparará por sí sola las rondas incorrectas que ya estén pendientes, resueltas o consolidadas.

Codex debe revisar el modelo y proponer un procedimiento separado de saneamiento con estas reglas:

1. Identificar rondas creadas por:
   - un grupo parcial de una igualdad por suma;
   - una agrupación de filas `TIED` consecutivas;
   - la condición insuficiente `fifthPlaceVoteIds.size > 1`;
   - una mezcla entre empate por suma y excepción 5.e;
   - una ronda completa y otra parcial duplicada.
2. Generar primero un reporte de diagnóstico en modo solo lectura con:
   - feria, categoría y etapa;
   - ronda afectada;
   - tipo o causa registrada;
   - participantes actuales;
   - participantes esperados;
   - estado de la ronda;
   - acción sugerida.
3. Para rondas pendientes y sin acciones posteriores, proponer una operación idempotente que permita invalidarlas y regenerarlas de forma segura.
4. Para rondas iniciadas, resueltas o resultados ya consolidados, no modificar, eliminar ni recalcular automáticamente. Requerir revisión funcional, respaldo y autorización explícita.
5. Preservar auditoría de cualquier corrección: motivo, fecha, usuario o proceso, identificador de la ronda anterior y de la nueva ronda.
6. No ejecutar el saneamiento de datos históricos como parte automática de la migración o del despliegue.

La entrega debe separar:

- el cambio de código para casos futuros;
- el diagnóstico de datos existentes;
- el script o procedimiento opcional de reparación.

## Pruebas que se deben agregar o modificar

Ubica las pruebas existentes del helper o servicio encargado de detectar desempates. Si actualmente existe una prueba que espera excluir al integrante provisionalmente ubicado fuera del top 5, corrígela porque formaliza el comportamiento erróneo.

Agrega, como mínimo, estas pruebas:

1. **Incluye el bloque completo cuando la igualdad afecta el top 5**
   - Datos: tres ejemplares con suma `12`.
   - Rango: 3.º a 5.º.
   - Esperado: una sola ronda con los tres identificadores.

2. **Incluye a todos cuando la igualdad cruza el quinto puesto**
   - Datos: dos ejemplares con la misma suma.
   - Rango: 5.º a 6.º.
   - Esperado: una ronda con ambos.

3. **No abre desempate fuera del top 5**
   - Datos: dos ejemplares con la misma suma.
   - Rango: 6.º a 7.º.
   - Esperado: ninguna ronda.

4. **No genera un subgrupo duplicado**
   - Datos: `#2`, `#3` y `#5` con suma `12`.
   - Esperado: exactamente una ronda; no una ronda de tres más otra de dos.

5. **Mantiene la idempotencia**
   - Ejecutar dos veces la detección con los mismos resultados.
   - Esperado: continúa existiendo una sola ronda equivalente.

6. **No altera grupos con sumas diferentes**
   - Los ejemplares con otra suma no deben añadirse a la ronda.

7. **Aplica la excepción 5.e cuando todos eligen ejemplares diferentes**
   - Datos: J1 → A, J2 → B, J3 → C; nadie declara desierto.
   - Esperado: una sola ronda especial con A, B y C.

8. **No aplica 5.e cuando existe coincidencia de dos jueces**
   - Datos: J1 → A, J2 → A, J3 → B.
   - Esperado: no crear una ronda especial 5.e.

9. **No aplica 5.e cuando un juez declara desierto**
   - Datos: J1 → A, J2 → B, J3 → desierto.
   - Esperado: no crear una ronda especial 5.e.

10. **No aplica 5.e cuando falta el voto de un juez**
    - Datos: J1 → A, J2 → B, J3 sin voto.
    - Esperado: no crear una ronda especial 5.e.

11. **No agrupa filas `TIED` por consecutividad**
    - Datos: varias filas consecutivas con estado `TIED`, pero sin igualdad de suma ni condiciones de 5.e.
    - Esperado: no construir un bloque de desempate con ellas.

12. **Mantiene separados los tipos de desempate**
    - Datos: en la misma categoría existe un empate por suma y un caso que cumple 5.e.
    - Esperado: grupos independientes, sin mezclar causas ni participantes ajenos a cada regla.

13. **Diagnóstico histórico sin mutación**
    - Datos: una ronda ya consolidada que fue creada con la lógica errónea.
    - Esperado: reportarla como afectada, sin modificarla automáticamente.

Las aserciones no deben depender del orden de entrada de los identificadores, salvo que el dominio exija expresamente ese orden.

## Criterios de aceptación

El ajuste se considera terminado únicamente si:

- El caso `#2`, `#3` y `#5`, todos con suma `12`, crea una sola ronda con los tres.
- Un grupo que disputa el quinto y sexto puesto incluye a todos sus integrantes.
- Un empate ubicado completamente desde el sexto puesto no crea ronda.
- No se generan rondas completas y parciales para la misma igualdad.
- La excepción 5.e solo se activa cuando ningún juez declara desierto, todos votan quinto y cada juez elige un ejemplar diferente.
- El caso J1 → A, J2 → A, J3 → B no genera una ronda 5.e.
- Los grupos por suma y por excepción 5.e permanecen separados.
- Las filas `TIED` no se agrupan por estado o consecutividad.
- Se conserva la suma y el F2 original.
- La operación sigue siendo idempotente.
- Las rondas históricas incorrectas se diagnostican, pero no se modifican automáticamente.
- Pasan las pruebas específicas de desempates.
- Pasa la suite completa del backend.
- Pasan el chequeo de tipos y el proceso de compilación de los paquetes afectados.

## Entrega solicitada

Al finalizar:

1. Resume la causa raíz encontrada.
2. Indica los archivos modificados.
3. Explica brevemente la nueva condición utilizada para determinar si una igualdad afecta puestos premiables.
4. Reporta las pruebas ejecutadas y sus resultados.
5. Muestra cualquier supuesto o diferencia encontrada frente a estas reglas antes de ampliar el alcance.
6. Deja los cambios en una rama separada creada desde `dev`; no hagas `merge` directo a `dev` ni a `main`.
7. Entrega por separado el reporte de rondas existentes potencialmente afectadas y cualquier script de reparación propuesto.
