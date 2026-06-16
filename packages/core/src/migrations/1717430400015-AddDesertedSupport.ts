import type { MigrationInterface, QueryRunner } from "typeorm";

export class AddDesertedSupport1717430400015 implements MigrationInterface {
  name = "AddDesertedSupport1717430400015";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "fair_category_stages"
      ADD COLUMN "deserted_at" timestamp
    `);
    await queryRunner.query(`
      ALTER TABLE "fair_category_stages"
      ADD COLUMN "deserted_by_user_id" uuid
    `);
    await queryRunner.query(`
      ALTER TABLE "fair_category_stages"
      ADD COLUMN "deserted_reason" text
    `);

    await queryRunner.query(`
      CREATE TABLE "judging_round_form_deserted_positions" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "round_form_id" uuid NOT NULL,
        "position" integer NOT NULL,
        "created_at" timestamp NOT NULL DEFAULT now(),
        "updated_at" timestamp NOT NULL DEFAULT now(),
        CONSTRAINT "PK_judging_round_form_deserted_positions_id" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_judging_round_form_deserted_positions_form_position" UNIQUE ("round_form_id", "position")
      )
    `);
    await queryRunner.query(`
      CREATE TABLE "judging_round_deserted_results" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "round_id" uuid NOT NULL,
        "final_position" integer NOT NULL,
        "votes_count" integer NOT NULL DEFAULT 0,
        "created_at" timestamp NOT NULL DEFAULT now(),
        "updated_at" timestamp NOT NULL DEFAULT now(),
        CONSTRAINT "PK_judging_round_deserted_results_id" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_judging_round_deserted_results_round_position" UNIQUE ("round_id", "final_position")
      )
    `);

    await queryRunner.query(`
      CREATE INDEX "IDX_judging_round_form_deserted_positions_form"
      ON "judging_round_form_deserted_positions" ("round_form_id")
    `);
    await queryRunner.query(`
      CREATE INDEX "IDX_judging_round_deserted_results_round"
      ON "judging_round_deserted_results" ("round_id")
    `);

    await queryRunner.query(`
      ALTER TABLE "fair_category_stages"
      ADD CONSTRAINT "FK_fair_category_stages_deserted_by_user_id"
      FOREIGN KEY ("deserted_by_user_id") REFERENCES "users"("id")
      ON DELETE SET NULL ON UPDATE NO ACTION
    `);
    await queryRunner.query(`
      ALTER TABLE "judging_round_form_deserted_positions"
      ADD CONSTRAINT "FK_judging_round_form_deserted_positions_form_id"
      FOREIGN KEY ("round_form_id") REFERENCES "judging_round_forms"("id")
      ON DELETE CASCADE ON UPDATE NO ACTION
    `);
    await queryRunner.query(`
      ALTER TABLE "judging_round_deserted_results"
      ADD CONSTRAINT "FK_judging_round_deserted_results_round_id"
      FOREIGN KEY ("round_id") REFERENCES "judging_rounds"("id")
      ON DELETE CASCADE ON UPDATE NO ACTION
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "judging_round_deserted_results"
      DROP CONSTRAINT "FK_judging_round_deserted_results_round_id"
    `);
    await queryRunner.query(`
      ALTER TABLE "judging_round_form_deserted_positions"
      DROP CONSTRAINT "FK_judging_round_form_deserted_positions_form_id"
    `);
    await queryRunner.query(`
      ALTER TABLE "fair_category_stages"
      DROP CONSTRAINT "FK_fair_category_stages_deserted_by_user_id"
    `);

    await queryRunner.query(`DROP INDEX "IDX_judging_round_deserted_results_round"`);
    await queryRunner.query(`DROP INDEX "IDX_judging_round_form_deserted_positions_form"`);

    await queryRunner.query(`DROP TABLE "judging_round_deserted_results"`);
    await queryRunner.query(`DROP TABLE "judging_round_form_deserted_positions"`);

    await queryRunner.query(`ALTER TABLE "fair_category_stages" DROP COLUMN "deserted_reason"`);
    await queryRunner.query(`ALTER TABLE "fair_category_stages" DROP COLUMN "deserted_by_user_id"`);
    await queryRunner.query(`ALTER TABLE "fair_category_stages" DROP COLUMN "deserted_at"`);
  }
}
