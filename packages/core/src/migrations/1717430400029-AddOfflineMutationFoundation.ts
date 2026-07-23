import type { MigrationInterface, QueryRunner } from "typeorm";

export class AddOfflineMutationFoundation1717430400029 implements MigrationInterface {
  name = "AddOfflineMutationFoundation1717430400029";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "fair_category_stages" ADD COLUMN "revision" integer NOT NULL DEFAULT 0`
    );
    await queryRunner.query(
      `ALTER TABLE "veterinary_checks" ADD COLUMN "revision" integer NOT NULL DEFAULT 0`
    );
    await queryRunner.query(
      `ALTER TABLE "fa_judge_forms" ADD COLUMN "revision" integer NOT NULL DEFAULT 0`
    );
    await queryRunner.query(
      `ALTER TABLE "judging_round_forms" ADD COLUMN "revision" integer NOT NULL DEFAULT 0`
    );

    await queryRunner.query(`
      CREATE TABLE "offline_operation_receipts" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "operation_id" uuid NOT NULL,
        "user_id" uuid NOT NULL,
        "fair_category_stage_id" uuid NOT NULL,
        "aggregate_type" varchar NOT NULL,
        "aggregate_id" uuid NOT NULL,
        "request_hash" varchar(64) NOT NULL,
        "response_status" integer NOT NULL,
        "response_payload" jsonb,
        "applied_revision" integer,
        "created_at" timestamp NOT NULL DEFAULT now(),
        CONSTRAINT "PK_offline_operation_receipts" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_offline_operation_receipts_operation_id" UNIQUE ("operation_id"),
        CONSTRAINT "CHK_offline_operation_receipts_aggregate_type"
          CHECK ("aggregate_type" IN ('VET_CHECK', 'FA_FORM', 'ROUND_FORM', 'ROUND_NOTE', 'ROUND_REMINDERS')),
        CONSTRAINT "FK_offline_operation_receipts_user"
          FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_offline_operation_receipts_stage"
          FOREIGN KEY ("fair_category_stage_id") REFERENCES "fair_category_stages"("id") ON DELETE CASCADE
      )
    `);
    await queryRunner.query(
      `CREATE INDEX "IDX_offline_operation_receipts_user_id" ON "offline_operation_receipts" ("user_id")`
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_offline_operation_receipts_stage_id" ON "offline_operation_receipts" ("fair_category_stage_id")`
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_offline_operation_receipts_created_at" ON "offline_operation_receipts" ("created_at")`
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "offline_operation_receipts"`);
    await queryRunner.query(`ALTER TABLE "judging_round_forms" DROP COLUMN "revision"`);
    await queryRunner.query(`ALTER TABLE "fa_judge_forms" DROP COLUMN "revision"`);
    await queryRunner.query(`ALTER TABLE "veterinary_checks" DROP COLUMN "revision"`);
    await queryRunner.query(`ALTER TABLE "fair_category_stages" DROP COLUMN "revision"`);
  }
}
