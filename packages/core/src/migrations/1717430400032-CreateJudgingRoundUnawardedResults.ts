import type { MigrationInterface, QueryRunner } from "typeorm";

export class CreateJudgingRoundUnawardedResults1717430400032 implements MigrationInterface {
  name = "CreateJudgingRoundUnawardedResults1717430400032";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "judging_round_unawarded_results" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "round_id" uuid NOT NULL,
        "final_position" integer NOT NULL,
        "assigned_votes" integer NOT NULL,
        "minimum_required" integer NOT NULL,
        "created_at" timestamp NOT NULL DEFAULT now(),
        "updated_at" timestamp NOT NULL DEFAULT now(),
        CONSTRAINT "PK_judging_round_unawarded_results_id" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_judging_round_unawarded_results_round_position" UNIQUE ("round_id", "final_position"),
        CONSTRAINT "CHK_judging_round_unawarded_results_assigned_votes_positive"
          CHECK ("assigned_votes" > 0)
      )
    `);

    await queryRunner.query(`
      CREATE INDEX "IDX_judging_round_unawarded_results_round"
      ON "judging_round_unawarded_results" ("round_id")
    `);

    await queryRunner.query(`
      ALTER TABLE "judging_round_unawarded_results"
      ADD CONSTRAINT "FK_judging_round_unawarded_results_round_id"
      FOREIGN KEY ("round_id") REFERENCES "judging_rounds"("id")
      ON DELETE CASCADE ON UPDATE NO ACTION
    `);

    // Separar resultados históricos mal clasificados: votes_count = 0 era
    // "agotamiento por consideración mínima", no un desierto real.
    await queryRunner.query(`
      INSERT INTO "judging_round_unawarded_results"
        ("round_id", "final_position", "assigned_votes", "minimum_required")
      SELECT
        "deserted"."round_id",
        "deserted"."final_position",
        1,
        1
      FROM "judging_round_deserted_results" "deserted"
      WHERE "deserted"."votes_count" = 0
      ON CONFLICT ("round_id", "final_position") DO NOTHING
    `);

    await queryRunner.query(`
      DELETE FROM "judging_round_deserted_results"
      WHERE "votes_count" = 0
    `);

    await queryRunner.query(`
      ALTER TABLE "judging_round_deserted_results"
      ADD CONSTRAINT "CHK_judging_round_deserted_results_votes_non_negative"
      CHECK ("votes_count" >= 0)
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "judging_round_deserted_results"
      DROP CONSTRAINT "CHK_judging_round_deserted_results_votes_non_negative"
    `);

    await queryRunner.query(`
      INSERT INTO "judging_round_deserted_results"
        ("round_id", "final_position", "votes_count")
      SELECT
        "unawarded"."round_id",
        "unawarded"."final_position",
        0
      FROM "judging_round_unawarded_results" "unawarded"
      ON CONFLICT ("round_id", "final_position") DO NOTHING
    `);

    await queryRunner.query(`
      ALTER TABLE "judging_round_unawarded_results"
      DROP CONSTRAINT "FK_judging_round_unawarded_results_round_id"
    `);
    await queryRunner.query(`DROP INDEX "IDX_judging_round_unawarded_results_round"`);
    await queryRunner.query(`DROP TABLE "judging_round_unawarded_results"`);
  }
}
