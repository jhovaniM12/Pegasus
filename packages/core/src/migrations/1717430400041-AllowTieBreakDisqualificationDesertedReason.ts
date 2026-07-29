import type { MigrationInterface, QueryRunner } from "typeorm";

export class AllowTieBreakDisqualificationDesertedReason1717430400041
  implements MigrationInterface
{
  name = "AllowTieBreakDisqualificationDesertedReason1717430400041";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "judging_round_deserted_results"
      DROP CONSTRAINT "CHK_judging_round_deserted_results_reason"
    `);
    await queryRunner.query(`
      ALTER TABLE "judging_round_deserted_results"
      ADD CONSTRAINT "CHK_judging_round_deserted_results_reason"
      CHECK (
        "reason" IS NULL
        OR "reason" IN (
          'NO_ASSIGNMENTS',
          'INSUFFICIENT_CONSIDERATION',
          'EXPLICIT_MAJORITY',
          'DISQUALIFICATION_DURING_TIE_BREAK'
        )
      )
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "judging_round_deserted_results"
      DROP CONSTRAINT "CHK_judging_round_deserted_results_reason"
    `);
    await queryRunner.query(`
      ALTER TABLE "judging_round_deserted_results"
      ADD CONSTRAINT "CHK_judging_round_deserted_results_reason"
      CHECK (
        "reason" IS NULL
        OR "reason" IN (
          'NO_ASSIGNMENTS',
          'INSUFFICIENT_CONSIDERATION',
          'EXPLICIT_MAJORITY'
        )
      )
    `);
  }
}
