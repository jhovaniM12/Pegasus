import type { MigrationInterface, QueryRunner } from "typeorm";

/**
 * Limpia el esquema introducido por AddTieBreakTestTraceability1717430400034
 * tras decidir que abrir desempate no registra votos ni sorteo público.
 * Conserva executed_at / executed_by_user_id.
 */
export class RemoveTieBreakTestVotesAndDrawColumns1717430400035
  implements MigrationInterface
{
  name = "RemoveTieBreakTestVotesAndDrawColumns1717430400035";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "tie_break_test_votes"`);
    await queryRunner.query(`
      ALTER TABLE "tie_break_tests"
      DROP CONSTRAINT IF EXISTS "FK_tie_break_tests_drawn_by"
    `);
    await queryRunner.query(`
      ALTER TABLE "tie_break_tests"
      DROP COLUMN IF EXISTS "draw_notes",
      DROP COLUMN IF EXISTS "drawn_by_user_id",
      DROP COLUMN IF EXISTS "drawn_at",
      DROP COLUMN IF EXISTS "selection_method"
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "tie_break_tests"
      ADD COLUMN "selection_method" varchar NOT NULL DEFAULT 'PUBLIC_DRAW',
      ADD COLUMN "drawn_at" TIMESTAMP,
      ADD COLUMN "drawn_by_user_id" uuid,
      ADD COLUMN "draw_notes" text
    `);
    await queryRunner.query(`
      ALTER TABLE "tie_break_tests"
      ADD CONSTRAINT "FK_tie_break_tests_drawn_by"
        FOREIGN KEY ("drawn_by_user_id") REFERENCES "users"("id") ON DELETE SET NULL
    `);
    await queryRunner.query(`
      CREATE TABLE "tie_break_test_votes" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
        "tie_break_test_id" uuid NOT NULL,
        "judge_user_id" uuid NOT NULL,
        "approved" boolean NOT NULL,
        "voted_at" TIMESTAMP NOT NULL,
        CONSTRAINT "PK_tie_break_test_votes" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_tie_break_test_votes_test_judge"
          UNIQUE ("tie_break_test_id", "judge_user_id"),
        CONSTRAINT "FK_tie_break_test_votes_test"
          FOREIGN KEY ("tie_break_test_id") REFERENCES "tie_break_tests"("id")
          ON DELETE CASCADE,
        CONSTRAINT "FK_tie_break_test_votes_judge"
          FOREIGN KEY ("judge_user_id") REFERENCES "users"("id")
      )
    `);
  }
}
