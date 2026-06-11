import type { MigrationInterface, QueryRunner } from "typeorm";

export class AlterPeopleTable1717430400006 implements MigrationInterface {
  name = "AlterPeopleTable1717430400006";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "people" DROP CONSTRAINT IF EXISTS "FK_people_city_id"`);
    await queryRunner.query(`ALTER TABLE "people" DROP COLUMN IF EXISTS "city_id"`);
    await queryRunner.query(`ALTER TABLE "people" DROP COLUMN IF EXISTS "document_type"`);
    await queryRunner.query(`ALTER TABLE "people" DROP COLUMN IF EXISTS "document_number"`);
    await queryRunner.query(`ALTER TABLE "people" DROP COLUMN IF EXISTS "first_name"`);
    await queryRunner.query(`ALTER TABLE "people" DROP COLUMN IF EXISTS "full_name"`);

    await queryRunner.query(`ALTER TABLE "people" ADD COLUMN IF NOT EXISTS "name" varchar`);
    await queryRunner.query(`UPDATE "people" SET "name" = '' WHERE "name" IS NULL`);
    await queryRunner.query(`ALTER TABLE "people" ALTER COLUMN "name" SET NOT NULL`);

    await queryRunner.query(`UPDATE "people" SET "last_name" = '' WHERE "last_name" IS NULL`);
    await queryRunner.query(`ALTER TABLE "people" ALTER COLUMN "last_name" SET NOT NULL`);

    await queryRunner.query(`ALTER TABLE "people" ADD COLUMN IF NOT EXISTS "address" varchar`);
    await queryRunner.query(`ALTER TABLE "people" ADD COLUMN IF NOT EXISTS "indicative" varchar`);
    await queryRunner.query(`ALTER TABLE "people" ADD COLUMN IF NOT EXISTS "telephone" varchar`);
    await queryRunner.query(`ALTER TABLE "people" ADD COLUMN IF NOT EXISTS "avantel_phone" varchar`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "people" DROP COLUMN IF EXISTS "avantel_phone"`);
    await queryRunner.query(`ALTER TABLE "people" DROP COLUMN IF EXISTS "telephone"`);
    await queryRunner.query(`ALTER TABLE "people" DROP COLUMN IF EXISTS "indicative"`);
    await queryRunner.query(`ALTER TABLE "people" DROP COLUMN IF EXISTS "address"`);
    await queryRunner.query(`ALTER TABLE "people" DROP COLUMN IF EXISTS "name"`);

    await queryRunner.query(`ALTER TABLE "people" ALTER COLUMN "last_name" DROP NOT NULL`);

    await queryRunner.query(`ALTER TABLE "people" ADD COLUMN IF NOT EXISTS "document_type" varchar`);
    await queryRunner.query(`ALTER TABLE "people" ADD COLUMN IF NOT EXISTS "document_number" varchar`);
    await queryRunner.query(`ALTER TABLE "people" ADD COLUMN IF NOT EXISTS "first_name" varchar`);
    await queryRunner.query(`ALTER TABLE "people" ADD COLUMN IF NOT EXISTS "full_name" varchar`);
    await queryRunner.query(`UPDATE "people" SET "full_name" = '' WHERE "full_name" IS NULL`);
    await queryRunner.query(`ALTER TABLE "people" ALTER COLUMN "full_name" SET NOT NULL`);
    await queryRunner.query(`ALTER TABLE "people" ADD COLUMN IF NOT EXISTS "city_id" uuid`);
    await queryRunner.query(`
      ALTER TABLE "people"
      ADD CONSTRAINT "FK_people_city_id"
      FOREIGN KEY ("city_id") REFERENCES "cities"("id")
      ON DELETE NO ACTION ON UPDATE NO ACTION
    `);
  }
}
