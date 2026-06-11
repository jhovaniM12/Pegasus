import { Column, Entity, JoinColumn, ManyToOne } from "typeorm";
import { SyncableEntity } from "./base.entity.js";
import { EquineType } from "./equine-type.entity.js";
import { Gait } from "./gait.entity.js";
import { Sex } from "./sex.entity.js";
import { Grouping } from "./grouping.entity.js";

@Entity({ name: "categories" })
export class Category extends SyncableEntity {
  @Column({
    name: "name",
    type: "varchar",
    length: 255
  })
  name!: string;

  @Column({
    name: "sex_id",
    type: "uuid",
  })
  sexId!: string;

  @ManyToOne(() => Sex, { nullable: false })
  @JoinColumn({ name: "sex_id" })
  sex!: Sex;

  //Tipo de andar
  @Column({
    name: "gait_id",
    type: "uuid",
  })
  gaitId!: string;

  @ManyToOne(() => Gait, { nullable: false })
  @JoinColumn({ name: "gait_id" })
  gait!: Gait;

  //Tipo de equino
  @Column({
    name: "equine_type_id",
    type: "uuid",
  })
  equineTypeId!: string;

  @ManyToOne(() => EquineType, { nullable: false })
  @JoinColumn({ name: "equine_type_id" })
  equineType!: EquineType;

  //Edad mínima en meses

  @Column({
    name: "min_age_months",
    type: "decimal",
    precision: 10,
    scale: 2
  })
  minAgeMonths!: number;

  //Edad máxima en meses

  @Column({
    name: "max_age_months",
    type: "decimal",
    precision: 10,
    scale: 2
  })
  maxAgeMonths!: number;

  //Código de la categoría siguiente
  @Column({
    name: "next_category_code",
    type: "varchar",
    length: 20,
    nullable: true
  })
  nextCategoryCode?: string;

  //Codigo agrupador
  @Column({
    name: "grouping_id",
    type: "uuid",
  })
  groupingId!: string;

  @ManyToOne(() => Grouping, { nullable: false })
  @JoinColumn({ name: "grouping_id" })
  grouping!: Grouping;

    //Grandes camp
  @Column({
    name: "large_camps",
    type: "integer"
  })
  largeCamps!: number;
  
}
