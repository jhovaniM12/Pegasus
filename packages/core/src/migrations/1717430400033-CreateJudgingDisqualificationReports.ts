import type { MigrationInterface, QueryRunner } from "typeorm";

export class CreateJudgingDisqualificationReports1717430400033
  implements MigrationInterface
{
  name = "CreateJudgingDisqualificationReports1717430400033";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "judging_disqualification_reports" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
        "fair_category_stage_id" uuid NOT NULL,
        "judging_participant_id" uuid NOT NULL,
        "disqualification_reason_id" uuid NOT NULL,
        "judge_user_id" uuid NOT NULL,
        "fa_judge_form_id" uuid,
        "round_id" uuid,
        "round_form_id" uuid,
        "reported_at" TIMESTAMP NOT NULL,
        CONSTRAINT "PK_judging_disqualification_reports" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_judging_disqualification_reports_participant_reason_judge"
          UNIQUE ("judging_participant_id", "disqualification_reason_id", "judge_user_id"),
        CONSTRAINT "FK_judging_disqualification_reports_stage"
          FOREIGN KEY ("fair_category_stage_id") REFERENCES "fair_category_stages"("id")
          ON DELETE CASCADE,
        CONSTRAINT "FK_judging_disqualification_reports_participant"
          FOREIGN KEY ("judging_participant_id") REFERENCES "judging_participants"("id")
          ON DELETE CASCADE,
        CONSTRAINT "FK_judging_disqualification_reports_reason"
          FOREIGN KEY ("disqualification_reason_id") REFERENCES "disqualification_reasons"("id"),
        CONSTRAINT "FK_judging_disqualification_reports_judge"
          FOREIGN KEY ("judge_user_id") REFERENCES "users"("id"),
        CONSTRAINT "FK_judging_disqualification_reports_fa_form"
          FOREIGN KEY ("fa_judge_form_id") REFERENCES "fa_judge_forms"("id")
          ON DELETE SET NULL,
        CONSTRAINT "FK_judging_disqualification_reports_round"
          FOREIGN KEY ("round_id") REFERENCES "judging_rounds"("id")
          ON DELETE SET NULL,
        CONSTRAINT "FK_judging_disqualification_reports_round_form"
          FOREIGN KEY ("round_form_id") REFERENCES "judging_round_forms"("id")
          ON DELETE SET NULL
      )
    `);
    await queryRunner.query(`
      CREATE INDEX "IDX_judging_disqualification_reports_stage_participant"
      ON "judging_disqualification_reports" ("fair_category_stage_id", "judging_participant_id")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP INDEX "IDX_judging_disqualification_reports_stage_participant"`
    );
    await queryRunner.query(`DROP TABLE "judging_disqualification_reports"`);
  }
}
