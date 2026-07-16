# Modelo de datos completo — Pegasus

Documento generado a partir de las entidades TypeORM en `packages/core/src/entities/` y las migraciones en `packages/core/src/migrations/` (hasta `1717430400022`).

**Total: 35 tablas** | PostgreSQL + TypeORM | Patrón de sincronización Fedequinas en catálogos.

---

## Convenciones

### Clases base

| Clase | Campos heredados |
|-------|------------------|
| `PegasusBaseEntity` | `id`, `created_at`, `updated_at` |
| `SyncableEntity` | + `external_id`, `source_system` con `UNIQUE (external_id, source_system)` |

### Tipos comunes

| Tipo en BD | Uso |
|------------|-----|
| `uuid` | Claves primarias y foráneas |
| `varchar` | Texto corto, enums almacenados como string |
| `timestamp` | Fechas con hora |
| `date` | Solo fecha (ferias) |
| `jsonb` | Payload flexible (eventos, notificaciones) |
| `decimal(10,2)` | Edades, puntajes |

---

## Índice

1. [Catálogos Fedequinas](#1-catálogos-fedequinas)
2. [Maestros y ferias](#2-maestros-y-ferias)
3. [Autenticación](#3-autenticación)
4. [Flujo por etapas (Staged Flow)](#4-flujo-por-etapas-staged-flow)
5. [Rondas de juzgamiento F1 / F2](#5-rondas-de-juzgamiento-f1--f2)
6. [Premiación y recordatorios](#6-premiación-y-recordatorios)
7. [Diagrama de relaciones](#7-diagrama-de-relaciones)
8. [Tablas pendientes](#8-tablas-pendientes)

---

## 1. Catálogos Fedequinas

### `cities` — Entidad: `City`

Catálogo de ciudades.

| Campo | Tipo | Null | FK | Descripción |
|-------|------|------|----|-------------|
| `id` | uuid | NO | PK | Identificador interno |
| `external_id` | varchar | SÍ | | `CODIGO_CIUDAD` Fedequinas |
| `source_system` | varchar | SÍ | | Origen (p. ej. `FEDEQUINAS`) |
| `department_code` | varchar(20) | NO | | `CODIGO_DEPARTAMENTO` |
| `name` | varchar(255) | NO | | `NOMBRE_CIUDAD` |
| `created_at` | timestamp | NO | | |
| `updated_at` | timestamp | NO | | |

**Índices / restricciones:** `UNIQUE (external_id, source_system)`

---

### `roles` — Entidad: `Role`

Roles funcionales en ferias (director, juez, veterinario, etc.).

| Campo | Tipo | Null | FK | Descripción |
|-------|------|------|----|-------------|
| `id` | uuid | NO | PK | |
| `external_id` | varchar | SÍ | | `ID_ROL` Fedequinas |
| `source_system` | varchar | SÍ | | |
| `name` | varchar | NO | | `NOMBRE_ROL` |
| `type_role` | char(1) | NO | | `TIPO_ROL` (`D` director / `J` juez) |
| `created_at` | timestamp | NO | | |
| `updated_at` | timestamp | NO | | |

**Índices / restricciones:** `UNIQUE (external_id, source_system)`

---

### `grades` — Entidad: `Grade`

Grados de feria (Nacional, AA, etc.).

| Campo | Tipo | Null | FK | Descripción |
|-------|------|------|----|-------------|
| `id` | uuid | NO | PK | |
| `external_id` | varchar | SÍ | | `CODIGO_GRADO` |
| `source_system` | varchar | SÍ | | |
| `name` | varchar | NO | | `NOMBRE_GRADO` |
| `nomenclature` | varchar(2) | NO | | `NOMENCLATURA` (p. ej. `N`, `AA`) |
| `created_at` | timestamp | NO | | |
| `updated_at` | timestamp | NO | | |

**Índices / restricciones:** `UNIQUE (external_id, source_system)`

---

### `sexes` — Entidad: `Sex`

Sexo del ejemplar.

| Campo | Tipo | Null | FK | Descripción |
|-------|------|------|----|-------------|
| `id` | uuid | NO | PK | |
| `external_id` | varchar | SÍ | | `CODIGO_SEXO` |
| `source_system` | varchar | SÍ | | |
| `name` | varchar(50) | NO | | `NOMBRE_SEXO` (MACHO/HEMBRA) |
| `created_at` | timestamp | NO | | |
| `updated_at` | timestamp | NO | | |

**Índices / restricciones:** `UNIQUE (external_id, source_system)`

---

### `gaits` — Entidad: `Gait`

Tipos de andar (paso fino, trocha, etc.).

| Campo | Tipo | Null | FK | Descripción |
|-------|------|------|----|-------------|
| `id` | uuid | NO | PK | |
| `external_id` | varchar | SÍ | | `CODIGO_TIPO_ANDAR` |
| `source_system` | varchar | SÍ | | |
| `name` | varchar | NO | | `NOMBRE_TIPO_ANDAR` |
| `created_at` | timestamp | NO | | |
| `updated_at` | timestamp | NO | | |

**Índices / restricciones:** `UNIQUE (external_id, source_system)`

---

### `equine_types` — Entidad: `EquineType`

Tipos de equino (A/C/E/J/M).

| Campo | Tipo | Null | FK | Descripción |
|-------|------|------|----|-------------|
| `id` | uuid | NO | PK | |
| `external_id` | varchar | SÍ | | `CODIGO_TIP_EQUINO` |
| `source_system` | varchar | SÍ | | |
| `name` | varchar | NO | | `NOMBRE_TIP_EQUINO` |
| `created_at` | timestamp | NO | | |
| `updated_at` | timestamp | NO | | |

**Índices / restricciones:** `UNIQUE (external_id, source_system)`

---

### `titles` — Entidad: `Title`

Títulos de competencia.

| Campo | Tipo | Null | FK | Descripción |
|-------|------|------|----|-------------|
| `id` | uuid | NO | PK | |
| `external_id` | varchar | SÍ | | `CODIGO_TITULO` |
| `source_system` | varchar | SÍ | | |
| `name` | varchar(255) | NO | | `NOMBRE_TITULO` |
| `created_at` | timestamp | NO | | |
| `updated_at` | timestamp | NO | | |

**Índices / restricciones:** `UNIQUE (external_id, source_system)`

---

### `groupings` — Entidad: `Grouping`

Agrupadores de categorías (REGU, GYCC, GYPC, MEDY, etc.).

| Campo | Tipo | Null | FK | Descripción |
|-------|------|------|----|-------------|
| `id` | uuid | NO | PK | |
| `external_id` | varchar | SÍ | | Código agrupador |
| `source_system` | varchar | SÍ | | |
| `group_permission_code` | varchar(20) | SÍ | | Permiso asociado (pendiente catálogo) |
| `created_at` | timestamp | NO | | |
| `updated_at` | timestamp | NO | | |

**Índices / restricciones:** `UNIQUE (external_id, source_system)`

---

### `categories` — Entidad: `Category`

Categorías de competencia.

| Campo | Tipo | Null | FK | Descripción |
|-------|------|------|----|-------------|
| `id` | uuid | NO | PK | |
| `external_id` | varchar | SÍ | | `CODIGO_CATEGORIA` |
| `source_system` | varchar | SÍ | | |
| `name` | varchar(255) | NO | | `NOMBRE_CATEGORIA` |
| `sex_id` | uuid | NO | → `sexes` | Sexo requerido |
| `gait_id` | uuid | NO | → `gaits` | Tipo de andar |
| `equine_type_id` | uuid | NO | → `equine_types` | Tipo de equino |
| `min_age_months` | decimal(10,2) | NO | | `EDAD_MINIMA` |
| `max_age_months` | decimal(10,2) | NO | | `EDAD_MAXIMA` |
| `next_category_code` | varchar(20) | SÍ | | `SIGUIENTE_CATEGORIA` (código, no FK) |
| `grouping_id` | uuid | NO | → `groupings` | Agrupador |
| `large_camps` | integer | NO | | `GRANDES_CAMP` |
| `created_at` | timestamp | NO | | |
| `updated_at` | timestamp | NO | | |

**Índices / restricciones:**
- `UNIQUE (external_id, source_system)`
- `CHECK (min_age_months <= max_age_months)`

---

## 2. Maestros y ferias

### `people` — Entidad: `Person`

Personas del ecosistema (jueces, criadores, montadores, etc.).

| Campo | Tipo | Null | FK | Descripción |
|-------|------|------|----|-------------|
| `id` | uuid | NO | PK | |
| `external_id` | varchar | SÍ | | `ID_PERSONAL` |
| `source_system` | varchar | SÍ | | |
| `name` | varchar | NO | | `NOMBRE_PERSONA` |
| `last_name` | varchar | NO | | `APELLIDO_PERSONA` |
| `address` | varchar | SÍ | | `DIRECCION_PERSONA` |
| `indicative` | varchar | SÍ | | `INDICATIVO` |
| `telephone` | varchar | SÍ | | `TELEFONO` |
| `phone` | varchar | SÍ | | `CELULAR` |
| `avantel_phone` | varchar | SÍ | | `AVANTEL` |
| `email` | varchar | SÍ | | `CORREO_ELECTRONICO` |
| `created_at` | timestamp | NO | | |
| `updated_at` | timestamp | NO | | |

**Índices / restricciones:** `UNIQUE (external_id, source_system)`

---

### `fairs` — Entidad: `Fair`

Ferias equinas.

| Campo | Tipo | Null | FK | Descripción |
|-------|------|------|----|-------------|
| `id` | uuid | NO | PK | |
| `external_id` | varchar | SÍ | | `ID_FERIA` |
| `source_system` | varchar | SÍ | | |
| `name` | varchar(255) | SÍ | | `DESCRIPCION` |
| `year` | integer | SÍ | | `ANO` |
| `start_date` | date | SÍ | | `FECHA_INICIO` |
| `end_date` | date | SÍ | | `FECHA_FIN` |
| `city_id` | uuid | SÍ | → `cities` | `CODIGO_CIUDAD` |
| `grade_id` | uuid | SÍ | → `grades` | `CODIGO_GRADO` |
| `comments` | text | SÍ | | `OBSERVACIONES` |
| `registered_count` | integer | SÍ | | `INSCRITOS` |
| `created_at` | timestamp | NO | | |
| `updated_at` | timestamp | NO | | |

**Índices / restricciones:** `UNIQUE (external_id, source_system)`

---

### `fair_entries` — Entidad: `FairEntry`

Inscripciones / montadores por feria y categoría.

| Campo | Tipo | Null | FK | Descripción |
|-------|------|------|----|-------------|
| `id` | uuid | NO | PK | |
| `external_id` | varchar | SÍ | | `NUMERO_INSCRIPCION` |
| `source_system` | varchar | SÍ | | |
| `fair_id` | uuid | NO | → `fairs` | Feria |
| `registration_number` | varchar | NO | | `NUMERO_REGISTRO` del ejemplar |
| `category_id` | uuid | NO | → `categories` | Categoría |
| `track_position` | integer | NO | | `POSICION_PISTA` |
| `rider_name` | varchar | NO | | `MONTADOR` |
| `rider_document_number` | varchar(50) | NO | | `ID_MONTADOR` |
| `receipt` | varchar(50) | NO | | `RECIBO` |
| `participate` | boolean | NO | | `PARTICIPA` |
| `fair_sequence` | integer | NO | | `CONSECUTIVO_FERIA` |
| `is_child` | boolean | NO | | `ES_HIJO` |
| `created_at` | timestamp | NO | | |
| `updated_at` | timestamp | NO | | |

**Índices / restricciones:** `UNIQUE (external_id, source_system)`

---

### `fair_staff` — Entidad: `FairStaff`

Personal asignado a una feria con un rol.

| Campo | Tipo | Null | FK | Descripción |
|-------|------|------|----|-------------|
| `id` | uuid | NO | PK | |
| `external_id` | varchar | SÍ | | `ID_PERSONAL_FERIA` |
| `source_system` | varchar | SÍ | | |
| `fair_id` | uuid | NO | → `fairs` | |
| `person_id` | uuid | NO | → `people` | |
| `role_id` | uuid | NO | → `roles` | |
| `created_at` | timestamp | NO | | |
| `updated_at` | timestamp | NO | | |

**Índices / restricciones:** `UNIQUE (external_id, source_system)`

---

### `fair_results` — Entidad: `FairResult`

Resultados históricos por inscripción y título (hoja Fedequinas `FEH_RESULTADO_FERIAS`).

| Campo | Tipo | Null | FK | Descripción |
|-------|------|------|----|-------------|
| `id` | uuid | NO | PK | |
| `external_id` | varchar | SÍ | | Generalmente `NULL` en Fedequinas |
| `source_system` | varchar | SÍ | | |
| `fair_id` | uuid | NO | → `fairs` | |
| `fair_entry_id` | uuid | NO | → `fair_entries` | |
| `grade_id` | uuid | NO | → `grades` | |
| `category_id` | uuid | NO | → `categories` | |
| `title_id` | uuid | NO | → `titles` | |
| `position_obtained` | integer | NO | | `PUESTO_OBTENIDO` |
| `score` | decimal(10,2) | NO | | `PUNTAJE_EJEMPLAR` |
| `created_at` | timestamp | NO | | |
| `updated_at` | timestamp | NO | | |

**Índices / restricciones:**
- `UNIQUE (external_id, source_system)`
- `UNIQUE (fair_id, fair_entry_id, category_id, title_id)` — clave de negocio

---

## 3. Autenticación

### `users` — Entidad: `User`

Acceso al sistema para staff operativo.

| Campo | Tipo | Null | FK | Descripción |
|-------|------|------|----|-------------|
| `id` | uuid | NO | PK | |
| `person_id` | uuid | SÍ | → `people` | Vínculo opcional a persona Fedequinas |
| `email` | varchar | SÍ | | Único si presente |
| `password_hash` | varchar | SÍ | | Hash de contraseña |
| `access_code_hash` | varchar | SÍ | | Hash de código de acceso (PIN) |
| `role` | varchar | NO | | Ver valores abajo |
| `is_active` | boolean | NO | | Default `true` |
| `last_login_at` | timestamp | SÍ | | Último inicio de sesión |
| `created_at` | timestamp | NO | | |
| `updated_at` | timestamp | NO | | |

**Valores de `role`:** `ROOT`, `ADMIN`, `JUDGE`, `TECHNICAL_DIRECTOR`, `VETERINARIAN`, `STAFF`, `VIEWER`

**Índices:** `UNIQUE (email)`, `IDX_users_role`, `IDX_users_is_active`

---

## 4. Flujo por etapas (Staged Flow)

El estado operativo de una categoría en una feria vive en `fair_category_stages`, no en `categories`.

### `fair_category_stages` — Entidad: `FairCategoryStage`

Instancia feria + categoría con su ciclo de juzgamiento.

| Campo | Tipo | Null | FK | Descripción |
|-------|------|------|----|-------------|
| `id` | uuid | NO | PK | |
| `fair_id` | uuid | NO | → `fairs` | |
| `category_id` | uuid | NO | → `categories` | |
| `status` | varchar | NO | | Ver estados abajo |
| `pre_ring_started_at` | timestamp | SÍ | | Inicio pre-pista |
| `pre_ring_started_by_user_id` | uuid | SÍ | → `users` | Director técnico |
| `pre_ring_closed_at` | timestamp | SÍ | | Cierre pre-pista |
| `pre_ring_closed_by_user_id` | uuid | SÍ | → `users` | Veterinario |
| `judging_started_at` | timestamp | SÍ | | Inicio juzgamiento |
| `judging_started_by_user_id` | uuid | SÍ | → `users` | |
| `fa_consolidated_at` | timestamp | SÍ | | FA consolidado |
| `fa_consolidated_by_user_id` | uuid | SÍ | → `users` | |
| `judging_closed_at` | timestamp | SÍ | | Juzgamiento cerrado |
| `judging_closed_by_user_id` | uuid | SÍ | → `users` | |
| `deserted_at` | timestamp | SÍ | | Competencia declarada desierta |
| `deserted_by_user_id` | uuid | SÍ | → `users` | |
| `deserted_reason` | text | SÍ | | Motivo de desierto |
| `created_at` | timestamp | NO | | |
| `updated_at` | timestamp | NO | | |

**Valores de `status`:**
`NOT_STARTED` · `PRE_RING_STARTED` · `PRE_RING_CLOSED` · `JUDGING_STARTED` · `FA_CONSOLIDATED` · `F1_IN_PROGRESS` · `F1_CONSOLIDATED` · `F2_IN_PROGRESS` · `TIE_BREAK_IN_PROGRESS` · `JUDGING_DESERTED` · `JUDGING_CLOSED`

**Índices / restricciones:**
- `UNIQUE (fair_id, category_id)`
- `IDX_fair_category_stages_status`

---

### `veterinary_checks` — Entidad: `VeterinaryCheck`

Chequeo veterinario por inscripción en pre-pista.

| Campo | Tipo | Null | FK | Descripción |
|-------|------|------|----|-------------|
| `id` | uuid | NO | PK | |
| `fair_category_stage_id` | uuid | NO | → `fair_category_stages` | |
| `fair_entry_id` | uuid | NO | → `fair_entries` | |
| `veterinarian_user_id` | uuid | SÍ | → `users` | Veterinario que revisó |
| `status` | varchar | NO | | `PENDING` · `APPROVED` · `REJECTED` · `ABSENT` |
| `notes` | text | SÍ | | Observaciones |
| `checked_at` | timestamp | SÍ | | Fecha del chequeo |
| `created_at` | timestamp | NO | | |
| `updated_at` | timestamp | NO | | |

**Índices / restricciones:**
- `UNIQUE (fair_category_stage_id, fair_entry_id)`
- `IDX_veterinary_checks_status`

---

### `disqualification_reasons` — Entidad: `DisqualificationReason`

Catálogo de motivos de descalificación.

| Campo | Tipo | Null | FK | Descripción |
|-------|------|------|----|-------------|
| `id` | uuid | NO | PK | |
| `external_id` | varchar | SÍ | | |
| `source_system` | varchar | SÍ | | |
| `code` | varchar | NO | | Código único del motivo |
| `name` | varchar | NO | | Nombre corto |
| `description` | text | SÍ | | Descripción extendida |
| `is_active` | boolean | NO | | Default `true` |
| `created_at` | timestamp | NO | | |
| `updated_at` | timestamp | NO | | |

**Índices / restricciones:**
- `UNIQUE (external_id, source_system)`
- `UNIQUE (code)`

---

### `judging_participants` — Entidad: `JudgingParticipant`

Participante activo en el juzgamiento de una etapa (vínculo etapa ↔ inscripción).

| Campo | Tipo | Null | FK | Descripción |
|-------|------|------|----|-------------|
| `id` | uuid | NO | PK | |
| `fair_category_stage_id` | uuid | NO | → `fair_category_stages` | |
| `fair_entry_id` | uuid | NO | → `fair_entries` | |
| `status` | varchar | NO | | `ELIGIBLE` · `DISQUALIFIED` |
| `disqualified_by_judge_form_id` | uuid | SÍ | → `fa_judge_forms` | Formulario FA que descalificó |
| `disqualified_by_user_id` | uuid | SÍ | → `users` | Usuario que descalificó |
| `disqualified_in_round_id` | uuid | SÍ | → `judging_rounds` | Ronda F1/F2/desempate |
| `disqualified_in_round_form_id` | uuid | SÍ | → `judging_round_forms` | Formulario de ronda |
| `disqualification_reason_id` | uuid | SÍ | → `disqualification_reasons` | |
| `disqualified_at` | timestamp | SÍ | | |
| `created_at` | timestamp | NO | | |
| `updated_at` | timestamp | NO | | |

**Índices / restricciones:**
- `UNIQUE (fair_category_stage_id, fair_entry_id)`
- `IDX_judging_participants_status`
- `IDX_judging_participants_disqualified_in_round_id`

---

### `fa_judge_forms` — Entidad: `FaJudgeForm`

Formulario FA (selección inicial) por juez y etapa.

| Campo | Tipo | Null | FK | Descripción |
|-------|------|------|----|-------------|
| `id` | uuid | NO | PK | |
| `fair_category_stage_id` | uuid | NO | → `fair_category_stages` | |
| `judge_user_id` | uuid | NO | → `users` | |
| `status` | varchar | NO | | `PENDING` · `STARTED` · `CLOSED` |
| `started_at` | timestamp | SÍ | | |
| `closed_at` | timestamp | SÍ | | |
| `created_at` | timestamp | NO | | |
| `updated_at` | timestamp | NO | | |

**Índices / restricciones:**
- `UNIQUE (fair_category_stage_id, judge_user_id)`
- `IDX_fa_judge_forms_status`

---

### `fa_judge_entry_decisions` — Entidad: `FaJudgeEntryDecision`

Decisión del juez por participante en el Formato FA.

| Campo | Tipo | Null | FK | Descripción |
|-------|------|------|----|-------------|
| `id` | uuid | NO | PK | |
| `fa_judge_form_id` | uuid | NO | → `fa_judge_forms` | |
| `judging_participant_id` | uuid | NO | → `judging_participants` | |
| `decision` | varchar | NO | | `SELECTED` · `DISCARDED` · `DISQUALIFIED` |
| `selection_order` | integer | SÍ | | Orden de selección si aplica |
| `disqualification_reason_id` | uuid | SÍ | → `disqualification_reasons` | |
| `created_at` | timestamp | NO | | |
| `updated_at` | timestamp | NO | | |

**Índices / restricciones:** `UNIQUE (fa_judge_form_id, judging_participant_id)`

---

### `fa_consolidated_results` — Entidad: `FaConsolidatedResult`

Resultado consolidado del Formato FA por participante.

| Campo | Tipo | Null | FK | Descripción |
|-------|------|------|----|-------------|
| `id` | uuid | NO | PK | |
| `fair_category_stage_id` | uuid | NO | → `fair_category_stages` | |
| `judging_participant_id` | uuid | NO | → `judging_participants` | |
| `votes_count` | integer | NO | | Votos de jueces que lo seleccionaron |
| `final_position` | integer | SÍ | | Posición tras consolidar FA |
| `created_at` | timestamp | NO | | |
| `updated_at` | timestamp | NO | | |

**Índices / restricciones:** `UNIQUE (fair_category_stage_id, judging_participant_id)`

---

### `workflow_events` — Entidad: `WorkflowEvent`

Auditoría de transiciones y eventos del flujo.

| Campo | Tipo | Null | FK | Descripción |
|-------|------|------|----|-------------|
| `id` | uuid | NO | PK | |
| `fair_category_stage_id` | uuid | NO | → `fair_category_stages` | |
| `user_id` | uuid | SÍ | → `users` | Actor del evento |
| `event_type` | varchar | NO | | Tipo de evento |
| `from_status` | varchar | SÍ | | Estado anterior |
| `to_status` | varchar | SÍ | | Estado nuevo |
| `payload` | jsonb | SÍ | | Datos adicionales |
| `created_at` | timestamp | NO | | |
| `updated_at` | timestamp | NO | | |

---

### `notification_outbox` — Entidad: `NotificationOutbox`

Cola de notificaciones push (Pusher Beams) e inbox del usuario.

| Campo | Tipo | Null | FK | Descripción |
|-------|------|------|----|-------------|
| `id` | uuid | NO | PK | |
| `recipient_user_id` | uuid | SÍ | → `users` | Destinatario directo |
| `recipient_role` | varchar | SÍ | | Rol destinatario (broadcast por rol) |
| `fair_category_stage_id` | uuid | SÍ | → `fair_category_stages` | Contexto |
| `provider` | varchar | NO | | Default `PUSHER_BEAMS` |
| `type` | varchar | NO | | Tipo semántico de notificación |
| `title` | varchar | NO | | Título |
| `body` | text | NO | | Cuerpo |
| `payload` | jsonb | SÍ | | Datos extra |
| `status` | varchar | NO | | `PENDING` · `SENT` · `FAILED` |
| `attempt_count` | int | NO | | Reintentos de envío |
| `processing_started_at` | timestamp | SÍ | | Lock de despacho |
| `next_retry_at` | timestamp | SÍ | | Próximo reintento |
| `publish_attempted_at` | timestamp | SÍ | | Intento de publicación |
| `beams_publish_id` | varchar | SÍ | | ID idempotencia Pusher |
| `sent_at` | timestamp | SÍ | | Enviada |
| `read_at` | timestamp | SÍ | | Leída por el usuario |
| `archived_at` | timestamp | SÍ | | Archivada en inbox |
| `failed_at` | timestamp | SÍ | | Fallo definitivo |
| `error_message` | text | SÍ | | Detalle del error |
| `created_at` | timestamp | NO | | |
| `updated_at` | timestamp | NO | | |

**Índices:**
- `IDX_notification_outbox_status`
- `IDX_notification_outbox_inbox (recipient_user_id, archived_at, read_at, created_at)`

---

## 5. Rondas de juzgamiento F1 / F2

El FA usa tablas dedicadas (`fa_*`). A partir del FA consolidado, F1, F2 y desempates usan estas tablas genéricas.

### `judging_rounds` — Entidad: `JudgingRound`

Ronda de juzgamiento (F1, F2 o desempate).

| Campo | Tipo | Null | FK | Descripción |
|-------|------|------|----|-------------|
| `id` | uuid | NO | PK | |
| `fair_category_stage_id` | uuid | NO | → `fair_category_stages` | |
| `round_type` | varchar | NO | | `F1` · `F2` · `TIE_BREAK` |
| `sequence` | integer | NO | | Secuencia (varios desempates: 1, 2, …) |
| `status` | varchar | NO | | `OPEN` · `CONSOLIDATED` · `CLOSED` |
| `parent_round_id` | uuid | SÍ | → `judging_rounds` | F2 padre si es desempate |
| `opened_at` | timestamp | SÍ | | |
| `opened_by_user_id` | uuid | SÍ | → `users` | |
| `consolidated_at` | timestamp | SÍ | | |
| `consolidated_by_user_id` | uuid | SÍ | → `users` | |
| `closed_at` | timestamp | SÍ | | |
| `closed_by_user_id` | uuid | SÍ | → `users` | |
| `created_at` | timestamp | NO | | |
| `updated_at` | timestamp | NO | | |

**Índices / restricciones:**
- `UNIQUE (fair_category_stage_id, round_type, sequence)`
- `IDX_judging_rounds_stage`
- `IDX_judging_rounds_status`

---

### `judging_round_forms` — Entidad: `JudgingRoundForm`

Formulario de ronda por juez.

| Campo | Tipo | Null | FK | Descripción |
|-------|------|------|----|-------------|
| `id` | uuid | NO | PK | |
| `round_id` | uuid | NO | → `judging_rounds` | |
| `judge_user_id` | uuid | NO | → `users` | |
| `status` | varchar | NO | | `PENDING` · `STARTED` · `CLOSED` |
| `started_at` | timestamp | SÍ | | |
| `closed_at` | timestamp | SÍ | | |
| `created_at` | timestamp | NO | | |
| `updated_at` | timestamp | NO | | |

**Índices / restricciones:**
- `UNIQUE (round_id, judge_user_id)`
- `IDX_judging_round_forms_round`

---

### `judging_round_entries` — Entidad: `JudgingRoundEntry`

Entrada del formulario: selección F1 o posición F2/desempate.

| Campo | Tipo | Null | FK | Descripción |
|-------|------|------|----|-------------|
| `id` | uuid | NO | PK | |
| `round_form_id` | uuid | NO | → `judging_round_forms` | |
| `judging_participant_id` | uuid | NO | → `judging_participants` | |
| `selected` | boolean | NO | | F1: cabeza de lote seleccionada |
| `position` | integer | SÍ | | F2/desempate: puesto ordinal (1 = mejor) |
| `private_note` | varchar(1000) | SÍ | | F1: nota privada del juez |
| `created_at` | timestamp | NO | | |
| `updated_at` | timestamp | NO | | |

**Índices / restricciones:**
- `UNIQUE (round_form_id, judging_participant_id)`
- `IDX_judging_round_entries_form`

---

### `judging_round_form_deserted_positions` — Entidad: `JudgingRoundFormDesertedPosition`

Puestos marcados como desiertos por un juez en su formulario F2.

| Campo | Tipo | Null | FK | Descripción |
|-------|------|------|----|-------------|
| `id` | uuid | NO | PK | |
| `round_form_id` | uuid | NO | → `judging_round_forms` | |
| `position` | integer | NO | | Puesto (1–5) |
| `created_at` | timestamp | NO | | |
| `updated_at` | timestamp | NO | | |

**Índices / restricciones:**
- `UNIQUE (round_form_id, position)`
- `IDX_judging_round_form_deserted_positions_form`

---

### `judging_round_results` — Entidad: `JudgingRoundResult`

Resultado consolidado por participante en una ronda.

| Campo | Tipo | Null | FK | Descripción |
|-------|------|------|----|-------------|
| `id` | uuid | NO | PK | |
| `round_id` | uuid | NO | → `judging_rounds` | |
| `judging_participant_id` | uuid | NO | → `judging_participants` | |
| `score_value` | integer | NO | | F1: votos; F2: suma de puestos |
| `first_place_votes` | integer | NO | | F2: tarjetas en primer puesto |
| `final_position` | integer | SÍ | | Puesto final asignado |
| `status` | varchar | NO | | `PROVISIONAL` · `TIED` · `FINAL` |
| `created_at` | timestamp | NO | | |
| `updated_at` | timestamp | NO | | |

**Índices / restricciones:**
- `UNIQUE (round_id, judging_participant_id)`
- `IDX_judging_round_results_round`

---

### `judging_round_deserted_results` — Entidad: `JudgingRoundDesertedResult`

Puestos desiertos consolidados en la ronda.

| Campo | Tipo | Null | FK | Descripción |
|-------|------|------|----|-------------|
| `id` | uuid | NO | PK | |
| `round_id` | uuid | NO | → `judging_rounds` | |
| `final_position` | integer | NO | | Puesto desierto (1–5) |
| `votes_count` | integer | NO | | Votos de jueces que lo marcaron desierto |
| `created_at` | timestamp | NO | | |
| `updated_at` | timestamp | NO | | |

**Índices / restricciones:**
- `UNIQUE (round_id, final_position)`
- `IDX_judging_round_deserted_results_round`

---

### `tie_break_tests` — Entidad: `TieBreakTest`

Pruebas de desempate asociadas a una ronda `TIE_BREAK`.

| Campo | Tipo | Null | FK | Descripción |
|-------|------|------|----|-------------|
| `id` | uuid | NO | PK | |
| `round_id` | uuid | NO | → `judging_rounds` | |
| `test_type` | varchar | NO | | Ver tipos abajo |
| `test_order` | integer | NO | | Orden de aplicación |
| `status` | varchar | NO | | `PENDING` · `ACTIVE` · `DONE` |
| `created_at` | timestamp | NO | | |
| `updated_at` | timestamp | NO | | |

**Valores de `test_type`:**
`DOUBLE_TABLE` · `DIRECTION_CHANGE` · `PARALLEL` · `CIRCLES` · `STOP_AND_GO` · `GAIT_CHANGE` · `MOUNT`

**Índices / restricciones:** `UNIQUE (round_id, test_type)`

**Constante de dominio:** `MAX_AWARD_POSITIONS = 5` (máximo de puestos premiados / cintas F2)

---

## 6. Premiación y recordatorios

### `award_distinctives` — Entidad: `AwardDistinctive`

Distintivos configurables para los 5 puestos premiados (color, etiqueta).

| Campo | Tipo | Null | FK | Descripción |
|-------|------|------|----|-------------|
| `id` | uuid | NO | PK | |
| `position` | integer | NO | | Puesto 1–5 |
| `label` | varchar | NO | | Etiqueta visible |
| `color_name` | varchar | NO | | Nombre del color |
| `color_hex` | varchar | SÍ | | Código hex opcional |
| `is_active` | boolean | NO | | |
| `created_at` | timestamp | NO | | |
| `updated_at` | timestamp | NO | | |

**Índices / restricciones:** `UNIQUE (position)`

**Seed inicial:** 5 registros (puestos 1–5, colores "Por definir")

---

### `judging_reminders` — Entidad: `JudgingReminder`

Catálogo de recordatorios para jueces en F1 (icono + nombre).

| Campo | Tipo | Null | FK | Descripción |
|-------|------|------|----|-------------|
| `id` | uuid | NO | PK | |
| `name` | varchar | NO | | Nombre del recordatorio |
| `icon` | varchar | NO | | Identificador de icono |
| `is_active` | boolean | NO | | |
| `created_at` | timestamp | NO | | |
| `updated_at` | timestamp | NO | | |

**Índices / restricciones:** `UNIQUE (name)`

---

### `judging_round_entry_reminders` — Entidad: `JudgingRoundEntryReminder`

Recordatorio aplicado a una entrada de formulario de ronda.

| Campo | Tipo | Null | FK | Descripción |
|-------|------|------|----|-------------|
| `id` | uuid | NO | PK | |
| `round_form_entry_id` | uuid | NO | → `judging_round_entries` | CASCADE delete |
| `judging_reminder_id` | uuid | NO | → `judging_reminders` | |
| `effect` | varchar | NO | | `SUMA` · `RESTA` |
| `created_at` | timestamp | NO | | |
| `updated_at` | timestamp | NO | | |

**Índices / restricciones:**
- `UNIQUE (round_form_entry_id, judging_reminder_id)`
- `IDX_judging_round_entry_reminders_entry`

---

### `judging_round_entry_reminder_history` — Entidad: `JudgingRoundEntryReminderHistory`

Historial inmutable de recordatorios aplicados (snapshots al momento de la acción).

| Campo | Tipo | Null | FK | Descripción |
|-------|------|------|----|-------------|
| `id` | uuid | NO | PK | |
| `round_form_id` | uuid | NO | → `judging_round_forms` | CASCADE delete |
| `round_form_entry_id` | uuid | NO | → `judging_round_entries` | CASCADE delete |
| `judging_reminder_id` | uuid | NO | → `judging_reminders` | |
| `effect` | varchar | NO | | `SUMA` · `RESTA` |
| `track_position_snapshot` | integer | NO | | Posición en pista al aplicar |
| `rider_name_snapshot` | varchar | NO | | Nombre montador al aplicar |
| `reminder_name_snapshot` | varchar | NO | | Nombre recordatorio al aplicar |
| `reminder_icon_snapshot` | varchar | NO | | Icono recordatorio al aplicar |
| `created_at` | timestamp | NO | | |
| `updated_at` | timestamp | NO | | |

**Índices:** `IDX_judging_round_entry_reminder_history_form_created (round_form_id, created_at DESC)`

---

## 7. Diagrama de relaciones

```text
CATÁLOGOS                          OPERATIVAS FERIA
──────────                         ────────────────
sexes ──┐                          fairs ──┬── fair_entries ── categories
gaits ──┼── categories                   ├── fair_staff ── people ── users
equine_types ─┘                          ├── fair_results
groupings ──┘                            └── fair_category_stages
cities ── fairs                                    │
grades ── fairs                                    │
roles ── fair_staff                                │
titles ── fair_results                             │
                                                   ▼
                              ┌────────────────────────────────────────┐
                              │         STAGED FLOW + JUZGAMIENTO       │
                              ├────────────────────────────────────────┤
                              │ veterinary_checks                      │
                              │ judging_participants                   │
                              │ fa_judge_forms → fa_judge_entry_decisions │
                              │ fa_consolidated_results              │
                              │ judging_rounds (F1/F2/TIE_BREAK)       │
                              │   ├── judging_round_forms              │
                              │   │     ├── judging_round_entries      │
                              │   │     │     └── judging_round_entry_reminders │
                              │   │     └── judging_round_form_deserted_positions │
                              │   ├── judging_round_results            │
                              │   ├── judging_round_deserted_results   │
                              │   └── tie_break_tests                  │
                              │ workflow_events                        │
                              │ notification_outbox                    │
                              └────────────────────────────────────────┘

CONFIGURACIÓN
─────────────
award_distinctives
judging_reminders
disqualification_reasons
```

---

## 8. Tablas pendientes

No implementadas en el esquema actual:

| Tabla | Propósito |
|-------|-----------|
| `associations` | Asociaciones equinas |
| `fair_associations` | Asociaciones por feria |
| `horses` | Ejemplares como entidad propia |
| `person_roles` | Roles de persona independientes de feria |
| `grouping_permissions` | Permisos por agrupador |
| `sync_batches` | Lotes de sincronización |
| `sync_mappings` | Mapeo de IDs externos |

---

## Migraciones (orden de ejecución)

| # | Archivo | Descripción |
|---|---------|-------------|
| 1 | `1717430400000-CreateInitialSchema` | Catálogos + people + fairs + categories |
| 2 | `1717430400001-ExpandGradesNomenclature` | `grades.nomenclature` → varchar(2) |
| 3 | `1717430400002-DropFairsStatusColumn` | Elimina `fairs.status` errónea |
| 4 | `1717430400003-AddFairsRegisteredCount` | `fairs.registered_count` |
| 5 | `1717430400004-CreateFairEntriesTable` | `fair_entries` |
| 6 | `1717430400005-AddCategoryAgeCheck` | CHECK edad en `categories` |
| 7 | `1717430400006-AlterPeopleTable` | Rediseño `people` |
| 8 | `1717430400007-CreateFairStaffTable` | `fair_staff` |
| 9 | `1717430400008-CreateFairResultsTable` | `fair_results` |
| 10 | `1717430400009-AlterFairResultsUniqueConstraint` | UNIQUE negocio `fair_results` |
| 11 | `1717430400010-CreateUsersTable` | `users` |
| 12 | `1717430400011-AddUserAccessCode` | `users.access_code_hash` |
| 13 | `1717430400012-CreateStagedFlowTables` | Flujo por etapas (9 tablas) |
| 14 | `1717430400013-AddNotificationInboxFields` | `read_at`, `archived_at` en outbox |
| 15 | `1717430400014-CreateJudgingRoundsTables` | Rondas F1/F2/desempate |
| 16 | `1717430400015-AddDesertedSupport` | Puestos desiertos + etapa desierta |
| 17 | `1717430400016-CreateAwardDistinctives` | Distintivos premiación |
| 18 | `1717430400017-CreateJudgingReminders` | Catálogo recordatorios |
| 19 | `1717430400018-AddRoundEntryAnnotations` | Notas + recordatorios en entradas |
| 20 | `1717430400019-AddRoundDisqualificationTraceability` | Trazabilidad descalificación en rondas |
| 21 | `1717430400020-AddNotificationOutboxAttemptCount` | Reintentos outbox |
| 22 | `1717430400021-AddNotificationDispatchLocking` | Lock de despacho |
| 23 | `1717430400022-AddNotificationPublishIdempotency` | Idempotencia Pusher |

**Comandos:**

```bash
pnpm migration:show
pnpm migration:run
```
