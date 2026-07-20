import type { MigrationInterface, QueryRunner } from "typeorm";

export class CreateFaRepeatTrackRequests1717430400027 implements MigrationInterface {
  name = "CreateFaRepeatTrackRequests1717430400027";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "fa_repeat_track_requests" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "created_at" timestamp NOT NULL DEFAULT now(),
        "updated_at" timestamp NOT NULL DEFAULT now(),
        "fair_category_stage_id" uuid NOT NULL,
        "fa_judge_form_id" uuid NOT NULL,
        "judging_participant_id" uuid NOT NULL,
        "requested_by_user_id" uuid NOT NULL,
        "status" varchar NOT NULL,
        "requested_at" timestamp NOT NULL,
        "executed_at" timestamp,
        "executed_by_user_id" uuid,
        CONSTRAINT "PK_fa_repeat_track_requests_id" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_fa_repeat_track_requests_stage_participant" UNIQUE ("fair_category_stage_id", "judging_participant_id")
      )
    `);
    await queryRunner.query(`CREATE INDEX "IDX_fa_repeat_track_requests_stage_status" ON "fa_repeat_track_requests" ("fair_category_stage_id", "status", "created_at")`);
    await queryRunner.query(`CREATE INDEX "IDX_fa_repeat_track_requests_participant" ON "fa_repeat_track_requests" ("judging_participant_id")`);
    await queryRunner.query(`ALTER TABLE "fa_repeat_track_requests" ADD CONSTRAINT "FK_fa_repeat_track_requests_stage" FOREIGN KEY ("fair_category_stage_id") REFERENCES "fair_category_stages"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
    await queryRunner.query(`ALTER TABLE "fa_repeat_track_requests" ADD CONSTRAINT "FK_fa_repeat_track_requests_form" FOREIGN KEY ("fa_judge_form_id") REFERENCES "fa_judge_forms"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
    await queryRunner.query(`ALTER TABLE "fa_repeat_track_requests" ADD CONSTRAINT "FK_fa_repeat_track_requests_participant" FOREIGN KEY ("judging_participant_id") REFERENCES "judging_participants"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
    await queryRunner.query(`ALTER TABLE "fa_repeat_track_requests" ADD CONSTRAINT "FK_fa_repeat_track_requests_requested_by" FOREIGN KEY ("requested_by_user_id") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
    await queryRunner.query(`ALTER TABLE "fa_repeat_track_requests" ADD CONSTRAINT "FK_fa_repeat_track_requests_executed_by" FOREIGN KEY ("executed_by_user_id") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "fa_repeat_track_requests" DROP CONSTRAINT "FK_fa_repeat_track_requests_executed_by"`);
    await queryRunner.query(`ALTER TABLE "fa_repeat_track_requests" DROP CONSTRAINT "FK_fa_repeat_track_requests_requested_by"`);
    await queryRunner.query(`ALTER TABLE "fa_repeat_track_requests" DROP CONSTRAINT "FK_fa_repeat_track_requests_participant"`);
    await queryRunner.query(`ALTER TABLE "fa_repeat_track_requests" DROP CONSTRAINT "FK_fa_repeat_track_requests_form"`);
    await queryRunner.query(`ALTER TABLE "fa_repeat_track_requests" DROP CONSTRAINT "FK_fa_repeat_track_requests_stage"`);
    await queryRunner.query(`DROP INDEX "IDX_fa_repeat_track_requests_participant"`);
    await queryRunner.query(`DROP INDEX "IDX_fa_repeat_track_requests_stage_status"`);
    await queryRunner.query(`DROP TABLE "fa_repeat_track_requests"`);
  }
}
