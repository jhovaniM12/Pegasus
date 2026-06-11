import { Column, Entity } from "typeorm";
import { SyncableEntity } from "./base.entity.js";

@Entity({ name: "sexes" })
export class Sex extends SyncableEntity {

  @Column({ type: "varchar", length: 50 })
  name!: string;
}
