import type { MigrationInterface, QueryRunner } from "typeorm";

export class AddTieBreakDisqualificationOutcomes1717430400040
  implements MigrationInterface
{
  name = "AddTieBreakDisqualificationOutcomes1717430400040";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "judging_round_deserted_results"
      ADD COLUMN "disqualified_participant_id" uuid,
      ADD COLUMN "source_tie_break_id" uuid
    `);
    await queryRunner.query(`
      ALTER TABLE "judging_round_deserted_results"
      ADD CONSTRAINT "FK_round_deserted_disqualified_participant"
      FOREIGN KEY ("disqualified_participant_id")
      REFERENCES "judging_participants"("id")
      ON DELETE SET NULL
    `);
    await queryRunner.query(`
      ALTER TABLE "judging_round_deserted_results"
      ADD CONSTRAINT "FK_round_deserted_source_tie_break"
      FOREIGN KEY ("source_tie_break_id")
      REFERENCES "judging_rounds"("id")
      ON DELETE SET NULL
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "judging_round_deserted_results"
      DROP CONSTRAINT "FK_round_deserted_source_tie_break"
    `);
    await queryRunner.query(`
      ALTER TABLE "judging_round_deserted_results"
      DROP CONSTRAINT "FK_round_deserted_disqualified_participant"
    `);
    await queryRunner.query(`
      ALTER TABLE "judging_round_deserted_results"
      DROP COLUMN "source_tie_break_id",
      DROP COLUMN "disqualified_participant_id"
    `);
  }
}
