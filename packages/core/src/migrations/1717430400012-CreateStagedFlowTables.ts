import type { MigrationInterface, QueryRunner } from "typeorm";

export class CreateStagedFlowTables1717430400012 implements MigrationInterface {
  name = "CreateStagedFlowTables1717430400012";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "fair_category_stages" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "fair_id" uuid NOT NULL,
        "category_id" uuid NOT NULL,
        "status" varchar NOT NULL,
        "pre_ring_started_at" timestamp,
        "pre_ring_started_by_user_id" uuid,
        "pre_ring_closed_at" timestamp,
        "pre_ring_closed_by_user_id" uuid,
        "judging_started_at" timestamp,
        "judging_started_by_user_id" uuid,
        "fa_consolidated_at" timestamp,
        "fa_consolidated_by_user_id" uuid,
        "judging_closed_at" timestamp,
        "judging_closed_by_user_id" uuid,
        "created_at" timestamp NOT NULL DEFAULT now(),
        "updated_at" timestamp NOT NULL DEFAULT now(),
        CONSTRAINT "PK_fair_category_stages_id" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_fair_category_stages_fair_category" UNIQUE ("fair_id", "category_id")
      )
    `);
    await queryRunner.query(`
      CREATE TABLE "veterinary_checks" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "fair_category_stage_id" uuid NOT NULL,
        "fair_entry_id" uuid NOT NULL,
        "veterinarian_user_id" uuid,
        "status" varchar NOT NULL,
        "notes" text,
        "checked_at" timestamp,
        "created_at" timestamp NOT NULL DEFAULT now(),
        "updated_at" timestamp NOT NULL DEFAULT now(),
        CONSTRAINT "PK_veterinary_checks_id" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_veterinary_checks_stage_entry" UNIQUE ("fair_category_stage_id", "fair_entry_id")
      )
    `);
    await queryRunner.query(`
      CREATE TABLE "disqualification_reasons" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "external_id" varchar,
        "source_system" varchar,
        "code" varchar NOT NULL,
        "name" varchar NOT NULL,
        "description" text,
        "is_active" boolean NOT NULL DEFAULT true,
        "created_at" timestamp NOT NULL DEFAULT now(),
        "updated_at" timestamp NOT NULL DEFAULT now(),
        CONSTRAINT "PK_disqualification_reasons_id" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_disqualification_reasons_external_id_source_system" UNIQUE ("external_id", "source_system"),
        CONSTRAINT "UQ_disqualification_reasons_code" UNIQUE ("code")
      )
    `);
    await queryRunner.query(`
      CREATE TABLE "judging_participants" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "fair_category_stage_id" uuid NOT NULL,
        "fair_entry_id" uuid NOT NULL,
        "status" varchar NOT NULL,
        "disqualified_by_judge_form_id" uuid,
        "disqualification_reason_id" uuid,
        "disqualified_at" timestamp,
        "created_at" timestamp NOT NULL DEFAULT now(),
        "updated_at" timestamp NOT NULL DEFAULT now(),
        CONSTRAINT "PK_judging_participants_id" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_judging_participants_stage_entry" UNIQUE ("fair_category_stage_id", "fair_entry_id")
      )
    `);
    await queryRunner.query(`
      CREATE TABLE "fa_judge_forms" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "fair_category_stage_id" uuid NOT NULL,
        "judge_user_id" uuid NOT NULL,
        "status" varchar NOT NULL,
        "started_at" timestamp,
        "closed_at" timestamp,
        "created_at" timestamp NOT NULL DEFAULT now(),
        "updated_at" timestamp NOT NULL DEFAULT now(),
        CONSTRAINT "PK_fa_judge_forms_id" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_fa_judge_forms_stage_judge" UNIQUE ("fair_category_stage_id", "judge_user_id")
      )
    `);
    await queryRunner.query(`
      CREATE TABLE "fa_judge_entry_decisions" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "fa_judge_form_id" uuid NOT NULL,
        "judging_participant_id" uuid NOT NULL,
        "decision" varchar NOT NULL,
        "selection_order" integer,
        "disqualification_reason_id" uuid,
        "created_at" timestamp NOT NULL DEFAULT now(),
        "updated_at" timestamp NOT NULL DEFAULT now(),
        CONSTRAINT "PK_fa_judge_entry_decisions_id" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_fa_judge_entry_decisions_form_participant" UNIQUE ("fa_judge_form_id", "judging_participant_id")
      )
    `);
    await queryRunner.query(`
      CREATE TABLE "fa_consolidated_results" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "fair_category_stage_id" uuid NOT NULL,
        "judging_participant_id" uuid NOT NULL,
        "votes_count" integer NOT NULL,
        "final_position" integer,
        "created_at" timestamp NOT NULL DEFAULT now(),
        "updated_at" timestamp NOT NULL DEFAULT now(),
        CONSTRAINT "PK_fa_consolidated_results_id" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_fa_consolidated_results_stage_participant" UNIQUE ("fair_category_stage_id", "judging_participant_id")
      )
    `);
    await queryRunner.query(`
      CREATE TABLE "workflow_events" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "fair_category_stage_id" uuid NOT NULL,
        "user_id" uuid,
        "event_type" varchar NOT NULL,
        "from_status" varchar,
        "to_status" varchar,
        "payload" jsonb,
        "created_at" timestamp NOT NULL DEFAULT now(),
        "updated_at" timestamp NOT NULL DEFAULT now(),
        CONSTRAINT "PK_workflow_events_id" PRIMARY KEY ("id")
      )
    `);
    await queryRunner.query(`
      CREATE TABLE "notification_outbox" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "recipient_user_id" uuid,
        "recipient_role" varchar,
        "fair_category_stage_id" uuid,
        "provider" varchar NOT NULL DEFAULT 'PUSHER_BEAMS',
        "type" varchar NOT NULL,
        "title" varchar NOT NULL,
        "body" text NOT NULL,
        "payload" jsonb,
        "status" varchar NOT NULL DEFAULT 'PENDING',
        "sent_at" timestamp,
        "failed_at" timestamp,
        "error_message" text,
        "created_at" timestamp NOT NULL DEFAULT now(),
        "updated_at" timestamp NOT NULL DEFAULT now(),
        CONSTRAINT "PK_notification_outbox_id" PRIMARY KEY ("id")
      )
    `);

    await queryRunner.query(`CREATE INDEX "IDX_fair_category_stages_status" ON "fair_category_stages" ("status")`);
    await queryRunner.query(`CREATE INDEX "IDX_veterinary_checks_status" ON "veterinary_checks" ("status")`);
    await queryRunner.query(`CREATE INDEX "IDX_judging_participants_status" ON "judging_participants" ("status")`);
    await queryRunner.query(`CREATE INDEX "IDX_fa_judge_forms_status" ON "fa_judge_forms" ("status")`);
    await queryRunner.query(`CREATE INDEX "IDX_notification_outbox_status" ON "notification_outbox" ("status")`);

    await queryRunner.query(`ALTER TABLE "fair_category_stages" ADD CONSTRAINT "FK_fair_category_stages_fair_id" FOREIGN KEY ("fair_id") REFERENCES "fairs"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
    await queryRunner.query(`ALTER TABLE "fair_category_stages" ADD CONSTRAINT "FK_fair_category_stages_category_id" FOREIGN KEY ("category_id") REFERENCES "categories"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
    await queryRunner.query(`ALTER TABLE "fair_category_stages" ADD CONSTRAINT "FK_fair_category_stages_pre_ring_started_by_user_id" FOREIGN KEY ("pre_ring_started_by_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE NO ACTION`);
    await queryRunner.query(`ALTER TABLE "fair_category_stages" ADD CONSTRAINT "FK_fair_category_stages_pre_ring_closed_by_user_id" FOREIGN KEY ("pre_ring_closed_by_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE NO ACTION`);
    await queryRunner.query(`ALTER TABLE "fair_category_stages" ADD CONSTRAINT "FK_fair_category_stages_judging_started_by_user_id" FOREIGN KEY ("judging_started_by_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE NO ACTION`);
    await queryRunner.query(`ALTER TABLE "fair_category_stages" ADD CONSTRAINT "FK_fair_category_stages_fa_consolidated_by_user_id" FOREIGN KEY ("fa_consolidated_by_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE NO ACTION`);
    await queryRunner.query(`ALTER TABLE "fair_category_stages" ADD CONSTRAINT "FK_fair_category_stages_judging_closed_by_user_id" FOREIGN KEY ("judging_closed_by_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE NO ACTION`);
    await queryRunner.query(`ALTER TABLE "veterinary_checks" ADD CONSTRAINT "FK_veterinary_checks_stage_id" FOREIGN KEY ("fair_category_stage_id") REFERENCES "fair_category_stages"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
    await queryRunner.query(`ALTER TABLE "veterinary_checks" ADD CONSTRAINT "FK_veterinary_checks_entry_id" FOREIGN KEY ("fair_entry_id") REFERENCES "fair_entries"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
    await queryRunner.query(`ALTER TABLE "veterinary_checks" ADD CONSTRAINT "FK_veterinary_checks_veterinarian_user_id" FOREIGN KEY ("veterinarian_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE NO ACTION`);
    await queryRunner.query(`ALTER TABLE "judging_participants" ADD CONSTRAINT "FK_judging_participants_stage_id" FOREIGN KEY ("fair_category_stage_id") REFERENCES "fair_category_stages"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
    await queryRunner.query(`ALTER TABLE "judging_participants" ADD CONSTRAINT "FK_judging_participants_entry_id" FOREIGN KEY ("fair_entry_id") REFERENCES "fair_entries"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
    await queryRunner.query(`ALTER TABLE "judging_participants" ADD CONSTRAINT "FK_judging_participants_disqualification_reason_id" FOREIGN KEY ("disqualification_reason_id") REFERENCES "disqualification_reasons"("id") ON DELETE SET NULL ON UPDATE NO ACTION`);
    await queryRunner.query(`ALTER TABLE "fa_judge_forms" ADD CONSTRAINT "FK_fa_judge_forms_stage_id" FOREIGN KEY ("fair_category_stage_id") REFERENCES "fair_category_stages"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
    await queryRunner.query(`ALTER TABLE "fa_judge_forms" ADD CONSTRAINT "FK_fa_judge_forms_judge_user_id" FOREIGN KEY ("judge_user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
    await queryRunner.query(`ALTER TABLE "judging_participants" ADD CONSTRAINT "FK_judging_participants_disqualified_by_judge_form_id" FOREIGN KEY ("disqualified_by_judge_form_id") REFERENCES "fa_judge_forms"("id") ON DELETE SET NULL ON UPDATE NO ACTION`);
    await queryRunner.query(`ALTER TABLE "fa_judge_entry_decisions" ADD CONSTRAINT "FK_fa_judge_entry_decisions_form_id" FOREIGN KEY ("fa_judge_form_id") REFERENCES "fa_judge_forms"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
    await queryRunner.query(`ALTER TABLE "fa_judge_entry_decisions" ADD CONSTRAINT "FK_fa_judge_entry_decisions_participant_id" FOREIGN KEY ("judging_participant_id") REFERENCES "judging_participants"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
    await queryRunner.query(`ALTER TABLE "fa_judge_entry_decisions" ADD CONSTRAINT "FK_fa_judge_entry_decisions_reason_id" FOREIGN KEY ("disqualification_reason_id") REFERENCES "disqualification_reasons"("id") ON DELETE SET NULL ON UPDATE NO ACTION`);
    await queryRunner.query(`ALTER TABLE "fa_consolidated_results" ADD CONSTRAINT "FK_fa_consolidated_results_stage_id" FOREIGN KEY ("fair_category_stage_id") REFERENCES "fair_category_stages"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
    await queryRunner.query(`ALTER TABLE "fa_consolidated_results" ADD CONSTRAINT "FK_fa_consolidated_results_participant_id" FOREIGN KEY ("judging_participant_id") REFERENCES "judging_participants"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
    await queryRunner.query(`ALTER TABLE "workflow_events" ADD CONSTRAINT "FK_workflow_events_stage_id" FOREIGN KEY ("fair_category_stage_id") REFERENCES "fair_category_stages"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
    await queryRunner.query(`ALTER TABLE "workflow_events" ADD CONSTRAINT "FK_workflow_events_user_id" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE NO ACTION`);
    await queryRunner.query(`ALTER TABLE "notification_outbox" ADD CONSTRAINT "FK_notification_outbox_recipient_user_id" FOREIGN KEY ("recipient_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE NO ACTION`);
    await queryRunner.query(`ALTER TABLE "notification_outbox" ADD CONSTRAINT "FK_notification_outbox_stage_id" FOREIGN KEY ("fair_category_stage_id") REFERENCES "fair_category_stages"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "notification_outbox" DROP CONSTRAINT "FK_notification_outbox_stage_id"`);
    await queryRunner.query(`ALTER TABLE "notification_outbox" DROP CONSTRAINT "FK_notification_outbox_recipient_user_id"`);
    await queryRunner.query(`ALTER TABLE "workflow_events" DROP CONSTRAINT "FK_workflow_events_user_id"`);
    await queryRunner.query(`ALTER TABLE "workflow_events" DROP CONSTRAINT "FK_workflow_events_stage_id"`);
    await queryRunner.query(`ALTER TABLE "fa_consolidated_results" DROP CONSTRAINT "FK_fa_consolidated_results_participant_id"`);
    await queryRunner.query(`ALTER TABLE "fa_consolidated_results" DROP CONSTRAINT "FK_fa_consolidated_results_stage_id"`);
    await queryRunner.query(`ALTER TABLE "fa_judge_entry_decisions" DROP CONSTRAINT "FK_fa_judge_entry_decisions_reason_id"`);
    await queryRunner.query(`ALTER TABLE "fa_judge_entry_decisions" DROP CONSTRAINT "FK_fa_judge_entry_decisions_participant_id"`);
    await queryRunner.query(`ALTER TABLE "fa_judge_entry_decisions" DROP CONSTRAINT "FK_fa_judge_entry_decisions_form_id"`);
    await queryRunner.query(`ALTER TABLE "judging_participants" DROP CONSTRAINT "FK_judging_participants_disqualified_by_judge_form_id"`);
    await queryRunner.query(`ALTER TABLE "fa_judge_forms" DROP CONSTRAINT "FK_fa_judge_forms_judge_user_id"`);
    await queryRunner.query(`ALTER TABLE "fa_judge_forms" DROP CONSTRAINT "FK_fa_judge_forms_stage_id"`);
    await queryRunner.query(`ALTER TABLE "judging_participants" DROP CONSTRAINT "FK_judging_participants_disqualification_reason_id"`);
    await queryRunner.query(`ALTER TABLE "judging_participants" DROP CONSTRAINT "FK_judging_participants_entry_id"`);
    await queryRunner.query(`ALTER TABLE "judging_participants" DROP CONSTRAINT "FK_judging_participants_stage_id"`);
    await queryRunner.query(`ALTER TABLE "veterinary_checks" DROP CONSTRAINT "FK_veterinary_checks_veterinarian_user_id"`);
    await queryRunner.query(`ALTER TABLE "veterinary_checks" DROP CONSTRAINT "FK_veterinary_checks_entry_id"`);
    await queryRunner.query(`ALTER TABLE "veterinary_checks" DROP CONSTRAINT "FK_veterinary_checks_stage_id"`);
    await queryRunner.query(`ALTER TABLE "fair_category_stages" DROP CONSTRAINT "FK_fair_category_stages_judging_closed_by_user_id"`);
    await queryRunner.query(`ALTER TABLE "fair_category_stages" DROP CONSTRAINT "FK_fair_category_stages_fa_consolidated_by_user_id"`);
    await queryRunner.query(`ALTER TABLE "fair_category_stages" DROP CONSTRAINT "FK_fair_category_stages_judging_started_by_user_id"`);
    await queryRunner.query(`ALTER TABLE "fair_category_stages" DROP CONSTRAINT "FK_fair_category_stages_pre_ring_closed_by_user_id"`);
    await queryRunner.query(`ALTER TABLE "fair_category_stages" DROP CONSTRAINT "FK_fair_category_stages_pre_ring_started_by_user_id"`);
    await queryRunner.query(`ALTER TABLE "fair_category_stages" DROP CONSTRAINT "FK_fair_category_stages_category_id"`);
    await queryRunner.query(`ALTER TABLE "fair_category_stages" DROP CONSTRAINT "FK_fair_category_stages_fair_id"`);
    await queryRunner.query(`DROP INDEX "IDX_notification_outbox_status"`);
    await queryRunner.query(`DROP INDEX "IDX_fa_judge_forms_status"`);
    await queryRunner.query(`DROP INDEX "IDX_judging_participants_status"`);
    await queryRunner.query(`DROP INDEX "IDX_veterinary_checks_status"`);
    await queryRunner.query(`DROP INDEX "IDX_fair_category_stages_status"`);
    await queryRunner.query(`DROP TABLE "notification_outbox"`);
    await queryRunner.query(`DROP TABLE "workflow_events"`);
    await queryRunner.query(`DROP TABLE "fa_consolidated_results"`);
    await queryRunner.query(`DROP TABLE "fa_judge_entry_decisions"`);
    await queryRunner.query(`DROP TABLE "fa_judge_forms"`);
    await queryRunner.query(`DROP TABLE "judging_participants"`);
    await queryRunner.query(`DROP TABLE "disqualification_reasons"`);
    await queryRunner.query(`DROP TABLE "veterinary_checks"`);
    await queryRunner.query(`DROP TABLE "fair_category_stages"`);
  }
}
