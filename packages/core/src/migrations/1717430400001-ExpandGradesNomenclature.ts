import type { MigrationInterface, QueryRunner } from "typeorm";

export class ExpandGradesNomenclature1717430400001 implements MigrationInterface {
  name = "ExpandGradesNomenclature1717430400001";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "grades"
      ALTER COLUMN "nomenclature" TYPE varchar(2)
      USING trim("nomenclature")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "grades"
      ALTER COLUMN "nomenclature" TYPE char(1)
      USING left(trim("nomenclature"), 1)
    `);
  }
}
