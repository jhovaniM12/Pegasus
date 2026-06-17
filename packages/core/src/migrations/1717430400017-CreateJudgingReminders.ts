import type { MigrationInterface, QueryRunner } from "typeorm";

export class CreateJudgingReminders1717430400017 implements MigrationInterface {
  name = "CreateJudgingReminders1717430400017";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "judging_reminders" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "name" varchar NOT NULL,
        "icon" varchar NOT NULL,
        "is_active" boolean NOT NULL DEFAULT true,
        "created_at" timestamp NOT NULL DEFAULT now(),
        "updated_at" timestamp NOT NULL DEFAULT now(),
        CONSTRAINT "PK_judging_reminders_id" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_judging_reminders_name" UNIQUE ("name")
      )
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "judging_reminders"`);
  }
}
