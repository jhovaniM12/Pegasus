import type { MigrationInterface, QueryRunner } from "typeorm";

export class AddCategoryAgeCheck1717430400005 implements MigrationInterface {
  name = "AddCategoryAgeCheck1717430400005";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "categories"
      ADD CONSTRAINT "chk_category_age"
      CHECK (min_age_months <= max_age_months)
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "categories" DROP CONSTRAINT "chk_category_age"`);
  }
}
