export type NotificationToastIdentity = {
  id?: string | null;
  type: string;
  title: string;
  body: string;
};

type NotificationToastDeduperOptions = {
  contentWindowMs?: number;
  idRetentionMs?: number;
  maxEntries?: number;
  now?: () => number;
};

const DEFAULT_CONTENT_WINDOW_MS = 5_000;
const DEFAULT_ID_RETENTION_MS = 24 * 60 * 60 * 1_000;
const DEFAULT_MAX_ENTRIES = 500;

function contentKey(input: NotificationToastIdentity): string {
  return `content:${input.type}\u0000${input.title}\u0000${input.body}`;
}

/**
 * Deduplica la misma entrega entre push e inbox.
 *
 * El ID es la identidad autoritativa. La huella del contenido solo vive unos
 * segundos para cubrir mensajes legacy o carreras push/fetch; nunca debe
 * silenciar permanentemente eventos legítimos que tengan el mismo texto.
 */
export class NotificationToastDeduper {
  private readonly entries = new Map<string, number>();
  private readonly contentWindowMs: number;
  private readonly idRetentionMs: number;
  private readonly maxEntries: number;
  private readonly now: () => number;

  constructor(options: NotificationToastDeduperOptions = {}) {
    this.contentWindowMs = options.contentWindowMs ?? DEFAULT_CONTENT_WINDOW_MS;
    this.idRetentionMs = options.idRetentionMs ?? DEFAULT_ID_RETENTION_MS;
    this.maxEntries = options.maxEntries ?? DEFAULT_MAX_ENTRIES;
    this.now = options.now ?? Date.now;
  }

  shouldShow(input: NotificationToastIdentity): boolean {
    const now = this.now();
    this.removeExpired(now);

    const idKey = input.id ? `id:${input.id}` : null;
    const fallbackKey = contentKey(input);
    if (
      (idKey && this.isActive(idKey, now)) ||
      this.isActive(fallbackKey, now)
    ) {
      return false;
    }

    if (idKey) {
      this.remember(idKey, now + this.idRetentionMs);
    }
    this.remember(fallbackKey, now + this.contentWindowMs);
    this.trim();
    return true;
  }

  private isActive(key: string, now: number): boolean {
    const expiresAt = this.entries.get(key);
    return expiresAt !== undefined && expiresAt > now;
  }

  private remember(key: string, expiresAt: number): void {
    this.entries.delete(key);
    this.entries.set(key, expiresAt);
  }

  private removeExpired(now: number): void {
    for (const [key, expiresAt] of this.entries) {
      if (expiresAt <= now) {
        this.entries.delete(key);
      }
    }
  }

  private trim(): void {
    while (this.entries.size > this.maxEntries) {
      const oldestKey = this.entries.keys().next().value;
      if (oldestKey === undefined) return;
      this.entries.delete(oldestKey);
    }
  }
}
