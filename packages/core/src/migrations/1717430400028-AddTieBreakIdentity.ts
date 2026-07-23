import type { MigrationInterface, QueryRunner } from "typeorm";

export class AddTieBreakIdentity1717430400028 implements MigrationInterface {
  name = "AddTieBreakIdentity1717430400028";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "judging_rounds" ADD COLUMN "tie_break_reason" varchar`
    );
    await queryRunner.query(
      `ALTER TABLE "judging_rounds" ADD COLUMN "tie_break_start_position" integer`
    );
    await queryRunner.query(
      `ALTER TABLE "judging_rounds" ADD COLUMN "tie_break_end_position" integer`
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "judging_rounds" DROP COLUMN "tie_break_end_position"`
    );
    await queryRunner.query(
      `ALTER TABLE "judging_rounds" DROP COLUMN "tie_break_start_position"`
    );
    await queryRunner.query(
      `ALTER TABLE "judging_rounds" DROP COLUMN "tie_break_reason"`
    );
  }
}
