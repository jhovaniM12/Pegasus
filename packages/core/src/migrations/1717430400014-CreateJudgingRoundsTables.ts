import type { MigrationInterface, QueryRunner } from "typeorm";

export class CreateJudgingRoundsTables1717430400014 implements MigrationInterface {
  name = "CreateJudgingRoundsTables1717430400014";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "judging_rounds" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "fair_category_stage_id" uuid NOT NULL,
        "round_type" varchar NOT NULL,
        "sequence" integer NOT NULL DEFAULT 1,
        "status" varchar NOT NULL,
        "parent_round_id" uuid,
        "opened_at" timestamp,
        "opened_by_user_id" uuid,
        "consolidated_at" timestamp,
        "consolidated_by_user_id" uuid,
        "closed_at" timestamp,
        "closed_by_user_id" uuid,
        "created_at" timestamp NOT NULL DEFAULT now(),
        "updated_at" timestamp NOT NULL DEFAULT now(),
        CONSTRAINT "PK_judging_rounds_id" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_judging_rounds_stage_type_sequence" UNIQUE ("fair_category_stage_id", "round_type", "sequence")
      )
    `);
    await queryRunner.query(`
      CREATE TABLE "judging_round_forms" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "round_id" uuid NOT NULL,
        "judge_user_id" uuid NOT NULL,
        "status" varchar NOT NULL,
        "started_at" timestamp,
        "closed_at" timestamp,
        "created_at" timestamp NOT NULL DEFAULT now(),
        "updated_at" timestamp NOT NULL DEFAULT now(),
        CONSTRAINT "PK_judging_round_forms_id" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_judging_round_forms_round_judge" UNIQUE ("round_id", "judge_user_id")
      )
    `);
    await queryRunner.query(`
      CREATE TABLE "judging_round_entries" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "round_form_id" uuid NOT NULL,
        "judging_participant_id" uuid NOT NULL,
        "selected" boolean NOT NULL DEFAULT false,
        "position" integer,
        "created_at" timestamp NOT NULL DEFAULT now(),
        "updated_at" timestamp NOT NULL DEFAULT now(),
        CONSTRAINT "PK_judging_round_entries_id" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_judging_round_entries_form_participant" UNIQUE ("round_form_id", "judging_participant_id")
      )
    `);
    await queryRunner.query(`
      CREATE TABLE "judging_round_results" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "round_id" uuid NOT NULL,
        "judging_participant_id" uuid NOT NULL,
        "score_value" integer NOT NULL DEFAULT 0,
        "first_place_votes" integer NOT NULL DEFAULT 0,
        "final_position" integer,
        "status" varchar NOT NULL,
        "created_at" timestamp NOT NULL DEFAULT now(),
        "updated_at" timestamp NOT NULL DEFAULT now(),
        CONSTRAINT "PK_judging_round_results_id" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_judging_round_results_round_participant" UNIQUE ("round_id", "judging_participant_id")
      )
    `);
    await queryRunner.query(`
      CREATE TABLE "tie_break_tests" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "round_id" uuid NOT NULL,
        "test_type" varchar NOT NULL,
        "test_order" integer NOT NULL DEFAULT 1,
        "status" varchar NOT NULL,
        "created_at" timestamp NOT NULL DEFAULT now(),
        "updated_at" timestamp NOT NULL DEFAULT now(),
        CONSTRAINT "PK_tie_break_tests_id" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_tie_break_tests_round_type" UNIQUE ("round_id", "test_type")
      )
    `);

    await queryRunner.query(`CREATE INDEX "IDX_judging_rounds_stage" ON "judging_rounds" ("fair_category_stage_id")`);
    await queryRunner.query(`CREATE INDEX "IDX_judging_rounds_status" ON "judging_rounds" ("status")`);
    await queryRunner.query(`CREATE INDEX "IDX_judging_round_forms_round" ON "judging_round_forms" ("round_id")`);
    await queryRunner.query(`CREATE INDEX "IDX_judging_round_entries_form" ON "judging_round_entries" ("round_form_id")`);
    await queryRunner.query(`CREATE INDEX "IDX_judging_round_results_round" ON "judging_round_results" ("round_id")`);

    await queryRunner.query(`ALTER TABLE "judging_rounds" ADD CONSTRAINT "FK_judging_rounds_stage_id" FOREIGN KEY ("fair_category_stage_id") REFERENCES "fair_category_stages"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
    await queryRunner.query(`ALTER TABLE "judging_rounds" ADD CONSTRAINT "FK_judging_rounds_parent_round_id" FOREIGN KEY ("parent_round_id") REFERENCES "judging_rounds"("id") ON DELETE SET NULL ON UPDATE NO ACTION`);
    await queryRunner.query(`ALTER TABLE "judging_rounds" ADD CONSTRAINT "FK_judging_rounds_opened_by_user_id" FOREIGN KEY ("opened_by_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE NO ACTION`);
    await queryRunner.query(`ALTER TABLE "judging_rounds" ADD CONSTRAINT "FK_judging_rounds_consolidated_by_user_id" FOREIGN KEY ("consolidated_by_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE NO ACTION`);
    await queryRunner.query(`ALTER TABLE "judging_rounds" ADD CONSTRAINT "FK_judging_rounds_closed_by_user_id" FOREIGN KEY ("closed_by_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE NO ACTION`);
    await queryRunner.query(`ALTER TABLE "judging_round_forms" ADD CONSTRAINT "FK_judging_round_forms_round_id" FOREIGN KEY ("round_id") REFERENCES "judging_rounds"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
    await queryRunner.query(`ALTER TABLE "judging_round_forms" ADD CONSTRAINT "FK_judging_round_forms_judge_user_id" FOREIGN KEY ("judge_user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
    await queryRunner.query(`ALTER TABLE "judging_round_entries" ADD CONSTRAINT "FK_judging_round_entries_form_id" FOREIGN KEY ("round_form_id") REFERENCES "judging_round_forms"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
    await queryRunner.query(`ALTER TABLE "judging_round_entries" ADD CONSTRAINT "FK_judging_round_entries_participant_id" FOREIGN KEY ("judging_participant_id") REFERENCES "judging_participants"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
    await queryRunner.query(`ALTER TABLE "judging_round_results" ADD CONSTRAINT "FK_judging_round_results_round_id" FOREIGN KEY ("round_id") REFERENCES "judging_rounds"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
    await queryRunner.query(`ALTER TABLE "judging_round_results" ADD CONSTRAINT "FK_judging_round_results_participant_id" FOREIGN KEY ("judging_participant_id") REFERENCES "judging_participants"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
    await queryRunner.query(`ALTER TABLE "tie_break_tests" ADD CONSTRAINT "FK_tie_break_tests_round_id" FOREIGN KEY ("round_id") REFERENCES "judging_rounds"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "tie_break_tests" DROP CONSTRAINT "FK_tie_break_tests_round_id"`);
    await queryRunner.query(`ALTER TABLE "judging_round_results" DROP CONSTRAINT "FK_judging_round_results_participant_id"`);
    await queryRunner.query(`ALTER TABLE "judging_round_results" DROP CONSTRAINT "FK_judging_round_results_round_id"`);
    await queryRunner.query(`ALTER TABLE "judging_round_entries" DROP CONSTRAINT "FK_judging_round_entries_participant_id"`);
    await queryRunner.query(`ALTER TABLE "judging_round_entries" DROP CONSTRAINT "FK_judging_round_entries_form_id"`);
    await queryRunner.query(`ALTER TABLE "judging_round_forms" DROP CONSTRAINT "FK_judging_round_forms_judge_user_id"`);
    await queryRunner.query(`ALTER TABLE "judging_round_forms" DROP CONSTRAINT "FK_judging_round_forms_round_id"`);
    await queryRunner.query(`ALTER TABLE "judging_rounds" DROP CONSTRAINT "FK_judging_rounds_closed_by_user_id"`);
    await queryRunner.query(`ALTER TABLE "judging_rounds" DROP CONSTRAINT "FK_judging_rounds_consolidated_by_user_id"`);
    await queryRunner.query(`ALTER TABLE "judging_rounds" DROP CONSTRAINT "FK_judging_rounds_opened_by_user_id"`);
    await queryRunner.query(`ALTER TABLE "judging_rounds" DROP CONSTRAINT "FK_judging_rounds_parent_round_id"`);
    await queryRunner.query(`ALTER TABLE "judging_rounds" DROP CONSTRAINT "FK_judging_rounds_stage_id"`);
    await queryRunner.query(`DROP INDEX "IDX_judging_round_results_round"`);
    await queryRunner.query(`DROP INDEX "IDX_judging_round_entries_form"`);
    await queryRunner.query(`DROP INDEX "IDX_judging_round_forms_round"`);
    await queryRunner.query(`DROP INDEX "IDX_judging_rounds_status"`);
    await queryRunner.query(`DROP INDEX "IDX_judging_rounds_stage"`);
    await queryRunner.query(`DROP TABLE "tie_break_tests"`);
    await queryRunner.query(`DROP TABLE "judging_round_results"`);
    await queryRunner.query(`DROP TABLE "judging_round_entries"`);
    await queryRunner.query(`DROP TABLE "judging_round_forms"`);
    await queryRunner.query(`DROP TABLE "judging_rounds"`);
  }
}
