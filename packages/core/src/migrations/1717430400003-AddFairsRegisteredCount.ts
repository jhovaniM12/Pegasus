import type { MigrationInterface, QueryRunner } from "typeorm";

export class AddFairsRegisteredCount1717430400003 implements MigrationInterface {
  name = "AddFairsRegisteredCount1717430400003";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "fairs"
      ADD COLUMN IF NOT EXISTS "registered_count" integer
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "fairs" DROP COLUMN IF EXISTS "registered_count"`);
  }
}
