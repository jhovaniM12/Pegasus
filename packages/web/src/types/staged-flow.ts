import type { TieBreakReason } from "@pegasus/core/judging/tie-blocks";

export type StageStatus =
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

export type RoundType = "F1" | "F2" | "TIE_BREAK";
export type RoundStatus = "OPEN" | "CONSOLIDATED" | "CLOSED";
export type RoundFormStatus = "PENDING" | "STARTED" | "CLOSED";
export type RoundResultStatus = "PROVISIONAL" | "TIED" | "FINAL";
export type TieBreakTestType =
  | "DOUBLE_TABLE"
  | "DIRECTION_CHANGE"
  | "PARALLEL"
  | "CIRCLES"
  | "STOP_AND_GO"
  | "GAIT_CHANGE"
  | "MOUNT";

export type VeterinaryCheckStatus = "PENDING" | "APPROVED" | "REJECTED" | "ABSENT";
export type JudgeFormStatus = "PENDING" | "STARTED" | "CLOSED";
export type JudgeFormatKey = "FA" | "F1" | "F2" | "TIE_BREAK";
export type JudgeFormatStatus = "NOT_AVAILABLE" | "PENDING" | "STARTED" | "CLOSED";

export type JudgeFormat = {
  key: JudgeFormatKey;
  formStatus: JudgeFormatStatus;
  isActive: boolean;
  participantCount: number | null;
};
export type JudgingParticipantStatus = "ELIGIBLE" | "DISQUALIFIED";
export type JudgeEntryDecision = "SELECTED" | "DISCARDED" | "DISQUALIFIED";
export type FaRepeatTrackRequestStatus = "PENDING" | "EXECUTED";

export type ApiResponse<T> = {
  success: boolean;
  data?: T;
};

export type StagedCategory = {
  stageId: string;
  status: StageStatus;
  fair: { id: string; name: string | null };
  category: { id: string; name: string | null; minAgeMonths: number; maxAgeMonths: number };
  gait: { id: string; name: string | null };
  totalEntries: number;
  veterinary: { pending: number; approved: number; rejected: number; absent: number };
  judging: { totalJudges: number; closedForms: number; selected: number; discarded: number; disqualified: number };
  judge?: {
    faFormStatus: JudgeFormStatus | null;
    roundFormStatus: RoundFormStatus | null;
    currentRoundType: RoundType | null;
    formats: JudgeFormat[];
  };
};

export type VeterinaryCheck = {
  id: string;
  fairEntryId: string;
  trackPosition: number;
  riderName: string;
  registrationNumber: string;
  status: VeterinaryCheckStatus;
  notes: string | null;
};

export type DisqualificationReason = {
  id: string;
  code: string;
  name: string;
  description: string | null;
};

export type FaParticipant = {
  id: string;
  fairEntryId: string;
  trackPosition: number;
  riderName: string;
  registrationNumber: string;
  status: JudgingParticipantStatus;
  disqualificationReason: DisqualificationReason | null;
  disqualifiedBy: { id: string; name: string } | null;
  repeatTrackRequest: {
    id: string;
    status: FaRepeatTrackRequestStatus;
    requestedAt: string;
    executedAt: string | null;
    requestedBy: { id: string; name: string } | null;
  } | null;
  decision: {
    id: string;
    decision: JudgeEntryDecision;
    selectionOrder: number | null;
    disqualificationReason: DisqualificationReason | null;
  } | null;
};

export type FaConsolidatedFinalist = {
  id: string;
  trackPosition: number;
  votesCount: number;
  finalPosition: number | null;
};

export type FaState = {
  stage: StagedCategory;
  form: {
    id: string;
    status: JudgeFormStatus;
    selectedCount: number;
    disqualifiedCount: number;
    discardedCount: number;
    closedAt: string | null;
  };
  participants: FaParticipant[];
  disqualificationReasons: DisqualificationReason[];
  consolidated: FaConsolidatedFinalist[];
};

export type ManagementVetCheck = {
  id: string;
  trackPosition: number;
  riderName: string;
  registrationNumber: string;
  status: VeterinaryCheckStatus;
};

export type ManagementJudgeForm = {
  id: string;
  judgeUserId: string;
  judgeName: string;
  status: JudgeFormStatus;
  startedAt: string | null;
  closedAt: string | null;
  selectedCount: number;
  disqualifiedCount: number;
  selections: number[];
};

export type ManagementParticipant = {
  id: string;
  trackPosition: number;
  riderName: string;
  registrationNumber: string;
  status: JudgingParticipantStatus;
  disqualificationReason: string | null;
  disqualifiedBy: { id: string; name: string } | null;
};

export type ManagementFaRepeatTrackRequest = {
  id: string;
  status: FaRepeatTrackRequestStatus;
  requestedAt: string;
  executedAt: string | null;
  judgeUserId: string;
  judgeName: string;
  executedBy: { id: string; name: string } | null;
  participant: {
    id: string;
    trackPosition: number;
    riderName: string;
    registrationNumber: string;
  };
};

export type ManagementState = {
  summary: StagedCategory & { preRingClosedAt: string | null; judgingStartedAt: string | null };
  veterinaryChecks: ManagementVetCheck[];
  judgeForms: ManagementJudgeForm[];
  participants: ManagementParticipant[];
  faRepeatTrackRequests: ManagementFaRepeatTrackRequest[];
  consolidated: Array<{ id: string; trackPosition: number; votesCount: number; finalPosition: number | null }>;
};

// ─── Rondas F1 / F2 / desempate ───────────────────────────────────────────────

export type RoundParticipant = {
  id: string;
  trackPosition: number;
  riderName: string;
  registrationNumber: string;
  status: JudgingParticipantStatus;
  disqualificationReason: DisqualificationReason | null;
  disqualifiedBy: { id: string; name: string } | null;
  selected: boolean;
  position: number | null;
  privateNote: string | null;
  reminders: RoundParticipantReminder[];
};

export type RoundReminderEffect = "SUMA" | "RESTA";

export type RoundAvailableReminder = {
  id: string;
  name: string;
  icon: string;
};

export type RoundParticipantReminder = {
  reminderId: string;
  name: string;
  icon: string;
  effect: RoundReminderEffect;
};

export type RoundReminderHistoryItem = {
  id: string;
  participantId: string;
  trackPosition: number;
  riderName: string;
  reminderId: string;
  reminderName: string;
  reminderIcon: string;
  effect: RoundReminderEffect;
  createdAt: string;
};

export type RoundState = {
  stage: StagedCategory;
  round: { id: string; roundType: RoundType; sequence: number; status: RoundStatus };
  form: { id: string; status: RoundFormStatus; closedAt: string | null; desertedPositions: number[] } | null;
  maxSelections: number | null;
  positionRange: { min: number; max: number } | null;
  availableReminders: RoundAvailableReminder[];
  reminderHistory: RoundReminderHistoryItem[];
  disqualificationReasons: DisqualificationReason[];
  participants: RoundParticipant[];
};

export type AwardDistinctiveDto = {
  position: number;
  label: string;
  colorName: string;
  colorHex: string | null;
};

export type RoundResult = {
  id: string;
  participantId: string;
  trackPosition: number;
  riderName: string;
  registrationNumber: string;
  scoreValue: number;
  firstPlaceVotes: number;
  finalPosition: number | null;
  status: RoundResultStatus;
  awardDistinctive: AwardDistinctiveDto | null;
  /** Metadato de presentación agregado al combinar el F2 con desempates consolidados. */
  resolvedByTieBreak?: boolean;
};

export type DesertedRoundResult = {
  id: string;
  finalPosition: number;
  votesCount: number;
  awardDistinctive: AwardDistinctiveDto | null;
};

export type RoundManagementForm = {
  id: string;
  judgeName: string;
  status: RoundFormStatus;
  startedAt: string | null;
  closedAt: string | null;
  desertedPositions: number[];
  entries: Array<{
    participantId: string;
    trackPosition: number;
    riderName: string;
    registrationNumber: string;
    selected: boolean;
    position: number | null;
  }>;
};

export type TieBreakTestDto = {
  id: string;
  testType: TieBreakTestType;
  label: string;
  testOrder: number;
  status: "PENDING" | "ACTIVE" | "DONE";
};

export type RoundManagementItem = {
  id: string;
  roundType: RoundType;
  sequence: number;
  status: RoundStatus;
  openedAt: string | null;
  tieBreakReason: TieBreakReason | null;
  tieBreakStartPosition: number | null;
  tieBreakEndPosition: number | null;
  tieBlocks: Array<{
    reason: TieBreakReason;
    participantIds: string[];
    positionSum: number | null;
    startPosition: number;
    endPosition: number;
  }>;
  forms: RoundManagementForm[];
  results: RoundResult[];
  desertedResults: DesertedRoundResult[];
  tests: TieBreakTestDto[];
};

export type RoundsManagement = {
  stage: StagedCategory;
  rounds: RoundManagementItem[];
};

export type StaffNotification = {
  id: string;
  type: string;
  title: string;
  body: string;
  deepLink: string | null;
  fairName: string | null;
  categoryName: string | null;
  gaitName: string | null;
  readAt: string | null;
  archivedAt: string | null;
  sentAt: string | null;
  createdAt: string;
};

export type NotificationInboxState = {
  unreadCount: number;
  notifications: StaffNotification[];
};
