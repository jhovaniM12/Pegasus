# Despliegue y configuración

La web tiene configuración de Vercel en `packages/web/vercel.json`. Su compilación instala desde la raíz, construye `core` y `functions` y después `web`. La ruta `packages/web/src/app/api/[[...route]]/route.ts` integra la API; `packages/functions/src/vercel.ts` proporciona el adaptador Hono.

| Función | Variables de `.env.example` |
| --- | --- |
| Datos | `DATABASE_URL`, `REDIS_URL` |
| HTTP y sesión | `CORS_ORIGIN`, `SESSION_SECRET`, `PORT`, `SERVICE_NAME` |
| Cuenta inicial | `ROOT_EMAIL`, `ROOT_PASSWORD` |
| Notificaciones | `PUSHER_BEAMS_INSTANCE_ID`, `PUSHER_BEAMS_PRIMARY_KEY`, `PUSHER_BEAMS_WEB_ORIGIN`, `NEXT_PUBLIC_PUSHER_BEAMS_INSTANCE_ID` |

Configura las variables del entorno en Vercel Project Settings → Environment Variables. `.env.example` indica `packages/web` como directorio raíz del proyecto Vercel. Antes de desplegar un cambio de esquema, revisa y aplica las migraciones en el entorno correspondiente.

`infra/pulumi/README.md` reserva ese directorio para infraestructura adicional, pero aún no documenta un despliegue ejecutable.
