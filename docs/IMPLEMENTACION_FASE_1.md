# Pegasus — Plan de Autenticación Root y Dashboard Inicial

## 1. Objetivo

Implementar la primera capa funcional de Pegasus con autenticación para un usuario `ROOT`, quien podrá ingresar a un dashboard administrativo y consultar la información ya disponible en la base de datos.

En esta fase no se implementará todavía el login de jueces, montadores o personas cargadas desde Fedequinas. La prioridad es dejar funcionando el acceso seguro del usuario root y la navegación inicial de la plataforma.

Además, se definirá desde el inicio la arquitectura frontend utilizando **Next.js**, **Tailwind CSS** y **Shadcn/UI** como sistema base de componentes para acelerar el desarrollo del dashboard administrativo.

---

## 2. Stack definido

```txt
Frontend
---------
Next.js 15
TypeScript
Tailwind CSS v4
Shadcn/UI
TanStack Query
React Hook Form
Zod
PWA
Dexie (IndexedDB)
Pusher Channels

Backend
--------
Next.js Route Handlers
TypeScript
Neon PostgreSQL
TypeORM

Infraestructura
---------------
Vercel
```

---

## 3. Arquitectura Frontend

### Librería de componentes

Se utilizará:

```txt
https://ui.shadcn.com/
```

### Objetivo

Shadcn/UI será la base visual del dashboard y permitirá construir rápidamente:

```txt
tablas
formularios
modales
sidebars
cards
tabs
skeletons
badges
```

### Componentes principales previstos

#### Dashboard

```txt
Card
Tabs
Separator
Badge
Skeleton
Breadcrumb
```

#### Listados

```txt
DataTable
Input
Select
Pagination
Dropdown Menu
```

#### Formularios

```txt
Form
Input
Textarea
Select
Checkbox
Dialog
Sheet
```

#### Navegación

```txt
Sidebar
Breadcrumb
Dropdown Menu
Tabs
```

---

## 4. Autenticación

### Requisito principal

El token de sesión debe guardarse en una cookie segura del navegador.

### Consideraciones de seguridad

La cookie debe configurarse con:

```txt
httpOnly: true
secure: true en producción
sameSite: "lax" o "strict"
path: "/"
maxAge definido
```

No se debe guardar el token en:

```txt
localStorage
sessionStorage
variables globales del frontend
```

### Motivo

Guardar el token en una cookie `httpOnly` reduce el riesgo de robo de sesión mediante scripts maliciosos ejecutados en el navegador.

---

## 5. Tabla users

Crear una tabla independiente para usuarios del sistema.

```txt
users
- id uuid primary key
- person_id uuid nullable
- email varchar unique nullable
- password_hash varchar nullable
- role varchar not null
- is_active boolean default true
- last_login_at timestamp nullable
- created_at timestamp
- updated_at timestamp
```

### Notas

- `person_id` será nullable porque el usuario root no necesariamente pertenece a una persona cargada desde Fedequinas.
- No se debe usar `people.external_id` para login hasta confirmar qué representa realmente ese campo.
- El usuario root debe autenticarse con email y contraseña.
- La tabla será gestionada mediante una entidad de TypeORM.

---

## 6. Usuario root inicial

Crear un seed para el usuario root.

```txt
email: root@pegasus.com
role: ROOT
person_id: NULL
is_active: true
```

La contraseña debe guardarse hasheada usando `bcrypt` o `argon2`.

---

## 7. Roles del sistema

### Roles iniciales recomendados

```txt
ROOT
ADMIN
JUDGE
STAFF
VIEWER
```

### Implementación inicial

Durante esta fase únicamente se habilitará el rol:

```txt
ROOT
```

Los demás roles podrán existir en base de datos para futuras fases, pero no tendrán funcionalidades activas todavía.

### Descripción de roles

#### ROOT

Usuario principal del sistema. Tiene acceso completo a la plataforma.

Puede:

```txt
ver dashboard general
listar ferias
ver detalle de feria
ver inscritos
ver resultados
ver participantes/personal
gestionar people
crear accesos de usuario en fases futuras
administrar configuración general
```

#### ADMIN

Usuario administrativo de una asociación o feria.

Puede:

```txt
gestionar ferias asignadas
ver inscritos
ver resultados
iniciar juzgamiento
asignar jueces
```

#### JUDGE

Usuario juez.

Puede:

```txt
ver juzgamientos asignados
calificar participantes
guardar calificaciones
sincronizar calificaciones offline
```

#### STAFF

Personal de apoyo.

Puede:

```txt
ver información operativa de la feria
apoyar inscripción o revisión
consultar participantes
```

#### VIEWER

Usuario solo lectura.

Puede:

```txt
consultar ferias
consultar resultados
consultar categorías
```

---

## 8. Estructura inicial de rutas App Router

Organización recomendada:

```txt
/app
├── (auth)
│   └── login
│
├── (dashboard)
│   ├── dashboard
│   ├── fairs
│   ├── people
│   ├── categories
│   ├── settings
│   └── profile
```

---

## 9. Dashboard del usuario root

Ruta principal:

```txt
/dashboard
```

### Módulos visibles para ROOT

```txt
Dashboard general
Ferias
People
Categorías
Resultados
Configuración
```

### Navegación principal

Sidebar fija:

```txt
🏠 Dashboard

🏇 Ferias
    ├── Listado
    └── Resultados

👤 People

📂 Categorías

⚙️ Configuración
```

---

## 10. Módulo Dashboard general

Ruta:

```txt
/dashboard
```

Debe mostrar tarjetas resumen utilizando componentes `Card` de Shadcn/UI.

KPIs:

```txt
Total de ferias
Total de inscritos
Total de resultados
Total de people
Total de categorías
```

También puede mostrar accesos rápidos:

```txt
Ver ferias
Ver people
Ver resultados
```

---

## 11. Módulo Ferias

Ruta:

```txt
/dashboard/fairs
```

### Componentes sugeridos

```txt
DataTable
Input
Select
Pagination
Badge
```

### Funcionalidades

```txt
listar ferias
buscar feria
ver detalle de feria
ver número de inscritos
ver ciudad
ver grado
ver fecha si existe
```

Endpoint base:

```txt
GET /api/fairs
```

---

## 12. Detalle de feria

Ruta:

```txt
/dashboard/fairs/[id]
```

### Componentes sugeridos

```txt
Tabs
Card
Accordion
Badge
Table
```

### Secciones

```txt
Información General
Inscritos
Participantes/Personal
Resultados
Categorías Relacionadas
```

Debe mostrar:

```txt
información general de la feria
inscritos
participantes/personal
resultados
categorías relacionadas
```

Endpoints:

```txt
GET /api/fairs/:id
GET /api/fairs/:id/entries
GET /api/fairs/:id/staff
GET /api/fairs/:id/results
```

---

## 13. Módulo People

Ruta:

```txt
/dashboard/people
```

### Componentes sugeridos

```txt
DataTable
Dialog
Sheet
Avatar
Badge
Form
```

### Funcionalidades fase 1

```txt
listar people
buscar por nombre
buscar por email
ver detalle de persona
```

### Funcionalidades fase 2

```txt
crear acceso de usuario
asignar contraseña
asignar PIN
asignar rol
activar/desactivar acceso
```

### Importante

```txt
people no debe ser igual a users.
people representa personas cargadas o relacionadas con Fedequinas.
users representa personas que pueden iniciar sesión en Pegasus.
```

---

## 14. Módulo Categorías

Ruta:

```txt
/dashboard/categories
```

Debe permitir consultar:

```txt
nombre de categoría
sexo
andar
tipo equino
agrupador
edad mínima
edad máxima
siguiente categoría
```

Endpoints:

```txt
GET /api/categories
GET /api/categories/:id
```

---

## 15. Módulo Resultados

Puede vivir dentro del detalle de feria inicialmente.

Ruta futura opcional:

```txt
/dashboard/results
```

Debe mostrar:

```txt
feria
número de inscripción
categoría
montador
título
puesto obtenido
puntaje
```

---

## 16. Configuración

Ruta:

```txt
/dashboard/settings
```

Módulos iniciales:

```txt
Usuarios
Roles
Parámetros del sistema
```

---

## 17. Protección de rutas

Todas las rutas bajo `/dashboard` deben requerir sesión activa.

Regla:

```txt
si no hay sesión válida → redirigir a /login
si hay sesión pero usuario inactivo → cerrar sesión
si el rol no tiene permiso → responder 403
```

---

## 18. Rutas iniciales

```txt
/login
/dashboard
/dashboard/fairs
/dashboard/fairs/[id]
/dashboard/people
/dashboard/people/[id]
/dashboard/categories
/dashboard/categories/[id]
/dashboard/settings
```

---

## 19. Endpoints iniciales

### Auth

```txt
POST /api/auth/login
POST /api/auth/logout
GET /api/auth/me
```

### Ferias

```txt
GET /api/fairs
GET /api/fairs/:id
GET /api/fairs/:id/entries
GET /api/fairs/:id/staff
GET /api/fairs/:id/results
```

### People

```txt
GET /api/people
GET /api/people/:id
```

### Categorías

```txt
GET /api/categories
GET /api/categories/:id
```

---

## 20. Persistencia y ORM

### ORM seleccionado

Se utilizará:

```txt
TypeORM
```

### Objetivos

TypeORM será responsable de:

```txt
mapear entidades a tablas
gestionar relaciones
realizar consultas y transacciones
ejecutar migraciones
administrar seeds iniciales
```

### Entidades iniciales previstas

```txt
User
Person
Fair
Category
Result
```

### Convenciones

```txt
usar entidades TypeScript
usar repositorios de TypeORM
mantener migraciones versionadas
evitar consultas SQL embebidas salvo casos específicos de rendimiento
```

---

## 21. Fase 2 — Easy Login

El easy login queda pendiente hasta validar correctamente los datos de `people`.

No se debe asumir todavía que `external_id` corresponde a un documento de identidad.

Opciones futuras:

```txt
documento + PIN
código temporal
QR de acceso
correo + PIN
```

Recomendación inicial:

```txt
document_number + PIN
```

Pero únicamente cuando se confirme cuál campo representa el documento real de la persona.

---

## 22. Orden de implementación

```txt
1. Crear entidad User en TypeORM
2. Crear migración de tabla users
3. Crear seed root
4. Implementar login
5. Guardar token en cookie segura
6. Crear middleware de protección
7. Configurar TypeORM
8. Configurar Shadcn/UI
9. Crear layout dashboard
10. Crear sidebar principal
11. Crear módulo ferias
12. Crear detalle de feria
13. Crear módulo people
14. Crear módulo categorías
15. Crear configuración básica
```

---

## 23. Criterio de éxito de esta fase

La fase se considera completa cuando:

```txt
El usuario root puede iniciar sesión.
El token queda guardado en cookie segura.
Las rutas /dashboard están protegidas.
TypeORM está configurado y funcionando correctamente.
El dashboard utiliza Shadcn/UI como sistema base de componentes.
El root puede listar ferias.
El root puede ver el detalle de una feria.
El root puede ver inscritos, participantes y resultados.
El root puede listar people.
El root puede consultar categorías.
Existe una navegación administrativa funcional mediante sidebar.
```

