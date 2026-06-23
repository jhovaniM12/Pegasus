import type { MigrationInterface, QueryRunner } from "typeorm";

export class AddNotificationOutboxAttemptCount1717430400020 implements MigrationInterface {
  name = "AddNotificationOutboxAttemptCount1717430400020";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "notification_outbox"
      ADD COLUMN "attempt_count" integer NOT NULL DEFAULT 0
    `);
    await queryRunner.query(`
      CREATE INDEX "IDX_notification_outbox_dispatch"
      ON "notification_outbox" ("status", "attempt_count", "created_at")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "IDX_notification_outbox_dispatch"`);
    await queryRunner.query(`ALTER TABLE "notification_outbox" DROP COLUMN "attempt_count"`);
  }
}
