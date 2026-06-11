import type { MigrationInterface, QueryRunner } from "typeorm";

export class DropFairsStatusColumn1717430400002 implements MigrationInterface {
  name = "DropFairsStatusColumn1717430400002";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "fairs" DROP COLUMN IF EXISTS "status"`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "fairs" ADD COLUMN "status" integer`);
  }
}
