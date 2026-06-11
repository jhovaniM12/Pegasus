import { Column, Entity } from "typeorm";
import { SyncableEntity } from "./base.entity.js";

@Entity({ name: "equine_types" })
export class EquineType extends SyncableEntity {
  @Column({ type: "varchar" })
  name!: string;
}
