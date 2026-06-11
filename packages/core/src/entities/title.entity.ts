import { Column, Entity } from "typeorm";
import { SyncableEntity } from "./base.entity.js";

@Entity({ name: "titles" })
export class Title extends SyncableEntity {
  @Column({ type: "varchar", length: 255 })
  name!: string;
}
