import { Column, Entity, Index, JoinColumn, ManyToOne } from "typeorm";
import { SyncableEntity } from "./base.entity.js";
import { Fair } from "./fair.entity.js";
import { Category } from "./category.entity.js";
import { Horse } from "./horse.entity.js";

@Entity({ name: "fair_entries" })
@Index(
  "UQ_fair_entries_business",
  ["fairId", "inscriptionNumber", "registrationNumber"],
  { unique: true }
)
@Index("IDX_fair_entries_fair_category", ["fairId", "categoryId"])
@Index("IDX_fair_entries_fair_sequence", ["fairId", "fairSequence"])
export class FairEntry extends SyncableEntity {
  @Column({ name: "fair_id", type: "uuid" })
  fairId!: string;

  @ManyToOne(() => Fair, { nullable: false })
  @JoinColumn({ name: "fair_id" })
  fair!: Fair;

  @Column({ name: "inscription_number", type: "varchar", nullable: true })
  inscriptionNumber!: string | null;

  @Column({ name: "registration_number", type: "varchar" })
  registrationNumber!: string;

  @Column({ name: "horse_id", type: "uuid", nullable: true })
  horseId!: string | null;

  @ManyToOne(() => Horse, (horse) => horse.fairEntries, { nullable: true })
  @JoinColumn({ name: "horse_id" })
  horse!: Horse | null;

  @Column({ name: "category_id", type: "uuid" })
  categoryId!: string;

  @ManyToOne(() => Category, { nullable: false })
  @JoinColumn({ name: "category_id" })
  category!: Category;

  @Column({ name: "track_position", type: "integer" })
  trackPosition!: number;

  @Column({ name: "rider_name", type: "varchar" })
  riderName!: string;

  @Column({ name: "rider_document_number", type: "varchar", length: 50, nullable: true })
  riderDocumentNumber!: string | null;

  @Column({ name: "receipt", type: "varchar", length: 50, nullable: true })
  receipt!: string | null;

  @Column({ name: "participate", type: "boolean", default: true })
  participate!: boolean;

  @Column({ name: "fair_sequence", type: "integer" })
  fairSequence!: number;

  @Column({ name: "is_child", type: "boolean", nullable: true })
  isChild!: boolean | null;
}
