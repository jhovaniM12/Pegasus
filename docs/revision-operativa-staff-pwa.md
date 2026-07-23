# Revisión operativa — Staff PWA (Pegaso)

**Fecha:** 22 julio 2026  
**Alcance:** Juzgamiento de ferias equinas (FA, F1, F2, desempates), notificaciones push, roles staff  
**Enfoque:** Bugs reales, estados inconsistentes, riesgos de producción y UX operativa  
**Fuera de alcance:** Refactors cosméticos

---

## Archivos revisados

| Área | Archivo |
|------|---------|
| Push gate | `packages/web/src/hooks/use-push-notification-gate.ts` |
| Service worker | `packages/web/public/service-worker.js` |
| Refresh realtime | `packages/web/src/hooks/use-staff-realtime-refresh.ts` |
| Envío push | `packages/functions/src/services/notification-send.service.ts` |
| Controllers | `packages/functions/src/controllers/staged-flow.controller.ts` |
| Flujo FA / prepista | `packages/functions/src/services/staged-flow.service.ts` |
| Rondas F1/F2/desempate | `packages/functions/src/services/judging/round.service.ts` |
| Página staff | `packages/web/src/app/staff/categories/[id]/page.tsx` |
| Workspace juez | `packages/web/src/app/staff/categories/[id]/_components/judge-round-workspace.tsx` |
| Gestión DT | `packages/web/src/app/staff/categories/[id]/_components/management-view.tsx` |
| Rondas DT | `packages/web/src/app/staff/categories/[id]/_components/director-rounds.tsx` |

**Soporte adicional:** `api.service.ts`, `session.ts`, `middleware.ts`, `shared.ts`, `push-notification-gate.tsx`, `push-notification-provider.tsx`

---

## Resumen ejecutivo

| Severidad | Cantidad | Acción sugerida |
|-----------|----------|-----------------|
| Crítica | 3 | Corregir antes de feria en producción |
| Alta | 4 | Corregir en el siguiente ciclo |
| Media | 3 | Planificar con tests |

**Prioridad de implementación recomendada:**

1. Propagar mensajes y status HTTP desde `api.service.ts`
2. Manejo global de 401 + aviso de sesión expirada
3. Guarda de entorno en `resetStageForTesting`
4. Gate de notificaciones: no bloquear por errores de red; salida en estado `blocked`
5. Botón «Declarar desierta» para estados sin salida
6. Corregir redirecciones a `/categories` y el indicador falso de «tiempo real»

---

## Pasada 1 — Bugs reales y estados inconsistentes

### CRÍTICA 1 — El frontend descarta todos los mensajes de error del backend

| Campo | Detalle |
|-------|---------|
| **Severidad** | Crítica |
| **Archivo** | `packages/web/src/services/api.service.ts` |
| **Escenario** | El backend produce mensajes operativos precisos («Todos los jueces deben cerrar su tarjeta antes de consolidar», «El FA no se puede editar porque el juzgamiento ya no está activo»). Cada método de `ApiService` hace `catch { throw new Error("Error al enviar /api/...") }`, destruyendo el mensaje, el código HTTP y la distinción 401/403/400. |
| **Impacto** | Todos los toasts que usan `error.message` muestran una URL en vez de la causa. El director intenta consolidar con un juez pendiente y ve «Error al enviar /api/…» — no sabe qué hacer. Anula el trabajo de validación del backend. |
| **Solución** | Extraer `error.response.data.message` de Axios y relanzarlo; propagar el status para tratar 401 aparte. |
| **Validación** | Manual: forzar cada `BadRequestError` y verificar que el toast muestra el texto del backend. |

---

### CRÍTICA 2 — Sesión expirada = usuario atrapado con datos viejos que parecen «en vivo»

| Campo | Detalle |
|-------|---------|
| **Severidad** | Crítica |
| **Archivos** | `packages/functions/src/lib/session.ts` (8 h de vida), `packages/web/src/app/staff/categories/[id]/page.tsx` (`load` silencioso), `api.service.ts`, `judge-round-workspace.tsx` |
| **Escenario** | La sesión dura 8 horas (un día de feria). Al expirar: (a) el polling silencioso de 10 s falla y se traga el error (`catch` de `load` solo actúa con `!silent`); (b) la pantalla del juez sigue mostrando «Sincronizando en tiempo real…» con spinner; (c) al tocar una acción el toast dice «Error al enviar /api/…» sin mención de sesión. Nadie redirige a `/login/staff` porque el 401 es indistinguible. |
| **Impacto** | Juez en pista trabajando sobre datos congelados creyendo que están actualizados; sus acciones fallan sin explicación. |
| **Solución** | Interceptor Axios global: en 401, redirigir a `/login/staff?next=…`. En el polling silencioso, detectar 401 y mostrar un banner «Sesión expirada, vuelve a ingresar». Considerar renovación deslizante de cookie en cada request autenticado. |
| **Validación** | Manual: expirar/borrar cookie con la pantalla abierta y verificar polling + acciones. |

---

### CRÍTICA 3 — `resetStageForTesting` expuesto en producción sin guarda

| Campo | Detalle |
|-------|---------|
| **Severidad** | Crítica |
| **Archivos** | `packages/functions/src/services/staged-flow.service.ts` (≈1421–1470), `packages/web/src/app/staff/categories/[id]/page.tsx` (≈727–750) |
| **Escenario** | El botón «Reiniciar flujo» está visible para cualquier director técnico en cualquier entorno. El endpoint borra notificaciones, eventos, rondas, FA, participantes y checkeos. No hay verificación de `NODE_ENV` / `VERCEL_ENV` ni doble confirmación. |
| **Impacto** | Un toque equivocado (o malintencionado) durante una feria real destruye el juzgamiento completo de una categoría, sin recuperación. |
| **Solución** | Guarda de entorno en el endpoint (rechazar si `VERCEL_ENV === "production"` salvo flag explícito) y ocultar la tarjeta roja en producción. |
| **Validación** | Test de integración del endpoint con env de producción simulado. |

---

### ALTA 4 — «Declarar desierta» no tiene UI — estados trampa sin salida

| Campo | Detalle |
|-------|---------|
| **Severidad** | Alta |
| **Archivos** | `packages/web/src/services/staged-flow.service.ts` define `desertCompetition`, pero ningún componente lo invoca |
| **Escenarios** | 1) El veterinario rechaza/marca ausentes a todos → `startJudging` responde «No hay participantes aprobados» → el director queda en `PRE_RING_CLOSED` sin botón útil excepto «Reiniciar flujo». 2) F2 consolidado sin posiciones → `closeResults` dice «Declara la competencia como desierta» pero la UI no lo permite. |
| **Impacto** | El director queda mirando una pantalla sin acción posible; el flujo de la categoría muere. |
| **Solución** | Añadir el botón «Declarar desierta» (con dialog de motivo) en `DirectorRounds` / gestión para los estados no cerrados. |
| **Validación** | Manual sobre los dos escenarios. |

---

### ALTA 5 — Redirecciones post-acción a `/categories` (ruta incorrecta para staff)

| Campo | Detalle |
|-------|---------|
| **Severidad** | Alta |
| **Archivos** | `page.tsx` (≈642, 1011, 1074), `judge-round-workspace.tsx` (≈495) |
| **Escenario** | Tras «Cerrar FA», «Cerrar prueba individual», «Activar ronda» y «Abrir desempate» se hace `router.replace("/categories")`. Esa ruta es del dashboard admin; el middleware rebota a staff hacia `/staff`. Funciona por accidente, con doble navegación y pérdida del contexto. |
| **Impacto** | El juez cierra su tarjeta y es expulsado a la lista general sin mensaje de qué sigue. Si cambia el middleware, estas rutas rompen. Inconsistente: consolidar FA te deja; cerrar FA te expulsa. |
| **Solución** | Redirigir a `/staff`, o mejor quedarse en la categoría mostrando el estado «Tarjeta cerrada — esperando consolidación». |
| **Validación** | Manual (navegación con cada rol). |

---

### ALTA 6 — Descalificación FA no valida elegibilidad previa

| Campo | Detalle |
|-------|---------|
| **Severidad** | Alta |
| **Archivo** | `packages/functions/src/services/staged-flow.service.ts` → `disqualifyParticipant` |
| **Escenario** | A diferencia de `disqualifyRoundParticipant` (que sí valida estado), la versión FA no lo hace. Dos jueces descalifican al mismo ejemplar casi a la vez: el segundo sobrescribe `disqualifiedByUserId`, motivo y timestamp sin error. |
| **Impacto** | Trazabilidad incorrecta de quién descalificó y por qué — dato sensible ante reclamos. |
| **Solución** | Replicar la validación de rondas; devolver 400 «El ejemplar ya está descalificado». |
| **Validación** | Test unitario del servicio con doble descalificación. |

---

### ALTA 7 — `getCategory` con fallback que enmascara errores de permiso

| Campo | Detalle |
|-------|---------|
| **Severidad** | Alta |
| **Archivo** | `packages/web/src/services/staged-flow.service.ts` → `getCategory` |
| **Escenario** | Si `getCategory` falla por cualquier motivo (403, 500, timeout), silenciosamente pide la lista completa y busca ahí. Un juez con etapa no visible puede recibir datos parciales o un error genérico que no refleja la causa real. |
| **Impacto** | Diagnósticos imposibles y estados UI contradictorios con el backend. |
| **Solución** | Eliminar el fallback o restringirlo a errores de red; propagar mensajes reales (depende de la crítica 1). |
| **Validación** | Manual + unitario del cliente HTTP. |

---

### MEDIA 8 — Validaciones inconsistentes entre editar y cerrar tarjeta F2

| Campo | Detalle |
|-------|---------|
| **Severidad** | Media |
| **Archivo** | `packages/functions/src/services/judging/round.service.ts` → `updateRoundForm` vs `closeRoundForm` |
| **Escenario** | Al editar, `maxAssignablePosition = eligibleCount + desertedPositions.length`. Al cerrar, `Math.min(eligibleCount, MAX_AWARD_POSITIONS)`. Un cliente puede guardar puestos que el cierre luego rechaza. |
| **Impacto** | Estados imposibles de cerrar si el cliente no respeta `positionRange`. |
| **Solución** | Unificar el límite en `updateRoundForm` con el del cierre. |
| **Validación** | Test unitario. |

---

### MEDIA 9 — El envío push bloquea la respuesta HTTP hasta 15 segundos

| Campo | Detalle |
|-------|---------|
| **Severidad** | Media |
| **Archivos** | `staged-flow.controller.ts` (`await dispatchNotificationsAfterAction`), `notification-send.service.ts` (`BEAMS_TIMEOUT_MS = 15_000`) |
| **Escenario** | La transacción de BD ya confirmó, pero si Beams está lento el controlador espera hasta 15 s. El director ve el spinner congelado, cree que falló y reintenta (acción ya aplicada → error de estado confuso). |
| **Impacto** | Doble clic / reintentos sobre acciones ya confirmadas. |
| **Solución** | Bajar timeout a ~5 s, o responder primero y despachar el push sin bloquear la respuesta. |
| **Validación** | Manual con red degradada o mock de Beams lento. |

---

### MEDIA 10 — Sin refresh push tras consolidar F1/F2/desempate

| Campo | Detalle |
|-------|---------|
| **Severidad** | Media |
| **Archivo** | `round.service.ts` → `consolidateRound` |
| **Escenario** | Tras consolidar no se encola notificación a jueces ni se emite `sendStageRefreshSignal`. El juez con tarjeta cerrada espera consolidación; depende del polling de 10 s. |
| **Impacto** | El mecanismo de push anunciado como primario no cubre la transición más esperada por el juez. |
| **Solución** | Emitir `sendStageRefreshSignal(stageId, "2")` tras consolidar (y reforzar `openNextRound`). |
| **Validación** | Manual con dos dispositivos (juez + DT). |

---

## Pasada 2 — Juez en pista (mala conexión, permisos, pantalla vieja)

### 2.1 Modal de notificaciones = candado total de la app

| Campo | Detalle |
|-------|---------|
| **Severidad** | Crítica (operativa) |
| **Archivos** | `push-notification-gate.tsx`, `use-push-notification-gate.ts` |
| **Escenario** | Dialog sin cierre (`showCloseButton={false}`, `onOpenChange={() => undefined}`). Si `checkStatus` falla por red transitoria → `needs_activation` → modal bloqueante. La auto-activación puede ejecutar `clearAllState()` y destruir un registro Beams válido; si el re-registro falla, queda en `error` sin notificaciones y con la app bloqueada. |
| **Impacto** | Juez en pista sin poder operar aunque el polling bastaría. |
| **Solución** | Distinguir errores de red (no degradar a `needs_activation` ni `clearAllState` si el estado local ya era válido). Permitir «Continuar sin notificaciones» en modo degradado con banner. |
| **Validación** | Manual con Network throttling / offline intermitente. |

### 2.2 Permiso bloqueado = callejón sin salida

| Campo | Detalle |
|-------|---------|
| **Severidad** | Alta |
| **Archivos** | `push-notification-gate.tsx`, `use-push-notification-gate.ts` |
| **Escenario** | En `blocked`, el único botón está deshabilitado y el texto pide recargar, pero no hay botón de recarga. El hook no re-verifica el permiso (`permissions.query` / `onchange`). Aunque el usuario habilite notificaciones, el modal persiste hasta recarga manual. |
| **Impacto** | Usuario atrapado tras seguir las instrucciones. |
| **Solución** | Botón «Ya las habilité — recargar» + recheck con `navigator.permissions.query({ name: "notifications" }).onchange`. |
| **Validación** | Manual en Chrome Android y Safari iOS (PWA). |

### 2.3 Carga inicial fallida = expulsión

| Campo | Detalle |
|-------|---------|
| **Severidad** | Media |
| **Archivo** | `page.tsx` → `load` (catch no-silencioso) |
| **Escenario** | Un 500 transitorio o timeout al abrir la categoría redirige siempre a `/staff`. |
| **Impacto** | El juez debe volver a navegar tras un fallo temporal. |
| **Solución** | Pantalla de error con botón «Reintentar» sin perder la ruta. |
| **Validación** | Manual con mock 500. |

### 2.4 Cambio de usuario en el mismo dispositivo

| Campo | Detalle |
|-------|---------|
| **Severidad** | Media |
| **Archivo** | `use-push-notification-gate.ts` (`needs_reactivation`) |
| **Escenario** | Flujo `clearAllState` → `setUserId` correcto. Si el token responde 403 por sesión vieja, el error se clasifica como `token`. |
| **Impacto** | Bajo si el copy guía a re-login; riesgo silencioso si dos jueces comparten tablet. |
| **Solución** | Test manual de dos usuarios en el mismo dispositivo; documentar el comportamiento. |
| **Validación** | Manual. |

### 2.5 Señal de refresh con TTL 60 s

| Campo | Detalle |
|-------|---------|
| **Severidad** | Baja / media |
| **Archivo** | `notification-send.service.ts` → `sendStageRefreshSignal` (`time_to_live: 60`) |
| **Escenario** | Si el dispositivo estuvo sin red > 60 s, la señal se pierde. Visibilidad + polling lo cubren en la página de detalle. |
| **Impacto** | Retraso de hasta 10 s vía polling; verificar que `/staff` tenga el mismo fallback. |
| **Solución** | Confirmar fallback en lista staff; considerar TTL mayor para señales críticas. |
| **Validación** | Manual con dispositivo en background / sin red. |

---

## Pasada 3 — UX de notificaciones (producto)

### Qué entiende hoy el usuario

| Pregunta | Estado actual | Problema |
|----------|---------------|----------|
| ¿Por qué activar? | Parcial | Explica el qué, no el porqué operativo en pista |
| ¿Qué hacer si están bloqueadas? | Débil | Copy orientado a Chrome desktop; el uso real es PWA móvil |
| ¿Qué pasa al cambiar de usuario? | Aceptable | Reactivación automática; el nuevo usuario no ve aviso explícito |
| ¿Actualización silenciosa? | Confuso | El rótulo «Sincronizando en tiempo real…» se muestra siempre, incluso con push muerto |
| ¿Después de cerrar/iniciar fase? | Débil | Expulsión a lista vía `/categories` sin decir qué sigue |

### Mejoras concretas de copy

**Activación (modal inicial)**

> Pegaso te avisa al instante cuando el Director Técnico abre una ronda o un juez cierra su tarjeta. Sin esto, tendrías que estar recargando la pantalla en plena pista.

**Permiso bloqueado (PWA)**

- Android: *Ajustes → Aplicaciones → Pegaso → Notificaciones → Permitir*, luego «Ya las habilité — recargar».
- iOS: la PWA debe estar instalada en la pantalla de inicio; luego Ajustes → Notificaciones → Pegaso.

**Reactivación (cambio de usuario)**

> Este dispositivo tenía notificaciones de otro usuario. Reactívalas para recibir avisos de tu sesión.

### Mejoras de navegación y estados vacíos

1. **Tras cerrar FA / tarjeta:** quedarse en la categoría con el estado «Tarjeta cerrada» + expectativa: *«Te avisaremos cuando el Director Técnico abra la siguiente ronda.»*
2. **Tras consolidar FA (juez):** mantener el patrón actual «FA consolidado — espera la notificación»; replicarlo en F1 consolidado y post-desempate.
3. **Indicador de sync:** mostrar «Sincronizando en tiempo real» solo si `push.status === "enabled"`; si no: «Actualizando cada 10 s» o «Sin conexión — datos de las HH:MM».
4. **Estados trampa del DT:** vacío accionable con «Declarar desierta» cuando no hay aprobados o no hay premiables.

---

## Matriz rápida de hallazgos

| ID | Severidad | Tema | Requiere test |
|----|-----------|------|---------------|
| C1 | Crítica | Mensajes de error destruidos en `ApiService` | Manual |
| C2 | Crítica | Sesión expirada + polling silencioso | Manual |
| C3 | Crítica | Reset de prueba en producción | Integración |
| A4 | Alta | Sin UI «Declarar desierta» | Manual |
| A5 | Alta | Redirect a `/categories` | Manual |
| A6 | Alta | Doble descalificación FA | Unitario |
| A7 | Alta | Fallback `getCategory` | Manual / unitario |
| M8 | Media | Límites F2 editar vs cerrar | Unitario |
| M9 | Media | Push bloquea respuesta 15 s | Manual |
| M10 | Media | Sin refresh push al consolidar | Manual |
| P2.1 | Crítica | Gate push bloquea por red | Manual |
| P2.2 | Alta | Permiso blocked sin salida | Manual |
| P2.3 | Media | Expulsión en error de carga | Manual |
| P2.4 | Media | Cambio de usuario / tablet | Manual |
| P2.5 | Baja–media | TTL 60 s de señal refresh | Manual |

---

## Notas

- No se asumió corrección por el solo hecho de que el código compile.
- Los hallazgos priorizan fallos que pueden dejar al staff sin acción, con datos viejos o con mensajes inútiles en un día de feria.
- Este documento es de auditoría; no implica que los fixes ya estén aplicados.
