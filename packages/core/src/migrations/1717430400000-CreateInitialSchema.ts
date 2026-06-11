import { MigrationInterface, QueryRunner } from "typeorm";

export class CreateInitialSchema1717430400000 implements MigrationInterface {
  name = "CreateInitialSchema1717430400000";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`CREATE EXTENSION IF NOT EXISTS "uuid-ossp"`);
    await queryRunner.query(`
      CREATE TABLE "cities" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "external_id" varchar,
        "source_system" varchar,
        "department_code" varchar(20) NOT NULL,
        "name" varchar(255) NOT NULL,
        "created_at" timestamp NOT NULL DEFAULT now(),
        "updated_at" timestamp NOT NULL DEFAULT now(),
        CONSTRAINT "PK_cities_id" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_cities_external_id_source_system" UNIQUE ("external_id", "source_system")
      )
    `);
    await queryRunner.query(`
      CREATE TABLE "roles" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "external_id" varchar,
        "source_system" varchar,
        "name" varchar NOT NULL,
        "type_role" char(1) NOT NULL,
        "created_at" timestamp NOT NULL DEFAULT now(),
        "updated_at" timestamp NOT NULL DEFAULT now(),
        CONSTRAINT "PK_roles_id" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_roles_external_id_source_system" UNIQUE ("external_id", "source_system")
      )
    `);
    await queryRunner.query(`
      CREATE TABLE "grades" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "external_id" varchar,
        "source_system" varchar,
        "name" varchar NOT NULL,
        "nomenclature" varchar(2) NOT NULL,
        "created_at" timestamp NOT NULL DEFAULT now(),
        "updated_at" timestamp NOT NULL DEFAULT now(),
        CONSTRAINT "PK_grades_id" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_grades_external_id_source_system" UNIQUE ("external_id", "source_system")
      )
    `);
    await queryRunner.query(`
      CREATE TABLE "sexes" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "external_id" varchar,
        "source_system" varchar,
        "name" varchar(50) NOT NULL,
        "created_at" timestamp NOT NULL DEFAULT now(),
        "updated_at" timestamp NOT NULL DEFAULT now(),
        CONSTRAINT "PK_sexes_id" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_sexes_external_id_source_system" UNIQUE ("external_id", "source_system")
      )
    `);
    await queryRunner.query(`
      CREATE TABLE "gaits" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "external_id" varchar,
        "source_system" varchar,
        "name" varchar NOT NULL,
        "created_at" timestamp NOT NULL DEFAULT now(),
        "updated_at" timestamp NOT NULL DEFAULT now(),
        CONSTRAINT "PK_gaits_id" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_gaits_external_id_source_system" UNIQUE ("external_id", "source_system")
      )
    `);
    await queryRunner.query(`
      CREATE TABLE "equine_types" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "external_id" varchar,
        "source_system" varchar,
        "name" varchar NOT NULL,
        "created_at" timestamp NOT NULL DEFAULT now(),
        "updated_at" timestamp NOT NULL DEFAULT now(),
        CONSTRAINT "PK_equine_types_id" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_equine_types_external_id_source_system" UNIQUE ("external_id", "source_system")
      )
    `);
    await queryRunner.query(`
      CREATE TABLE "titles" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "external_id" varchar,
        "source_system" varchar,
        "name" varchar(255) NOT NULL,
        "created_at" timestamp NOT NULL DEFAULT now(),
        "updated_at" timestamp NOT NULL DEFAULT now(),
        CONSTRAINT "PK_titles_id" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_titles_external_id_source_system" UNIQUE ("external_id", "source_system")
      )
    `);
    await queryRunner.query(`
      CREATE TABLE "groupings" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "external_id" varchar,
        "source_system" varchar,
        "group_permission_code" varchar(20),
        "created_at" timestamp NOT NULL DEFAULT now(),
        "updated_at" timestamp NOT NULL DEFAULT now(),
        CONSTRAINT "PK_groupings_id" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_groupings_external_id_source_system" UNIQUE ("external_id", "source_system")
      )
    `);
    await queryRunner.query(`
      CREATE TABLE "categories" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "external_id" varchar,
        "source_system" varchar,
        "name" varchar(255) NOT NULL,
        "sex_id" uuid NOT NULL,
        "gait_id" uuid NOT NULL,
        "equine_type_id" uuid NOT NULL,
        "min_age_months" numeric(10, 2) NOT NULL,
        "max_age_months" numeric(10, 2) NOT NULL,
        "next_category_code" varchar(20),
        "grouping_id" uuid NOT NULL,
        "large_camps" integer NOT NULL,
        "created_at" timestamp NOT NULL DEFAULT now(),
        "updated_at" timestamp NOT NULL DEFAULT now(),
        CONSTRAINT "PK_categories_id" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_categories_external_id_source_system" UNIQUE ("external_id", "source_system")
      )
    `);
    await queryRunner.query(`
      CREATE TABLE "people" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "external_id" varchar,
        "source_system" varchar,
        "name" varchar NOT NULL,
        "last_name" varchar NOT NULL,
        "address" varchar,
        "indicative" varchar,
        "telephone" varchar,
        "phone" varchar,
        "avantel_phone" varchar,
        "email" varchar,
        "created_at" timestamp NOT NULL DEFAULT now(),
        "updated_at" timestamp NOT NULL DEFAULT now(),
        CONSTRAINT "PK_people_id" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_people_external_id_source_system" UNIQUE ("external_id", "source_system")
      )
    `);
    await queryRunner.query(`
      CREATE TABLE "fairs" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "external_id" varchar,
        "source_system" varchar,
        "name" varchar(255),
        "year" integer,
        "start_date" date,
        "end_date" date,
        "city_id" uuid,
        "grade_id" uuid,
        "comments" text,
        "registered_count" integer,
        "created_at" timestamp NOT NULL DEFAULT now(),
        "updated_at" timestamp NOT NULL DEFAULT now(),
        CONSTRAINT "PK_fairs_id" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_fairs_external_id_source_system" UNIQUE ("external_id", "source_system")
      )
    `);
    await queryRunner.query(`ALTER TABLE "categories" ADD CONSTRAINT "FK_categories_sex_id" FOREIGN KEY ("sex_id") REFERENCES "sexes"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
    await queryRunner.query(`ALTER TABLE "categories" ADD CONSTRAINT "FK_categories_gait_id" FOREIGN KEY ("gait_id") REFERENCES "gaits"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
    await queryRunner.query(`ALTER TABLE "categories" ADD CONSTRAINT "FK_categories_equine_type_id" FOREIGN KEY ("equine_type_id") REFERENCES "equine_types"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
    await queryRunner.query(`ALTER TABLE "categories" ADD CONSTRAINT "FK_categories_grouping_id" FOREIGN KEY ("grouping_id") REFERENCES "groupings"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
    await queryRunner.query(`ALTER TABLE "categories" ADD CONSTRAINT "chk_category_age" CHECK (min_age_months <= max_age_months)`);
    await queryRunner.query(`ALTER TABLE "fairs" ADD CONSTRAINT "FK_fairs_city_id" FOREIGN KEY ("city_id") REFERENCES "cities"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
    await queryRunner.query(`ALTER TABLE "fairs" ADD CONSTRAINT "FK_fairs_grade_id" FOREIGN KEY ("grade_id") REFERENCES "grades"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "fairs" DROP CONSTRAINT "FK_fairs_grade_id"`);
    await queryRunner.query(`ALTER TABLE "fairs" DROP CONSTRAINT "FK_fairs_city_id"`);
    await queryRunner.query(`ALTER TABLE "categories" DROP CONSTRAINT "FK_categories_grouping_id"`);
    await queryRunner.query(`ALTER TABLE "categories" DROP CONSTRAINT "FK_categories_equine_type_id"`);
    await queryRunner.query(`ALTER TABLE "categories" DROP CONSTRAINT "FK_categories_gait_id"`);
    await queryRunner.query(`ALTER TABLE "categories" DROP CONSTRAINT "FK_categories_sex_id"`);
    await queryRunner.query(`ALTER TABLE "categories" DROP CONSTRAINT "chk_category_age"`);
    await queryRunner.query(`DROP TABLE "fairs"`);
    await queryRunner.query(`DROP TABLE "people"`);
    await queryRunner.query(`DROP TABLE "categories"`);
    await queryRunner.query(`DROP TABLE "groupings"`);
    await queryRunner.query(`DROP TABLE "titles"`);
    await queryRunner.query(`DROP TABLE "equine_types"`);
    await queryRunner.query(`DROP TABLE "gaits"`);
    await queryRunner.query(`DROP TABLE "sexes"`);
    await queryRunner.query(`DROP TABLE "grades"`);
    await queryRunner.query(`DROP TABLE "roles"`);
    await queryRunner.query(`DROP TABLE "cities"`);
  }
}
