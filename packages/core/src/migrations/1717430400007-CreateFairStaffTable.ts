import type { MigrationInterface, QueryRunner } from "typeorm";

export class CreateFairStaffTable1717430400007 implements MigrationInterface {
  name = "CreateFairStaffTable1717430400007";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "fair_staff" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "external_id" varchar,
        "source_system" varchar,
        "fair_id" uuid NOT NULL,
        "person_id" uuid NOT NULL,
        "role_id" uuid NOT NULL,
        "created_at" timestamp NOT NULL DEFAULT now(),
        "updated_at" timestamp NOT NULL DEFAULT now(),
        CONSTRAINT "PK_fair_staff_id" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_fair_staff_external_id_source_system" UNIQUE ("external_id", "source_system")
      )
    `);
    await queryRunner.query(`
      ALTER TABLE "fair_staff"
      ADD CONSTRAINT "FK_fair_staff_fair_id"
      FOREIGN KEY ("fair_id") REFERENCES "fairs"("id")
      ON DELETE NO ACTION ON UPDATE NO ACTION
    `);
    await queryRunner.query(`
      ALTER TABLE "fair_staff"
      ADD CONSTRAINT "FK_fair_staff_person_id"
      FOREIGN KEY ("person_id") REFERENCES "people"("id")
      ON DELETE NO ACTION ON UPDATE NO ACTION
    `);
    await queryRunner.query(`
      ALTER TABLE "fair_staff"
      ADD CONSTRAINT "FK_fair_staff_role_id"
      FOREIGN KEY ("role_id") REFERENCES "roles"("id")
      ON DELETE NO ACTION ON UPDATE NO ACTION
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "fair_staff" DROP CONSTRAINT "FK_fair_staff_role_id"`);
    await queryRunner.query(`ALTER TABLE "fair_staff" DROP CONSTRAINT "FK_fair_staff_person_id"`);
    await queryRunner.query(`ALTER TABLE "fair_staff" DROP CONSTRAINT "FK_fair_staff_fair_id"`);
    await queryRunner.query(`DROP TABLE "fair_staff"`);
  }
}
