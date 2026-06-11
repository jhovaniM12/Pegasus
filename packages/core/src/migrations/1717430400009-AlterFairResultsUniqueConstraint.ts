import type { MigrationInterface, QueryRunner } from "typeorm";

export class AlterFairResultsUniqueConstraint1717430400009 implements MigrationInterface {
  name = "AlterFairResultsUniqueConstraint1717430400009";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "fair_results"
      DROP CONSTRAINT IF EXISTS "UQ_fair_results_fair_entry_title"
    `);
    await queryRunner.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM pg_constraint WHERE conname = 'UQ_fair_results_business_key'
        ) THEN
          ALTER TABLE "fair_results"
          ADD CONSTRAINT "UQ_fair_results_business_key"
          UNIQUE ("fair_id", "fair_entry_id", "category_id", "title_id");
        END IF;
      END $$;
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "fair_results"
      DROP CONSTRAINT IF EXISTS "UQ_fair_results_business_key"
    `);
    await queryRunner.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM pg_constraint WHERE conname = 'UQ_fair_results_fair_entry_title'
        ) THEN
          ALTER TABLE "fair_results"
          ADD CONSTRAINT "UQ_fair_results_fair_entry_title"
          UNIQUE ("fair_entry_id", "title_id");
        END IF;
      END $$;
    `);
  }
}
