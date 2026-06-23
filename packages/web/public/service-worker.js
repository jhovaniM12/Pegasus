importScripts("https://js.pusher.com/beams/service-worker.js");

// Chrome Android exige un handler fetch registrado para considerar la app instalable.
// Passthrough sin caché offline: no intercepta el comportamiento de red de Beams.
self.addEventListener("fetch", (event) => {
  event.respondWith(fetch(event.request));
});

// Cuando llega un push, notificar a todos los tabs abiertos para que
// refresquen la bandeja de notificaciones sin necesidad de recargar la página.
self.addEventListener("push", () => {
  self.clients
    .matchAll({ type: "window", includeUncontrolled: true })
    .then((clients) => {
      clients.forEach((client) => client.postMessage({ type: "PUSH_RECEIVED" }));
    });
});
