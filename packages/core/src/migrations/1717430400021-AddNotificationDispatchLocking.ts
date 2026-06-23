import type { MigrationInterface, QueryRunner } from "typeorm";

export class AddNotificationDispatchLocking1717430400021 implements MigrationInterface {
  name = "AddNotificationDispatchLocking1717430400021";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "notification_outbox"
      ADD COLUMN "processing_started_at" timestamp NULL
    `);
    await queryRunner.query(`
      ALTER TABLE "notification_outbox"
      ADD COLUMN "next_retry_at" timestamp NULL
    `);
    await queryRunner.query(`
      CREATE INDEX "IDX_notification_outbox_claim"
      ON "notification_outbox" ("status", "next_retry_at", "processing_started_at", "created_at")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "IDX_notification_outbox_claim"`);
    await queryRunner.query(`ALTER TABLE "notification_outbox" DROP COLUMN "next_retry_at"`);
    await queryRunner.query(`ALTER TABLE "notification_outbox" DROP COLUMN "processing_started_at"`);
  }
}
