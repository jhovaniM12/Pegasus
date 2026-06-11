import { Column, Entity } from "typeorm";
import { SyncableEntity } from "./base.entity.js";

@Entity({ name: "gaits" })
export class Gait extends SyncableEntity {
  @Column({ type: "varchar" })
  name!: string;
}
