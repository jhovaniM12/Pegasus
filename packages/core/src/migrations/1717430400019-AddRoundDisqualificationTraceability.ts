import type { MigrationInterface, QueryRunner } from "typeorm";

export class AddRoundDisqualificationTraceability1717430400019 implements MigrationInterface {
  name = "AddRoundDisqualificationTraceability1717430400019";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "judging_participants"
      ADD COLUMN "disqualified_by_user_id" uuid,
      ADD COLUMN "disqualified_in_round_id" uuid,
      ADD COLUMN "disqualified_in_round_form_id" uuid
    `);

    await queryRunner.query(`
      CREATE INDEX "IDX_judging_participants_disqualified_in_round_id"
      ON "judging_participants" ("disqualified_in_round_id")
    `);

    await queryRunner.query(`
      ALTER TABLE "judging_participants"
      ADD CONSTRAINT "FK_judging_participants_disqualified_by_user_id"
        FOREIGN KEY ("disqualified_by_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE NO ACTION
    `);

    await queryRunner.query(`
      ALTER TABLE "judging_participants"
      ADD CONSTRAINT "FK_judging_participants_disqualified_in_round_id"
        FOREIGN KEY ("disqualified_in_round_id") REFERENCES "judging_rounds"("id") ON DELETE SET NULL ON UPDATE NO ACTION
    `);

    await queryRunner.query(`
      ALTER TABLE "judging_participants"
      ADD CONSTRAINT "FK_judging_participants_disqualified_in_round_form_id"
        FOREIGN KEY ("disqualified_in_round_form_id") REFERENCES "judging_round_forms"("id") ON DELETE SET NULL ON UPDATE NO ACTION
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "judging_participants" DROP CONSTRAINT "FK_judging_participants_disqualified_in_round_form_id"`
    );
    await queryRunner.query(
      `ALTER TABLE "judging_participants" DROP CONSTRAINT "FK_judging_participants_disqualified_in_round_id"`
    );
    await queryRunner.query(
      `ALTER TABLE "judging_participants" DROP CONSTRAINT "FK_judging_participants_disqualified_by_user_id"`
    );
    await queryRunner.query(`DROP INDEX "IDX_judging_participants_disqualified_in_round_id"`);
    await queryRunner.query(`
      ALTER TABLE "judging_participants"
      DROP COLUMN "disqualified_in_round_form_id",
      DROP COLUMN "disqualified_in_round_id",
      DROP COLUMN "disqualified_by_user_id"
    `);
  }
}
