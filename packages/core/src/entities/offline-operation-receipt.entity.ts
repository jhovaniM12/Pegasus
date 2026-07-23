import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  Unique,
} from "typeorm";

export type OfflineAggregateType =
  | "VET_CHECK"
  | "FA_FORM"
  | "ROUND_FORM"
  | "ROUND_NOTE"
  | "ROUND_REMINDERS";

@Unique("UQ_offline_operation_receipts_operation_id", ["operationId"])
@Index("IDX_offline_operation_receipts_user_id", ["userId"])
@Index("IDX_offline_operation_receipts_stage_id", ["fairCategoryStageId"])
@Index("IDX_offline_operation_receipts_created_at", ["createdAt"])
@Entity({ name: "offline_operation_receipts" })
export class OfflineOperationReceipt {
  @PrimaryGeneratedColumn("uuid")
  id!: string;

  @Column({ name: "operation_id", type: "uuid" })
  operationId!: string;

  @Column({ name: "user_id", type: "uuid" })
  userId!: string;

  @Column({ name: "fair_category_stage_id", type: "uuid" })
  fairCategoryStageId!: string;

  @Column({ name: "aggregate_type", type: "varchar" })
  aggregateType!: OfflineAggregateType;

  @Column({ name: "aggregate_id", type: "uuid" })
  aggregateId!: string;

  @Column({ name: "request_hash", type: "varchar", length: 64 })
  requestHash!: string;

  @Column({ name: "response_status", type: "integer" })
  responseStatus!: number;

  @Column({ name: "response_payload", type: "jsonb", nullable: true })
  responsePayload!: unknown | null;

  @Column({ name: "applied_revision", type: "integer", nullable: true })
  appliedRevision!: number | null;

  @CreateDateColumn({ name: "created_at", type: "timestamp" })
  createdAt!: Date;
}
