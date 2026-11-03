# Pegasus

Aplicación para administrar ferias equinas y su juzgamiento. Monorepo `pnpm` con interfaz web, API y modelo de datos compartido.

## Primeros pasos

1. [Instalación y arranque](docs/01-inicio.md)
2. [Arquitectura](docs/02-arquitectura.md)
3. [Desarrollo](docs/03-desarrollo.md)

| Paquete | Responsabilidad |
| --- | --- |
| `packages/web` | Interfaz Next.js. |
| `packages/functions` | API Hono y reglas de aplicación. |
| `packages/core` | Entidades, repositorios y migraciones TypeORM. |

## Guías

- [Base de datos](docs/04-base-de-datos.md)
- [Despliegue](docs/05-despliegue.md)
- [Juzgamiento](docs/dominios/juzgamiento.md)
- [Sincronización](docs/dominios/sincronizacion.md)
- [Soporte para operaciones sin conexión](docs/dominios/offline.md)
- [Reglamento FEDEQUINAS](docs/REGLAMENTO-FEDEQUINAS.md)

`docs/trash/` contiene documentos históricos pendientes de revisión. No es una especificación vigente.
