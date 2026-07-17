import type { MigrationInterface, QueryRunner } from "typeorm";

/**
 * Retira la maquinaria de colas/reintentos del envío de notificaciones push.
 * El envío ahora es directo y síncrono al momento de la acción: se publica una
 * sola vez a Pusher Beams y, si falla, solo se registra en logs (sin cron ni backoff).
 */
export class SimplifyNotificationOutboxDelivery1717430400026 implements MigrationInterface {
  name = "SimplifyNotificationOutboxDelivery1717430400026";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_notification_outbox_dispatch"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_notification_outbox_claim"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_notification_outbox_status"`);
    await queryRunner.query(`
      ALTER TABLE "notification_outbox"
      DROP COLUMN "status",
      DROP COLUMN "attempt_count",
      DROP COLUMN "processing_started_at",
      DROP COLUMN "next_retry_at",
      DROP COLUMN "publish_attempted_at",
      DROP COLUMN "beams_publish_id",
      DROP COLUMN "failed_at",
      DROP COLUMN "error_message",
      DROP COLUMN "recipient_role"
    `);
    await queryRunner.query(`
      CREATE INDEX "IDX_notification_outbox_stage_pending"
      ON "notification_outbox" ("fair_category_stage_id", "sent_at")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_notification_outbox_stage_pending"`);
    await queryRunner.query(`
      ALTER TABLE "notification_outbox"
      ADD COLUMN "recipient_role" varchar,
      ADD COLUMN "error_message" text,
      ADD COLUMN "failed_at" timestamp,
      ADD COLUMN "beams_publish_id" varchar,
      ADD COLUMN "publish_attempted_at" timestamp,
      ADD COLUMN "next_retry_at" timestamp,
      ADD COLUMN "processing_started_at" timestamp,
      ADD COLUMN "attempt_count" integer NOT NULL DEFAULT 0,
      ADD COLUMN "status" varchar NOT NULL DEFAULT 'PENDING'
    `);
    await queryRunner.query(`CREATE INDEX "IDX_notification_outbox_status" ON "notification_outbox" ("status")`);
    await queryRunner.query(`
      CREATE INDEX "IDX_notification_outbox_claim"
      ON "notification_outbox" ("status", "next_retry_at", "processing_started_at", "created_at")
    `);
    await queryRunner.query(`
      CREATE INDEX "IDX_notification_outbox_dispatch"
      ON "notification_outbox" ("status", "attempt_count", "created_at")
    `);
  }
}
