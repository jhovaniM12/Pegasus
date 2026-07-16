import type { MigrationInterface, QueryRunner } from "typeorm";

export class CreateSyncControlTables1717430400024 implements MigrationInterface {
  name = "CreateSyncControlTables1717430400024";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "sync_batches" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "source_system" varchar NOT NULL,
        "entity_name" varchar NOT NULL,
        "file_name" varchar NOT NULL,
        "file_size" integer NOT NULL,
        "file_checksum" varchar(64) NOT NULL,
        "status" varchar NOT NULL,
        "total_rows" integer NOT NULL DEFAULT 0,
        "inserted_rows" integer NOT NULL DEFAULT 0,
        "updated_rows" integer NOT NULL DEFAULT 0,
        "skipped_rows" integer NOT NULL DEFAULT 0,
        "failed_rows" integer NOT NULL DEFAULT 0,
        "started_at" timestamp NOT NULL,
        "finished_at" timestamp,
        "error_message" text,
        "created_by" uuid NOT NULL,
        "created_at" timestamp NOT NULL DEFAULT now(),
        "updated_at" timestamp NOT NULL DEFAULT now(),
        CONSTRAINT "PK_sync_batches_id" PRIMARY KEY ("id")
      )
    `);
    await queryRunner.query(`
      ALTER TABLE "sync_batches"
      ADD CONSTRAINT "FK_sync_batches_created_by"
      FOREIGN KEY ("created_by") REFERENCES "users"("id")
      ON DELETE NO ACTION ON UPDATE NO ACTION
    `);
    await queryRunner.query(`
      CREATE INDEX "IDX_sync_batches_entity_status"
      ON "sync_batches" ("entity_name", "status")
    `);
    await queryRunner.query(`
      CREATE INDEX "IDX_sync_batches_started_at"
      ON "sync_batches" ("started_at")
    `);

    await queryRunner.query(`
      CREATE TABLE "sync_mappings" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "source_system" varchar NOT NULL,
        "entity_name" varchar NOT NULL,
        "external_id" varchar NOT NULL,
        "internal_id" uuid NOT NULL,
        "row_hash" varchar(64) NOT NULL,
        "last_seen_batch_id" uuid NOT NULL,
        "created_at" timestamp NOT NULL DEFAULT now(),
        "updated_at" timestamp NOT NULL DEFAULT now(),
        CONSTRAINT "PK_sync_mappings_id" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_sync_mappings_source_entity_external"
          UNIQUE ("source_system", "entity_name", "external_id")
      )
    `);
    await queryRunner.query(`
      ALTER TABLE "sync_mappings"
      ADD CONSTRAINT "FK_sync_mappings_last_seen_batch_id"
      FOREIGN KEY ("last_seen_batch_id") REFERENCES "sync_batches"("id")
      ON DELETE NO ACTION ON UPDATE NO ACTION
    `);
    await queryRunner.query(`
      CREATE INDEX "IDX_sync_mappings_internal_id"
      ON "sync_mappings" ("internal_id")
    `);

    await queryRunner.query(`
      CREATE TABLE "sync_errors" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "batch_id" uuid NOT NULL,
        "entity_name" varchar NOT NULL,
        "row_number" integer NOT NULL,
        "external_id" varchar,
        "error_code" varchar NOT NULL,
        "error_message" text NOT NULL,
        "raw_row" jsonb NOT NULL,
        "created_at" timestamp NOT NULL DEFAULT now(),
        "updated_at" timestamp NOT NULL DEFAULT now(),
        CONSTRAINT "PK_sync_errors_id" PRIMARY KEY ("id")
      )
    `);
    await queryRunner.query(`
      ALTER TABLE "sync_errors"
      ADD CONSTRAINT "FK_sync_errors_batch_id"
      FOREIGN KEY ("batch_id") REFERENCES "sync_batches"("id")
      ON DELETE CASCADE ON UPDATE NO ACTION
    `);
    await queryRunner.query(`
      CREATE INDEX "IDX_sync_errors_batch_id"
      ON "sync_errors" ("batch_id")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "IDX_sync_errors_batch_id"`);
    await queryRunner.query(`ALTER TABLE "sync_errors" DROP CONSTRAINT "FK_sync_errors_batch_id"`);
    await queryRunner.query(`DROP TABLE "sync_errors"`);
    await queryRunner.query(`DROP INDEX "IDX_sync_mappings_internal_id"`);
    await queryRunner.query(`ALTER TABLE "sync_mappings" DROP CONSTRAINT "FK_sync_mappings_last_seen_batch_id"`);
    await queryRunner.query(`DROP TABLE "sync_mappings"`);
    await queryRunner.query(`DROP INDEX "IDX_sync_batches_started_at"`);
    await queryRunner.query(`DROP INDEX "IDX_sync_batches_entity_status"`);
    await queryRunner.query(`ALTER TABLE "sync_batches" DROP CONSTRAINT "FK_sync_batches_created_by"`);
    await queryRunner.query(`DROP TABLE "sync_batches"`);
  }
}
