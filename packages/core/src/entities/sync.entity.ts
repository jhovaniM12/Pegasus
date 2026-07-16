import { Column, Entity, JoinColumn, ManyToOne, Unique } from "typeorm";
import { PegasusBaseEntity } from "./base.entity.js";
import { User } from "./user.entity.js";

export type SyncBatchStatus =
  | "PROCESSING"
  | "COMPLETED"
  | "COMPLETED_WITH_ERRORS"
  | "FAILED";

@Entity({ name: "sync_batches" })
export class SyncBatch extends PegasusBaseEntity {
  @Column({ name: "source_system", type: "varchar" })
  sourceSystem!: string;

  @Column({ name: "entity_name", type: "varchar" })
  entityName!: string;

  @Column({ name: "file_name", type: "varchar" })
  fileName!: string;

  @Column({ name: "file_size", type: "integer" })
  fileSize!: number;

  @Column({ name: "file_checksum", type: "varchar", length: 64 })
  fileChecksum!: string;

  @Column({ name: "status", type: "varchar" })
  status!: SyncBatchStatus;

  @Column({ name: "total_rows", type: "integer", default: 0 })
  totalRows!: number;

  @Column({ name: "inserted_rows", type: "integer", default: 0 })
  insertedRows!: number;

  @Column({ name: "updated_rows", type: "integer", default: 0 })
  updatedRows!: number;

  @Column({ name: "skipped_rows", type: "integer", default: 0 })
  skippedRows!: number;

  @Column({ name: "failed_rows", type: "integer", default: 0 })
  failedRows!: number;

  @Column({ name: "started_at", type: "timestamp" })
  startedAt!: Date;

  @Column({ name: "finished_at", type: "timestamp", nullable: true })
  finishedAt!: Date | null;

  @Column({ name: "error_message", type: "text", nullable: true })
  errorMessage!: string | null;

  @Column({ name: "created_by", type: "uuid" })
  createdBy!: string;

  @ManyToOne(() => User, { nullable: false })
  @JoinColumn({ name: "created_by" })
  createdByUser!: User;
}

@Entity({ name: "sync_mappings" })
@Unique("UQ_sync_mappings_source_entity_external", [
  "sourceSystem",
  "entityName",
  "externalId"
])
export class SyncMapping extends PegasusBaseEntity {
  @Column({ name: "source_system", type: "varchar" })
  sourceSystem!: string;

  @Column({ name: "entity_name", type: "varchar" })
  entityName!: string;

  @Column({ name: "external_id", type: "varchar" })
  externalId!: string;

  @Column({ name: "internal_id", type: "uuid" })
  internalId!: string;

  @Column({ name: "row_hash", type: "varchar", length: 64 })
  rowHash!: string;

  @Column({ name: "last_seen_batch_id", type: "uuid" })
  lastSeenBatchId!: string;

  @ManyToOne(() => SyncBatch, { nullable: false })
  @JoinColumn({ name: "last_seen_batch_id" })
  lastSeenBatch!: SyncBatch;
}

@Entity({ name: "sync_errors" })
export class SyncError extends PegasusBaseEntity {
  @Column({ name: "batch_id", type: "uuid" })
  batchId!: string;

  @ManyToOne(() => SyncBatch, { nullable: false })
  @JoinColumn({ name: "batch_id" })
  batch!: SyncBatch;

  @Column({ name: "entity_name", type: "varchar" })
  entityName!: string;

  @Column({ name: "row_number", type: "integer" })
  rowNumber!: number;

  @Column({ name: "external_id", type: "varchar", nullable: true })
  externalId!: string | null;

  @Column({ name: "error_code", type: "varchar" })
  errorCode!: string;

  @Column({ name: "error_message", type: "text" })
  errorMessage!: string;

  @Column({ name: "raw_row", type: "jsonb" })
  rawRow!: Record<string, string>;
}
