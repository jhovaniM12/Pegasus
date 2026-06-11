import type { MigrationInterface, QueryRunner } from "typeorm";

export class CreateUsersTable1717430400010 implements MigrationInterface {
  name = "CreateUsersTable1717430400010";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "users" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "person_id" uuid,
        "email" varchar,
        "password_hash" varchar,
        "role" varchar NOT NULL,
        "is_active" boolean NOT NULL DEFAULT true,
        "last_login_at" timestamp,
        "created_at" timestamp NOT NULL DEFAULT now(),
        "updated_at" timestamp NOT NULL DEFAULT now(),
        CONSTRAINT "PK_users_id" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_users_email" UNIQUE ("email")
      )
    `);
    await queryRunner.query(`
      ALTER TABLE "users"
      ADD CONSTRAINT "FK_users_person_id"
      FOREIGN KEY ("person_id") REFERENCES "people"("id")
      ON DELETE SET NULL ON UPDATE NO ACTION
    `);
    await queryRunner.query(`CREATE INDEX "IDX_users_role" ON "users" ("role")`);
    await queryRunner.query(`CREATE INDEX "IDX_users_is_active" ON "users" ("is_active")`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "IDX_users_is_active"`);
    await queryRunner.query(`DROP INDEX "IDX_users_role"`);
    await queryRunner.query(`ALTER TABLE "users" DROP CONSTRAINT "FK_users_person_id"`);
    await queryRunner.query(`DROP TABLE "users"`);
  }
}
