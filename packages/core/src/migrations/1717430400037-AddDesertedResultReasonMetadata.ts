import type { MigrationInterface, QueryRunner } from "typeorm";

/**
 * Metadatos de auditoría para puestos desiertos consolidados.
 * No migra ni borra filas históricas: reason queda NULL en registros previos.
 */
export class AddDesertedResultReasonMetadata1717430400037 implements MigrationInterface {
  name = "AddDesertedResultReasonMetadata1717430400037";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "judging_round_deserted_results"
      ADD COLUMN "reason" varchar
    `);
    await queryRunner.query(`
      ALTER TABLE "judging_round_deserted_results"
      ADD COLUMN "assigned_votes" integer NOT NULL DEFAULT 0
    `);
    await queryRunner.query(`
      ALTER TABLE "judging_round_deserted_results"
      ADD COLUMN "minimum_required" integer
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
    await queryRunner.query(`
      ALTER TABLE "judging_round_deserted_results"
      ADD CONSTRAINT "CHK_judging_round_deserted_results_assigned_votes_non_negative"
      CHECK ("assigned_votes" >= 0)
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "judging_round_deserted_results"
      DROP CONSTRAINT "CHK_judging_round_deserted_results_assigned_votes_non_negative"
    `);
    await queryRunner.query(`
      ALTER TABLE "judging_round_deserted_results"
      DROP CONSTRAINT "CHK_judging_round_deserted_results_reason"
    `);
    await queryRunner.query(`
      ALTER TABLE "judging_round_deserted_results"
      DROP COLUMN "minimum_required"
    `);
    await queryRunner.query(`
      ALTER TABLE "judging_round_deserted_results"
      DROP COLUMN "assigned_votes"
    `);
    await queryRunner.query(`
      ALTER TABLE "judging_round_deserted_results"
      DROP COLUMN "reason"
    `);
  }
}
