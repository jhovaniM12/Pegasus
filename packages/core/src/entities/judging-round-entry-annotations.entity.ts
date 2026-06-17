import { Column, Entity, JoinColumn, ManyToOne, Unique } from "typeorm";
import { PegasusBaseEntity } from "./base.entity.js";
import { JudgingReminder } from "./judging-reminder.entity.js";
import { JudgingRoundEntry, JudgingRoundForm } from "./judging-rounds.entity.js";

export type RoundEntryReminderEffect = "SUMA" | "RESTA";

@Unique("UQ_round_entry_reminders_entry_reminder", ["roundFormEntryId", "judgingReminderId"])
@Entity({ name: "judging_round_entry_reminders" })
export class JudgingRoundEntryReminder extends PegasusBaseEntity {
  @Column({ name: "round_form_entry_id", type: "uuid" })
  roundFormEntryId!: string;

  @ManyToOne(() => JudgingRoundEntry, { nullable: false, onDelete: "CASCADE" })
  @JoinColumn({ name: "round_form_entry_id" })
  roundFormEntry!: JudgingRoundEntry;

  @Column({ name: "judging_reminder_id", type: "uuid" })
  judgingReminderId!: string;

  @ManyToOne(() => JudgingReminder, { nullable: false })
  @JoinColumn({ name: "judging_reminder_id" })
  judgingReminder!: JudgingReminder;

  @Column({ name: "effect", type: "varchar" })
  effect!: RoundEntryReminderEffect;
}

@Entity({ name: "judging_round_entry_reminder_history" })
export class JudgingRoundEntryReminderHistory extends PegasusBaseEntity {
  @Column({ name: "round_form_id", type: "uuid" })
  roundFormId!: string;

  @ManyToOne(() => JudgingRoundForm, { nullable: false, onDelete: "CASCADE" })
  @JoinColumn({ name: "round_form_id" })
  roundForm!: JudgingRoundForm;

  @Column({ name: "round_form_entry_id", type: "uuid" })
  roundFormEntryId!: string;

  @ManyToOne(() => JudgingRoundEntry, { nullable: false, onDelete: "CASCADE" })
  @JoinColumn({ name: "round_form_entry_id" })
  roundFormEntry!: JudgingRoundEntry;

  @Column({ name: "judging_reminder_id", type: "uuid" })
  judgingReminderId!: string;

  @ManyToOne(() => JudgingReminder, { nullable: false })
  @JoinColumn({ name: "judging_reminder_id" })
  judgingReminder!: JudgingReminder;

  @Column({ name: "effect", type: "varchar" })
  effect!: RoundEntryReminderEffect;

  @Column({ name: "track_position_snapshot", type: "integer" })
  trackPositionSnapshot!: number;

  @Column({ name: "rider_name_snapshot", type: "varchar" })
  riderNameSnapshot!: string;

  @Column({ name: "reminder_name_snapshot", type: "varchar" })
  reminderNameSnapshot!: string;

  @Column({ name: "reminder_icon_snapshot", type: "varchar" })
  reminderIconSnapshot!: string;
}
