export type OfflineTelemetryEventName =
  | "OFFLINE_MUTATION_QUEUED"
  | "OFFLINE_MUTATION_ACCEPTED"
  | "OFFLINE_MUTATION_DUPLICATE"
  | "OFFLINE_MUTATION_CONFLICT"
  | "OFFLINE_MUTATION_REJECTED"
  | "OFFLINE_SYNC_BATCH_COMPLETED"
  | "OFFLINE_SW_UPDATE_DEFERRED"
  | "OFFLINE_SW_UPDATE_APPLIED"
  | "OFFLINE_LOGOUT_BLOCKED_BY_PENDING";

export type OfflineTelemetryEvent = {
  name: OfflineTelemetryEventName;
  at: string;
  operationId?: string;
  userId?: string;
  stageId?: string;
  aggregateType?: string;
  aggregateId?: string;
  baseRevision?: number;
  appliedRevision?: number | null;
  durationMs?: number;
  resultCode?: string;
  pendingCount?: number;
  conflictCount?: number;
  failedCount?: number;
  syncedCount?: number;
};

type TelemetrySink = (event: OfflineTelemetryEvent) => void;

const DEFAULT_SINK: TelemetrySink = (event) => {
  if (typeof console === "undefined") return;
  // Sin payload de tarjeta: solo metadatos operativos.
  console.info("[pegasus-offline]", event.name, event);
};

let sink: TelemetrySink = DEFAULT_SINK;

export function setOfflineTelemetrySink(next: TelemetrySink | null): void {
  sink = next ?? DEFAULT_SINK;
}

export function recordOfflineTelemetry(
  name: OfflineTelemetryEventName,
  fields: Omit<OfflineTelemetryEvent, "name" | "at"> = {}
): void {
  sink({
    name,
    at: new Date().toISOString(),
    ...fields,
  });
}
