import type { MigrationInterface, QueryRunner } from "typeorm";

export class CreateHorsesAndLinkFairEntries1717430400023 implements MigrationInterface {
  name = "CreateHorsesAndLinkFairEntries1717430400023";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "horses" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "external_id" varchar,
        "source_system" varchar,
        "name" varchar,
        "registration_number" varchar NOT NULL,
        "birth_date" date,
        "color_code" varchar,
        "microchip_number" varchar,
        "association_code" varchar,
        "birth_city_code" varchar,
        "father_registration_number" varchar,
        "mother_registration_number" varchar,
        "created_at" timestamp NOT NULL DEFAULT now(),
        "updated_at" timestamp NOT NULL DEFAULT now(),
        CONSTRAINT "PK_horses_id" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_horses_external_id_source_system" UNIQUE ("external_id", "source_system"),
        CONSTRAINT "UQ_horses_registration_number" UNIQUE ("registration_number")
      )
    `);
    await queryRunner.query(`
      CREATE INDEX "IDX_horses_registration_number"
      ON "horses" ("registration_number")
    `);
    await queryRunner.query(`
      ALTER TABLE "fair_entries"
      ADD "horse_id" uuid
    `);
    await queryRunner.query(`
      CREATE INDEX "IDX_fair_entries_horse_id"
      ON "fair_entries" ("horse_id")
    `);
    await queryRunner.query(`
      ALTER TABLE "fair_entries"
      ADD CONSTRAINT "FK_fair_entries_horse_id"
      FOREIGN KEY ("horse_id") REFERENCES "horses"("id")
      ON DELETE SET NULL ON UPDATE NO ACTION
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "fair_entries" DROP CONSTRAINT "FK_fair_entries_horse_id"`);
    await queryRunner.query(`DROP INDEX "IDX_fair_entries_horse_id"`);
    await queryRunner.query(`ALTER TABLE "fair_entries" DROP COLUMN "horse_id"`);
    await queryRunner.query(`DROP INDEX "IDX_horses_registration_number"`);
    await queryRunner.query(`DROP TABLE "horses"`);
  }
}
