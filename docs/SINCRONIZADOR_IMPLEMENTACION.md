# Implementación del Módulo Sincronizador

## Resumen

Se implementó el módulo administrativo **Sincronizador** para Pegasus/Fedequinas, orientado al usuario `ROOT`.

El flujo de esta primera versión procesa archivos CSV directamente en memoria durante la misma request:

```text
CSV -> normalizar -> validar -> calcular row_hash -> insertar/actualizar/omitir -> registrar lote y errores
```

No se guarda el archivo CSV en storage, filesystem ni PostgreSQL.

## Alcance Implementado

### Acceso

- Las rutas backend `/api/sync/*` quedan protegidas con `requireRootSession`.
- Solo usuarios con rol `ROOT` pueden ejecutar sincronizaciones y consultar historial/errores.
- Roles no autorizados reciben `403`.
- La pantalla se agrega al dashboard administrativo como `Sincronizador`.

### Entidades sincronizables

Tipos iniciales soportados:

- `horses`: archivo `INFORMACION_EJEMPLARES`.
- `fair_entries`: archivo `FEH_INSCRIPCIONES_FERIA`.

### Endpoints

Se implementaron los endpoints requeridos para esta fase:

```http
POST /api/sync/:entity/run
GET  /api/sync/batches
GET  /api/sync/batches/:id
GET  /api/sync/batches/:id/errors
POST /api/sync/dev/cleanup
```

No se implementó endpoint separado de upload.

## Tablas de Control

Se creó la migración:

```text
1717430400024-CreateSyncControlTables
```

Tablas agregadas:

### `sync_batches`

Registra cada ejecución de sincronización.

Campos relevantes:

- `source_system`
- `entity_name`
- `file_name`
- `file_size`
- `file_checksum`
- `status`
- `total_rows`
- `inserted_rows`
- `updated_rows`
- `skipped_rows`
- `failed_rows`
- `started_at`
- `finished_at`
- `error_message`
- `created_by`

Estados soportados:

- `PROCESSING`
- `COMPLETED`
- `COMPLETED_WITH_ERRORS`
- `FAILED`

### `sync_mappings`

Controla la relación incremental entre registros externos e internos.

Restricción única:

```text
source_system + entity_name + external_id
```

Campos relevantes:

- `external_id`
- `internal_id`
- `row_hash`
- `last_seen_batch_id`

### `sync_errors`

Registra errores por fila sin detener el lote completo.

Campos relevantes:

- `batch_id`
- `entity_name`
- `row_number`
- `external_id`
- `error_code`
- `error_message`
- `raw_row`

## Procesamiento CSV

El endpoint `POST /api/sync/:entity/run`:

1. Recibe un archivo CSV en `multipart/form-data` usando el campo `file`.
2. Valida entidad permitida.
3. Valida extensión `.csv`.
4. Valida MIME compatible.
5. Limita tamaño máximo a 10 MB.
6. Lee el archivo en memoria.
7. Calcula `file_checksum` SHA-256 del buffer completo.
8. Crea un `sync_batch`.
9. Parsea filas CSV.
10. Normaliza datos por entidad.
11. Calcula `row_hash` SHA-256 de la fila normalizada.
12. Inserta, actualiza u omite registros según `sync_mappings`.
13. Registra errores por fila en `sync_errors`.
14. Cierra el lote con contadores.
15. Descarta el archivo al terminar la request.

El parser soporta:

- Delimitador `,` o `;` por autodetección.
- UTF-8.
- Latin-1 como fallback.
- Campos entre comillas dobles.

## Sincronización de Ejemplares

Entidad: `horses`.

Archivo esperado: `INFORMACION_EJEMPLARES`.

Llave externa:

```text
NUMERO_REGISTRO
```

Mapeo:

| CSV | Entidad |
| --- | --- |
| `NUMERO_REGISTRO` | `external_id`, `registration_number` |
| `NOMBRE_EJEMPLAR` | `name` |
| `FECHA_NACIMIENTO` | `birth_date` |
| `CODIGO_COLOR` | `color_code` |
| `NUMERO_MICROCHIP` | `microchip_number` |
| `CODIGO_ASOCIACION` | `association_code` |
| `CODIGO_CIUDAD_NACIMIENTO` | `birth_city_code` |
| `NUMERO_REGISTRO_PADRE` | `father_registration_number` |
| `NUMERO_REGISTRO_MADRE` | `mother_registration_number` |

Validaciones:

- `NUMERO_REGISTRO` es obligatorio.
- Si `NOMBRE_EJEMPLAR` viene como columna pero vacío, se registra error de fila.
- Duplicados de `NUMERO_REGISTRO` dentro del CSV se registran como error.

## Sincronización de Inscripciones

Entidad: `fair_entries`.

Archivo esperado: `FEH_INSCRIPCIONES_FERIA`.

Llave externa:

```text
NUMERO_INSCRIPCION
```

Mapeo principal:

| CSV | Entidad |
| --- | --- |
| `NUMERO_INSCRIPCION` | `external_id` |
| `ID_FERIA` | `fair_id` |
| `CODIGO_CATEGORIA` | `category_id` |
| `NUMERO_REGISTRO` | `registration_number` |
| `NUMERO_REGISTRO` | resolución de `horse_id` |
| `POSICION_PISTA` | `track_position` |
| `MONTADOR` | `rider_name` |
| `ID_MONTADOR` | `rider_document_number` |
| `RECIBO` | `receipt` |
| `PARTICIPA` | `participate` |
| `CONSECUTIVO_FERIA` | `fair_sequence` |
| `ES_HIJO` | `is_child` |

Relación oficial:

```text
FEH_INSCRIPCIONES_FERIA.NUMERO_REGISTRO
  -> fair_entries.registration_number
  -> horses.registration_number
  -> fair_entries.horse_id
```

Validaciones:

- Si no existe un caballo con `horses.registration_number = NUMERO_REGISTRO`, se registra error de fila.
- Si no existe feria o categoría asociada, se registra error de fila.
- El proceso continúa aunque una fila falle.

## Limpieza de Desarrollo

Endpoint:

```http
POST /api/sync/dev/cleanup
```

Disponible solo cuando `NODE_ENV !== "production"`.

No borra catálogos base:

- `cities`
- `roles`
- `grades`
- `sexes`
- `gaits`
- `equine_types`
- `titles`
- `groupings`
- `categories`

Limpia datos sincronizados y dependencias operativas necesarias para evitar fallos por FK, incluyendo:

- `horses`
- `fair_entries`
- `fair_results`
- `sync_batches`
- `sync_mappings`
- `sync_errors`
- tablas operativas dependientes del flujo de juzgamiento.

## Frontend

Se creó la ruta:

```text
/sincronizador
```

Funcionalidades:

- Cards para `horses` y `fair_entries`.
- Carga de CSV por entidad.
- Validación local de extensión `.csv`.
- Visualización de nombre y tamaño del archivo.
- Ejecución de sincronización en una sola acción.
- Contadores del último lote:
  - total
  - insertados
  - actualizados
  - omitidos
  - fallidos
- Historial de lotes.
- Consulta de errores por lote.
- Diálogo de confirmación para limpieza de desarrollo.

También se agregó el item `Sincronizador` al sidebar del dashboard administrativo.

## Archivos Principales

Backend/core:

- `packages/core/src/entities/sync.entity.ts`
- `packages/core/src/migrations/1717430400024-CreateSyncControlTables.ts`
- `packages/functions/src/services/sync.service.ts`
- `packages/functions/src/controllers/sync.controller.ts`
- `packages/functions/src/routes/sync.routes.ts`
- `packages/functions/src/mappers/sync.mapper.ts`

Frontend:

- `packages/web/src/app/(dashboard)/sincronizador/page.tsx`
- `packages/web/src/services/sync.service.ts`
- `packages/web/src/hooks/use-sync.ts`
- `packages/web/src/types/sync.ts`
- `packages/web/src/components/layout/app-sidebar.tsx`

## Verificación

Comandos ejecutados:

```bash
pnpm run build
pnpm --filter @pegasus/web build
```

Resultado:

- `@pegasus/core` compiló correctamente.
- `@pegasus/functions` compiló correctamente.
- `@pegasus/web` compiló correctamente.

Nota: no se ejecutaron migraciones contra la base de datos.
