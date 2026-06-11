import { Column, Entity, JoinColumn, ManyToOne } from "typeorm";
import { SyncableEntity } from "./base.entity.js";
import { City } from "./city.entity.js";
import { Grade } from "./grade.entity.js";

@Entity({ name: "fairs" })
export class Fair extends SyncableEntity {
  @Column({ type: "varchar", length: 255, nullable: true })
  name!: string | null;

  @Column({ type: "integer", nullable: true })
  year!: number | null;

  @Column({ name: "start_date", type: "date", nullable: true })
  startDate!: string | null;

  @Column({ name: "end_date", type: "date", nullable: true })
  endDate!: string | null;

  @Column({ name: "city_id", type: "uuid", nullable: true })
  cityId!: string | null;

  @ManyToOne(() => City, { nullable: true })
  @JoinColumn({ name: "city_id" })
  city!: City | null;

  @Column({ name: "grade_id", type: "uuid", nullable: true })
  gradeId!: string | null;

  @ManyToOne(() => Grade, { nullable: true })
  @JoinColumn({ name: "grade_id" })
  grade!: Grade | null;

  @Column({ type: "text", nullable: true })
  comments!: string | null;

  @Column({ name: "registered_count", type: "integer", nullable: true })
  registeredCount!: number | null;
}
