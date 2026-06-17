import type { MigrationInterface, QueryRunner } from "typeorm";

export class AddRoundEntryAnnotations1717430400018 implements MigrationInterface {
  name = "AddRoundEntryAnnotations1717430400018";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "judging_round_entries"
      ADD COLUMN "private_note" varchar(1000)
    `);

    await queryRunner.query(`
      CREATE TABLE "judging_round_entry_reminders" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "round_form_entry_id" uuid NOT NULL,
        "judging_reminder_id" uuid NOT NULL,
        "effect" varchar NOT NULL,
        "created_at" timestamp NOT NULL DEFAULT now(),
        "updated_at" timestamp NOT NULL DEFAULT now(),
        CONSTRAINT "PK_judging_round_entry_reminders_id" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_round_entry_reminders_entry_reminder" UNIQUE ("round_form_entry_id", "judging_reminder_id"),
        CONSTRAINT "FK_judging_round_entry_reminders_entry"
          FOREIGN KEY ("round_form_entry_id") REFERENCES "judging_round_entries"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_judging_round_entry_reminders_reminder"
          FOREIGN KEY ("judging_reminder_id") REFERENCES "judging_reminders"("id")
      )
    `);

    await queryRunner.query(`
      CREATE INDEX "IDX_judging_round_entry_reminders_entry"
      ON "judging_round_entry_reminders" ("round_form_entry_id")
    `);

    await queryRunner.query(`
      CREATE TABLE "judging_round_entry_reminder_history" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "round_form_id" uuid NOT NULL,
        "round_form_entry_id" uuid NOT NULL,
        "judging_reminder_id" uuid NOT NULL,
        "effect" varchar NOT NULL,
        "track_position_snapshot" integer NOT NULL,
        "rider_name_snapshot" varchar NOT NULL,
        "reminder_name_snapshot" varchar NOT NULL,
        "reminder_icon_snapshot" varchar NOT NULL,
        "created_at" timestamp NOT NULL DEFAULT now(),
        "updated_at" timestamp NOT NULL DEFAULT now(),
        CONSTRAINT "PK_judging_round_entry_reminder_history_id" PRIMARY KEY ("id"),
        CONSTRAINT "FK_judging_round_entry_reminder_history_form"
          FOREIGN KEY ("round_form_id") REFERENCES "judging_round_forms"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_judging_round_entry_reminder_history_entry"
          FOREIGN KEY ("round_form_entry_id") REFERENCES "judging_round_entries"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_judging_round_entry_reminder_history_reminder"
          FOREIGN KEY ("judging_reminder_id") REFERENCES "judging_reminders"("id")
      )
    `);

    await queryRunner.query(`
      CREATE INDEX "IDX_judging_round_entry_reminder_history_form_created"
      ON "judging_round_entry_reminder_history" ("round_form_id", "created_at" DESC)
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "judging_round_entry_reminder_history"`);
    await queryRunner.query(`DROP TABLE "judging_round_entry_reminders"`);
    await queryRunner.query(`ALTER TABLE "judging_round_entries" DROP COLUMN "private_note"`);
  }
}
