import { Column, Entity } from "typeorm";
import { SyncableEntity } from "./base.entity.js";

@Entity({ name: "grades" })
export class Grade extends SyncableEntity {

  @Column({ type: "varchar" })
  name!: string;

  @Column({ type: "varchar", length: 2 })
  nomenclature!: string;
}
