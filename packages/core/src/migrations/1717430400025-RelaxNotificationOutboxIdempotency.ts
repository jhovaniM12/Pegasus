import type { MigrationInterface, QueryRunner } from "typeorm";

export class RelaxNotificationOutboxIdempotency1717430400025 implements MigrationInterface {
  name = "RelaxNotificationOutboxIdempotency1717430400025";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "UQ_notification_outbox_active_role_event"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "UQ_notification_outbox_active_user_event"`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
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
}
