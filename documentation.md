# Solicitud técnica: Crear proyecto Pegasus (Base Inicial)

## Objetivo

Crear la base del proyecto **Pegasus** utilizando una arquitectura de **monolito modular**, preparada para crecer posteriormente hacia módulos de sincronización con Fedequinas.

En esta primera fase el objetivo NO es construir el sincronizador ni los endpoints de negocio.

El objetivo es:

* Crear la estructura del proyecto.
* Configurar PostgreSQL.
* Configurar TypeORM.
* Configurar Redis.
* Crear las entidades principales.
* Crear las migraciones.
* Exponer únicamente un endpoint de salud (`/health`).

---

# Stack Tecnológico

Utilizar las siguientes tecnologías:

* TypeScript
* Hono
* AWS Lambda
* SST v3
* Pulumi
* PostgreSQL
* TypeORM
* Zod
* Redis (ioredis)
* pnpm workspaces

---

# Arquitectura

El proyecto debe construirse como un **monolito modular**.

Estructura sugerida:

```txt
pegasus/
│
├── infra/
│   └── pulumi/
│
├── packages/
│
│   ├── core/
│   │
│   │   └── src/
│   │       ├── database/
│   │       ├── entities/
│   │       ├── migrations/
│   │       ├── repositories/
│   │       ├── redis/
│   │       ├── modules/
│   │       └── shared/
│   │
│   └── functions/
│
│       └── src/
│           ├── app.ts
│           ├── routes/
│           ├── controllers/
│           ├── services/
│           └── middlewares/
│
├── package.json
├── pnpm-workspace.yaml
├── tsconfig.base.json
└── sst.config.ts
```

---

# Responsabilidades

## packages/core

Debe contener:

* Entidades TypeORM.
* Migraciones.
* Configuración PostgreSQL.
* Configuración Redis.
* Tipos compartidos.
* Utilidades compartidas.

No debe contener lógica HTTP.

---

## packages/functions

Debe contener:

* Aplicación Hono.
* Rutas.
* Controllers.
* Validaciones Zod.
* Adaptador AWS Lambda.

No debe contener entidades ni configuración de base de datos.

---

# Endpoint requerido

Únicamente crear:

```http
GET /health
```

Respuesta:

```json
{
  "success": true,
  "service": "pegasus-api",
  "status": "healthy"
}
```

No crear ningún CRUD.

No crear endpoints de negocio.

No crear autenticación todavía.

---

# Base de Datos

Configurar PostgreSQL mediante TypeORM.

Utilizar:

```txt
UUID como primary key
```

Todas las entidades deben incluir:

```txt
id uuid
created_at timestamp
updated_at timestamp
```

---

# Integración futura con Fedequinas

Preparar todas las entidades para sincronización futura agregando:

```txt
external_id varchar nullable
source_system varchar nullable
```

Ejemplo:

```txt
external_id = 12345
source_system = FEDEQUINAS
```

No implementar todavía:

```txt
sync_batches
sync_mappings
staging tables
csv import
```

Solo dejar preparados los campos.

---

# Entidades a crear

## cities

```txt
id uuid

external_id varchar nullable
source_system varchar nullable

code varchar nullable
name varchar not null
department varchar nullable

created_at timestamp
updated_at timestamp
```

---

## roles

```txt
id uuid

external_id varchar nullable
source_system varchar nullable

code varchar nullable
name varchar not null
description text nullable

created_at timestamp
updated_at timestamp
```

---

## grades

Representa el grado de una feria.

```txt
id uuid

external_id varchar nullable
source_system varchar nullable

code varchar nullable
name varchar not null
description text nullable

created_at timestamp
updated_at timestamp
```

---

## sexes

```txt
id uuid

external_id varchar nullable
source_system varchar nullable

code varchar nullable
name varchar not null

created_at timestamp
updated_at timestamp
```

---

## gaits

Representa el andar.

```txt
id uuid

external_id varchar nullable
source_system varchar nullable

code varchar nullable
name varchar not null

created_at timestamp
updated_at timestamp
```

---

## equine_types

```txt
id uuid

external_id varchar nullable
source_system varchar nullable

code varchar nullable
name varchar not null

created_at timestamp
updated_at timestamp
```

---

## titles

```txt
id uuid

external_id varchar nullable
source_system varchar nullable

code varchar nullable
name varchar not null
description text nullable

created_at timestamp
updated_at timestamp
```

---

## categories

```txt
id uuid

external_id varchar nullable
source_system varchar nullable

code varchar nullable
name varchar not null

sex_id uuid nullable
gait_id uuid nullable
equine_type_id uuid nullable

min_age_months integer nullable
max_age_months integer nullable

created_at timestamp
updated_at timestamp
```

Relaciones:

```txt
categories.sex_id
    → sexes.id

categories.gait_id
    → gaits.id

categories.equine_type_id
    → equine_types.id
```

---

## associations

```txt
id uuid

external_id varchar nullable
source_system varchar nullable

code varchar nullable
name varchar not null

nit varchar nullable

city_id uuid nullable

created_at timestamp
updated_at timestamp
```

Relación:

```txt
associations.city_id
    → cities.id
```

---

## people

```txt
id uuid

external_id varchar nullable
source_system varchar nullable

document_type varchar nullable
document_number varchar nullable

first_name varchar nullable
last_name varchar nullable

full_name varchar not null

email varchar nullable
phone varchar nullable

city_id uuid nullable

created_at timestamp
updated_at timestamp
```

Relación:

```txt
people.city_id
    → cities.id
```

---

## fairs

```txt
id uuid

external_id varchar nullable
source_system varchar nullable

code varchar nullable

name varchar not null

year integer nullable

start_date date nullable
end_date date nullable

city_id uuid nullable
grade_id uuid nullable

status varchar nullable

created_at timestamp
updated_at timestamp
```

Relaciones:

```txt
fairs.city_id
    → cities.id

fairs.grade_id
    → grades.id
```

---

## horses

```txt
id uuid

external_id varchar nullable
source_system varchar nullable

registration_number varchar nullable

name varchar not null

sex_id uuid nullable
gait_id uuid nullable
equine_type_id uuid nullable

birth_date date nullable

created_at timestamp
updated_at timestamp
```

Relaciones:

```txt
horses.sex_id
    → sexes.id

horses.gait_id
    → gaits.id

horses.equine_type_id
    → equine_types.id
```

---

## person_roles

```txt
id uuid

person_id uuid not null
role_id uuid not null

association_id uuid nullable

start_date date nullable
end_date date nullable

created_at timestamp
updated_at timestamp
```

Relaciones:

```txt
person_roles.person_id
    → people.id

person_roles.role_id
    → roles.id

person_roles.association_id
    → associations.id
```

---

## fair_staff

```txt
id uuid

fair_id uuid not null
person_id uuid not null

role_id uuid nullable

created_at timestamp
updated_at timestamp
```

Relaciones:

```txt
fair_staff.fair_id
    → fairs.id

fair_staff.person_id
    → people.id

fair_staff.role_id
    → roles.id
```

---

## fair_associations

```txt
id uuid

fair_id uuid not null
association_id uuid not null

is_organizer boolean default false

created_at timestamp
updated_at timestamp
```

Relaciones:

```txt
fair_associations.fair_id
    → fairs.id

fair_associations.association_id
    → associations.id
```

---

# Migraciones

Crear migraciones TypeORM para todas las entidades.

No utilizar synchronize=true.

Las migraciones deben ser la única forma de crear/modificar la base de datos.

Agregar scripts:

```json
{
  "typeorm": "...",
  "migration:generate": "...",
  "migration:run": "...",
  "migration:revert": "..."
}
```

---

# Redis

Configurar Redis compartido dentro de:

```txt
packages/core/src/redis
```

No implementar lógica de negocio.

Solo dejar el cliente inicializado para uso futuro.

---

# Resultado esperado

Al finalizar debe existir:

✅ Proyecto SST v3 funcional

✅ API Hono funcionando

✅ Endpoint `/health`

✅ PostgreSQL configurado

✅ Redis configurado

✅ TypeORM configurado

✅ Entidades creadas

✅ Migraciones creadas

✅ Arquitectura monolito modular limpia

❌ Sin CRUD

❌ Sin autenticación

❌ Sin sincronizador

❌ Sin CSV

❌ Sin staging

❌ Sin tablas de sincronización

La meta de esta fase es únicamente construir la base técnica y el modelo de dominio inicial de Pegasus.
