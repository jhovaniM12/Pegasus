# Instalación y primer arranque

## Requisitos

Node.js compatible con Next.js 16, `pnpm` 9.15.4 y PostgreSQL accesible. Redis y Pusher Beams se configuran según las funciones utilizadas.

Desde la raíz:

```bash
pnpm install
cp .env.example .env
```

Completa `DATABASE_URL`, `SESSION_SECRET` y las demás variables necesarias con valores de desarrollo. No apuntes las migraciones o semillas a producción. TypeORM también acepta `DB_HOST`, `DB_PORT`, `DB_USERNAME`, `DB_PASSWORD` y `DB_NAME` si no hay `DATABASE_URL`.

```bash
pnpm db:ping
pnpm migration:show
pnpm migration:run
pnpm dev:all
```

La web usa normalmente `http://localhost:3000`. La API de desarrollo comienza en `http://localhost:3001/api` y puede pasar a otro puerto si este está ocupado; revisa la salida del proceso. `pnpm dev:vercel` ofrece otra forma de ejecutar la integración de Vercel.

Las semillas se ejecutan por separado. `pnpm db:seed` carga roles, no todos los catálogos. Consulta los comandos `db:seed:*` en `package.json`. `db:seed:root` utiliza `ROOT_EMAIL` y `ROOT_PASSWORD`.
