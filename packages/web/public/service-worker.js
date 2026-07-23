importScripts("https://js.pusher.com/beams/service-worker.js");

// Versión del SW: subir al cambiar la estrategia. No llamar skipWaiting automático
// para no activar a mitad de una feria con mutaciones pendientes; la app decide.
const SW_VERSION = "pegasus-sw-offline-v1";

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

// Cuando llega un push, notificar a todos los tabs abiertos para que
// refresquen la bandeja de notificaciones sin necesidad de recargar la página.
self.addEventListener("push", (event) => {
  event.waitUntil(
    self.clients
      .matchAll({ type: "window", includeUncontrolled: true })
      .then((clients) => {
        clients.forEach((client) => client.postMessage({ type: "PUSH_RECEIVED" }));
      })
  );
});
