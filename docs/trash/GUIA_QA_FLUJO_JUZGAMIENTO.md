# Guía de QA — Flujo de juzgamiento Pegasus

Documento operativo para validar manualmente en QA el comportamiento esperado de la aplicación,
etapa por etapa: cuántos ejemplares avanzan, a qué estado pasa la categoría y qué debe verse en
pantalla.

Complementa a `MATRIZ_REGLAMENTARIA_JUZGAMIENTO.md` (contrato regla ↔ código) y a
`PRUEBAS_FLUJO_JUZGAMIENTO_FEDEQUINAS.md` (escenarios automatizados de dominio). Esta guía es
para pruebas **manuales end-to-end** con datos reales en un ambiente de QA.

---

## 1. Preparación del ambiente

### Usuarios necesarios

| Rol | Código interno | Para qué se necesita |
|-----|----------------|----------------------|
| Veterinario | `Z` | Diligenciar y cerrar la pre-pista |
| Juez | `2` | Diligenciar tarjetas FA, F1, F2 y desempate |
| Director Técnico | `3` | Iniciar etapas, consolidar, abrir desempates, cerrar |

El panel debe tener **1, 3 o 5 jueces**. Con 2 jueces solo funciona en Grado B alternado (un juez
activo por categoría). Con 2 fuera de Grado B, o con 4, la aplicación debe **rechazar** la
operación con un mensaje de panel no reglamentario.

### Reiniciar una categoría

El Director Técnico puede reiniciar una categoría a `NOT_STARTED` desde la pantalla de gestión.
Está disponible en todos los ambientes, incluido producción, y es la forma recomendada de repetir
un caso de prueba sin recrear la feria.

### Antes de empezar cada caso

1. Anota cuántos ejemplares hay inscritos en la categoría.
2. Reinicia la categoría.
3. Verifica que el estado inicial sea **Sin iniciar** (`NOT_STARTED`).

---

## 2. Tabla de referencia rápida

Estos son los números que gobiernan el avance entre etapas. Cualquier desviación es un defecto.

| Concepto | Valor | Aplica en |
|----------|-------|-----------|
| Máximo de selecciones por juez en FA | **10** | Tarjeta FA |
| Umbral para abrir F1 | Sobrevivientes FA **mayor que 8** | Al abrir ronda tras FA |
| Máximo de selecciones por juez en F1 | **7** | Tarjeta F1 |
| Puestos premiables en F2 | **1 al 5** | Consolidado F2 |
| Voto de castigo (no puntuado por un juez) | Posición **6** | Cálculo F2 |
| Mayoría con 1 juez | 1 voto | Desierto, hiperflexión, mayoría de primeros |
| Mayoría con 3 jueces | 2 votos | Desierto, hiperflexión, mayoría de primeros |
| Mayoría con 5 jueces | 3 votos | Desierto, hiperflexión, mayoría de primeros |

> Nota: FA=10 y castigo=6 son **excepciones operativas conocidas** de Pegasus. El reglamento
> contempla 15 en Campeonato Joven y castigo 6 o 7 según categoría. Las categorías afectadas no
> pueden reportarse como certificación reglamentaria completa.

---

## 3. Estados de la categoría

| Estado | Qué significa | Quién lo produce |
|--------|---------------|------------------|
| `NOT_STARTED` | Sin iniciar | Estado inicial o reinicio |
| `PRE_RING_STARTED` | Pre-pista abierta, veterinario diligenciando | Director Técnico |
| `PRE_RING_CLOSED` | Pre-pista cerrada, lista para juzgar | Veterinario |
| `JUDGING_STARTED` | Tarjetas FA abiertas | Director Técnico |
| `FA_CONSOLIDATED` | FA consolidado, se puede abrir la siguiente ronda | Director Técnico |
| `F1_IN_PROGRESS` | Tarjetas F1 abiertas | Director Técnico |
| `F1_CONSOLIDATED` | F1 consolidado, se puede abrir F2 | Director Técnico |
| `F2_IN_PROGRESS` | F2 abierta **o** ya consolidada esperando desempate o cierre | Director Técnico |
| `TIE_BREAK_IN_PROGRESS` | Ronda de desempate abierta | Director Técnico |
| `JUDGING_DESERTED` | Competencia desierta, sin premiación | Director Técnico |
| `JUDGING_CLOSED` | Resultado oficial cerrado | Director Técnico |

Detalle importante para QA: **no existe un estado `F2_CONSOLIDATED`**. Al consolidar F2, y también
al consolidar un desempate, la categoría permanece o vuelve a `F2_IN_PROGRESS`. Lo que cambia es el
estado de la *ronda*, no el de la categoría. No lo reportes como defecto.

---

## 4. Ejemplo completo trabajado

Caso de referencia con 3 jueces y 20 ejemplares inscritos. Úsalo como plantilla mental para
construir tus propios casos.

| Etapa | Entran | Qué pasa | Salen | Estado resultante |
|-------|--------|----------|-------|-------------------|
| Pre-pista | 20 inscritos | 18 aprobados, 1 rechazado, 1 ausente | 18 | `PRE_RING_CLOSED` |
| FA | 18 | Cada juez selecciona hasta 10; la unión de los tres da 11 | 11 | `FA_CONSOLIDATED` |
| Apertura de ronda | 11 | 11 es mayor que 8, corresponde **F1** | — | `F1_IN_PROGRESS` |
| F1 | 11 | Cada juez selecciona hasta 7; la unión da 7 | 7 | `F1_CONSOLIDATED` |
| Apertura de ronda | 7 | Siempre F2 después de F1 | — | `F2_IN_PROGRESS` |
| F2 | 7 | Ranking completo; puestos 1 a 5 premiados; el resto desde 6 | 5 premiados | `F2_IN_PROGRESS` |
| Cierre | — | Sin empates bloqueantes | Resultado oficial | `JUDGING_CLOSED` |

Variante sin F1: si del FA sobreviven 8 o menos, la aplicación debe abrir **F2 directamente** y la
categoría pasa de `FA_CONSOLIDATED` a `F2_IN_PROGRESS` sin pasar por F1.

---

## 5. Casos de prueba por etapa

### QA-01 · Pre-pista: solo los aprobados avanzan

**Precondición:** categoría en `NOT_STARTED` con al menos 5 ejemplares inscritos.

**Pasos:**
1. Director Técnico inicia la pre-pista.
2. Veterinario marca: 3 aprobados, 1 rechazado, 1 ausente.
3. Veterinario cierra la pre-pista.
4. Director Técnico inicia el juzgamiento.

**Resultado esperado:**
- Tras el paso 1, el estado es `PRE_RING_STARTED`.
- El cierre de pre-pista se **rechaza** si queda algún ejemplar en pendiente.
- Tras el paso 3, el estado es `PRE_RING_CLOSED`.
- Tras el paso 4, las tarjetas FA contienen **exactamente 3 ejemplares**. El rechazado y el ausente
  no aparecen en ninguna tarjeta.

---

### QA-02 · Pre-pista sin aprobados

**Precondición:** categoría en `PRE_RING_STARTED`.

**Pasos:** el veterinario rechaza o marca ausente a todos los ejemplares y cierra la pre-pista.
Luego el Director Técnico intenta iniciar el juzgamiento.

**Resultado esperado:** la aplicación **impide** iniciar el juzgamiento porque no hay ejemplares
aprobados. Debe mostrar un mensaje claro, no un error genérico.

---

### QA-03 · FA con más de 8 sobrevivientes abre F1

**Precondición:** 12 ejemplares aprobados en pre-pista, panel de 3 jueces.

**Pasos:**
1. Cada juez abre su tarjeta FA y selecciona ejemplares (respetando el máximo de 10).
2. Coordina las selecciones para que la unión de los tres jueces sea de **9 ejemplares**.
3. Los tres jueces cierran su tarjeta.
4. Director Técnico consolida FA.
5. Director Técnico abre la siguiente ronda.

**Resultado esperado:**
- Al intentar seleccionar un ejemplar número 11 en una tarjeta, la aplicación lo **bloquea**.
- La consolidación se **rechaza** mientras algún juez tenga la tarjeta abierta.
- El consolidado FA muestra **9 sobrevivientes**: un ejemplar sobrevive si **al menos un juez** lo
  seleccionó, no se requiere mayoría.
- Estado tras consolidar: `FA_CONSOLIDATED`.
- La ronda que se abre es **F1** y el estado pasa a `F1_IN_PROGRESS`.

---

### QA-04 · FA con 8 o menos sobrevivientes salta directo a F2

**Precondición:** igual al anterior.

**Pasos:** coordina las selecciones para que la unión sea de **8 ejemplares**. Consolida y abre la
siguiente ronda.

**Resultado esperado:** la ronda que se abre es **F2**, no F1. El estado pasa a `F2_IN_PROGRESS`.
Repite con 7 y con 8 para confirmar el límite exacto: 8 va a F2, 9 va a F1.

---

### QA-05 · FA sin sobrevivientes declara desierta la categoría

**Pasos:** los tres jueces cierran su tarjeta FA sin seleccionar a nadie. Director Técnico
consolida.

**Resultado esperado:** la categoría pasa directamente a `JUDGING_DESERTED`. No se ofrece abrir
ninguna ronda.

---

### QA-06 · F1 respeta el máximo de 7 y la unión define el paso a F2

**Precondición:** categoría en `F1_IN_PROGRESS` con 11 ejemplares.

**Pasos:**
1. Cada juez selecciona en su tarjeta F1.
2. Intenta seleccionar un octavo ejemplar en una tarjeta.
3. Cierra las tres tarjetas y consolida.

**Resultado esperado:**
- La octava selección se **bloquea**.
- Sobreviven los ejemplares con **al menos un voto**. Si los jueces no coinciden, la unión puede
  superar 7 y eso es correcto: el tope de 7 es por tarjeta, no por consolidado.
- Estado: `F1_CONSOLIDATED`. La siguiente ronda siempre es F2.

---

### QA-07 · F2 asigna puestos, castigo y no premiados

**Precondición:** categoría en `F2_IN_PROGRESS` con 7 ejemplares y 3 jueces.

**Pasos:** cada juez asigna puestos 1 a 5 en su tarjeta y deja 2 ejemplares sin puntuar. Cierra las
tres tarjetas y consolida.

**Resultado esperado:**
- Los ejemplares no puntuados por un juez reciben automáticamente **posición 6** en esa tarjeta.
- **Todos** los ejemplares aparecen en el consolidado, no solo los premiados.
- Gana quien tenga la **menor suma** de posiciones.
- Solo los puestos **1 a 5** reciben cinta. Del 6 en adelante se muestran sin premio.
- El estado de la categoría sigue siendo `F2_IN_PROGRESS`.

---

### QA-08 · Mayoría de primeros lugares

**Pasos:** con 3 jueces, haz que **2 de 3** coloquen al mismo ejemplar en primer lugar, aunque su
suma no sea la menor.

**Resultado esperado:** ese ejemplar obtiene el **primer puesto** por mayoría de primeros, por
encima del criterio de suma. Con 5 jueces la mayoría requerida es 3.

---

### QA-09 · Puesto desierto por mayoría explícita

**Pasos:** con 3 jueces, **2 de 3** declaran explícitamente desierto el cuarto puesto. El tercer
juez sí asigna un ejemplar al cuarto puesto.

**Resultado esperado:** el cuarto puesto se muestra como **desierto**. La asignación del juez
minoritario no lo evita. Este es un caso que históricamente falló, revísalo con atención.

---

### QA-10 · Puesto no adjudicado por consideración insuficiente

**Pasos:** haz que ningún ejemplar alcance la consideración mínima para el quinto puesto (con 3
jueces, que ningún candidato sea puntuado allí por al menos 2 jueces) y que **no** haya mayoría de
declaraciones de desierto.

**Resultado esperado:** el quinto puesto se muestra como **no adjudicado por consideración
insuficiente**, con la etiqueta correspondiente. **No** debe mostrarse como desierto ni
desaparecer de la tabla. La diferencia entre desierto y no adjudicado es una distinción
reglamentaria, no cosmética.

---

### QA-11 · Empate por suma en puestos premiables

**Pasos:** construye tarjetas donde dos ejemplares queden con la **misma suma** disputando el
tercer puesto.

**Resultado esperado:**
- El consolidado F2 marca a ambos como empatados.
- La aplicación **impide cerrar** el resultado oficial y pide abrir un desempate.
- El panel de desempate indica la causa, el rango de puestos en disputa y los ejemplares
  convocados.

---

### QA-12 · Excepción del quinto puesto (5.e)

**Pasos:** con 3 jueces, haz que cada uno elija un **ejemplar distinto** como quinto, y que ninguno
declare desierto el quinto.

**Resultado esperado:**
- Se genera un bloque especial de desempate para definir el quinto puesto.
- Solo participan los ejemplares que **no** tengan ya un puesto del 1 al 4. Si uno de los tres
  quintos quedó tercero por suma, queda excluido del desempate.
- Si dos jueces coinciden en el mismo quinto, la excepción **no** aplica y se resuelve por las
  reglas ordinarias.

---

### QA-13 · Prioridad entre empates

**Pasos:** construye un caso donde coexistan un empate por suma que afecta los puestos 1 a 4 y un
bloque de quinto puesto.

**Resultado esperado:** la aplicación ofrece resolver **primero** el empate ordinario de los
puestos 1 a 4, y solo después el del quinto. Nunca mezcla ambas causas en una misma ronda.

---

### QA-14 · Abrir y resolver un desempate

**Precondición:** F2 consolidada con un empate bloqueante.

**Pasos:**
1. Director Técnico abre el panel de desempate.
2. Selecciona una prueba y pulsa abrir.
3. Los jueces diligencian y cierran la tarjeta de desempate.
4. Director Técnico consolida.

**Resultado esperado:**
- Para abrir la ronda basta con **seleccionar una prueba**. No debe pedir votos de jueces,
  certificación de sorteo ni notas.
- La ronda de desempate convoca **solo** a los ejemplares empatados.
- Estado durante la ronda: `TIE_BREAK_IN_PROGRESS`. Al consolidar vuelve a `F2_IN_PROGRESS`.
- Una vez resuelto el bloque, la aplicación **no debe volver a pedir otra ronda** para los mismos
  ejemplares. Este fue un defecto corregido; verifícalo explícitamente.

---

### QA-15 · Restricciones de las pruebas de desempate

**Pasos:** con un bloque de **3 o más** ejemplares, intenta seleccionar Paralelo y luego Cambios de
dirección. Después, sin haber ejecutado pruebas previas, intenta seleccionar Montar ejemplares.

**Resultado esperado:**
- Paralelo y Cambios de dirección solo se permiten con **exactamente 2** ejemplares. Con 3 o más la
  aplicación los rechaza.
- **Montar ejemplares** es el último recurso: se rechaza hasta haber agotado las pruebas anteriores
  aplicables.

---

### QA-16 · El desempate sigue empatado

**Pasos:** haz que los jueces produzcan de nuevo un empate en la ronda de desempate y consolida.

**Resultado esperado:** la aplicación indica que el empate persiste, **impide cerrar** el resultado
oficial y permite abrir otra ronda de desempate.

---

### QA-17 · Cierre del resultado oficial

**Precondición:** F2 consolidada, todos los empates bloqueantes resueltos.

**Pasos:** Director Técnico cierra el resultado.

**Resultado esperado:**
- El estado pasa a `JUDGING_CLOSED`.
- El tablero oficial refleja las posiciones **fusionando** los resultados de los desempates sobre
  el F2 original.
- Los puestos desiertos y no adjudicados se muestran con su etiqueta correcta.
- Intentar cerrar con un desempate abierto o con un bloque pendiente debe ser **rechazado** con un
  mensaje explicativo.

---

### QA-18 · Descalificación por causal ordinaria

**Pasos:** un juez descalifica un ejemplar por cualquier causal distinta de hiperflexión (por
ejemplo, brinca o cojeras).

**Resultado esperado:** la descalificación es **inmediata** con el reporte de un solo juez. El
ejemplar queda excluido de los consolidados posteriores, aunque figure en selecciones previas.

---

### QA-19 · Descalificación por hiperflexión requiere mayoría

**Pasos:** con 3 jueces, un solo juez reporta hiperflexión. Luego un segundo juez reporta la misma
causal sobre el mismo ejemplar.

**Resultado esperado:**
- Con **1 de 3** reportes, el ejemplar queda en estado **provisional** y sigue compitiendo.
- Con **2 de 3**, la descalificación se hace efectiva.
- Con 5 jueces el umbral es **3**. Con 1 juez basta **1**.

---

### QA-20 · Paneles de jueces no reglamentarios

**Pasos:** configura la feria con 2 jueces fuera de Grado B, y en otra prueba con 4 jueces.

**Resultado esperado:** la aplicación **rechaza** ambas configuraciones con un mensaje de panel no
reglamentario. Con 2 jueces en Grado B debe activarse **un solo juez por categoría**, alternando
entre categorías, sin consolidación conjunta.

---

## 6. Errores frecuentes al reportar

Antes de abrir un defecto, descarta estos comportamientos que **son correctos**:

| Observación | Por qué es correcto |
|-------------|---------------------|
| Tras consolidar F2 el estado sigue en `F2_IN_PROGRESS` | No existe estado `F2_CONSOLIDATED` en la categoría |
| Del F1 pasan más de 7 ejemplares a F2 | El tope de 7 es por tarjeta; el consolidado es la unión |
| Un ejemplar con un solo voto sobrevive al FA | Sobrevivir no requiere mayoría, basta un voto |
| Aparecen ejemplares en posición 6 o mayor en F2 | Es el voto de castigo; todos los elegibles se rankean |
| Un puesto figura como "no adjudicado" y no como desierto | Son reglas distintas; ver QA-09 y QA-10 |
| El quinto puesto se disputa entre 2 y no entre 3 ejemplares | Se excluyen los que ya tienen puesto 1 a 4 |

---

## 7. Plantilla de registro

| Caso | Fecha | Ambiente | Jueces | Ejemplares | Esperado | Obtenido | Estado |
|------|-------|----------|--------|------------|----------|----------|--------|
| QA-01 | | | | | | | Aprobado / Fallido |
| QA-02 | | | | | | | |
| ... | | | | | | | |

Para cada caso fallido, registra: estado de la categoría al momento del fallo, número de jueces,
cantidad de ejemplares en cada etapa, y captura del tablero de resultados.
