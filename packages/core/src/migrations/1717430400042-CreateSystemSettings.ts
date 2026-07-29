import type { MigrationInterface, QueryRunner } from "typeorm";

export class CreateSystemSettings1717430400042 implements MigrationInterface {
  name = "CreateSystemSettings1717430400042";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "system_settings" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "key" varchar NOT NULL,
        "integer_value" integer NOT NULL,
        "created_at" timestamp NOT NULL DEFAULT now(),
        "updated_at" timestamp NOT NULL DEFAULT now(),
        CONSTRAINT "PK_system_settings_id" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_system_settings_key" UNIQUE ("key"),
        CONSTRAINT "CHK_system_settings_integer_value" CHECK ("integer_value" > 0)
      )
    `);

    await queryRunner.query(`
      INSERT INTO "system_settings" ("key", "integer_value")
      VALUES ('F1_MAX_SELECTIONS', 10)
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "system_settings"`);
  }
}
