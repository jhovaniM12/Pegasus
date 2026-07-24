importScripts("https://js.pusher.com/beams/service-worker.js");

// Versión del SW: subir al cambiar la estrategia. No llamar skipWaiting automático
// para no activar a mitad de una feria con mutaciones pendientes; la app decide.
const SW_VERSION = "pegasus-sw-offline-v2-push-payload";

self.addEventListener("install", (event) => {
  // Mantener el SW en waiting hasta que la app envíe SKIP_WAITING.
  event.waitUntil(Promise.resolve(SW_VERSION));
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener("message", (event) => {
  if (event.data && event.data.type === "SKIP_WAITING") {
    self.skipWaiting();
  }
});

// Chrome Android exige un handler fetch registrado para considerar la app instalable.
// Passthrough NetworkOnly: no cachea HTML autenticado ni respuestas de API.
self.addEventListener("fetch", (event) => {
  event.respondWith(fetch(event.request));
});

function parsePushData(event) {
  if (!event.data) return null;

  let raw;
  try {
    raw = event.data.json();
  } catch {
    try {
      raw = JSON.parse(event.data.text());
    } catch {
      return null;
    }
  }

  if (!raw || typeof raw !== "object") return null;

  // Beams puede entregar el envelope completo o solo `data`.
  const data =
    raw.web && typeof raw.web === "object" && raw.web.data && typeof raw.web.data === "object"
      ? raw.web.data
      : raw.data && typeof raw.data === "object"
        ? raw.data
        : raw;

  if (!data || typeof data !== "object") return null;
  return data;
}

function toClientPushMessage(data) {
  const kind = typeof data.kind === "string" ? data.kind : null;
  const type = typeof data.type === "string" ? data.type : null;

  if (kind === "STAFF_REFRESH" || type === "STAFF_REFRESH") {
    return {
      type: "PUSH_RECEIVED",
      kind: "STAFF_REFRESH",
      fairCategoryStageId:
        typeof data.fairCategoryStageId === "string" ? data.fairCategoryStageId : null,
    };
  }

  const notificationId =
    typeof data.notificationId === "string" ? data.notificationId : null;
  const title = typeof data.title === "string" ? data.title : null;
  const body = typeof data.body === "string" ? data.body : null;

  if (kind === "INBOX_NOTIFICATION" || notificationId || title) {
    return {
      type: "PUSH_RECEIVED",
      kind: "INBOX_NOTIFICATION",
      notificationId,
      notificationType:
        typeof data.notificationType === "string"
          ? data.notificationType
          : typeof data.type === "string"
            ? data.type
            : null,
      title,
      body,
      deepLink: typeof data.deepLink === "string" ? data.deepLink : null,
      fairName: typeof data.fairName === "string" ? data.fairName : null,
      categoryName: typeof data.categoryName === "string" ? data.categoryName : null,
      gaitName: typeof data.gaitName === "string" ? data.gaitName : null,
    };
  }

  return { type: "PUSH_RECEIVED", kind: "UNKNOWN" };
}

// Cuando llega un push, notificar a todos los tabs abiertos con el payload
// para toast inmediato y refresco de bandeja/pantallas.
self.addEventListener("push", (event) => {
  const data = parsePushData(event);
  const message = toClientPushMessage(data ?? {});

  event.waitUntil(
    self.clients
      .matchAll({ type: "window", includeUncontrolled: true })
      .then((clients) => {
        clients.forEach((client) => client.postMessage(message));
      })
  );
});
