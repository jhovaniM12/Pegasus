# Modelo de Datos Inicial - Pegasus

## Introducción

Este documento describe el modelo de datos actual del sistema Pegasus en su fase inicial: catálogos sincronizables con Fedequinas y tablas operativas de ferias (inscripciones, personal y resultados).

Todas las tablas sincronizables comparten el patrón `SyncableEntity`:

* `id` — UUID como llave primaria.
* `external_id` — identificador original del sistema externo (principalmente Fedequinas).
* `source_system` — origen del dato (p. ej. `FEDEQUINAS`).
* `created_at` / `updated_at` — timestamps de auditoría.

Unicidad compuesta en entidades sincronizables:

```text
UNIQUE (external_id, source_system)
```

## Tablas activas (15)

| Tabla          | Tipo        | Descripción breve                          |
| -------------- | ----------- | -------------------------------------------- |
| `cities`       | Catálogo    | Ciudades                                     |
| `roles`        | Catálogo    | Roles funcionales en ferias                    |
| `grades`       | Catálogo    | Grados de feria                              |
| `sexes`        | Catálogo    | Sexos de ejemplares                          |
| `gaits`        | Catálogo    | Tipos de andar                               |
| `equine_types` | Catálogo    | Tipos de equino                              |
| `titles`       | Catálogo    | Títulos de competencia                       |
| `groupings`    | Catálogo    | Agrupadores de categorías                    |
| `categories`   | Catálogo    | Categorías de competencia                    |
| `people`       | Maestro     | Personas (jueces, criadores, etc.)           |
| `fairs`        | Operativa   | Ferias equinas                               |
| `fair_entries` | Operativa   | Inscripciones / montadores por feria         |
| `fair_staff`   | Operativa   | Personal asignado a una feria con un rol     |
| `fair_results` | Operativa   | Resultados por inscripción y título          |

Tablas **no** implementadas en esta fase: `associations`, `horses`, `person_roles`, `fair_associations`, `grouping_permissions`, staging/sync.

---

# Tabla: cities

Catálogo de ciudades utilizadas por ferias y demás entidades del sistema.

| Campo             | Tipo        | Descripción                                            |
| ----------------- | ----------- | ------------------------------------------------------ |
| id                | uuid        | Identificador interno.                                 |
| external_id       | varchar     | `CODIGO_CIUDAD` en Fedequinas.                         |
| source_system     | varchar     | Sistema origen.                                        |
| department_code   | varchar(20) | `CODIGO_DEPARTAMENTO` en Fedequinas.                   |
| name              | varchar(255)| `NOMBRE_CIUDAD` en Fedequinas.                         |
| created_at        | timestamp   | Fecha de creación.                                     |
| updated_at        | timestamp   | Fecha de actualización.                                |

**Seed:** `pnpm db:seed:ciudades` — ~1.754 registros Fedequinas.

---

# Tabla: roles

Catálogo de roles funcionales dentro de ferias.

| Campo         | Tipo      | Descripción                              |
| ------------- | --------- | ---------------------------------------- |
| id            | uuid      | Identificador interno.                   |
| external_id   | varchar   | `ID_ROL` en Fedequinas.                  |
| source_system | varchar   | Sistema origen.                          |
| name          | varchar   | `NOMBRE_ROL` en Fedequinas.              |
| type_role     | char(1)   | `TIPO_ROL` en Fedequinas (`D` / `J`).    |
| created_at    | timestamp | Fecha de creación.                       |
| updated_at    | timestamp | Fecha de actualización.                  |

**Seed:** `pnpm db:seed` — 28 roles Fedequinas.

---

# Tabla: grades

Catálogo de grados de feria.

| Campo         | Tipo        | Descripción                        |
| ------------- | ----------- | ---------------------------------- |
| id            | uuid        | Identificador interno.             |
| external_id   | varchar     | `CODIGO_GRADO` en Fedequinas.      |
| source_system | varchar     | Sistema origen.                    |
| name          | varchar     | `NOMBRE_GRADO` en Fedequinas.      |
| nomenclature  | varchar(2)  | `NOMENCLATURA` (p. ej. `N`, `AA`). |
| created_at    | timestamp   | Fecha de creación.                 |
| updated_at    | timestamp   | Fecha de actualización.            |

**Seed:** `pnpm db:seed:grades` — 6 grados Fedequinas.

---

# Tabla: sexes

| Campo         | Tipo      | Descripción                   |
| ------------- | --------- | ----------------------------- |
| id            | uuid      | Identificador interno.        |
| external_id   | varchar   | `CODIGO_SEXO` en Fedequinas.  |
| source_system | varchar   | Sistema origen.               |
| name          | varchar(50)| `NOMBRE_SEXO` (MACHO/HEMBRA).|
| created_at    | timestamp | Fecha de creación.            |
| updated_at    | timestamp | Fecha de actualización.       |

**Seed:** `pnpm db:seed:sexes` — 2 registros.

---

# Tabla: gaits

Catálogo de tipos de andar.

| Campo         | Tipo      | Descripción                          |
| ------------- | --------- | ------------------------------------ |
| id            | uuid      | Identificador interno.               |
| external_id   | varchar   | `CODIGO_TIPO_ANDAR` (p. ej. `P1`).   |
| source_system | varchar   | Sistema origen.                      |
| name          | varchar   | `NOMBRE_TIPO_ANDAR`.                 |
| created_at    | timestamp | Fecha de creación.                   |
| updated_at    | timestamp | Fecha de actualización.              |

**Seed:** `pnpm db:seed:gaits` — 5 andares.

---

# Tabla: equine_types

| Campo         | Tipo      | Descripción                        |
| ------------- | --------- | ---------------------------------- |
| id            | uuid      | Identificador interno.             |
| external_id   | varchar   | `CODIGO_TIP_EQUINO` (A/C/E/J/M).   |
| source_system | varchar   | Sistema origen.                    |
| name          | varchar   | `NOMBRE_TIP_EQUINO`.               |
| created_at    | timestamp | Fecha de creación.                 |
| updated_at    | timestamp | Fecha de actualización.            |

**Seed:** `pnpm db:seed:equine-types` — 5 tipos.

---

# Tabla: titles

| Campo         | Tipo        | Descripción              |
| ------------- | ----------- | ------------------------ |
| id            | uuid        | Identificador interno.   |
| external_id   | varchar     | `CODIGO_TITULO`.         |
| source_system | varchar     | Sistema origen.          |
| name          | varchar(255)| `NOMBRE_TITULO`.         |
| created_at    | timestamp   | Fecha de creación.       |
| updated_at    | timestamp   | Fecha de actualización.  |

**Seed:** `pnpm db:seed:titles` — 45 títulos.

---

# Tabla: groupings

Catálogo de agrupadores (`GRUPO_BASE`) usados por categorías.

| Campo                 | Tipo        | Descripción                                              |
| --------------------- | ----------- | -------------------------------------------------------- |
| id                    | uuid        | Identificador interno.                                   |
| external_id           | varchar     | Código del agrupador (REGU, GYCC, GYPC, MEDY, etc.).     |
| source_system         | varchar     | Sistema origen.                                          |
| group_permission_code | varchar(20) | Permiso asociado; nullable, pendiente de catálogo Fedequinas. |
| created_at            | timestamp   | Fecha de creación.                                       |
| updated_at            | timestamp   | Fecha de actualización.                                  |

**Seed:** `pnpm db:seed:groupings` — 9 agrupadores.

---

# Tabla: categories

Catálogo principal de categorías de competencia.

| Campo              | Tipo           | Descripción / mapeo Fedequinas              |
| ------------------ | -------------- | ------------------------------------------- |
| id                 | uuid           | Identificador interno.                      |
| external_id        | varchar        | `CODIGO_CATEGORIA`.                         |
| source_system      | varchar        | Sistema origen.                             |
| name               | varchar(255)   | `NOMBRE_CATEGORIA`.                         |
| sex_id             | uuid NOT NULL  | FK → `sexes`; `CODIGO_SEXO`.                |
| gait_id            | uuid NOT NULL  | FK → `gaits`; `CODIGO_TIPO_ANDAR`.          |
| equine_type_id     | uuid NOT NULL  | FK → `equine_types`; `CODIGO_TIP_EQUINO`.   |
| min_age_months     | numeric(10,2)  | `EDAD_MINIMA`.                              |
| max_age_months     | numeric(10,2)  | `EDAD_MAXIMA`.                              |
| next_category_code | varchar(20)    | `SIGUIENTE_CATEGORIA` (código, no FK).      |
| grouping_id        | uuid NOT NULL  | FK → `groupings`; `AGRUPADOR`.              |
| large_camps        | integer        | `GRANDES_CAMP`.                             |
| created_at         | timestamp      | Fecha de creación.                          |
| updated_at         | timestamp      | Fecha de actualización.                     |

**Restricción:**

```sql
CONSTRAINT chk_category_age CHECK (min_age_months <= max_age_months)
```

`next_category_code` permanece como código externo mientras se analiza la jerarquía entre categorías.

**Seed:** `pnpm db:seed:categories` — 103 categorías desde `categorias.json`.

---

# Tabla: people

Personas del ecosistema Fedequinas/Pegasus (jueces, criadores, expositores, etc.).

| Campo          | Tipo        | Descripción / mapeo Fedequinas   |
| -------------- | ----------- | -------------------------------- |
| id             | uuid        | Identificador interno.           |
| external_id    | varchar     | `ID_PERSONAL`.                   |
| source_system  | varchar     | Sistema origen.                  |
| name           | varchar     | `NOMBRE_PERSONA`.                |
| last_name      | varchar     | `APELLIDO_PERSONA`.              |
| address        | varchar     | `DIRECCION_PERSONA`; nullable.   |
| indicative     | varchar     | `INDICATIVO`; nullable.          |
| telephone      | varchar     | `TELEFONO`; nullable.            |
| phone          | varchar     | `CELULAR`; nullable.             |
| avantel_phone  | varchar     | `AVANTEL`; nullable.             |
| email          | varchar     | `CORREO_ELECTRONICO`; nullable.  |
| created_at     | timestamp   | Fecha de creación.               |
| updated_at     | timestamp   | Fecha de actualización.          |

> `CODIGO_CIUDAD` de Fedequinas **no** se persiste en esta fase (sin `city_id` en `people`).

**Seed:** `pnpm db:seed:people`.

---

# Tabla: fairs

Ferias equinas.

| Campo            | Tipo        | Descripción / mapeo Fedequinas   |
| ---------------- | ----------- | -------------------------------- |
| id               | uuid        | Identificador interno.           |
| external_id      | varchar     | `ID_FERIA`.                      |
| source_system    | varchar     | Sistema origen.                  |
| name             | varchar(255)| `DESCRIPCION`; nullable.         |
| year             | integer     | `ANO`; nullable.                 |
| start_date       | date        | `FECHA_INICIO`; nullable.        |
| end_date         | date        | `FECHA_FIN`; nullable.           |
| city_id          | uuid        | FK → `cities`; `CODIGO_CIUDAD`.  |
| grade_id         | uuid        | FK → `grades`; `CODIGO_GRADO`.   |
| comments         | text        | `OBSERVACIONES`; nullable.       |
| registered_count | integer     | `INSCRITOS`; nullable.           |
| created_at       | timestamp   | Fecha de creación.               |
| updated_at       | timestamp   | Fecha de actualización.          |

**Seed:** `pnpm db:seed:fairs`.

---

# Tabla: fair_entries

Inscripciones de montadores/ejemplares en una feria y categoría.

| Campo                 | Tipo         | Descripción / mapeo Fedequinas      |
| --------------------- | ------------ | ------------------------------------- |
| id                    | uuid         | Identificador interno.                |
| external_id           | varchar      | `NUMERO_INSCRIPCION`.                 |
| source_system         | varchar      | Sistema origen.                       |
| fair_id               | uuid NOT NULL| FK → `fairs`; `ID_FERIA`.             |
| registration_number   | varchar      | `NUMERO_REGISTRO`.                    |
| category_id           | uuid NOT NULL| FK → `categories`; `CODIGO_CATEGORIA`.|
| track_position        | integer      | `POSICION_PISTA`.                     |
| rider_name            | varchar      | `MONTADOR`.                           |
| rider_document_number | varchar(50)  | `ID_MONTADOR`.                        |
| receipt               | varchar(50)  | `RECIBO`.                             |
| participate           | boolean      | `PARTICIPA` (`1`/`0`).                |
| fair_sequence         | integer      | `CONSECUTIVO_FERIA`.                  |
| is_child              | boolean      | `ES_HIJO` (`1`/`0`).                  |
| created_at            | timestamp    | Fecha de creación.                    |
| updated_at            | timestamp    | Fecha de actualización.               |

**Seed:** `pnpm db:seed:fair-entries` — desde `incripciones-montadores.json`.

---

# Tabla: fair_staff

Asignación de una persona a una feria con un rol determinado.

| Campo         | Tipo          | Descripción / mapeo Fedequinas |
| ------------- | ------------- | ------------------------------ |
| id            | uuid          | Identificador interno.         |
| external_id   | varchar       | `ID_PERSONAL_FERIA`.           |
| source_system | varchar       | Sistema origen.                |
| fair_id       | uuid NOT NULL | FK → `fairs`; `ID_FERIA`.      |
| person_id     | uuid NOT NULL | FK → `people`; `ID_PERSONAL`.  |
| role_id       | uuid NOT NULL | FK → `roles`; `ID_ROL`.        |
| created_at    | timestamp     | Fecha de creación.             |
| updated_at    | timestamp     | Fecha de actualización.        |

**Seed:** `pnpm db:seed:fair-staff`.

---

# Tabla: fair_results

Resultados de competencia por inscripción en una feria (hoja Fedequinas `FEH_RESULTADO_FERIAS`).

| Campo              | Tipo          | Descripción / mapeo Fedequinas        |
| ------------------ | ------------- | --------------------------------------- |
| id                 | uuid          | Identificador interno.                  |
| external_id        | varchar       | `NULL` — Fedequinas no expone ID propio. |
| source_system      | varchar       | `FEDEQUINAS`.                           |
| fair_id            | uuid NOT NULL | FK → `fairs`; `ID_FERIA`.               |
| fair_entry_id      | uuid NOT NULL | FK → `fair_entries`; `NUMERO_INSCRIPCION`. |
| grade_id           | uuid NOT NULL | FK → `grades`; `CODIGO_GRADO`.          |
| category_id        | uuid NOT NULL | FK → `categories`; `CODIGO_CATEGORIA`.  |
| title_id           | uuid NOT NULL | FK → `titles`; `CODIGO_TITULO`.         |
| position_obtained  | integer       | `PUESTO_OBTENIDO`.                      |
| score              | numeric(10,2) | `PUNTAJE_EJEMPLAR`.                     |
| created_at         | timestamp     | Fecha de creación.                      |
| updated_at         | timestamp     | Fecha de actualización.                 |

**Seed:** `pnpm db:seed:fair-results` — desde `resultados-feria.json` (26 registros feria `999992036`).

Unicidad de negocio: `UNIQUE (fair_id, fair_entry_id, category_id, title_id)`.

---

# Relaciones principales

```text
Category
 ├── Sex          (sex_id)
 ├── Gait         (gait_id)
 ├── EquineType   (equine_type_id)
 └── Grouping     (grouping_id)

Fair
 ├── City         (city_id)
 └── Grade        (grade_id)

FairEntry
 ├── Fair         (fair_id)
 └── Category     (category_id)

FairStaff
 ├── Fair         (fair_id)
 ├── Person       (person_id)
 └── Role         (role_id)

FairResult
 ├── Fair         (fair_id)
 ├── FairEntry    (fair_entry_id)
 ├── Grade        (grade_id)
 ├── Category     (category_id)
 └── Title        (title_id)
```

---

# Migraciones

Las migraciones viven en `packages/core/src/migrations/` y deben registrarse en `data-source.ts`.

| Migración                               | Descripción                                      |
| --------------------------------------- | ------------------------------------------------ |
| `1717430400000-CreateInitialSchema`     | Esquema base (catálogos + people + fairs + categories) |
| `1717430400001-ExpandGradesNomenclature`| `grades.nomenclature` → `varchar(2)`             |
| `1717430400002-DropFairsStatusColumn`   | Elimina columna errónea `fairs.status`           |
| `1717430400003-AddFairsRegisteredCount` | Añade `fairs.registered_count`                   |
| `1717430400004-CreateFairEntriesTable`  | Tabla `fair_entries`                             |
| `1717430400005-AddCategoryAgeCheck`     | CHECK edad mínima ≤ máxima en `categories`       |
| `1717430400006-AlterPeopleTable`        | Rediseño de `people` (sin documento/ciudad)      |
| `1717430400007-CreateFairStaffTable`    | Tabla `fair_staff`                               |
| `1717430400008-CreateFairResultsTable`  | Tabla `fair_results`                             |
| `1717430400009-AlterFairResultsUniqueConstraint` | UNIQUE de negocio en `fair_results`   |

**Comandos:**

```bash
pnpm migration:show
pnpm migration:run
```

---

# Orden sugerido de carga (seeds Fedequinas)

```bash
pnpm db:seed              # roles
pnpm db:seed:ciudades
pnpm db:seed:sexes
pnpm db:seed:gaits
pnpm db:seed:equine-types
pnpm db:seed:groupings
pnpm db:seed:titles
pnpm db:seed:grades
pnpm db:seed:categories
pnpm db:seed:fairs
pnpm db:seed:people
pnpm db:seed:fair-entries   # requiere feria + categorías
pnpm db:seed:fair-staff     # requiere feria + persona + rol
pnpm db:seed:fair-results   # requiere feria + inscripciones + grado + categorías + títulos
```

Los seeds de tablas operativas resuelven FKs consultando `external_id` + `source_system = 'FEDEQUINAS'` en los catálogos ya cargados.

---

# Fuera de alcance en esta fase

Entidades y capacidades **pendientes** de análisis o implementación:

* Asociaciones (`associations`, `fair_associations`).
* Ejemplares / caballos (`horses`).
* Resultados, juzgamientos y puntajes.
* `person_roles` como tabla independiente.
* `grouping_permissions` y permisos por agrupador.
* ETL, staging (`sync_batches`, `sync_mappings`), importación CSV masiva.
* API CRUD y sincronización bidireccional.

Este documento refleja el estado del modelo a junio 2026 según las entidades y migraciones en `packages/core`.
