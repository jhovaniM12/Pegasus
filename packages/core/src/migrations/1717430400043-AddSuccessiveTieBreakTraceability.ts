import type { MigrationInterface, QueryRunner } from "typeorm";

export class AddSuccessiveTieBreakTraceability1717430400043 implements MigrationInterface {
  name = "AddSuccessiveTieBreakTraceability1717430400043";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "judging_rounds" ADD COLUMN "previous_tie_break_round_id" uuid`
    );
    await queryRunner.query(`
      ALTER TABLE "judging_rounds"
      ADD CONSTRAINT "FK_judging_rounds_previous_tie_break_round_id"
      FOREIGN KEY ("previous_tie_break_round_id")
      REFERENCES "judging_rounds"("id")
      ON DELETE SET NULL
      ON UPDATE NO ACTION
    `);
    await queryRunner.query(`
      CREATE INDEX "IDX_judging_rounds_previous_tie_break_round_id"
      ON "judging_rounds" ("previous_tie_break_round_id")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "IDX_judging_rounds_previous_tie_break_round_id"`);
    await queryRunner.query(
      `ALTER TABLE "judging_rounds" DROP CONSTRAINT "FK_judging_rounds_previous_tie_break_round_id"`
    );
    await queryRunner.query(
      `ALTER TABLE "judging_rounds" DROP COLUMN "previous_tie_break_round_id"`
    );
  }
}
