import { Column, Entity, JoinColumn, ManyToOne, Unique } from "typeorm";
import { PegasusBaseEntity, SyncableEntity } from "./base.entity.js";
import { Category } from "./category.entity.js";
import { FairEntry } from "./fair-entries.js";
import { Fair } from "./fair.entity.js";
import { User } from "./user.entity.js";

export type FairCategoryStageStatus =
  | "NOT_STARTED"
  | "PRE_RING_STARTED"
  | "PRE_RING_CLOSED"
  | "JUDGING_STARTED"
  | "FA_CONSOLIDATED"
  | "F1_IN_PROGRESS"
  | "F1_CONSOLIDATED"
  | "F2_IN_PROGRESS"
  | "TIE_BREAK_IN_PROGRESS"
  | "JUDGING_DESERTED"
  | "JUDGING_CLOSED";

export type VeterinaryCheckStatus = "PENDING" | "APPROVED" | "REJECTED" | "ABSENT";

export type JudgeFormStatus = "PENDING" | "STARTED" | "CLOSED";

export type JudgingParticipantStatus = "ELIGIBLE" | "DISQUALIFIED";

export type JudgeEntryDecision = "SELECTED" | "DISCARDED" | "DISQUALIFIED";

export type NotificationOutboxStatus = "PENDING" | "SENT" | "FAILED";

@Unique("UQ_fair_category_stages_fair_category", ["fairId", "categoryId"])
@Entity({ name: "fair_category_stages" })
export class FairCategoryStage extends PegasusBaseEntity {
  @Column({ name: "fair_id", type: "uuid" })
  fairId!: string;

  @ManyToOne(() => Fair, { nullable: false })
  @JoinColumn({ name: "fair_id" })
  fair!: Fair;

  @Column({ name: "category_id", type: "uuid" })
  categoryId!: string;

  @ManyToOne(() => Category, { nullable: false })
  @JoinColumn({ name: "category_id" })
  category!: Category;

  @Column({ name: "status", type: "varchar" })
  status!: FairCategoryStageStatus;

  @Column({ name: "pre_ring_started_at", type: "timestamp", nullable: true })
  preRingStartedAt!: Date | null;

  @Column({ name: "pre_ring_started_by_user_id", type: "uuid", nullable: true })
  preRingStartedByUserId!: string | null;

  @Column({ name: "pre_ring_closed_at", type: "timestamp", nullable: true })
  preRingClosedAt!: Date | null;

  @Column({ name: "pre_ring_closed_by_user_id", type: "uuid", nullable: true })
  preRingClosedByUserId!: string | null;

  @Column({ name: "judging_started_at", type: "timestamp", nullable: true })
  judgingStartedAt!: Date | null;

  @Column({ name: "judging_started_by_user_id", type: "uuid", nullable: true })
  judgingStartedByUserId!: string | null;

  @Column({ name: "fa_consolidated_at", type: "timestamp", nullable: true })
  faConsolidatedAt!: Date | null;

  @Column({ name: "fa_consolidated_by_user_id", type: "uuid", nullable: true })
  faConsolidatedByUserId!: string | null;

  @Column({ name: "judging_closed_at", type: "timestamp", nullable: true })
  judgingClosedAt!: Date | null;

  @Column({ name: "judging_closed_by_user_id", type: "uuid", nullable: true })
  judgingClosedByUserId!: string | null;

  @Column({ name: "deserted_at", type: "timestamp", nullable: true })
  desertedAt!: Date | null;

  @Column({ name: "deserted_by_user_id", type: "uuid", nullable: true })
  desertedByUserId!: string | null;

  @Column({ name: "deserted_reason", type: "text", nullable: true })
  desertedReason!: string | null;
}

@Unique("UQ_veterinary_checks_stage_entry", ["fairCategoryStageId", "fairEntryId"])
@Entity({ name: "veterinary_checks" })
export class VeterinaryCheck extends PegasusBaseEntity {
  @Column({ name: "fair_category_stage_id", type: "uuid" })
  fairCategoryStageId!: string;

  @ManyToOne(() => FairCategoryStage, { nullable: false })
  @JoinColumn({ name: "fair_category_stage_id" })
  fairCategoryStage!: FairCategoryStage;

  @Column({ name: "fair_entry_id", type: "uuid" })
  fairEntryId!: string;

  @ManyToOne(() => FairEntry, { nullable: false })
  @JoinColumn({ name: "fair_entry_id" })
  fairEntry!: FairEntry;

  @Column({ name: "veterinarian_user_id", type: "uuid", nullable: true })
  veterinarianUserId!: string | null;

  @ManyToOne(() => User, { nullable: true })
  @JoinColumn({ name: "veterinarian_user_id" })
  veterinarianUser!: User | null;

  @Column({ name: "status", type: "varchar" })
  status!: VeterinaryCheckStatus;

  @Column({ name: "notes", type: "text", nullable: true })
  notes!: string | null;

  @Column({ name: "checked_at", type: "timestamp", nullable: true })
  checkedAt!: Date | null;
}

@Unique("UQ_disqualification_reasons_code", ["code"])
@Entity({ name: "disqualification_reasons" })
export class DisqualificationReason extends SyncableEntity {
  @Column({ name: "code", type: "varchar" })
  code!: string;

  @Column({ name: "name", type: "varchar" })
  name!: string;

  @Column({ name: "description", type: "text", nullable: true })
  description!: string | null;

  @Column({ name: "is_active", type: "boolean", default: true })
  isActive!: boolean;
}

@Unique("UQ_judging_participants_stage_entry", ["fairCategoryStageId", "fairEntryId"])
@Entity({ name: "judging_participants" })
export class JudgingParticipant extends PegasusBaseEntity {
  @Column({ name: "fair_category_stage_id", type: "uuid" })
  fairCategoryStageId!: string;

  @ManyToOne(() => FairCategoryStage, { nullable: false })
  @JoinColumn({ name: "fair_category_stage_id" })
  fairCategoryStage!: FairCategoryStage;

  @Column({ name: "fair_entry_id", type: "uuid" })
  fairEntryId!: string;

  @ManyToOne(() => FairEntry, { nullable: false })
  @JoinColumn({ name: "fair_entry_id" })
  fairEntry!: FairEntry;

  @Column({ name: "status", type: "varchar" })
  status!: JudgingParticipantStatus;

  @Column({ name: "disqualified_by_judge_form_id", type: "uuid", nullable: true })
  disqualifiedByJudgeFormId!: string | null;

  @Column({ name: "disqualification_reason_id", type: "uuid", nullable: true })
  disqualificationReasonId!: string | null;

  @ManyToOne(() => DisqualificationReason, { nullable: true })
  @JoinColumn({ name: "disqualification_reason_id" })
  disqualificationReason!: DisqualificationReason | null;

  @Column({ name: "disqualified_at", type: "timestamp", nullable: true })
  disqualifiedAt!: Date | null;
}

@Unique("UQ_fa_judge_forms_stage_judge", ["fairCategoryStageId", "judgeUserId"])
@Entity({ name: "fa_judge_forms" })
export class FaJudgeForm extends PegasusBaseEntity {
  @Column({ name: "fair_category_stage_id", type: "uuid" })
  fairCategoryStageId!: string;

  @ManyToOne(() => FairCategoryStage, { nullable: false })
  @JoinColumn({ name: "fair_category_stage_id" })
  fairCategoryStage!: FairCategoryStage;

  @Column({ name: "judge_user_id", type: "uuid" })
  judgeUserId!: string;

  @ManyToOne(() => User, { nullable: false })
  @JoinColumn({ name: "judge_user_id" })
  judgeUser!: User;

  @Column({ name: "status", type: "varchar" })
  status!: JudgeFormStatus;

  @Column({ name: "started_at", type: "timestamp", nullable: true })
  startedAt!: Date | null;

  @Column({ name: "closed_at", type: "timestamp", nullable: true })
  closedAt!: Date | null;
}

@Unique("UQ_fa_judge_entry_decisions_form_participant", [
  "faJudgeFormId",
  "judgingParticipantId"
])
@Entity({ name: "fa_judge_entry_decisions" })
export class FaJudgeEntryDecision extends PegasusBaseEntity {
  @Column({ name: "fa_judge_form_id", type: "uuid" })
  faJudgeFormId!: string;

  @ManyToOne(() => FaJudgeForm, { nullable: false })
  @JoinColumn({ name: "fa_judge_form_id" })
  faJudgeForm!: FaJudgeForm;

  @Column({ name: "judging_participant_id", type: "uuid" })
  judgingParticipantId!: string;

  @ManyToOne(() => JudgingParticipant, { nullable: false })
  @JoinColumn({ name: "judging_participant_id" })
  judgingParticipant!: JudgingParticipant;

  @Column({ name: "decision", type: "varchar" })
  decision!: JudgeEntryDecision;

  @Column({ name: "selection_order", type: "integer", nullable: true })
  selectionOrder!: number | null;

  @Column({ name: "disqualification_reason_id", type: "uuid", nullable: true })
  disqualificationReasonId!: string | null;

  @ManyToOne(() => DisqualificationReason, { nullable: true })
  @JoinColumn({ name: "disqualification_reason_id" })
  disqualificationReason!: DisqualificationReason | null;
}

@Unique("UQ_fa_consolidated_results_stage_participant", [
  "fairCategoryStageId",
  "judgingParticipantId"
])
@Entity({ name: "fa_consolidated_results" })
export class FaConsolidatedResult extends PegasusBaseEntity {
  @Column({ name: "fair_category_stage_id", type: "uuid" })
  fairCategoryStageId!: string;

  @ManyToOne(() => FairCategoryStage, { nullable: false })
  @JoinColumn({ name: "fair_category_stage_id" })
  fairCategoryStage!: FairCategoryStage;

  @Column({ name: "judging_participant_id", type: "uuid" })
  judgingParticipantId!: string;

  @ManyToOne(() => JudgingParticipant, { nullable: false })
  @JoinColumn({ name: "judging_participant_id" })
  judgingParticipant!: JudgingParticipant;

  @Column({ name: "votes_count", type: "integer" })
  votesCount!: number;

  @Column({ name: "final_position", type: "integer", nullable: true })
  finalPosition!: number | null;
}

@Entity({ name: "workflow_events" })
export class WorkflowEvent extends PegasusBaseEntity {
  @Column({ name: "fair_category_stage_id", type: "uuid" })
  fairCategoryStageId!: string;

  @ManyToOne(() => FairCategoryStage, { nullable: false })
  @JoinColumn({ name: "fair_category_stage_id" })
  fairCategoryStage!: FairCategoryStage;

  @Column({ name: "user_id", type: "uuid", nullable: true })
  userId!: string | null;

  @ManyToOne(() => User, { nullable: true })
  @JoinColumn({ name: "user_id" })
  user!: User | null;

  @Column({ name: "event_type", type: "varchar" })
  eventType!: string;

  @Column({ name: "from_status", type: "varchar", nullable: true })
  fromStatus!: string | null;

  @Column({ name: "to_status", type: "varchar", nullable: true })
  toStatus!: string | null;

  @Column({ name: "payload", type: "jsonb", nullable: true })
  payload!: Record<string, unknown> | null;
}

@Entity({ name: "notification_outbox" })
export class NotificationOutbox extends PegasusBaseEntity {
  @Column({ name: "recipient_user_id", type: "uuid", nullable: true })
  recipientUserId!: string | null;

  @ManyToOne(() => User, { nullable: true })
  @JoinColumn({ name: "recipient_user_id" })
  recipientUser!: User | null;

  @Column({ name: "recipient_role", type: "varchar", nullable: true })
  recipientRole!: string | null;

  @Column({ name: "fair_category_stage_id", type: "uuid", nullable: true })
  fairCategoryStageId!: string | null;

  @ManyToOne(() => FairCategoryStage, { nullable: true })
  @JoinColumn({ name: "fair_category_stage_id" })
  fairCategoryStage!: FairCategoryStage | null;

  @Column({ name: "provider", type: "varchar", default: "PUSHER_BEAMS" })
  provider!: string;

  @Column({ name: "type", type: "varchar" })
  type!: string;

  @Column({ name: "title", type: "varchar" })
  title!: string;

  @Column({ name: "body", type: "text" })
  body!: string;

  @Column({ name: "payload", type: "jsonb", nullable: true })
  payload!: Record<string, unknown> | null;

  @Column({ name: "status", type: "varchar", default: "PENDING" })
  status!: NotificationOutboxStatus;

  @Column({ name: "sent_at", type: "timestamp", nullable: true })
  sentAt!: Date | null;

  @Column({ name: "read_at", type: "timestamp", nullable: true })
  readAt!: Date | null;

  @Column({ name: "archived_at", type: "timestamp", nullable: true })
  archivedAt!: Date | null;

  @Column({ name: "failed_at", type: "timestamp", nullable: true })
  failedAt!: Date | null;

  @Column({ name: "error_message", type: "text", nullable: true })
  errorMessage!: string | null;
}
