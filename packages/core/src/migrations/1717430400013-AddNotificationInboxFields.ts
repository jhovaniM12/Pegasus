import { MigrationInterface, QueryRunner } from "typeorm";

export class AddNotificationInboxFields1717430400013 implements MigrationInterface {
  name = "AddNotificationInboxFields1717430400013";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "notification_outbox" ADD "read_at" timestamp`);
    await queryRunner.query(`ALTER TABLE "notification_outbox" ADD "archived_at" timestamp`);
    await queryRunner.query(
      `CREATE INDEX "IDX_notification_outbox_inbox" ON "notification_outbox" ("recipient_user_id", "archived_at", "read_at", "created_at")`
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "IDX_notification_outbox_inbox"`);
    await queryRunner.query(`ALTER TABLE "notification_outbox" DROP COLUMN "archived_at"`);
    await queryRunner.query(`ALTER TABLE "notification_outbox" DROP COLUMN "read_at"`);
  }
}
