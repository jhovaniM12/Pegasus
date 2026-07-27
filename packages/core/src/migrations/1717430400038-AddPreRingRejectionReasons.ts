import type { MigrationInterface, QueryRunner } from "typeorm";

/**
 * Motivos de rechazo veterinario en prepista:
 * - scope/category en disqualification_reasons
 * - FK rejection_reason_id en veterinary_checks
 * No borra motivos históricos de competencia.
 */
export class AddPreRingRejectionReasons1717430400038 implements MigrationInterface {
  name = "AddPreRingRejectionReasons1717430400038";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "disqualification_reasons"
      ADD COLUMN "scope" varchar NOT NULL DEFAULT 'COMPETITION'
    `);
    await queryRunner.query(`
      ALTER TABLE "disqualification_reasons"
      ADD COLUMN "category" varchar
    `);
    await queryRunner.query(`
      ALTER TABLE "disqualification_reasons"
      ADD CONSTRAINT "CHK_disqualification_reasons_scope"
      CHECK ("scope" IN ('COMPETITION', 'PRE_RING'))
    `);

    await queryRunner.query(`
      ALTER TABLE "veterinary_checks"
      ADD COLUMN "rejection_reason_id" uuid
    `);
    await queryRunner.query(`
      ALTER TABLE "veterinary_checks"
      ADD CONSTRAINT "FK_veterinary_checks_rejection_reason_id"
      FOREIGN KEY ("rejection_reason_id")
      REFERENCES "disqualification_reasons"("id")
      ON DELETE SET NULL
      ON UPDATE NO ACTION
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "veterinary_checks"
      DROP CONSTRAINT IF EXISTS "FK_veterinary_checks_rejection_reason_id"
    `);
    await queryRunner.query(`
      ALTER TABLE "veterinary_checks"
      DROP COLUMN IF EXISTS "rejection_reason_id"
    `);
    await queryRunner.query(`
      ALTER TABLE "disqualification_reasons"
      DROP CONSTRAINT IF EXISTS "CHK_disqualification_reasons_scope"
    `);
    await queryRunner.query(`
      ALTER TABLE "disqualification_reasons"
      DROP COLUMN IF EXISTS "category"
    `);
    await queryRunner.query(`
      ALTER TABLE "disqualification_reasons"
      DROP COLUMN IF EXISTS "scope"
    `);
  }
}
