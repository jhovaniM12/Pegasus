import { type MigrationInterface, type QueryRunner } from "typeorm";

export class AddUserAccessCode1717430400011 implements MigrationInterface {
  name = "AddUserAccessCode1717430400011";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "users" ADD "access_code_hash" varchar`);
    await queryRunner.query(
      `CREATE UNIQUE INDEX "IDX_users_access_code_hash" ON "users" ("access_code_hash") WHERE "access_code_hash" IS NOT NULL`
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "IDX_users_access_code_hash"`);
    await queryRunner.query(`ALTER TABLE "users" DROP COLUMN "access_code_hash"`);
  }
}
