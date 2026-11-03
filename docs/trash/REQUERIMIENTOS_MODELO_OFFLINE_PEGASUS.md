# Requerimientos técnicos para el modelo offline de Pegasus

**Proyecto:** Pegasus – FEDEQUINAS  
**Repositorio analizado:** `jhovaniM12/Pegasus`  
**Rama base:** `main`  
**Commit analizado:** `21f4b83`  
**Fecha del análisis:** 23 de julio de 2026  
**Objetivo del documento:** servir como especificación ejecutable para que Codex implemente el modo offline sin alterar las reglas de juzgamiento ni comprometer la consistencia de los resultados oficiales.

---

## 1. Objetivo

Implementar en la PWA de Pegasus un modelo **offline-first controlado** que permita a veterinarios y jueces continuar capturando información cuando la conexión a internet se interrumpa y sincronizarla de forma automática, idempotente, observable y segura cuando se recupere la comunicación con el backend.

La solución debe:

1. Conservar localmente los datos mínimos necesarios para continuar la operación.
2. Guardar las acciones permitidas en una cola persistente de IndexedDB.
3. Mantener los cambios después de cerrar o recargar la PWA.
4. Sincronizar automáticamente al recuperar conexión real con la API de Pegasus.
5. Evitar envíos duplicados y sobrescrituras silenciosas.
6. Mostrar claramente qué información está:
   - guardada solo en el dispositivo;
   - sincronizándose;
   - confirmada por el servidor;
   - bloqueada por conflicto;
   - fallida y pendiente de intervención.
7. Impedir que cierres, consolidaciones o resultados oficiales se ejecuten con datos locales aún pendientes.

El modo offline **no debe simular que el servidor confirmó una acción**. “Guardado en este dispositivo” y “sincronizado con Pegasus” son estados distintos.

---

## 2. Hallazgos del análisis del repositorio

### 2.1 Arquitectura actual relevante

- Monorepo con:
  - `packages/web`: Next.js `16.2.9`, React `19.2.4`, Axios y PWA.
  - `packages/functions`: Hono, TypeORM y Zod.
  - `packages/core`: entidades y migraciones PostgreSQL.
- La API se publica bajo `/api` desde la propia aplicación Next.js.
- La autenticación usa la cookie segura `pegasus_session`.
- Ya existe `NetworkStatusProvider`.
- Ya existe un Service Worker, pero actualmente:
  - carga el worker de Pusher Beams;
  - registra un `fetch` de paso directo a red;
  - no almacena el shell de la aplicación;
  - no ofrece respuestas offline;
  - no gestiona una cola de sincronización.
- La pantalla del flujo operativo ya detecta conexión con `navigator.onLine` y una petición cada 5 segundos a un dominio externo.
- FA y las tarjetas denominadas P1/P2 en la interfaz —conservando internamente los
  tipos y endpoints `F1`/`F2`— ya usan actualizaciones optimistas en memoria.
- Cuando falla una petición, la interfaz revierte el cambio al último estado confirmado.
- Esas colas actuales usan `useRef`; se pierden al recargar, cerrar la PWA o navegar.
- El cierre del FA ahora recibe `selectedParticipantIds` como snapshot definitivo.
- El backend bloquea el formulario, reemplaza el autosave con ese snapshot y cierra
  el FA dentro de una misma transacción.
- El FA vacío está permitido explícitamente.
- Los bloques de desempate poseen identidad propia y la detección de las reglas
  5.d/5.e fue corregida. Las operaciones offline deben conservar esa identidad y
  no reconstruir bloques a partir de filas `TIED`.
- El backend usa transacciones, pero no posee un mecanismo general de:
  - `operationId` o clave de idempotencia para mutaciones offline;
  - revisión/versionado optimista;
  - detección explícita de conflictos basada en la versión leída por el dispositivo.

### 2.2 Riesgo actual

Si se pierde internet durante una tarjeta, las selecciones optimistas pueden verse momentáneamente en pantalla, pero la petición falla y se restauran los datos anteriores. El usuario no puede continuar trabajando de forma confiable.

Agregar únicamente IndexedDB y reenviar las mismas peticiones tampoco sería suficiente: una acción podría llegar dos veces, una tarjeta podría haberse cerrado desde otro dispositivo o la etapa podría haber avanzado antes de que el dispositivo offline se reconecte.

### 2.3 Ajustes confirmados antes de implementar

La revisión contra el commit base confirmó estos ajustes:

1. **Conectividad:** ya existe `GET /api/health`. Debe reutilizarse con
   `Cache-Control: no-store` en lugar de crear otro endpoint equivalente. Como el
   middleware actual inicializa la conexión de datos, una respuesta saludable
   confirma tanto la API como su dependencia principal.
2. **Service Worker:** no se debe cachear HTML autenticado de `/staff` de forma
   indiscriminada. La futura apertura offline debe usar un shell neutro y cargar
   exclusivamente el contexto del usuario desde IndexedDB.
3. **Activación gradual:** crear IndexedDB y el motor de cola no habilita por sí
   mismo escrituras offline. Cada agregado se habilita únicamente después de
   contar en backend con revisión, idempotencia, conflictos estructurados y sus
   pruebas correspondientes.
4. **Estado inicial:** la interfaz no puede asumir `ONLINE` antes de recibir una
   respuesta válida de la API. Mientras se realiza la primera comprobación debe
   considerarse conexión no confirmada.
5. **Identidad durante un arranque completamente offline:** una cookie HttpOnly
   no permite revalidar la identidad sin servidor. Se adopta para v1 la política
   de **dispositivo operativo confiable durante la feria**:
   - el usuario debe preparar explícitamente el dispositivo mientras está
     autenticado y con conexión;
   - la preparación queda vinculada a un único `userId`;
   - no se guardan cookies, tokens ni credenciales en IndexedDB;
   - la confianza tiene vencimiento corto y visible;
   - otro usuario no puede asumir la cola ni los contextos guardados;
   - cerrar sesión revoca la confianza si no hay pendientes; si existen, se
     bloquea el cambio de identidad y se exige sincronizar o resolver;
   - la UI debe advertir que se trata de un dispositivo confiable y recomendar
     bloqueo del sistema operativo.

Un PIN o desbloqueo biométrico local queda fuera de v1 y podrá añadirse si el
piloto operativo demuestra que el riesgo físico requiere una barrera adicional.

---

## 3. Alcance funcional por módulo

### 3.1 Matriz de decisiones

| Módulo o acción | Offline v1 | Estrategia | Motivo |
|---|---:|---|---|
| Consultar categorías asignadas al staff | Sí | Snapshot local de solo lectura | Permite entrar al trabajo preparado previamente |
| Consultar detalle de categoría | Sí | Snapshot local | Contexto necesario para el flujo |
| Consultar participantes y datos básicos | Sí | Snapshot local mínimo | Necesario para identificar ejemplares |
| Checkeo veterinario: estado y nota | Sí | Cola persistente, reemplazo por última intención | Cada ejemplar tiene una decisión del veterinario |
| Selecciones FA | Sí | Snapshot completo de la tarjeta, coalescente | Evita reproducir cada toque y conserva la intención final |
| Selecciones P1 (`F1` interno) | Sí | Snapshot completo de la tarjeta, coalescente | Mismo criterio que FA |
| Posiciones y puestos desiertos P2 (`F2` interno) | Sí | Snapshot completo de la tarjeta, coalescente | La tarjeta debe sincronizarse como una unidad coherente |
| Posiciones de desempate | Sí | Snapshot completo de la tarjeta, coalescente | Todos los empatados deben conservar una asignación coherente |
| Nota privada del juez | Sí | Último valor por participante | La nota pertenece al juez y a su tarjeta |
| Recordatorios `SUMA/RESTA` | Sí | Snapshot por participante | Evita duplicar recordatorios |
| Iniciar tarjeta FA/P1/P2 | No en v1 | Requiere servidor | Define el formulario y la ronda activa |
| Cerrar tarjeta FA/P1/P2/desempate | Solo online y sin pendientes | Barrera de sincronización | El cierre vuelve inmutable la tarjeta |
| Iniciar/cerrar pre-pista | No | Requiere servidor | Cambia el estado global de la categoría |
| Iniciar juzgamiento | No | Requiere servidor | Crea participantes y formularios |
| Descalificar ejemplar | No en v1 | Requiere servidor | Tiene efecto global, trazabilidad y notificaciones |
| Solicitar/reconocer repetición de pista | No en v1 | Requiere servidor | Involucra coordinación entre juez y director |
| Consolidar FA o una ronda | No | Requiere servidor | Depende de todos los jueces y genera resultados |
| Abrir P1, P2 o desempate | No | Requiere servidor | Crea estructuras compartidas |
| Declarar competencia desierta | No | Requiere servidor | Cierre oficial |
| Cerrar/publicar resultado oficial | No | Requiere servidor | Operación crítica e irreversible |
| Sincronizador CSV, usuarios y configuración ROOT | No | Fuera del alcance offline operativo | No es necesario durante el juzgamiento en pista |
| Notificaciones y bandeja | Lectura del último snapshot | No encolar cambios en v1 | No debe bloquear el juzgamiento |

### 3.2 Regla de disponibilidad previa

El modo offline solo podrá abrir una feria/categoría que haya sido **preparada mientras existía conexión**. La PWA debe descargar y almacenar el paquete operativo de las categorías asignadas al usuario:

- identidad de la feria, categoría y andar;
- `stageId`, estado y revisión;
- rol e identidad del usuario;
- participantes y posiciones de pista;
- controles veterinarios, si aplica;
- formulario FA o ronda activa del juez;
- `roundId` e identidad inmutable del bloque de desempate, cuando aplique;
- motivos activos de descalificación, aunque la descalificación siga siendo online;
- recordatorios disponibles;
- datos mínimos para renderizar la pantalla.

Si una categoría nunca fue descargada, se debe mostrar:

> Esta categoría no está disponible sin conexión. Conéctate a internet para prepararla.

---

## 4. Principios obligatorios de diseño

### 4.1 El servidor sigue siendo la fuente oficial

IndexedDB conserva borradores, snapshots y operaciones pendientes. No reemplaza PostgreSQL ni autoriza cambios de estado globales.

### 4.2 Guardar intención final, no cada toque

FA, P1, P2 y desempate ya envían el estado completo de la tarjeta. La cola
offline debe mantener **una sola mutación pendiente por tarjeta**, reemplazando
su payload cuando el usuario realice otro cambio antes de sincronizar.

En contratos, tipos, persistencia y llamadas a la API se deben conservar los
nombres internos `F1` y `F2`. `P1` y `P2` son únicamente etiquetas de
presentación y no justifican migrar entidades, endpoints ni valores de dominio.

Ejemplos:

- FA: `selectedParticipantIds`.
- P1 (`F1`): `selectedParticipantIds`.
- P2 (`F2`)/desempate: `positions` + `desertedPositions`.
- Recordatorios: arreglo completo por participante.
- Nota: valor completo por participante.
- Veterinaria: último `status` y `notes` por ejemplar.

No se debe guardar una operación independiente por cada selección/deselección.

### 4.3 Idempotencia

Cada operación transmitida debe incluir un `operationId` UUID estable, generado una sola vez en el cliente. Los reintentos de esa misma operación deben conservarlo.

El backend debe persistir y reconocer dicho identificador. Si recibe nuevamente una operación ya aplicada:

- no debe volver a ejecutar efectos secundarios;
- no debe duplicar eventos o notificaciones;
- debe responder con el resultado confirmado de la primera aplicación.

### 4.4 Control de concurrencia

Cada agregado editable debe exponer una `revision` monotónica:

- control veterinario;
- tarjeta FA;
- tarjeta de ronda F1/F2/desempate;
- etapa/categoría para cambios globales.

Cada mutación offline debe enviar:

- `operationId`;
- `baseRevision`;
- `clientUpdatedAt`;
- tipo de operación;
- identificadores de `stage`, formulario/ronda y usuario;
- payload completo.

El backend aplica la mutación únicamente si la revisión esperada sigue siendo válida o si la operación puede combinarse de forma segura.

No usar `updatedAt` como único control de concurrencia. Añadir una columna entera `revision` con incremento transaccional.

### 4.5 Barrera antes de cerrar

Para cerrar una tarjeta:

1. Debe existir conexión confirmada con la API.
2. La cola de esa tarjeta debe estar vacía.
3. El motor debe haber confirmado la sincronización de todas las intenciones
   locales anteriores.
4. El cliente debe refrescar el formulario o ronda desde el servidor y comprobar
   que su identidad y revisión continúan vigentes.
5. El cierre debe incluir `expectedRevision` y el snapshot definitivo visible.
6. El backend debe validar nuevamente el contenido, la identidad de la ronda y
   el estado, y ejecutar el cierre de forma atómica.

#### Cierre específico del FA

El contrato actual de `closeFa` ya recibe `selectedParticipantIds`. Debe
mantenerse ese diseño:

1. Sincronizar y vaciar la cola pendiente del FA.
2. Confirmar que el formulario continúa abierto.
3. Invocar `closeFa` con el snapshot local completo y definitivo de
   `selectedParticipantIds`, incluso cuando sea un arreglo vacío.
4. En el backend, bloquear el formulario, reemplazar el estado previo/autosave
   con el snapshot recibido y cerrar dentro de la misma transacción.

No implementar el cierre como `updateFaDecisions` seguido de `closeFa` sin
snapshot. La operación de cierre debe ser autosuficiente: si la conexión se
interrumpe entre un autosave y el cierre, el servidor no debe cerrar con una
selección anterior.

Si existen pendientes:

> Tienes cambios guardados únicamente en este dispositivo. Debes sincronizarlos antes de cerrar la tarjeta.

---

## 5. Modelo de datos local

Implementar IndexedDB mediante una capa tipada. Se recomienda `Dexie`, encapsulado detrás de interfaces propias para que los componentes no dependan directamente de la librería.

Nombre sugerido: `pegasus-offline-v1`.

### 5.1 Tablas

#### `offline_contexts`

Snapshot operativo por usuario y categoría.

```ts
type OfflineContext = {
  key: string; // `${userId}:${stageId}`
  userId: string;
  role: "JUDGE" | "VETERINARIAN" | "TECHNICAL_DIRECTOR";
  stageId: string;
  fairId: string;
  stageRevision: number;
  stageStatus: StageStatus;
  activeRoundId: string | null;
  activeTieBlockIdentity: string | null;
  payload: OfflineStagePayload;
  cachedAt: string;
  lastServerSyncAt: string;
  schemaVersion: number;
};
```

#### `offline_mutations`

```ts
type OfflineMutation = {
  operationId: string;
  deduplicationKey: string;
  userId: string;
  stageId: string;
  aggregateType: "VET_CHECK" | "FA_FORM" | "ROUND_FORM" | "ROUND_NOTE" | "ROUND_REMINDERS";
  aggregateId: string;
  operationType: string;
  baseRevision: number;
  payload: unknown;
  status: "PENDING" | "SYNCING" | "CONFLICT" | "FAILED";
  attempts: number;
  nextRetryAt: string | null;
  createdAt: string;
  clientUpdatedAt: string;
  lastAttemptAt: string | null;
  lastErrorCode: string | null;
  lastErrorMessage: string | null;
};
```

#### `offline_confirmations`

Registro corto de operaciones confirmadas para reconciliar la UI y evitar que una respuesta tardía restaure datos antiguos.

#### `offline_meta`

Versión de esquema, identidad del último usuario, fecha de limpieza y estado del sincronizador.

### 5.2 Claves de deduplicación sugeridas

```text
VET_CHECK:{stageId}:{fairEntryId}
FA_FORM:{stageId}:{formId}
ROUND_FORM:{stageId}:{roundId}:{tieBlockIdentityOrStandard}:{formId}
ROUND_NOTE:{roundId}:{formId}:{participantId}
ROUND_REMINDERS:{roundId}:{formId}:{participantId}
```

Al modificar una entidad con una mutación `PENDING`, actualizar el payload y `clientUpdatedAt` de esa fila. Si la fila ya está `SYNCING`, crear o conservar una nueva intención posterior para no alterar el request que está en vuelo.

---

## 6. Modelo de datos del backend

### 6.1 Revisiones

Agregar mediante migración:

- `veterinary_checks.revision integer NOT NULL DEFAULT 0`;
- `fa_judge_forms.revision integer NOT NULL DEFAULT 0`;
- `judging_round_forms.revision integer NOT NULL DEFAULT 0`;
- `fair_category_stages.revision integer NOT NULL DEFAULT 0`.

Cada actualización debe incrementar la revisión dentro de la misma transacción.

### 6.2 Registro de idempotencia

Crear una tabla similar a:

```text
offline_operation_receipts
- id uuid PK
- operation_id uuid UNIQUE NOT NULL
- user_id uuid NOT NULL
- fair_category_stage_id uuid NOT NULL
- aggregate_type varchar NOT NULL
- aggregate_id uuid NOT NULL
- request_hash varchar NOT NULL
- response_status integer NOT NULL
- response_payload jsonb NULL
- applied_revision integer NULL
- created_at timestamp NOT NULL
```

Reglas:

1. `operation_id` repetido con el mismo `request_hash`: devolver la respuesta original.
2. `operation_id` repetido con payload diferente: responder `409 IDEMPOTENCY_KEY_REUSED`.
3. El recibo y la mutación de dominio deben guardarse en la misma transacción.
4. Definir retención; no borrar recibos mientras puedan existir reintentos de dispositivos usados en ferias activas.

### 6.3 Contrato común de mutación

Puede implementarse mediante headers o body. Se recomienda un sobre explícito:

```ts
type OfflineMutationEnvelope<T> = {
  operationId: string;
  baseRevision: number;
  clientUpdatedAt: string;
  payload: T;
};
```

Respuesta:

```ts
type MutationResult<T> = {
  data: T;
  sync: {
    operationId: string;
    applied: boolean;
    duplicate: boolean;
    revision: number;
    serverUpdatedAt: string;
  };
};
```

### 6.4 Errores estructurados

El backend debe responder con códigos estables:

- `409 REVISION_CONFLICT`
- `409 STAGE_ADVANCED`
- `409 FORM_CLOSED`
- `409 IDEMPOTENCY_KEY_REUSED`
- `401 SESSION_EXPIRED`
- `403 ROLE_OR_STAGE_ACCESS_REVOKED`
- `422 OFFLINE_PAYLOAD_INVALID`

El detalle de conflicto debe incluir, sin exponer datos de otros jueces:

```ts
{
  aggregateId: string;
  expectedRevision: number;
  currentRevision: number;
  currentState: unknown;
  resolution: "RELOAD_REQUIRED" | "CAN_REAPPLY_LOCAL_DRAFT";
}
```

---

## 7. Política de conflictos

### 7.1 Cambios propios de una tarjeta abierta

FA, F1, F2 y desempate son tarjetas privadas por juez. Si la tarjeta sigue abierta y pertenece al mismo usuario:

- traer la versión actual;
- comparar el snapshot;
- permitir al usuario elegir entre:
  - conservar la versión del servidor;
  - volver a aplicar su borrador local completo.

No hacer mezcla automática de posiciones F2/desempate. El conjunto de posiciones es una unidad y una mezcla campo a campo puede producir puestos duplicados.

### 7.2 Identidad y cambio de ronda

Toda operación de P1/P2 o desempate debe quedar vinculada, como mínimo, a:

- `stageId`;
- `roundId`;
- `formId`;
- tipo interno de ronda (`F1` o `F2`);
- identidad del bloque de desempate cuando aplique;
- `baseRevision`.

No identificar un desempate únicamente por `stageId`, por posición provisional
ni por filas consecutivas con estado `TIED`.

Antes de sincronizar, el servidor debe comprobar que la ronda y el bloque
siguen siendo los mismos. Si mientras el juez estuvo offline la ronda fue
cerrada, reemplazada, anulada o se abrió una nueva:

- no aplicar la operación a la ronda nueva;
- marcarla como `CONFLICT`;
- conservar el borrador local;
- exigir recarga o resolución explícita.

Una mutación de una ronda anterior jamás debe reinterpretarse automáticamente
como una intención para la ronda activa.

### 7.3 Nota privada y recordatorios

Pueden usar “última intención del mismo usuario”, siempre que:

- la tarjeta continúe abierta;
- el participante siga elegible;
- la revisión base no corresponda a una ronda anterior.

### 7.4 Veterinaria

Si el mismo control cambió en el servidor:

- no aplicar silenciosamente la versión offline;
- mostrar el estado local y el estado del servidor;
- permitir al veterinario confirmar cuál conservar, si la pre-pista sigue abierta.

Si la pre-pista ya fue cerrada, el cambio queda en conflicto no aplicable y requiere intervención del Director Técnico conforme al flujo que defina el negocio.

### 7.5 Estado avanzado o formulario cerrado

Nunca reabrir ni modificar automáticamente una tarjeta cerrada. Conservar el borrador local como evidencia y mostrar:

> No fue posible sincronizar porque la etapa avanzó mientras el dispositivo estaba sin conexión.

Debe existir una opción para copiar/exportar el detalle del conflicto para soporte, sin incluir información sensible innecesaria.

---

## 8. Motor de sincronización

### 8.1 Detección de conectividad

No depender de `https://www.gstatic.com/generate_204`. El dispositivo puede tener acceso a internet y no a Pegasus, o la red de la feria puede bloquear dominios externos.

Crear un endpoint liviano en la misma API, por ejemplo:

```http
GET /api/health/connectivity
Cache-Control: no-store
```

El estado `isOnline` debe significar “la API de Pegasus responde”, no solamente “el navegador declara conexión”.

Estados de red sugeridos:

- `ONLINE`
- `OFFLINE`
- `DEGRADED` (API inestable o sincronización con fallos)
- `SESSION_EXPIRED`

### 8.2 Disparadores

Intentar sincronizar:

- al recuperar conexión;
- al abrir/enfocar la PWA;
- al cambiar `visibilityState` a visible;
- después de guardar una mutación si la API está disponible;
- mediante reintento controlado mientras la aplicación esté abierta;
- opcionalmente con Background Sync cuando el navegador lo soporte.

Background Sync debe ser una optimización, no un requisito: iOS y otros entornos no garantizan su disponibilidad.

### 8.3 Orden

Procesar secuencialmente por agregado. No ejecutar en paralelo mutaciones del mismo formulario.

Prioridad:

1. veterinaria;
2. snapshot principal de FA/ronda;
3. notas y recordatorios;
4. operaciones futuras no críticas.

Nunca sincronizar datos de un usuario usando la sesión de otro.

### 8.4 Reintentos

Backoff sugerido con jitter:

```text
2 s → 5 s → 15 s → 30 s → 60 s, máximo 5 min mientras la app esté abierta
```

- Errores de red y `5xx`: reintentar.
- `409`: marcar `CONFLICT`, no reintentar automáticamente.
- `401`: pausar toda la cola y solicitar reautenticación.
- `403`: pausar la operación y mostrar pérdida de acceso.
- `422`: marcar `FAILED`; requiere corrección o descarte explícito.

### 8.5 Reautenticación

No copiar ni guardar manualmente la cookie de sesión en IndexedDB o `localStorage`.

Si la sesión vence:

1. conservar la cola local;
2. bloquear nuevos envíos;
3. pedir al mismo usuario que vuelva a ingresar;
4. comprobar que el `userId` autenticado coincida con el propietario de la cola;
5. reanudar solo si coincide.

Si ingresa otro usuario, la cola anterior debe permanecer aislada y no debe enviarse.

---

## 9. Service Worker y caché

### 9.1 Requisito

Conservar la compatibilidad con Pusher Beams y ampliar el Service Worker actual.

### 9.2 Estrategias

- Assets versionados de Next.js: `CacheFirst` con limpieza por versión.
- Navegación del área `/staff`: `NetworkFirst` con fallback a un shell offline previamente almacenado.
- API `GET` operativa: gestionar snapshots desde la aplicación/IndexedDB; no guardar respuestas autenticadas indiscriminadamente en Cache Storage.
- API de escritura: no hacer un “replay” genérico de cualquier `POST/PUT/PATCH`. Solo el motor tipado de mutaciones puede encolar operaciones autorizadas.
- Login, logout, Beams token, sincronizador y administración: `NetworkOnly`.

No cachear una respuesta autenticada bajo una clave que pueda ser compartida entre usuarios.

### 9.3 Actualización de la PWA

Si existe una nueva versión durante una feria:

- no activar un nuevo Service Worker en mitad de operaciones pendientes sin avisar;
- esperar a que la cola esté persistida;
- mostrar “Actualización disponible”;
- al aceptar, recargar sin perder borradores.

Mantener un `OFFLINE_SCHEMA_VERSION` y migraciones de IndexedDB.

---

## 10. Experiencia de usuario

### 10.1 Indicador global

Reemplazar el indicador binario actual por:

- **En línea**
- **Sin conexión**
- **Sincronizando N cambios**
- **N cambios pendientes**
- **Conflicto de sincronización**
- **Sesión expirada**

### 10.2 Estado por formulario

Mostrar cerca de la acción principal:

- `Guardado en este dispositivo`
- `Pendiente de sincronización`
- `Sincronizando…`
- `Sincronizado a las HH:mm`
- `No se pudo sincronizar`
- `Requiere resolver un conflicto`

No usar un toast como único mecanismo: el estado debe permanecer visible.

### 10.3 Cierre

El botón de cierre debe permanecer deshabilitado cuando:

- no hay acceso a la API;
- existen cambios pendientes o en conflicto;
- hay una sincronización en curso;
- el último snapshot confirmado no coincide con el borrador visible.

Agregar la acción **“Sincronizar ahora”**.

### 10.4 Centro de sincronización

Crear un panel accesible desde el indicador global que muestre:

- número de pendientes;
- formulario/categoría afectada;
- última sincronización;
- errores;
- botón de reintento;
- resolución de conflictos;
- opción de descartar una mutación solo después de confirmación clara.

No mostrar a un juez el contenido de las tarjetas de otros jueces.

---

## 11. Seguridad y privacidad

1. Particionar IndexedDB por `userId`.
2. Validar propiedad y rol en cada sincronización; nunca confiar en el rol guardado localmente.
3. Guardar únicamente la información operacional mínima.
4. No almacenar:
   - cookies;
   - tokens;
   - contraseñas o códigos de acceso;
   - respuestas administrativas completas;
   - información de tarjetas de otros jueces.
5. Limpiar el contexto local:
   - al cerrar sesión, si no hay pendientes;
   - al terminar la feria, después de confirmar sincronización;
   - por retención configurable.
6. Si hay pendientes al cerrar sesión, advertir y conservarlos aislados.
7. Aplicar una política CSP estricta y evitar XSS; los datos de IndexedDB son accesibles al JavaScript del mismo origen.
8. No afirmar que IndexedDB está cifrada de extremo a extremo. Web Crypto puede considerarse después, con un diseño de llaves compatible con uso offline; no improvisar una llave almacenada junto a los datos.

---

## 12. Cambios propuestos en el código

### 12.1 `packages/web`

Crear, como mínimo:

```text
src/offline/
  db.ts
  schema.ts
  mutation-types.ts
  offline-repository.ts
  sync-engine.ts
  conflict-policy.ts
  connectivity.ts
  cache-context.ts

src/components/offline/
  sync-status-indicator.tsx
  sync-center.tsx
  mutation-status.tsx
  conflict-dialog.tsx

src/hooks/
  use-offline-mutation.ts
  use-offline-context.ts
  use-sync-status.ts
```

Refactorizar:

- `src/services/api.service.ts`
  - distinguir fallo de red, timeout, conflicto, sesión y validación;
  - no encolar automáticamente cualquier método HTTP.
- `src/services/staged-flow.service.ts`
  - exponer contratos offline tipados únicamente para operaciones permitidas.
- `src/components/network-status.tsx`
  - comprobar la API de Pegasus;
  - integrar los estados del motor de sincronización.
- `src/hooks/use-veterinary-checks.ts`
  - reemplazar rollback por persistencia local y reconciliación.
- `src/app/staff/categories/[id]/page.tsx`
  - sustituir las refs efímeras de FA por el repositorio offline.
- `judge-round-workspace.tsx`
  - sustituir la cola en memoria por snapshot persistente.
- `f1-selection-board.tsx` y `f2-position-board.tsx`
  - integrar notas/recordatorios con estado local persistente.
- `public/service-worker.js`
  - incorporar caché del shell sin romper Beams.

No colocar lógica de conflictos o IndexedDB directamente en componentes de página.

### 12.2 `packages/functions`

- Añadir endpoint de conectividad.
- Ampliar schemas Zod con el sobre offline.
- Centralizar idempotencia en un servicio reutilizable.
- Aplicar revisión optimista en servicios de veterinaria, FA y rondas.
- Devolver códigos de error estables.
- Mantener cada cambio de dominio, recibo idempotente, evento y notificación en una sola transacción.
- Excluir cierres/consolidaciones del endpoint genérico de sincronización.

### 12.3 `packages/core`

- Migración de columnas `revision`.
- Entidad y migración de `offline_operation_receipts`.
- Índices por `operation_id`, `user_id`, `stage_id` y fecha.
- Exportar tipos compartidos si no introducen acoplamiento del frontend con entidades TypeORM.

---

## 13. Estrategia de implementación por fases

### Fase 0 – Preparación

- Crear rama desde el `main` actualizado y verificar que el commit base sea
  `21f4b83` o un descendiente que contenga esos cambios:

```bash
git switch main
git pull --ff-only
git switch -c feat/offline-judging
```

- Leer `packages/web/AGENTS.md`.
- Como el proyecto usa Next.js 16, consultar la documentación instalada en `node_modules/next/dist/docs/` antes de cambiar Service Worker, routing o renderización.
- Documentar los contratos actuales antes de modificarlos.

### Fase 1 – Infraestructura

- IndexedDB tipada.
- Endpoint de conectividad.
- Provider/Sync Engine.
- Estados visibles.
- Cache del shell.
- Aislamiento por usuario.

### Fase 2 – Veterinaria

- Snapshot de pre-pista.
- Actualización offline de estado/nota.
- Coalescencia por ejemplar.
- Revisión e idempotencia.
- Barrera de cierre.

### Fase 3 – FA

- Snapshot offline completo.
- Reemplazar cola basada en refs.
- Persistir selección vacía y selección de hasta 10.
- Sincronización y conflictos.
- Cierre solamente tras confirmación.
- Conservar el contrato atómico actual: `closeFa` recibe
  `selectedParticipantIds`, reemplaza el autosave y cierra en una transacción.
- Probar explícitamente el cierre de un FA vacío.

### Fase 4 – P1, P2 y desempates

- Snapshot completo por tarjeta.
- Conservar `F1`/`F2` como nombres internos y usar P1/P2 solo en presentación.
- Vincular toda mutación a `roundId` y a la identidad del bloque.
- Notas y recordatorios.
- Validaciones locales equivalentes a Zod/backend.
- No permitir cierre mientras existan pendientes.
- Rechazar como conflicto operaciones pertenecientes a una ronda anterior.

### Fase 5 – Robustez operativa

- Centro de sincronización.
- Telemetría.
- Pruebas de actualización de Service Worker.
- Retención/limpieza.
- Prueba piloto con múltiples dispositivos y conectividad intermitente.

No implementar todos los módulos en un único cambio masivo. Cada fase debe pasar pruebas antes de continuar.

---

## 14. Pruebas obligatorias

### 14.1 Unitarias

- Coalescencia de múltiples cambios FA en un solo snapshot.
- Posiciones P2 (`F2`) preservadas como unidad.
- Identidad de `roundId` y bloque preservada entre reintentos.
- `operationId` estable entre reintentos.
- Backoff y clasificación de errores.
- Aislamiento de colas por usuario.
- Migraciones de IndexedDB.
- No encolar endpoints no permitidos.

### 14.2 Backend

- Primera operación se aplica una vez.
- Reintento idéntico devuelve la misma confirmación.
- Reuso de `operationId` con otro payload devuelve `409`.
- `baseRevision` anterior produce conflicto.
- Operación contra formulario cerrado no modifica datos.
- Operación contra una ronda reemplazada o un bloque distinto devuelve conflicto.
- `closeFa` aplica el snapshot recibido y cierra en una única transacción.
- `closeFa` acepta `selectedParticipantIds: []`.
- Idempotencia evita eventos y notificaciones duplicadas.
- Dos peticiones concurrentes no pierden actualizaciones silenciosamente.

### 14.3 Integración/E2E

1. Cargar categoría online.
2. Desactivar red.
3. Modificar varias veces el mismo FA.
4. Recargar y cerrar la PWA.
5. Abrir nuevamente sin red.
6. Comprobar que el borrador permanece.
7. Recuperar conexión.
8. Verificar una sola mutación efectiva y estado confirmado.

Repetir para:

- veterinaria;
- P1 (`F1`);
- P2 (`F2`);
- desempate;
- notas;
- recordatorios.

### 14.4 Conflictos

- El servidor cierra la tarjeta mientras el dispositivo está offline.
- El mismo usuario modifica la tarjeta desde otro dispositivo.
- La etapa avanza antes de sincronizar.
- Se resuelve un desempate y se crea otra ronda mientras el dispositivo sigue
  offline.
- Existe una fila `TIED` consecutiva, pero no pertenece al mismo bloque.
- La sesión expira.
- Inicia sesión otro usuario.
- API responde `500`, timeout, `409`, `422` y `401`.
- El navegador dispara varias veces eventos `online`.
- La respuesta de una petición antigua llega después de una intención más reciente.

### 14.5 Service Worker

- Primera carga sin caché y sin red muestra mensaje correcto.
- Categoría preparada abre offline.
- Beams continúa registrándose y recibiendo push.
- Una versión nueva no elimina mutaciones pendientes.
- Los datos de un usuario no aparecen al iniciar otro.

---

## 15. Observabilidad

Registrar sin incluir el contenido privado completo de tarjetas:

- `OFFLINE_MUTATION_ACCEPTED`
- `OFFLINE_MUTATION_DUPLICATE`
- `OFFLINE_MUTATION_CONFLICT`
- `OFFLINE_MUTATION_REJECTED`
- `OFFLINE_SYNC_BATCH_COMPLETED`

Campos mínimos:

- `operationId`;
- `userId`;
- `stageId`;
- `aggregateType`;
- `aggregateId`;
- revisión base/aplicada;
- duración;
- código de resultado.

En frontend se pueden recolectar métricas agregadas:

- pendientes;
- edad de la mutación más antigua;
- reintentos;
- conflictos;
- última sincronización exitosa.

No registrar selecciones, posiciones o notas completas en logs generales.

---

## 16. Criterios de aceptación

La implementación se considera completa cuando:

1. Una categoría preparada puede abrirse sin conexión.
2. Veterinario y juez pueden continuar las acciones permitidas.
3. Los cambios sobreviven recarga y cierre de la PWA.
4. El usuario distingue guardado local de confirmación del servidor.
5. La reconexión sincroniza automáticamente.
6. Reintentar no duplica efectos.
7. No existe sobrescritura silenciosa ante revisión diferente.
8. Ninguna tarjeta se cierra con mutaciones pendientes.
9. Ninguna consolidación o publicación se ejecuta offline.
10. Una sesión distinta no puede enviar ni ver la cola de otro usuario.
11. Pusher Beams sigue funcionando.
12. Las pruebas unitarias, backend, integración y typecheck pasan.
13. No se modifica la lógica reglamentaria de FA, P1, P2 ni desempates.
14. La implementación incluye migraciones, documentación y plan de rollback.
15. El cierre FA conserva su atomicidad y usa el snapshot definitivo, incluido
    el arreglo vacío.
16. Ninguna operación pendiente se aplica a una ronda o bloque de desempate
    distinto del que la originó.

---

## 17. Instrucción lista para Codex

> Analiza e implementa los requerimientos de este documento sobre una rama nueva creada desde el `main` actualizado, verificando que incluya el commit `21f4b83` o sus cambios equivalentes. Antes de editar, lee todas las instrucciones del repositorio, especialmente `packages/web/AGENTS.md` y la documentación instalada de Next.js 16 aplicable al Service Worker. Empieza por la Fase 1 y no avances a la siguiente fase hasta tener pruebas y typecheck exitosos. No conviertas todos los requests HTTP en operaciones offline: aplica el modo offline únicamente a la matriz autorizada. Conserva `F1`/`F2` como nombres internos y P1/P2 como etiquetas visuales. Mantén el cierre atómico del FA enviando `selectedParticipantIds` como snapshot definitivo. Vincula los borradores de ronda a `roundId` y a la identidad del bloque de desempate; nunca los reconstruyas por filas `TIED` ni los apliques a otra ronda. El servidor debe seguir siendo la fuente oficial; agrega idempotencia, revisiones y conflictos estructurados antes de habilitar sincronización de datos de juzgamiento. Conserva la compatibilidad con Pusher Beams. No cambies reglas FEDEQUINAS ni algoritmos de consolidación como parte de este trabajo.

---

## 18. Decisión de alcance recomendada

La primera entrega productiva debe cubrir:

1. infraestructura offline;
2. veterinaria;
3. borradores FA;
4. borradores P1/P2/desempate, conservando `F1`/`F2` internamente;
5. notas y recordatorios;
6. barreras de cierre.

Las descalificaciones, cambios globales del Director Técnico, consolidaciones y resultado oficial deben permanecer online hasta que exista experiencia operativa suficiente para evaluar un protocolo de coordinación más complejo.
