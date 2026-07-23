import { ApiService } from "@/services/api.service";
import type { OfflineMutationEnvelope } from "@/offline/mutation-types";
import type {
  ApiResponse,
  FaState,
  ManagementState,
  NotificationInboxState,
  RoundReminderHistoryItem,
  RoundState,
  RoundType,
  RoundsManagement,
  StaffNotification,
  StagedCategory,
  TieBreakTestType,
  VeterinaryCheck,
  VeterinaryCheckStatus,
} from "@/types/staged-flow";

class StagedFlowService extends ApiService {
  async listCategories(): Promise<ApiResponse<StagedCategory[]>> {
    return this.get<ApiResponse<StagedCategory[]>>("/api/staff/staged-categories");
  }

  async getCategory(stageId: string): Promise<ApiResponse<StagedCategory>> {
    return this.get<ApiResponse<StagedCategory>>(`/api/staff/staged-categories/${stageId}`);
  }

  async startPreRing(stageId: string): Promise<ApiResponse<StagedCategory>> {
    return this.post<ApiResponse<StagedCategory>>(`/api/staff/fair-categories/${stageId}/pre-ring/start`);
  }

  async resetStageForTesting(stageId: string): Promise<ApiResponse<StagedCategory>> {
    return this.post<ApiResponse<StagedCategory>>(`/api/staff/fair-categories/${stageId}/reset-for-testing`);
  }

  async listVeterinaryChecks(stageId: string): Promise<ApiResponse<VeterinaryCheck[]>> {
    return this.get<ApiResponse<VeterinaryCheck[]>>(`/api/staff/fair-categories/${stageId}/veterinary-checks`);
  }

  async updateVeterinaryCheck(
    stageId: string,
    fairEntryId: string,
    body:
      | { status: VeterinaryCheckStatus; notes?: string | null }
      | OfflineMutationEnvelope<{ status: VeterinaryCheckStatus; notes?: string | null }>
  ): Promise<ApiResponse<VeterinaryCheck[]>> {
    return this.patch<ApiResponse<VeterinaryCheck[]>>(
      `/api/staff/fair-categories/${stageId}/veterinary-checks/${fairEntryId}`,
      body
    );
  }

  async closePreRing(stageId: string): Promise<ApiResponse<StagedCategory>> {
    return this.post<ApiResponse<StagedCategory>>(`/api/staff/fair-categories/${stageId}/pre-ring/close`);
  }

  async startJudging(stageId: string): Promise<ApiResponse<StagedCategory>> {
    return this.post<ApiResponse<StagedCategory>>(`/api/staff/fair-categories/${stageId}/judging/start`);
  }

  async getFa(stageId: string): Promise<ApiResponse<FaState>> {
    return this.get<ApiResponse<FaState>>(`/api/staff/fair-categories/${stageId}/fa`);
  }

  async startFa(stageId: string): Promise<ApiResponse<FaState>> {
    return this.post<ApiResponse<FaState>>(`/api/staff/fair-categories/${stageId}/fa/start`);
  }

  async updateFaDecisions(
    stageId: string,
    selectedParticipantIdsOrEnvelope:
      | string[]
      | OfflineMutationEnvelope<{ selectedParticipantIds: string[] }>
  ): Promise<ApiResponse<FaState>> {
    const body = Array.isArray(selectedParticipantIdsOrEnvelope)
      ? { selectedParticipantIds: selectedParticipantIdsOrEnvelope }
      : selectedParticipantIdsOrEnvelope;
    return this.put<ApiResponse<FaState>>(`/api/staff/fair-categories/${stageId}/fa/decisions`, body);
  }

  async disqualifyParticipant(
    stageId: string,
    judgingParticipantId: string,
    reasonId: string
  ): Promise<ApiResponse<FaState>> {
    return this.post<ApiResponse<FaState>>(
      `/api/staff/fair-categories/${stageId}/fa/participants/${judgingParticipantId}/disqualify`,
      { reasonId }
    );
  }

  async requestFaRepeatTrack(stageId: string, judgingParticipantId: string): Promise<ApiResponse<FaState>> {
    return this.post<ApiResponse<FaState>>(
      `/api/staff/fair-categories/${stageId}/fa/participants/${judgingParticipantId}/repeat-track-request`
    );
  }

  async executeFaRepeatTrackRequest(stageId: string, requestId: string): Promise<ApiResponse<ManagementState>> {
    return this.post<ApiResponse<ManagementState>>(
      `/api/staff/fair-categories/${stageId}/fa/repeat-track-requests/${requestId}/execute`
    );
  }

  async closeFa(stageId: string, selectedParticipantIds: string[]): Promise<ApiResponse<FaState>> {
    return this.post<ApiResponse<FaState>>(`/api/staff/fair-categories/${stageId}/fa/close`, {
      selectedParticipantIds,
    });
  }

  async getManagement(stageId: string): Promise<ApiResponse<ManagementState>> {
    return this.get<ApiResponse<ManagementState>>(`/api/staff/fair-categories/${stageId}/management`);
  }

  async consolidateFa(stageId: string): Promise<ApiResponse<StagedCategory>> {
    return this.post<ApiResponse<StagedCategory>>(`/api/staff/fair-categories/${stageId}/fa/consolidate`);
  }

  // ─── Rondas F1 / F2 / desempate ────────────────────────────────────────────

  async openNextRound(stageId: string): Promise<ApiResponse<StagedCategory>> {
    return this.post<ApiResponse<StagedCategory>>(`/api/staff/fair-categories/${stageId}/rounds/open`);
  }

  async getRound(stageId: string): Promise<ApiResponse<RoundState>> {
    return this.get<ApiResponse<RoundState>>(`/api/staff/fair-categories/${stageId}/rounds/current`);
  }

  async getRoundByType(stageId: string, roundType: RoundType): Promise<ApiResponse<RoundState>> {
    return this.get<ApiResponse<RoundState>>(`/api/staff/fair-categories/${stageId}/rounds/${roundType}`);
  }

  async startRoundForm(stageId: string): Promise<ApiResponse<RoundState>> {
    return this.post<ApiResponse<RoundState>>(`/api/staff/fair-categories/${stageId}/rounds/form/start`);
  }

  async updateRoundForm(
    stageId: string,
    body:
      | {
          selectedParticipantIds?: string[];
          positions?: Array<{ participantId: string; position: number }>;
          desertedPositions?: number[];
        }
      | OfflineMutationEnvelope<{
          roundId: string;
          tieBlockIdentity: string;
          selectedParticipantIds?: string[];
          positions?: Array<{ participantId: string; position: number }>;
          desertedPositions?: number[];
        }>
  ): Promise<ApiResponse<RoundState>> {
    return this.put<ApiResponse<RoundState>>(`/api/staff/fair-categories/${stageId}/rounds/form/entries`, body);
  }

  async updateRoundEntryReminders(
    stageId: string,
    participantId: string,
    remindersOrEnvelope:
      | Array<{ reminderId: string; effect: "SUMA" | "RESTA" }>
      | OfflineMutationEnvelope<{
          reminders: Array<{ reminderId: string; effect: "SUMA" | "RESTA" }>;
          roundId: string;
          tieBlockIdentity: string;
        }>
  ): Promise<ApiResponse<RoundState>> {
    const body = Array.isArray(remindersOrEnvelope)
      ? { reminders: remindersOrEnvelope }
      : remindersOrEnvelope;
    return this.put<ApiResponse<RoundState>>(
      `/api/staff/fair-categories/${stageId}/rounds/form/entries/${participantId}/reminders`,
      body
    );
  }

  async updateRoundEntryNote(
    stageId: string,
    participantId: string,
    noteOrEnvelope:
      | string
      | null
      | OfflineMutationEnvelope<{
          note: string | null;
          roundId: string;
          tieBlockIdentity: string;
        }>
  ): Promise<ApiResponse<RoundState>> {
    const body =
      noteOrEnvelope !== null && typeof noteOrEnvelope === "object" && "operationId" in noteOrEnvelope
        ? noteOrEnvelope
        : { note: noteOrEnvelope as string | null };
    return this.put<ApiResponse<RoundState>>(
      `/api/staff/fair-categories/${stageId}/rounds/form/entries/${participantId}/note`,
      body
    );
  }

  async disqualifyRoundParticipant(
    stageId: string,
    participantId: string,
    reasonId: string
  ): Promise<ApiResponse<RoundState>> {
    return this.post<ApiResponse<RoundState>>(
      `/api/staff/fair-categories/${stageId}/rounds/form/entries/${participantId}/disqualify`,
      { reasonId }
    );
  }

  async getRoundReminderHistory(stageId: string): Promise<ApiResponse<RoundReminderHistoryItem[]>> {
    return this.get<ApiResponse<RoundReminderHistoryItem[]>>(
      `/api/staff/fair-categories/${stageId}/rounds/form/reminder-history`
    );
  }

  async closeRoundForm(
    stageId: string,
    body: {
      roundId: string;
      tieBlockIdentity: string;
      expectedRevision: number;
      selectedParticipantIds?: string[];
      positions?: Array<{ participantId: string; position: number }>;
      desertedPositions?: number[];
    }
  ): Promise<ApiResponse<RoundState>> {
    return this.post<ApiResponse<RoundState>>(`/api/staff/fair-categories/${stageId}/rounds/form/close`, body);
  }

  async consolidateRound(stageId: string): Promise<ApiResponse<StagedCategory>> {
    return this.post<ApiResponse<StagedCategory>>(`/api/staff/fair-categories/${stageId}/rounds/consolidate`);
  }

  async openTieBreak(stageId: string, testTypes: TieBreakTestType[]): Promise<ApiResponse<StagedCategory>> {
    return this.post<ApiResponse<StagedCategory>>(`/api/staff/fair-categories/${stageId}/rounds/tie-break/open`, {
      testTypes,
    });
  }

  async closeResults(stageId: string): Promise<ApiResponse<StagedCategory>> {
    return this.post<ApiResponse<StagedCategory>>(`/api/staff/fair-categories/${stageId}/results/close`);
  }

  async desertCompetition(stageId: string, reason?: string): Promise<ApiResponse<StagedCategory>> {
    return this.post<ApiResponse<StagedCategory>>(`/api/staff/fair-categories/${stageId}/results/desert`, {
      reason: reason?.trim() || null
    });
  }

  async getRoundsManagement(stageId: string): Promise<ApiResponse<RoundsManagement>> {
    return this.get<ApiResponse<RoundsManagement>>(`/api/staff/fair-categories/${stageId}/rounds/management`);
  }

  async getBeamsToken(): Promise<ApiResponse<unknown>> {
    return this.post<ApiResponse<unknown>>("/api/staff/push/beams-token");
  }

  async listNotifications(limit = 20): Promise<ApiResponse<NotificationInboxState>> {
    return this.get<ApiResponse<NotificationInboxState>>(`/api/staff/notifications?limit=${limit}`);
  }

  async markNotificationRead(notificationId: string): Promise<ApiResponse<StaffNotification>> {
    return this.patch<ApiResponse<StaffNotification>>(`/api/staff/notifications/${notificationId}/read`);
  }

  async markAllNotificationsRead(): Promise<ApiResponse<NotificationInboxState>> {
    return this.patch<ApiResponse<NotificationInboxState>>("/api/staff/notifications/read-all");
  }

  async archiveNotification(notificationId: string): Promise<ApiResponse<{ id: string; archivedAt: string }>> {
    return this.patch<ApiResponse<{ id: string; archivedAt: string }>>(
      `/api/staff/notifications/${notificationId}/archive`
    );
  }
}

export const stagedFlowService = new StagedFlowService();
