import { Column, Entity, JoinColumn, ManyToOne, Unique } from "typeorm";
import { PegasusBaseEntity } from "./base.entity.js";
import { FairCategoryStage } from "./staged-flow.entity.js";
import { JudgingParticipant } from "./staged-flow.entity.js";
import { User } from "./user.entity.js";

/**
 * Modelo genérico de rondas de juzgamiento posteriores al FA (F1, F2 y desempates).
 *
 * El FA conserva su modelo dedicado (`fa_judge_forms`, `fa_consolidated_results`) porque
 * es la selección inicial. A partir del FA consolidado, el resto del flujo reglamentario
 * (cabeza de lote F1, tarjeta final F2 y rondas de desempate) usa estas tablas genéricas.
 */
export type JudgingRoundType = "F1" | "F2" | "TIE_BREAK";

export type JudgingRoundStatus = "OPEN" | "CONSOLIDATED" | "CLOSED";

export type JudgingRoundFormStatus = "PENDING" | "STARTED" | "CLOSED";

export type JudgingRoundResultStatus = "PROVISIONAL" | "TIED" | "FINAL";

export type TieBreakTestType =
  | "DOUBLE_TABLE"
  | "DIRECTION_CHANGE"
  | "PARALLEL"
  | "CIRCLES"
  | "STOP_AND_GO"
  | "GAIT_CHANGE"
  | "MOUNT";

export type TieBreakTestStatus = "PENDING" | "ACTIVE" | "DONE";

export const MAX_AWARD_POSITIONS = 5;

@Unique("UQ_judging_rounds_stage_type_sequence", ["fairCategoryStageId", "roundType", "sequence"])
@Entity({ name: "judging_rounds" })
export class JudgingRound extends PegasusBaseEntity {
  @Column({ name: "fair_category_stage_id", type: "uuid" })
  fairCategoryStageId!: string;

  @ManyToOne(() => FairCategoryStage, { nullable: false })
  @JoinColumn({ name: "fair_category_stage_id" })
  fairCategoryStage!: FairCategoryStage;

  @Column({ name: "round_type", type: "varchar" })
  roundType!: JudgingRoundType;

  /** Permite múltiples desempates (TIE_BREAK seq 1, 2, ...) dentro de una categoría. */
  @Column({ name: "sequence", type: "integer", default: 1 })
  sequence!: number;

  @Column({ name: "status", type: "varchar" })
  status!: JudgingRoundStatus;

  /** Para rondas de desempate: ronda F2 cuyo empate se está resolviendo. */
  @Column({ name: "parent_round_id", type: "uuid", nullable: true })
  parentRoundId!: string | null;

  @Column({ name: "opened_at", type: "timestamp", nullable: true })
  openedAt!: Date | null;

  @Column({ name: "opened_by_user_id", type: "uuid", nullable: true })
  openedByUserId!: string | null;

  @Column({ name: "consolidated_at", type: "timestamp", nullable: true })
  consolidatedAt!: Date | null;

  @Column({ name: "consolidated_by_user_id", type: "uuid", nullable: true })
  consolidatedByUserId!: string | null;

  @Column({ name: "closed_at", type: "timestamp", nullable: true })
  closedAt!: Date | null;

  @Column({ name: "closed_by_user_id", type: "uuid", nullable: true })
  closedByUserId!: string | null;
}

@Unique("UQ_judging_round_forms_round_judge", ["roundId", "judgeUserId"])
@Entity({ name: "judging_round_forms" })
export class JudgingRoundForm extends PegasusBaseEntity {
  @Column({ name: "round_id", type: "uuid" })
  roundId!: string;

  @ManyToOne(() => JudgingRound, { nullable: false })
  @JoinColumn({ name: "round_id" })
  round!: JudgingRound;

  @Column({ name: "judge_user_id", type: "uuid" })
  judgeUserId!: string;

  @ManyToOne(() => User, { nullable: false })
  @JoinColumn({ name: "judge_user_id" })
  judgeUser!: User;

  @Column({ name: "status", type: "varchar" })
  status!: JudgingRoundFormStatus;

  @Column({ name: "started_at", type: "timestamp", nullable: true })
  startedAt!: Date | null;

  @Column({ name: "closed_at", type: "timestamp", nullable: true })
  closedAt!: Date | null;
}

@Unique("UQ_judging_round_entries_form_participant", ["roundFormId", "judgingParticipantId"])
@Entity({ name: "judging_round_entries" })
export class JudgingRoundEntry extends PegasusBaseEntity {
  @Column({ name: "round_form_id", type: "uuid" })
  roundFormId!: string;

  @ManyToOne(() => JudgingRoundForm, { nullable: false })
  @JoinColumn({ name: "round_form_id" })
  roundForm!: JudgingRoundForm;

  @Column({ name: "judging_participant_id", type: "uuid" })
  judgingParticipantId!: string;

  @ManyToOne(() => JudgingParticipant, { nullable: false })
  @JoinColumn({ name: "judging_participant_id" })
  judgingParticipant!: JudgingParticipant;

  /** F1: marca de cabeza de lote seleccionada por el juez. */
  @Column({ name: "selected", type: "boolean", default: false })
  selected!: boolean;

  /** F2 / desempate: puesto ordinal asignado por el juez (1 = mejor). */
  @Column({ name: "position", type: "integer", nullable: true })
  position!: number | null;

  /** F1: observación privada del juez sobre este ejemplar (solo visible para él). */
  @Column({ name: "private_note", type: "varchar", length: 1000, nullable: true })
  privateNote!: string | null;
}

@Unique("UQ_judging_round_form_deserted_positions_form_position", ["roundFormId", "position"])
@Entity({ name: "judging_round_form_deserted_positions" })
export class JudgingRoundFormDesertedPosition extends PegasusBaseEntity {
  @Column({ name: "round_form_id", type: "uuid" })
  roundFormId!: string;

  @ManyToOne(() => JudgingRoundForm, { nullable: false })
  @JoinColumn({ name: "round_form_id" })
  roundForm!: JudgingRoundForm;

  @Column({ name: "position", type: "integer" })
  position!: number;
}

@Unique("UQ_judging_round_results_round_participant", ["roundId", "judgingParticipantId"])
@Entity({ name: "judging_round_results" })
export class JudgingRoundResult extends PegasusBaseEntity {
  @Column({ name: "round_id", type: "uuid" })
  roundId!: string;

  @ManyToOne(() => JudgingRound, { nullable: false })
  @JoinColumn({ name: "round_id" })
  round!: JudgingRound;

  @Column({ name: "judging_participant_id", type: "uuid" })
  judgingParticipantId!: string;

  @ManyToOne(() => JudgingParticipant, { nullable: false })
  @JoinColumn({ name: "judging_participant_id" })
  judgingParticipant!: JudgingParticipant;

  /** F1: número de jueces que lo seleccionaron. F2: suma de puestos. */
  @Column({ name: "score_value", type: "integer", default: 0 })
  scoreValue!: number;

  /** F2: número de tarjetas que lo ubicaron en primer puesto. */
  @Column({ name: "first_place_votes", type: "integer", default: 0 })
  firstPlaceVotes!: number;

  @Column({ name: "final_position", type: "integer", nullable: true })
  finalPosition!: number | null;

  @Column({ name: "status", type: "varchar" })
  status!: JudgingRoundResultStatus;
}

@Unique("UQ_judging_round_deserted_results_round_position", ["roundId", "finalPosition"])
@Entity({ name: "judging_round_deserted_results" })
export class JudgingRoundDesertedResult extends PegasusBaseEntity {
  @Column({ name: "round_id", type: "uuid" })
  roundId!: string;

  @ManyToOne(() => JudgingRound, { nullable: false })
  @JoinColumn({ name: "round_id" })
  round!: JudgingRound;

  @Column({ name: "final_position", type: "integer" })
  finalPosition!: number;

  @Column({ name: "votes_count", type: "integer", default: 0 })
  votesCount!: number;
}

@Unique("UQ_award_distinctives_position", ["position"])
@Entity({ name: "award_distinctives" })
export class AwardDistinctive extends PegasusBaseEntity {
  @Column({ name: "position", type: "integer" })
  position!: number;

  @Column({ name: "label", type: "varchar" })
  label!: string;

  @Column({ name: "color_name", type: "varchar" })
  colorName!: string;

  @Column({ name: "color_hex", type: "varchar", nullable: true })
  colorHex!: string | null;

  @Column({ name: "is_active", type: "boolean", default: true })
  isActive!: boolean;
}

@Unique("UQ_tie_break_tests_round_type", ["roundId", "testType"])
@Entity({ name: "tie_break_tests" })
export class TieBreakTest extends PegasusBaseEntity {
  @Column({ name: "round_id", type: "uuid" })
  roundId!: string;

  @ManyToOne(() => JudgingRound, { nullable: false })
  @JoinColumn({ name: "round_id" })
  round!: JudgingRound;

  @Column({ name: "test_type", type: "varchar" })
  testType!: TieBreakTestType;

  @Column({ name: "test_order", type: "integer", default: 1 })
  testOrder!: number;

  @Column({ name: "status", type: "varchar" })
  status!: TieBreakTestStatus;
}
