import type { MigrationInterface, QueryRunner } from "typeorm";

export class ExpandFairEntryImportIdentity1717430400030 implements MigrationInterface {
  name = "ExpandFairEntryImportIdentity1717430400030";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "people" ALTER COLUMN "last_name" DROP NOT NULL`);

    await queryRunner.query(`ALTER TABLE "horses" ADD COLUMN "father_name" varchar`);
    await queryRunner.query(`ALTER TABLE "horses" ADD COLUMN "mother_name" varchar`);

    await queryRunner.query(`ALTER TABLE "sync_batches" ADD COLUMN "file_kind" varchar`);
    await queryRunner.query(`ALTER TABLE "sync_batches" ADD COLUMN "fair_external_id" varchar`);
    await queryRunner.query(
      `ALTER TABLE "sync_batches" ADD COLUMN "warning_rows" integer NOT NULL DEFAULT 0`
    );
    await queryRunner.query(`
      CREATE INDEX "IDX_sync_batches_fair_file_kind"
      ON "sync_batches" ("fair_external_id", "file_kind")
    `);

    await queryRunner.query(`ALTER TABLE "fair_entries" ADD COLUMN "inscription_number" varchar`);
    await queryRunner.query(`
      UPDATE "fair_entries"
      SET "inscription_number" = "external_id"
      WHERE "inscription_number" IS NULL
        AND "external_id" IS NOT NULL
    `);
    await queryRunner.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1
          FROM "fair_entries"
          WHERE "inscription_number" IS NULL
        ) THEN
          ALTER TABLE "fair_entries"
          ALTER COLUMN "inscription_number" SET NOT NULL;
        END IF;
      END
      $$
    `);

    await queryRunner.query(
      `ALTER TABLE "fair_entries" ALTER COLUMN "rider_document_number" DROP NOT NULL`
    );
    await queryRunner.query(`ALTER TABLE "fair_entries" ALTER COLUMN "receipt" DROP NOT NULL`);
    await queryRunner.query(`ALTER TABLE "fair_entries" ALTER COLUMN "is_child" DROP NOT NULL`);
    await queryRunner.query(
      `ALTER TABLE "fair_entries" ALTER COLUMN "participate" SET DEFAULT true`
    );

    await queryRunner.query(`
      UPDATE "sync_mappings" AS "mapping"
      SET "external_id" =
        "fair"."external_id" || ':' || "entry"."inscription_number" || ':' || "entry"."registration_number"
      FROM "fair_entries" AS "entry"
      INNER JOIN "fairs" AS "fair" ON "fair"."id" = "entry"."fair_id"
      WHERE "mapping"."entity_name" = 'fair_entries'
        AND "mapping"."internal_id" = "entry"."id"
        AND "fair"."external_id" IS NOT NULL
        AND "entry"."inscription_number" IS NOT NULL
    `);
    await queryRunner.query(`
      UPDATE "fair_entries" AS "entry"
      SET "external_id" =
        "fair"."external_id" || ':' || "entry"."inscription_number" || ':' || "entry"."registration_number"
      FROM "fairs" AS "fair"
      WHERE "fair"."id" = "entry"."fair_id"
        AND "fair"."external_id" IS NOT NULL
        AND "entry"."inscription_number" IS NOT NULL
    `);

    await queryRunner.query(`
      CREATE UNIQUE INDEX "UQ_fair_entries_business"
      ON "fair_entries" ("fair_id", "inscription_number", "registration_number")
    `);
    await queryRunner.query(`
      CREATE INDEX "IDX_fair_entries_fair_category"
      ON "fair_entries" ("fair_id", "category_id")
    `);
    await queryRunner.query(`
      CREATE INDEX "IDX_fair_entries_fair_sequence"
      ON "fair_entries" ("fair_id", "fair_sequence")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "IDX_fair_entries_fair_sequence"`);
    await queryRunner.query(`DROP INDEX "IDX_fair_entries_fair_category"`);
    await queryRunner.query(`DROP INDEX "UQ_fair_entries_business"`);

    await queryRunner.query(`
      WITH "ranked_entries" AS (
        SELECT
          "id",
          "inscription_number",
          ROW_NUMBER() OVER (
            PARTITION BY "source_system", "inscription_number"
            ORDER BY "registration_number", "id"
          ) AS "duplicate_rank"
        FROM "fair_entries"
        WHERE "inscription_number" IS NOT NULL
      )
      UPDATE "fair_entries" AS "entry"
      SET "external_id" = CASE
        WHEN "ranked"."duplicate_rank" = 1 THEN "ranked"."inscription_number"
        ELSE "ranked"."inscription_number" || ':' || "entry"."registration_number" || ':' || "entry"."id"
      END
      FROM "ranked_entries" AS "ranked"
      WHERE "entry"."id" = "ranked"."id"
    `);
    await queryRunner.query(`
      UPDATE "sync_mappings" AS "mapping"
      SET "external_id" = "entry"."external_id"
      FROM "fair_entries" AS "entry"
      WHERE "mapping"."entity_name" = 'fair_entries'
        AND "mapping"."internal_id" = "entry"."id"
        AND "entry"."external_id" IS NOT NULL
    `);

    await queryRunner.query(`ALTER TABLE "fair_entries" ALTER COLUMN "participate" DROP DEFAULT`);
    await queryRunner.query(`UPDATE "fair_entries" SET "is_child" = false WHERE "is_child" IS NULL`);
    await queryRunner.query(`ALTER TABLE "fair_entries" ALTER COLUMN "is_child" SET NOT NULL`);
    await queryRunner.query(`UPDATE "fair_entries" SET "receipt" = '' WHERE "receipt" IS NULL`);
    await queryRunner.query(`ALTER TABLE "fair_entries" ALTER COLUMN "receipt" SET NOT NULL`);
    await queryRunner.query(`
      UPDATE "fair_entries"
      SET "rider_document_number" = ''
      WHERE "rider_document_number" IS NULL
    `);
    await queryRunner.query(
      `ALTER TABLE "fair_entries" ALTER COLUMN "rider_document_number" SET NOT NULL`
    );
    await queryRunner.query(`ALTER TABLE "fair_entries" DROP COLUMN "inscription_number"`);

    await queryRunner.query(`ALTER TABLE "horses" DROP COLUMN "mother_name"`);
    await queryRunner.query(`ALTER TABLE "horses" DROP COLUMN "father_name"`);

    await queryRunner.query(`DROP INDEX "IDX_sync_batches_fair_file_kind"`);
    await queryRunner.query(`ALTER TABLE "sync_batches" DROP COLUMN "warning_rows"`);
    await queryRunner.query(`ALTER TABLE "sync_batches" DROP COLUMN "fair_external_id"`);
    await queryRunner.query(`ALTER TABLE "sync_batches" DROP COLUMN "file_kind"`);

    await queryRunner.query(`UPDATE "people" SET "last_name" = '' WHERE "last_name" IS NULL`);
    await queryRunner.query(`ALTER TABLE "people" ALTER COLUMN "last_name" SET NOT NULL`);
  }
}
