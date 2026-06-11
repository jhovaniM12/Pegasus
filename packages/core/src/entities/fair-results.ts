import { Column, Entity, JoinColumn, ManyToOne, Unique } from "typeorm";
import { Category } from "./category.entity.js";
import { SyncableEntity } from "./base.entity.js";
import { Fair } from "./fair.entity.js";
import { FairEntry } from "./fair-entries.js";
import { Grade } from "./grade.entity.js";
import { Title } from "./title.entity.js";

@Unique("UQ_fair_results_business_key", ["fairId", "fairEntryId", "categoryId", "titleId"])
@Entity({ name: "fair_results" })
export class FairResult extends SyncableEntity {
  @Column({ name: "fair_id", type: "uuid" })
  fairId!: string;

  @ManyToOne(() => Fair, { nullable: false })
  @JoinColumn({ name: "fair_id" })
  fair!: Fair;

  @Column({ name: "fair_entry_id", type: "uuid" })
  fairEntryId!: string;

  @ManyToOne(() => FairEntry, { nullable: false })
  @JoinColumn({ name: "fair_entry_id" })
  fairEntry!: FairEntry;

  @Column({ name: "grade_id", type: "uuid" })
  gradeId!: string;

  @ManyToOne(() => Grade, { nullable: false })
  @JoinColumn({ name: "grade_id" })
  grade!: Grade;

  @Column({ name: "category_id", type: "uuid" })
  categoryId!: string;

  @ManyToOne(() => Category, { nullable: false })
  @JoinColumn({ name: "category_id" })
  category!: Category;

  @Column({ name: "title_id", type: "uuid" })
  titleId!: string;

  @ManyToOne(() => Title, { nullable: false })
  @JoinColumn({ name: "title_id" })
  title!: Title;

  @Column({ name: "position_obtained", type: "integer" })
  positionObtained!: number;

  @Column({ type: "decimal", precision: 10, scale: 2 })
  score!: number;
}
