# Base de datos

Pegasus usa PostgreSQL con TypeORM. La configuración está en `packages/core/src/database/data-source.ts`. `synchronize` está desactivado: el esquema cambia mediante migraciones.

- Entidades y repositorios: `packages/core/src/domains/`.
- Registro de entidades y migraciones: `packages/core/src/database/data-source.ts`.
- Historial del esquema: `packages/core/src/migrations/`.
- Semillas: scripts en `packages/core/src/domains/`, expuestos en `package.json`.

## Migraciones

```bash
pnpm migration:show
pnpm migration:generate
pnpm migration:run
```

Revisa el archivo generado antes de aplicarlo. Al crear una migración, expórtala desde `packages/core/src/migrations/index.ts` y regístrala en `data-source.ts` siguiendo el patrón existente. `migration:revert` revierte la última migración; revisa su impacto en los datos antes de usarlo.

## Semillas

`pnpm db:seed` ejecuta solo la semilla de roles. Los demás comandos `db:seed:*` cargan conjuntos concretos de datos. `pnpm db:seed:root` crea la cuenta inicial con `ROOT_EMAIL` y `ROOT_PASSWORD`; usa credenciales exclusivas del entorno de desarrollo.

Para entender relaciones exactas, consulta entidades y migraciones.
