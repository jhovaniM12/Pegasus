# Implementación del Módulo Sincronizador

## Resumen

El módulo administrativo **Sincronizador** tiene dos flujos vigentes:

1. El importador Fedequinas XLSX, que carga una feria en cuatro pasos ordenados con vista previa y confirmación.
2. El sincronizador CSV legado, cuyos endpoints, lotes, historial y limpieza de desarrollo se conservan por compatibilidad.

Todas las rutas `/api/sync/*` están protegidas con `requireRootSession`; solo un usuario `ROOT` activo puede usarlas.

El flujo Fedequinas procesa cada XLSX en memoria y no guarda el archivo:

```text
XLSX -> validar estructura -> analizar referencias y cambios -> preview
     -> confirmar el mismo archivo -> transacción -> registrar lote, mappings y warnings
```

## Prerrequisitos

Antes de importar deben existir los catálogos base con `source_system = FEDEQUINAS` y el `external_id` que llega en el XLSX:

- `cities`: requerido por `FEH_FERIAS.CODIGO_CIUDAD`.
- `grades`: requerido por `FEH_FERIAS.CODIGO_GRADO`.
- `roles`: requerido por `FEH_PERSONAL_FERIA.ID_ROL`.
- `categories`: requerido por `FEH_INSCRIPCIONES_FERIA.CODIGO_CATEGORIA`.

Una referencia faltante de ciudad, grado, rol o categoría es un error bloqueante. El importador crea o actualiza ferias, personas, asignaciones de personal, inscripciones y caballos, pero no crea esos catálogos.

También se requiere:

- `SESSION_SECRET`, usado para firmar los tokens de vista previa.
- Un archivo `.xlsx` de máximo 10 MB por paso.
- Exactamente una hoja por archivo.
- Una fila 1 con el conjunto exacto de encabezados del tipo de archivo.
- Al menos una fila de datos.
- Un solo `ID_FERIA` en todas las filas del archivo.

Las filas completamente vacías se ignoran. Las celdas se leen como texto; se preservan ceros a la izquierda cuando el formato de Excel es una máscara de ceros y las fechas se normalizan a `YYYY-MM-DD`.

## Archivos Fedequinas y orden obligatorio

Los nombres lógicos y el orden son:

1. `FEH_FERIAS.xlsx`
2. `FEH_PERSONAL_FERIA.xlsx`
3. `FEH_INSCRIPCIONES_FERIA.xlsx`
4. `FEH_INSCRIPCIONES_FERIA_PADRES.xlsx`

El backend identifica el tipo mediante `:fileKind` y exige extensión `.xlsx`; no compara el nombre físico del archivo con el nombre lógico. Cada paso, salvo el primero, exige un lote `COMPLETED` del paso anterior para la misma feria.

### Encabezados exactos

Los encabezados no pueden faltar, sobrar, estar vacíos ni repetirse. El orden mostrado es el canónico de Fedequinas, aunque el parser resuelve las columnas por nombre y no exige posición.

#### 1. `FEH_FERIAS`

1. `ID_FERIA`
2. `ANO`
3. `DESCRIPCION`
4. `FECHA_INICIO`
5. `FECHA_FIN`
6. `CODIGO_CIUDAD`
7. `CODIGO_GRADO`
8. `OBSERVACIONES`
9. `INSCRITOS`

#### 2. `FEH_PERSONAL_FERIA`

1. `ID_PERSONAL_FERIA`
2. `ID_FERIA`
3. `ID_PERSONAL`
4. `ID_ROL`
5. `NOMBRE`

#### 3. `FEH_INSCRIPCIONES_FERIA`

1. `ID_FERIA`
2. `NUMERO_INSCRIPCION`
3. `NUMERO_REGISTRO`
4. `CODIGO_CATEGORIA`
5. `POSICION_PISTA`
6. `MONTADOR`
7. `ID_MONTADOR`
8. `CONSECUTIVO_FERIA`

#### 4. `FEH_INSCRIPCIONES_FERIA_PADRES`

1. `ID_FERIA`
2. `NUMERO_INSCRIPCION`
3. `NUMERO_REGISTRO`
4. `NOMBRE_EJEMPLAR`
5. `PADRE`
6. `MADRE`
7. `CODIGO_CATEGORIA`
8. `POSICION_PISTA`
9. `ID_MONTADOR`
10. `MONTADOR`

## Mapeo y campos opcionales

### Feria

| XLSX | Destino | Regla |
| --- | --- | --- |
| `ID_FERIA` | `fairs.external_id` | Obligatorio; identidad Fedequinas de la feria. |
| `ANO` | `fairs.year` | Obligatorio; entero. |
| `DESCRIPCION` | `fairs.name` | Obligatorio. |
| `FECHA_INICIO` | `fairs.start_date` | Obligatorio. |
| `FECHA_FIN` | `fairs.end_date` | Obligatorio. |
| `CODIGO_CIUDAD` | `fairs.city_id` | Obligatorio; resuelve `cities.external_id`. |
| `CODIGO_GRADO` | `fairs.grade_id` | Obligatorio; resuelve `grades.external_id`. |
| `OBSERVACIONES` | `fairs.comments` | Opcional. |
| `INSCRITOS` | `fairs.registered_count` | Obligatorio; entero. |

`OBSERVACIONES` vacía no inventa texto: en una actualización conserva el comentario existente y en una feria nueva queda nula.

### Personal

| XLSX | Destino | Regla |
| --- | --- | --- |
| `ID_PERSONAL_FERIA` | `fair_staff.external_id` | Obligatorio. |
| `ID_FERIA` | `fair_staff.fair_id` | Obligatorio; resuelve la feria importada. |
| `ID_PERSONAL` | `people.external_id` | Obligatorio; crea o reutiliza la persona. |
| `ID_ROL` | `fair_staff.role_id` | Obligatorio; resuelve `roles.external_id`. |
| `NOMBRE` | `people.name` | Obligatorio. |

Los atributos de persona no incluidos por Fedequinas permanecen nulos o conservan su valor anterior; no se derivan apellidos, teléfonos, correo ni dirección desde `NOMBRE`.

### Inscripciones

| XLSX | Destino | Regla |
| --- | --- | --- |
| `ID_FERIA` | `fair_entries.fair_id` | Obligatorio. |
| `NUMERO_INSCRIPCION` | `fair_entries.inscription_number` | Obligatorio. |
| `NUMERO_REGISTRO` | `fair_entries.registration_number` | Obligatorio. |
| `CODIGO_CATEGORIA` | `fair_entries.category_id` | Obligatorio; resuelve `categories.external_id`. |
| `POSICION_PISTA` | `fair_entries.track_position` | Obligatorio; entero. |
| `MONTADOR` | `fair_entries.rider_name` | Obligatorio. |
| `ID_MONTADOR` | `fair_entries.rider_document_number` | Opcional. |
| `CONSECUTIVO_FERIA` | `fair_entries.fair_sequence` | Obligatorio; entero. |

La identidad externa y la restricción de negocio usan la clave compuesta:

```text
ID_FERIA:NUMERO_INSCRIPCION:NUMERO_REGISTRO
```

No se puede usar solo `NUMERO_INSCRIPCION`: en el archivo de aceptación hay números repetidos. Como compatibilidad con datos previos, una inscripción también puede localizarse por `fair_id + fair_sequence` y entonces adopta la clave compuesta.

Si el caballo todavía no existe, la inscripción se importa con `horse_id = null` y una advertencia. `ID_MONTADOR` vacío conserva el documento existente o queda `null` en una fila nueva. Los campos que este archivo no trae (`receipt` e `is_child`) se conservan al actualizar y quedan nulos al crear. `participate` se conserva al actualizar; para una inscripción nueva mantiene el valor operativo vigente del modelo, `true`.

### Ejemplares y padres

La fila se cruza con la inscripción por la misma clave compuesta. Si la inscripción existe:

- Se busca o crea el caballo por `NUMERO_REGISTRO`.
- `NOMBRE_EJEMPLAR`, `PADRE` y `MADRE` enriquecen `name`, `father_name` y `mother_name`.
- La inscripción queda enlazada mediante `horse_id`.

`NOMBRE_EJEMPLAR`, `PADRE` y `MADRE` son opcionales. Un vacío no se convierte en una cadena inventada ni borra un dato existente; al crear, el atributo sin valor queda nulo. `CODIGO_CATEGORIA`, `POSICION_PISTA`, `ID_MONTADOR` y `MONTADOR` forman parte del encabezado exacto de este archivo, pero no modifican la inscripción durante este paso.

Si no existe la inscripción correspondiente, la fila produce `ENTRY_NOT_FOUND`, se omite y no crea un caballo huérfano.

## Vista previa, checksum y token

La vista previa es de solo lectura: parsea nuevamente el XLSX, valida referencias, calcula acciones y no crea lote ni entidades.

- `checksum` es SHA-256 de los bytes completos del archivo.
- `previewToken` es un token firmado con HMAC-SHA-256 y `SESSION_SECRET`.
- El token contiene `checksum`, `fileKind`, `fairExternalId` y expiración.
- Su vigencia es de 30 minutos.
- `apply` vuelve a leer y analizar el archivo y exige que checksum, tipo y feria coincidan con el token.
- Un token alterado, expirado o usado con otro archivo se rechaza.

El cliente web también envía un campo `checksum` al confirmar, pero el backend no confía en ese campo ni lo consume: recalcula el SHA-256 y lo contrasta con el token firmado.

## Endpoints Fedequinas

Las respuestas exitosas usan el sobre:

```json
{
  "success": true,
  "data": {}
}
```

Los errores usan `success: false` y `error.code`, `error.message` y, cuando aplica, `error.details`.

### Preview

```http
POST /api/sync/fedequinas/:fileKind/preview
Content-Type: multipart/form-data
```

Campo multipart:

- `file`: XLSX obligatorio.

`fileKind` acepta únicamente los cuatro nombres lógicos. `data` contiene:

```json
{
  "checksum": "sha256-hex",
  "previewToken": "payload.firma",
  "detectedFairExternalId": "999992078",
  "headers": ["ID_FERIA"],
  "counts": {
    "total": 270,
    "inserts": 270,
    "updates": 0,
    "skips": 0,
    "warnings": 0,
    "errors": 0
  },
  "issues": [
    {
      "severity": "warning",
      "row": 13,
      "code": "HORSE_PENDING",
      "message": "El caballo aún no existe; la entrada se importará pendiente de enriquecimiento."
    }
  ]
}
```

Los contadores `warnings` y `errors` cuentan filas distintas afectadas, no la cantidad total de observaciones.

### Apply

```http
POST /api/sync/fedequinas/:fileKind/apply
Content-Type: multipart/form-data
```

Campos multipart:

- `file`: el mismo XLSX analizado.
- `previewToken`: obligatorio.
- `checksum`: enviado actualmente por el cliente, informativo; el backend recalcula el valor real.

`data` contiene:

```json
{
  "batch": {
    "id": "uuid",
    "sourceSystem": "FEDEQUINAS",
    "entityName": "fair_entries",
    "fileKind": "FEH_INSCRIPCIONES_FERIA",
    "fairExternalId": "999992078",
    "fileName": "FEH_INSCRIPCIONES_FERIA.xlsx",
    "fileSize": 12345,
    "fileChecksum": "sha256-hex",
    "status": "COMPLETED",
    "totalRows": 270,
    "insertedRows": 270,
    "updatedRows": 0,
    "skippedRows": 0,
    "failedRows": 0,
    "warningRows": 0,
    "startedAt": "fecha ISO",
    "finishedAt": "fecha ISO",
    "errorMessage": null,
    "createdBy": "uuid"
  },
  "result": {
    "checksum": "sha256-hex",
    "previewToken": "payload.firma",
    "detectedFairExternalId": "999992078",
    "headers": [],
    "counts": {},
    "issues": []
  }
}
```

La escritura del archivo es una transacción única. Si una persistencia falla, se revierte el contenido del paso y el lote queda `FAILED` con `errorMessage`.

### Estado de una feria

```http
GET /api/sync/fedequinas/fairs/:fairExternalId/status
```

Este endpoint no es multipart. Devuelve los cuatro pasos en orden:

```json
{
  "success": true,
  "data": {
    "fairExternalId": "999992078",
    "steps": [
      {
        "fileKind": "FEH_FERIAS",
        "status": "COMPLETED_WITH_WARNINGS",
        "batch": {
          "id": "uuid",
          "fileName": "FEH_FERIAS.xlsx",
          "checksum": "sha256-hex",
          "startedAt": "fecha ISO",
          "finishedAt": "fecha ISO",
          "counts": {
            "total": 1,
            "inserts": 1,
            "updates": 0,
            "skips": 0,
            "warnings": 1,
            "errors": 0
          }
        }
      }
    ]
  }
}
```

Los estados devueltos son `LOCKED`, `READY`, `COMPLETED`, `COMPLETED_WITH_WARNINGS` y `FAILED`. Se usa el lote más reciente de cada combinación feria/tipo de archivo.

## Errores y advertencias

### Errores bloqueantes

Un error de estructura —archivo inválido, más de una hoja, encabezados incorrectos, archivo vacío, ferias mezcladas o paso fuera de orden— rechaza la request de preview.

Los errores por fila aparecen en la vista previa. Si `counts.errors > 0`, no se puede aplicar ninguna fila del archivo. Incluyen:

- Campos obligatorios vacíos.
- Enteros inválidos.
- Claves externas duplicadas dentro del XLSX.
- Ciudad, grado, feria, rol o categoría inexistente.
- Cambio protegido de una inscripción después de iniciar pre-pista o juzgamiento.

### Advertencias no bloqueantes

Las advertencias permiten confirmar y aplicar:

- `HORSE_PENDING`: la inscripción queda con caballo pendiente.
- `RIDER_DOCUMENT_MISSING`: falta `ID_MONTADOR`.
- `ENTRY_NOT_FOUND`: la fila de Padres se omite.
- `HORSE_NAME_MISSING`: falta el nombre del ejemplar.
- `GENEALOGY_MISSING`: falta padre o madre.

Al aplicar, las advertencias se guardan en `sync_errors` con prefijo `WARNING_` en `error_code`. El lote Fedequinas se guarda como `COMPLETED` y `warning_rows`; `COMPLETED_WITH_WARNINGS` es una presentación derivada por el endpoint de estado y la interfaz.

## Reimportación, idempotencia y protección de datos

- Cada fila normalizada tiene un `row_hash` SHA-256.
- `sync_mappings` identifica origen, entidad y clave externa.
- Si la clave y el hash no cambiaron, la fila es `skip` y solo se actualiza `last_seen_batch_id`.
- Si cambió, se actualiza la entidad existente.
- Reimportar el mismo archivo no duplica filas.
- Que una fila desaparezca de una versión posterior no elimina la entidad.
- Un vacío opcional no borra el dato enriquecido existente.
- Los datos operativos no suministrados por Fedequinas se preservan.

Para inscripciones, una actualización que cambie categoría, posición en pista, número de inscripción o número de registro se bloquea si la categoría anterior o nueva dejó `NOT_STARTED`. Esto incluye pre-pista iniciada/cerrada, juzgamiento iniciado, consolidaciones, F1/F2, desempate, desierta y juzgamiento cerrado. Cambios seguros, como montador o documento, siguen permitidos.

## Categorías grupales GYCC y GYPC

Las inscripciones con categorías externas `GYCC` y `GYPC` se importan y permanecen disponibles en los datos de la feria. No se descartan en el sincronizador.

Ambas categorías se excluyen del flujo de juzgamiento individual:

- No generan etapas individuales desde las inscripciones.
- No aparecen en las consultas de etapas asignadas al staff.
- El acceso directo a una etapa grupal existente se rechaza.

La comparación se hace sin distinguir mayúsculas/minúsculas y eliminando espacios laterales.

## UX, lotes y recuperación

La pantalla `/sincronizador` presenta:

- Feria activa, selección de una feria conocida o recuperación por `ID_FERIA`.
- Cuatro cards ordenadas; un paso permanece bloqueado hasta completar el anterior.
- Selección y validación local de `.xlsx` y 10 MB.
- Vista previa con feria detectada, encabezados, inserts, updates, skips, warnings y errors.
- Confirmación separada de la fase de análisis.
- Historial de lotes filtrado por feria.
- Opción **Importar una versión nueva** para reimportar un paso.

Estados de UX definidos: `LOCKED`, `READY`, `UPLOADING`, `PARSING`, `ANALYZING`, `PREVIEW`, `APPLYING`, `COMPLETED`, `COMPLETED_WITH_WARNINGS` y `FAILED`. En el flujo actual las requests síncronas transicionan directamente por `ANALYZING`, `PREVIEW` y `APPLYING`; `UPLOADING` y `PARSING` quedan reservados en el contrato de UI.

Estados persistidos de lote: `PROCESSING`, `COMPLETED`, `COMPLETED_WITH_ERRORS` y `FAILED`. El importador Fedequinas usa `PROCESSING`, `COMPLETED` y `FAILED`; `COMPLETED_WITH_ERRORS` se conserva para el sincronizador legado.

La feria activa se guarda en `localStorage` bajo `pegasus:fedequinas:active-fair:v1`. Al recargar, la UI consulta el estado del servidor y reconstruye los pasos desde los lotes. Un paso `FAILED` puede reintentarse seleccionando y analizando de nuevo el archivo. Un token expirado o una modificación del archivo requiere generar otra vista previa.

Las observaciones del preview pueden filtrarse por error o advertencia y descargarse como:

```text
<nombre-del-xlsx>-issues.csv
```

El CSV usa las columnas `severidad,fila,codigo,mensaje`, incluye BOM UTF-8 y se genera localmente en el navegador. Después de aplicar, las observaciones persistidas también siguen disponibles mediante el endpoint legado paginado de errores del lote.

## Aceptación Copa Colombia - Villeta

La prueba de aceptación sobre `docs/planos/COPA COLOMBIA - VILLETA-INFO.xlsx` verifica:

- 270 filas en `FEH_INSCRIPCIONES_FERIA`.
- 270 claves compuestas únicas, aunque existen números de inscripción repetidos.
- 269 filas en `FEH_INSCRIPCIONES_FERIA_PADRES` que cruzan por la clave compuesta.
- 1 inscripción pendiente sin fila de Padres: `NUMERO_INSCRIPCION = 358054`.

Por tanto, el resultado esperado es **270 inscripciones / 269 enriquecimientos / 1 pendiente**, sin perder inscripciones por deduplicar únicamente `NUMERO_INSCRIPCION`.

## Endpoints CSV legados preservados

El flujo XLSX no reemplaza ni elimina los contratos anteriores:

```http
GET  /api/sync/summary
POST /api/sync/:entity/run
GET  /api/sync/batches
GET  /api/sync/batches/:id
GET  /api/sync/batches/:id/errors
POST /api/sync/dev/cleanup
```

`POST /api/sync/:entity/run` conserva `multipart/form-data` con campo `file` CSV para `people`, `horses`, `fair_staff` y `fair_entries`. Mantiene autodetección de delimitador `,` o `;`, UTF-8 con fallback Latin-1, límite de 10 MB, checksum, `row_hash`, mappings e historial.

`POST /api/sync/dev/cleanup` continúa disponible solo fuera de producción y exige:

```json
{
  "confirm": "DELETE_SYNC_DATA"
}
```

No elimina los catálogos base (`cities`, `roles`, `grades`, `sexes`, `gaits`, `equine_types`, `titles`, `groupings` y `categories`) ni usuarios `ROOT`/`ADMIN`. Sí elimina `fairs`, `fair_staff`, personas (salvo las ligadas a ROOT/ADMIN), usuarios de staff con código de acceso, inscripciones, ejemplares, juzgamiento y lotes de sync.

## Tablas de control

### `sync_batches`

Registra origen, entidad, `file_kind`, `fair_external_id`, nombre, tamaño, checksum, estado, contadores, fechas, error final y usuario ejecutor.

### `sync_mappings`

Mantiene la identidad incremental:

```text
source_system + entity_name + external_id
```

Guarda `internal_id`, `row_hash` y `last_seen_batch_id`.

### `sync_errors`

Guarda lote, entidad, fila, clave externa, código, mensaje y la fila original. En Fedequinas se usa para advertencias aplicadas; los errores bloqueantes permanecen en el preview porque impiden crear el lote.

## Archivos principales

Backend y core:

- `packages/functions/src/services/fedequinas-xlsx.service.ts`
- `packages/functions/src/services/fedequinas-sync.service.ts`
- `packages/functions/src/services/fedequinas-import-rules.ts`
- `packages/functions/src/schemas/fedequinas-sync.schema.ts`
- `packages/functions/src/controllers/sync.controller.ts`
- `packages/functions/src/routes/sync.routes.ts`
- `packages/functions/src/services/judging/category-flow-rules.ts`
- `packages/core/src/entities/sync.entity.ts`
- `packages/core/src/entities/fair-entries.ts`
- `packages/core/src/migrations/1717430400030-ExpandFairEntryImportIdentity.ts`

Frontend:

- `packages/web/src/app/(dashboard)/sincronizador/page.tsx`
- `packages/web/src/components/sync/import-stepper.tsx`
- `packages/web/src/components/sync/import-step-card.tsx`
- `packages/web/src/components/sync/import-preview.tsx`
- `packages/web/src/components/sync/import-issues-table.tsx`
- `packages/web/src/hooks/use-sync.ts`
- `packages/web/src/services/sync.service.ts`
- `packages/web/src/types/sync.ts`

## Verificación automatizada

La implementación cuenta con pruebas para:

- Parser XLSX, tamaño, hoja única y encabezados exactos.
- Preview sin escrituras, checksum y token.
- Orden de pasos y feria única por archivo.
- Atomicidad y rollback.
- Warnings, nulls y enriquecimiento sin borrar con vacíos.
- Idempotencia y preservación de datos operativos.
- Bloqueo cuando inició el juzgamiento.
- Exclusión de GYCC/GYPC del flujo individual.
- Recuperación de estado en frontend y contratos HTTP.
- Aceptación Villeta 270/269/1.
