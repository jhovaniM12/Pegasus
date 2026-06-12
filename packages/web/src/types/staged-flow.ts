export type StageStatus =
  | "NOT_STARTED"
  | "PRE_RING_STARTED"
  | "PRE_RING_CLOSED"
  | "JUDGING_STARTED"
  | "FA_CONSOLIDATED"
  | "JUDGING_CLOSED";

export type VeterinaryCheckStatus = "PENDING" | "APPROVED" | "REJECTED" | "ABSENT";
export type JudgeFormStatus = "PENDING" | "STARTED" | "CLOSED";
export type JudgingParticipantStatus = "ELIGIBLE" | "DISQUALIFIED";
export type JudgeEntryDecision = "SELECTED" | "DISCARDED" | "DISQUALIFIED";

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
  decision: {
    id: string;
    decision: JudgeEntryDecision;
    selectionOrder: number | null;
    disqualificationReason: DisqualificationReason | null;
  } | null;
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
};

export type ManagementState = {
  summary: StagedCategory & { preRingClosedAt: string | null };
  veterinaryChecks: ManagementVetCheck[];
  judgeForms: ManagementJudgeForm[];
  participants: ManagementParticipant[];
  consolidated: Array<{ id: string; trackPosition: number; votesCount: number; finalPosition: number | null }>;
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
