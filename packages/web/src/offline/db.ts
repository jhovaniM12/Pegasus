import Dexie, { type EntityTable } from "dexie";
import type {
  OfflineConfirmation,
  OfflineContext,
  OfflineMeta,
  OfflineMutation,
} from "./schema";

const DATABASE_NAME = "pegasus-offline-v1";

type PegasusOfflineDatabase = Dexie & {
  offlineContexts: EntityTable<OfflineContext, "key">;
  offlineMutations: EntityTable<OfflineMutation, "operationId">;
  offlineConfirmations: EntityTable<OfflineConfirmation, "operationId">;
  offlineMeta: EntityTable<OfflineMeta, "key">;
};

let database: PegasusOfflineDatabase | null = null;

function createDatabase(): PegasusOfflineDatabase {
  const nextDatabase = new Dexie(DATABASE_NAME) as PegasusOfflineDatabase;

  nextDatabase.version(1).stores({
    offlineContexts: "key,userId,stageId,[userId+stageId],lastServerSyncAt",
    offlineMutations:
      "operationId,deduplicationKey,userId,stageId,aggregateId,status,[userId+status],[userId+deduplicationKey],nextRetryAt,createdAt",
    offlineConfirmations: "operationId,userId,stageId,aggregateId,confirmedAt,expiresAt",
    offlineMeta: "key,updatedAt",
  });

  return nextDatabase;
}

export function getOfflineDatabase(): PegasusOfflineDatabase {
  if (typeof indexedDB === "undefined") {
    throw new Error("La base offline solo está disponible en el navegador.");
  }

  database ??= createDatabase();
  return database;
}

export async function closeOfflineDatabase(): Promise<void> {
  if (!database) return;

  database.close();
  database = null;
}
