# Desarrollo

| Comando desde la raíz | Uso |
| --- | --- |
| `pnpm dev:all` | Inicia web y API. |
| `pnpm dev:web` | Inicia solo Next.js. |
| `pnpm dev` | Inicia solo Hono. |
| `pnpm build` | Compila `core` y `functions`. |
| `pnpm typecheck` | Comprueba tipos en los paquetes. |
| `pnpm test:judging` | Ejecuta pruebas de juzgamiento. |
| `pnpm verify:regulatory` | Ejecuta la verificación reglamentaria definida en `package.json`. |

Para hacer un cambio, ubica primero el dominio en `packages/functions/src/domains` y `packages/core/src/domains`. Revisa rutas, esquemas, servicios y pruebas cercanas. Si cambia el esquema persistido, crea una migración y regístrala en el `data-source.ts`. Ajusta la web y actualiza el documento del dominio cuando cambie una regla o contrato observable.

Las pruebas están junto al código (`*.test.ts`). El flujo reglamentario de CI está en `.github/workflows/regulatory-gate.yml`.
