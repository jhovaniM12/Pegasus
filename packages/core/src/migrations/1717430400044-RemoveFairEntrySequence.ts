import type { MigrationInterface, QueryRunner } from "typeorm";

export class RemoveFairEntrySequence1717430400044 implements MigrationInterface {
  name = "RemoveFairEntrySequence1717430400044";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_fair_entries_fair_sequence"`);
    await queryRunner.query(`ALTER TABLE "fair_entries" DROP COLUMN "fair_sequence"`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "fair_entries" ADD COLUMN "fair_sequence" integer`);
    await queryRunner.query(`
      CREATE INDEX "IDX_fair_entries_fair_sequence"
      ON "fair_entries" ("fair_id", "fair_sequence")
    `);
  }
}
