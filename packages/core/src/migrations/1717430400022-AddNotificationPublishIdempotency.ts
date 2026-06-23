import type { MigrationInterface, QueryRunner } from "typeorm";

export class AddNotificationPublishIdempotency1717430400022 implements MigrationInterface {
  name = "AddNotificationPublishIdempotency1717430400022";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "notification_outbox"
      ADD COLUMN "publish_attempted_at" timestamp NULL
    `);
    await queryRunner.query(`
      ALTER TABLE "notification_outbox"
      ADD COLUMN "beams_publish_id" varchar NULL
    `);
    await queryRunner.query(`
      CREATE UNIQUE INDEX "UQ_notification_outbox_active_user_event"
      ON "notification_outbox" ("recipient_user_id", "fair_category_stage_id", "type")
      WHERE "status" IN ('PENDING', 'PROCESSING') AND "recipient_user_id" IS NOT NULL
    `);
    await queryRunner.query(`
      CREATE UNIQUE INDEX "UQ_notification_outbox_active_role_event"
      ON "notification_outbox" ("recipient_role", "fair_category_stage_id", "type")
      WHERE "status" IN ('PENDING', 'PROCESSING') AND "recipient_user_id" IS NULL AND "recipient_role" IS NOT NULL
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "UQ_notification_outbox_active_role_event"`);
    await queryRunner.query(`DROP INDEX "UQ_notification_outbox_active_user_event"`);
    await queryRunner.query(`ALTER TABLE "notification_outbox" DROP COLUMN "beams_publish_id"`);
    await queryRunner.query(`ALTER TABLE "notification_outbox" DROP COLUMN "publish_attempted_at"`);
  }
}
