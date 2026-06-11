import type { MigrationInterface, QueryRunner } from "typeorm";

export class CreateFairResultsTable1717430400008 implements MigrationInterface {
  name = "CreateFairResultsTable1717430400008";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "fair_results" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "external_id" varchar,
        "source_system" varchar,
        "fair_id" uuid NOT NULL,
        "fair_entry_id" uuid NOT NULL,
        "grade_id" uuid NOT NULL,
        "category_id" uuid NOT NULL,
        "title_id" uuid NOT NULL,
        "position_obtained" integer NOT NULL,
        "score" numeric(10, 2) NOT NULL,
        "created_at" timestamp NOT NULL DEFAULT now(),
        "updated_at" timestamp NOT NULL DEFAULT now(),
        CONSTRAINT "PK_fair_results_id" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_fair_results_external_id_source_system" UNIQUE ("external_id", "source_system"),
        CONSTRAINT "UQ_fair_results_business_key" UNIQUE ("fair_id", "fair_entry_id", "category_id", "title_id")
      )
    `);
    await queryRunner.query(`
      ALTER TABLE "fair_results"
      ADD CONSTRAINT "FK_fair_results_fair_id"
      FOREIGN KEY ("fair_id") REFERENCES "fairs"("id")
      ON DELETE NO ACTION ON UPDATE NO ACTION
    `);
    await queryRunner.query(`
      ALTER TABLE "fair_results"
      ADD CONSTRAINT "FK_fair_results_fair_entry_id"
      FOREIGN KEY ("fair_entry_id") REFERENCES "fair_entries"("id")
      ON DELETE NO ACTION ON UPDATE NO ACTION
    `);
    await queryRunner.query(`
      ALTER TABLE "fair_results"
      ADD CONSTRAINT "FK_fair_results_grade_id"
      FOREIGN KEY ("grade_id") REFERENCES "grades"("id")
      ON DELETE NO ACTION ON UPDATE NO ACTION
    `);
    await queryRunner.query(`
      ALTER TABLE "fair_results"
      ADD CONSTRAINT "FK_fair_results_category_id"
      FOREIGN KEY ("category_id") REFERENCES "categories"("id")
      ON DELETE NO ACTION ON UPDATE NO ACTION
    `);
    await queryRunner.query(`
      ALTER TABLE "fair_results"
      ADD CONSTRAINT "FK_fair_results_title_id"
      FOREIGN KEY ("title_id") REFERENCES "titles"("id")
      ON DELETE NO ACTION ON UPDATE NO ACTION
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "fair_results" DROP CONSTRAINT "FK_fair_results_title_id"`);
    await queryRunner.query(`ALTER TABLE "fair_results" DROP CONSTRAINT "FK_fair_results_category_id"`);
    await queryRunner.query(`ALTER TABLE "fair_results" DROP CONSTRAINT "FK_fair_results_grade_id"`);
    await queryRunner.query(`ALTER TABLE "fair_results" DROP CONSTRAINT "FK_fair_results_fair_entry_id"`);
    await queryRunner.query(`ALTER TABLE "fair_results" DROP CONSTRAINT "FK_fair_results_fair_id"`);
    await queryRunner.query(`DROP TABLE "fair_results"`);
  }
}
