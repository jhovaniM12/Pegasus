import type { MigrationInterface, QueryRunner } from "typeorm";

/**
 * Un puesto sin asignaciones y sin mayoría explícita de desierto se conserva
 * como no adjudicado por consideración insuficiente. Por eso assigned_votes
 * puede ser cero, pero nunca negativo.
 */
export class AllowZeroAssignedVotesInUnawardedResults1717430400036
  implements MigrationInterface
{
  name = "AllowZeroAssignedVotesInUnawardedResults1717430400036";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "judging_round_unawarded_results"
      DROP CONSTRAINT "CHK_judging_round_unawarded_results_assigned_votes_positive"
    `);
    await queryRunner.query(`
      ALTER TABLE "judging_round_unawarded_results"
      ADD CONSTRAINT "CHK_judging_round_unawarded_results_assigned_votes_non_negative"
      CHECK ("assigned_votes" >= 0)
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "judging_round_unawarded_results"
      DROP CONSTRAINT "CHK_judging_round_unawarded_results_assigned_votes_non_negative"
    `);
    await queryRunner.query(`
      DELETE FROM "judging_round_unawarded_results"
      WHERE "assigned_votes" = 0
    `);
    await queryRunner.query(`
      ALTER TABLE "judging_round_unawarded_results"
      ADD CONSTRAINT "CHK_judging_round_unawarded_results_assigned_votes_positive"
      CHECK ("assigned_votes" > 0)
    `);
  }
}
