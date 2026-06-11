import { Column, Entity, JoinColumn, ManyToOne} from "typeorm";
import { SyncableEntity } from "./base.entity.js";
import { Fair } from "./fair.entity.js";
import { Category } from "./category.entity.js";

@Entity({ name: "fair_entries" })
export class FairEntry extends SyncableEntity {
  @Column({ name: "fair_id", type: "uuid" })
  fairId!: string;

  @ManyToOne(() => Fair, { nullable: false })
  @JoinColumn({ name: "fair_id" })
  fair!: Fair;

  @Column({name: "registration_number", type: "varchar"})
  registrationNumber!: string;

  @Column({name: "category_id", type: "uuid"})
  categoryId!: string;

  @ManyToOne(() => Category, { nullable: false })
  @JoinColumn({ name: "category_id" })
  category!: Category;

  @Column({name: "track_position", type: "integer"})
  trackPosition!: number;

  @Column({name: "rider_name", type: "varchar"})
  riderName!: string;

  @Column({name: "rider_document_number", type: "varchar" , length: 50})
  riderDocumentNumber!: string;

  @Column({name: "receipt", type: "varchar" , length: 50})
  receipt!: string;

  @Column({name: "participate", type: "boolean"})
  participate!: boolean;

  @Column({name: "fair_sequence", type: "integer"})
  fairSequence!: number;

  @Column({name: "is_child", type: "boolean"})
  isChild!: boolean;
}