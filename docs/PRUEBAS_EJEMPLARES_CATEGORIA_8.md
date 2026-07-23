# Pruebas operativas con ejemplares reales — categoría de 8

Fecha: 23 de julio de 2026  
Rama: `fix/fedequinas-tie-break-rules`  
Contexto: categoría con 8 ejemplares en pre-pista.

## Roster

| # | Ejemplar | Alias en escenarios |
|---|---|---|
| 1 | Wilson David González Peñuela | `#1` |
| 2 | Duvan Armando Romero Cárdenas | `#2` |
| 3 | Danilo Romero Marín | `#3` |
| 4 | Brayhan Alonso López Bautista | `#4` |
| 5 | Juan Esteban Puerta Vélez | `#5` |
| 6 | Johan Sebastián Gómez Castañeda | `#6` |
| 7 | Alexander Mota | `#7` |
| 8 | Jeferson Andrés Mendoza De La Ossa | `#8` |

## Reglas de bifurcación relevantes

- Tras consolidar FA:
  - ≤ 8 sobrevivientes → F2 directo
  - > 8 sobrevivientes → F1
- Con estos 8 ejemplares, si todos pasan FA, la siguiente ronda es F2.
- Desempates solo se abren para bloques que afectan puestos 1.º–5.º.

## Prerrequisito técnico

Antes de pruebas reales en DB:

```bash
pnpm migration:run
```

---

## Prueba P0 — Pre-pista base

### Preparación

1. Aprobar los 8 ejemplares en pre-pista.
2. Cerrar pre-pista.
3. Iniciar juzgamiento (FA).

### Resultado esperado

- Contador: `8/8 revisados`.
- Estado: `JUDGING_STARTED`.
- Los 8 quedan elegibles para FA.

### Resultado obtenido

- [ ] Aprobado
- [ ] Falló — notas:

---

## Prueba P1 — FA completo sin descalificados → F2 directo

### Preparación

Cada juez selecciona al menos estos 8 (o el máximo permitido ≤10) y cierra FA.

### Acciones

1. Cerrar FA de los 3 jueces.
2. Consolidar FA.
3. Abrir siguiente ronda.

### Resultado esperado

- Sobrevivientes FA: `#1` … `#8` (8).
- Estado: `FA_CONSOLIDATED`.
- Siguiente ronda: **F2** (no F1).
- Estado tras abrir: `F2_IN_PROGRESS`.

### Resultado obtenido

- [ ] Aprobado
- [ ] Falló — notas:

---

## Prueba P2 — Descalificación en FA

### Preparación

Durante FA, descalificar `#8` (Jeferson Andrés Mendoza).

### Acciones

1. Un juez descalifica `#8` con motivo oficial.
2. Los demás jueces cierran FA.
3. Consolidar FA.
4. Abrir siguiente ronda.

### Resultado esperado

- `#8` no aparece en consolidado FA.
- Sobrevivientes: 7 (`#1`…`#7`).
- Siguiente ronda: **F2**.
- Cualquier intento de seleccionar `#8` en F2 debe fallar o no estar disponible.

### Resultado obtenido

- [ ] Aprobado
- [ ] Falló — notas:

---

## Prueba P3 — FA con 0 sobrevivientes → desierta

### Preparación

Descalificar o descartar a todos; ningún elegible queda seleccionado.

### Resultado esperado

- Al consolidar FA: `JUDGING_DESERTED`.
- No se puede abrir F1 ni F2.

### Resultado obtenido

- [ ] Aprobado
- [ ] Falló — notas:

---

## Prueba P4 — F2 sin empate → cierre oficial

### Preparación

Usar roster completo `#1`…`#8` en F2.

### Tarjetas sugeridas (3 jueces)

| Juez | 1.º | 2.º | 3.º | 4.º | 5.º |
|---|---|---|---|---|---|
| Juez 1 | `#1` | `#4` | `#2` | `#3` | `#6` |
| Juez 2 | `#1` | `#4` | `#2` | `#3` | `#6` |
| Juez 3 | `#1` | `#4` | `#2` | `#3` | `#6` |

(Los no puntuados reciben castigo 6.)

### Resultado esperado

- Sumas distintas en top 5.
- Sin empate bloqueante.
- Tras consolidar F2: botón **Cerrar resultado oficial** disponible.
- Tras cerrar: `JUDGING_CLOSED`.

### Resultado obtenido

- [ ] Aprobado
- [ ] Falló — notas:

---

## Prueba P5 — Empate por suma en 3.º–5.º (caso operativo)

### Objetivo

Reproducir el bug corregido: igualdad de suma que atraviesa el quinto puesto.

### Tarjetas F2 sugeridas

| Juez | 1.º | 2.º | 3.º | 4.º | 5.º | Observación |
|---|---|---|---|---|---|---|
| Juez Dos | `#1` | — | `#2` | `#5` | `#7` | 2.º desierto |
| Juez Tres | `#4` | `#5` | `#6` | `#3` | `#7` | |
| Juez Uno | `#1` | `#3` | `#2` | `#4` | `#6` | |

### Sumas esperadas (con castigo 6)

| Ejemplar | Cálculo | Suma |
|---|---|---:|
| `#1` | 1+6+1 | 8 |
| `#4` | 6+1+4 | 11 |
| `#2` | 3+6+3 | 12 |
| `#3` | 6+4+2 | 12 |
| `#5` | 4+2+6 | 12 |
| `#6` | 5+3+5 | 13 |
| `#7` | 5+5+6 | 16 |
| `#8` | 6+6+6 | 18 |

### Resultado esperado al consolidar F2

- Bloque único `SUM_EQUALITY` con `#2`, `#3`, `#5`.
- Rango disputado: 3.º–5.º.
- Panel: “Empate por puestos 3°–5°” con `#2`, `#3`, `#5`.
- **No** aplicar excepción 5.e (porque dos jueces coinciden en `#7` como quinto).
- `#6` y `#7` no deben entrar a ese desempate.

### Acciones de desempate

1. Abrir ronda con prueba opcional (ej. Doble tabla).
2. Los 3 jueces ordenan, por ejemplo:
   - 3.º `#2`, 4.º `#3`, 5.º `#5`.
3. Consolidar desempate.
4. Cerrar resultado oficial.

### Resultado esperado tras desempate

- Oficial compuesto: `#2` 3.º, `#3` 4.º, `#5` 5.º.
- Estado de esas filas: “Resuelto por desempate”.
- F2 original conserva sumas 12.
- Cierre oficial permitido.

### Resultado obtenido

- [ ] Aprobado
- [ ] Falló — notas:

---

## Prueba P6 — No inventar empate del quinto (anti-regresión)

### Preparación

Tras P5, o con tarjetas donde dos jueces dan quinto a `#7` y uno a `#6`.

### Resultado esperado

- No debe aparecer:
  - “Empate por puestos 5°–6°” solo por sumas distintas.
  - Bloque 3.º–7.º mezclando `#2,#3,#5,#6,#7`.
- Si hay empate real, solo el grupo completo por suma (`#2,#3,#5`).

### Resultado obtenido

- [ ] Aprobado
- [ ] Falló — notas:

---

## Prueba P7 — Excepción 5.e válida

### Tarjetas F2 sugeridas

| Juez | 1.º | 2.º | 3.º | 4.º | 5.º |
|---|---|---|---|---|---|
| Juez 1 | `#1` | `#4` | `#2` | `#3` | `#5` |
| Juez 2 | `#1` | `#4` | `#2` | `#3` | `#6` |
| Juez 3 | `#1` | `#4` | `#2` | `#3` | `#7` |

Ningún juez declara desierto el quinto.

### Resultado esperado

- Bloque especial `FIFTH_PLACE_EXCEPTION_5E` con `#5`, `#6`, `#7`.
- Copy UI: “Desempate especial para definir el quinto puesto”.
- Tras desempate decisivo (ej. `#6` quinto, `#5` sexto, `#7` séptimo):
  - Solo uno ocupa el quinto.
  - Los otros quedan sin cinta / fuera de premiación según rango.

### Resultado obtenido

- [ ] Aprobado
- [ ] Falló — notas:

---

## Prueba P8 — 5.e no aplica por coincidencia

### Tarjetas

| Juez | 5.º |
|---|---|
| Juez 1 | `#6` |
| Juez 2 | `#6` |
| Juez 3 | `#7` |

### Resultado esperado

- No crear bloque 5.e.
- Resolver con suma y reglas ordinarias.
- `#6` no debe marcarse “Empate” solo por esa coincidencia parcial.

### Resultado obtenido

- [ ] Aprobado
- [ ] Falló — notas:

---

## Prueba P9 — Empate 6.º–7.º no abre desempate

### Preparación

Top 5 definido y estable; solo `#7` y `#8` empatan fuera de premiación.

### Resultado esperado

- `hasBlockingTie = false` (a nivel de producto: sin panel de desempate).
- Botón de cierre oficial disponible.
- No abrir ronda por puestos 6–7.

### Resultado obtenido

- [ ] Aprobado
- [ ] Falló — notas:

---

## Prueba P10 — Descalificación durante F2

### Preparación

Con F2 abierta, descalificar `#5` antes de cerrar tarjetas.

### Resultado esperado

- `#5` queda fuera del cómputo.
- Se limpia de las tarjetas de los jueces.
- Consolidación F2 no lo incluye como premiable.

### Resultado obtenido

- [ ] Aprobado
- [ ] Falló — notas:

---

## Prueba P11 — Desempate que vuelve a empatar

### Preparación

Abrir desempate de `#2` y `#3` (o el bloque pendiente).

### Acciones

1. Primera ronda de desempate: jueces intercambian puestos → sigue empatado.
2. Consolidar.
3. Abrir segunda ronda.
4. Segunda ronda decisiva.

### Resultado esperado

- Tras el primer desempate: sigue bloque pendiente.
- No permitir cierre oficial.
- Tras el segundo: bloque resuelto y cierre permitido.
- Secuencia de desempates: `#1`, luego `#2`.

### Resultado obtenido

- [ ] Aprobado
- [ ] Falló — notas:

---

## Prueba P12 — Idempotencia al abrir desempate

### Acciones

Con empate pendiente, intentar abrir dos veces el desempate (doble clic / dos requests).

### Resultado esperado

- Solo una ronda `TIE_BREAK` abierta.
- No duplicar formularios.

### Resultado obtenido

- [ ] Aprobado
- [ ] Falló — notas:

---

## Matriz rápida de decisión (con este roster de 8)

| Situación | ¿F1? | ¿F2? | ¿Desempate? |
|---|---|---|---|
| 8 aprobados en FA | No | Sí | Solo si F2 genera bloque top 5 |
| Descalifican 1 en FA → 7 | No | Sí | Depende de F2 |
| Empate `#2,#3,#5` suma 12 | — | Sí | Sí, un solo bloque de 3 |
| Quintos distintos `#5,#6,#7` | — | Sí | Sí, bloque 5.e |
| Empate solo `#7,#8` fuera top 5 | — | Sí | No |

## Checklist de coherencia visual

Al consolidar F2, verificar:

- [ ] No aparece “Empate” en un puesto con suma única sin causa 5.e.
- [ ] No aparece bloque 3.º–7.º artificial.
- [ ] El panel lista exactamente los track positions del bloque.
- [ ] Tras resolver, el consolidado F2 muestra “Resuelto por desempate” solo en el grupo resuelto.
- [ ] Los nombres con `ñ` se ven correctamente (revisar encoding de `#1` y `#6`).

## Observación de UI detectada en pre-pista

En capturas recientes aparecen:

- `#1` como `PEÏ¿½UELA` (debería ser Peñuela)
- `#6` como `CASTAÏ¿½EDA` (debería ser Castañeda)

Registrar si es bug de encoding en sync/seed/render; no bloquea las pruebas de desempate, pero sí la calidad operativa.

## Resumen de ejecución

| ID | Escenario | Estado | Notas |
|---|---|---|---|
| P0 | Pre-pista 8/8 | ⬜ | |
| P1 | FA → F2 directo | ⬜ | |
| P2 | Descalificación FA `#8` | ⬜ | |
| P3 | FA desierta | ⬜ | |
| P4 | F2 sin empate | ⬜ | |
| P5 | Empate `#2,#3,#5` | ⬜ | Caso crítico |
| P6 | Anti-regresión quinto falso | ⬜ | |
| P7 | Excepción 5.e | ⬜ | |
| P8 | 5.e inválida | ⬜ | |
| P9 | Empate fuera top 5 | ⬜ | |
| P10 | Descalificación en F2 | ⬜ | |
| P11 | Desempate persistente | ⬜ | |
| P12 | Idempotencia | ⬜ | |
