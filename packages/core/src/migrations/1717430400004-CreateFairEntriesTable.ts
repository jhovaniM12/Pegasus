import type { MigrationInterface, QueryRunner } from "typeorm";

export class CreateFairEntriesTable1717430400004 implements MigrationInterface {
  name = "CreateFairEntriesTable1717430400004";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "fair_entries" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "external_id" varchar,
        "source_system" varchar,
        "fair_id" uuid NOT NULL,
        "registration_number" varchar NOT NULL,
        "category_id" uuid NOT NULL,
        "track_position" integer NOT NULL,
        "rider_name" varchar NOT NULL,
        "rider_document_number" varchar(50) NOT NULL,
        "receipt" varchar(50) NOT NULL,
        "participate" boolean NOT NULL,
        "fair_sequence" integer NOT NULL,
        "is_child" boolean NOT NULL,
        "created_at" timestamp NOT NULL DEFAULT now(),
        "updated_at" timestamp NOT NULL DEFAULT now(),
        CONSTRAINT "PK_fair_entries_id" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_fair_entries_external_id_source_system" UNIQUE ("external_id", "source_system")
      )
    `);
    await queryRunner.query(`
      ALTER TABLE "fair_entries"
      ADD CONSTRAINT "FK_fair_entries_fair_id"
      FOREIGN KEY ("fair_id") REFERENCES "fairs"("id")
      ON DELETE NO ACTION ON UPDATE NO ACTION
    `);
    await queryRunner.query(`
      ALTER TABLE "fair_entries"
      ADD CONSTRAINT "FK_fair_entries_category_id"
      FOREIGN KEY ("category_id") REFERENCES "categories"("id")
      ON DELETE NO ACTION ON UPDATE NO ACTION
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "fair_entries" DROP CONSTRAINT "FK_fair_entries_category_id"`);
    await queryRunner.query(`ALTER TABLE "fair_entries" DROP CONSTRAINT "FK_fair_entries_fair_id"`);
    await queryRunner.query(`DROP TABLE "fair_entries"`);
  }
}
