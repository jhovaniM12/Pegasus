import type { SyncableEntity } from "@pegasus/core";

export type SyncableDto = {
  id: string;
  externalId: string | null;
  sourceSystem: string | null;
  createdAt: string;
  updatedAt: string;
};

export function toSyncableDto(entity: SyncableEntity): SyncableDto {
  return {
    id: entity.id,
    externalId: entity.externalId,
    sourceSystem: entity.sourceSystem,
    createdAt: entity.createdAt.toISOString(),
    updatedAt: entity.updatedAt.toISOString()
  };
}
