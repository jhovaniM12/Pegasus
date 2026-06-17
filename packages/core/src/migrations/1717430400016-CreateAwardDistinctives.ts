import type { MigrationInterface, QueryRunner } from "typeorm";

export class CreateAwardDistinctives1717430400016 implements MigrationInterface {
  name = "CreateAwardDistinctives1717430400016";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "award_distinctives" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "position" integer NOT NULL,
        "label" varchar NOT NULL,
        "color_name" varchar NOT NULL,
        "color_hex" varchar,
        "is_active" boolean NOT NULL DEFAULT true,
        "created_at" timestamp NOT NULL DEFAULT now(),
        "updated_at" timestamp NOT NULL DEFAULT now(),
        CONSTRAINT "PK_award_distinctives_id" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_award_distinctives_position" UNIQUE ("position")
      )
    `);

    await queryRunner.query(`
      INSERT INTO "award_distinctives" ("position", "label", "color_name", "color_hex", "is_active")
      VALUES
        (1, 'Primer puesto', 'Por definir', NULL, true),
        (2, 'Segundo puesto', 'Por definir', NULL, true),
        (3, 'Tercer puesto', 'Por definir', NULL, true),
        (4, 'Cuarto puesto', 'Por definir', NULL, true),
        (5, 'Quinto puesto', 'Por definir', NULL, true)
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "award_distinctives"`);
  }
}
