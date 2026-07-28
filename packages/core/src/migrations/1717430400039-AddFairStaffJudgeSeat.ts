import type { MigrationInterface, QueryRunner } from "typeorm";

export class AddFairStaffJudgeSeat1717430400039 implements MigrationInterface {
  name = "AddFairStaffJudgeSeat1717430400039";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "fair_staff"
      ADD COLUMN "judge_seat" integer
    `);

    // Asigna asientos 1..n a jueces existentes por feria (orden estable).
    await queryRunner.query(`
      WITH ranked AS (
        SELECT
          staff.id,
          ROW_NUMBER() OVER (
            PARTITION BY staff.fair_id
            ORDER BY staff.created_at ASC, staff.id ASC
          ) AS seat
        FROM "fair_staff" staff
        INNER JOIN "roles" role ON role.id = staff.role_id
        WHERE role.external_id = '2'
      )
      UPDATE "fair_staff" AS staff
      SET "judge_seat" = ranked.seat
      FROM ranked
      WHERE staff.id = ranked.id
        AND ranked.seat BETWEEN 1 AND 5
    `);

    await queryRunner.query(`
      ALTER TABLE "fair_staff"
      ADD CONSTRAINT "CHK_fair_staff_judge_seat_range"
      CHECK ("judge_seat" IS NULL OR ("judge_seat" >= 1 AND "judge_seat" <= 5))
    `);

    await queryRunner.query(`
      CREATE UNIQUE INDEX "UQ_fair_staff_fair_judge_seat"
      ON "fair_staff" ("fair_id", "judge_seat")
      WHERE "judge_seat" IS NOT NULL
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "UQ_fair_staff_fair_judge_seat"`);
    await queryRunner.query(`ALTER TABLE "fair_staff" DROP CONSTRAINT "CHK_fair_staff_judge_seat_range"`);
    await queryRunner.query(`ALTER TABLE "fair_staff" DROP COLUMN "judge_seat"`);
  }
}
