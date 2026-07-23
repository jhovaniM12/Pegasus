export const OFFLINE_MUTATIONS_CHANGED_EVENT = "pegasus:offline-mutations-changed";

/** Avisa a la UI (badge/spin del sincronizador) que la cola IndexedDB cambió. */
export function notifyOfflineMutationsChanged(): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new Event(OFFLINE_MUTATIONS_CHANGED_EVENT));
}
