import { type MigrationInterface, type QueryRunner } from "typeorm";

export class AddUserAccessCodePlaintext1717430400031 implements MigrationInterface {
  name = "AddUserAccessCodePlaintext1717430400031";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "users" ADD "access_code" varchar`);
    await queryRunner.query(
      `CREATE UNIQUE INDEX "IDX_users_access_code" ON "users" ("access_code") WHERE "access_code" IS NOT NULL`
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "IDX_users_access_code"`);
    await queryRunner.query(`ALTER TABLE "users" DROP COLUMN "access_code"`);
  }
}
