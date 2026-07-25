import type { MigrationInterface, QueryRunner } from "typeorm";

export class AddTieBreakTestTraceability1717430400034 implements MigrationInterface {
  name = "AddTieBreakTestTraceability1717430400034";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "tie_break_tests"
      ADD COLUMN "selection_method" varchar NOT NULL DEFAULT 'PUBLIC_DRAW',
      ADD COLUMN "drawn_at" TIMESTAMP,
      ADD COLUMN "drawn_by_user_id" uuid,
      ADD COLUMN "draw_notes" text,
      ADD COLUMN "executed_at" TIMESTAMP,
      ADD COLUMN "executed_by_user_id" uuid
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
    await queryRunner.query(`
      ALTER TABLE "tie_break_tests"
      ADD CONSTRAINT "FK_tie_break_tests_drawn_by"
        FOREIGN KEY ("drawn_by_user_id") REFERENCES "users"("id") ON DELETE SET NULL,
      ADD CONSTRAINT "FK_tie_break_tests_executed_by"
        FOREIGN KEY ("executed_by_user_id") REFERENCES "users"("id") ON DELETE SET NULL
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "tie_break_tests" DROP CONSTRAINT "FK_tie_break_tests_executed_by"`
    );
    await queryRunner.query(
      `ALTER TABLE "tie_break_tests" DROP CONSTRAINT "FK_tie_break_tests_drawn_by"`
    );
    await queryRunner.query(`DROP TABLE "tie_break_test_votes"`);
    await queryRunner.query(`
      ALTER TABLE "tie_break_tests"
      DROP COLUMN "executed_by_user_id",
      DROP COLUMN "executed_at",
      DROP COLUMN "draw_notes",
      DROP COLUMN "drawn_by_user_id",
      DROP COLUMN "drawn_at",
      DROP COLUMN "selection_method"
    `);
  }
}
