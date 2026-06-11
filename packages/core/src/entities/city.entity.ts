import { Column, Entity } from "typeorm";
import { SyncableEntity } from "./base.entity.js";

@Entity({ name: "cities" })
export class City extends SyncableEntity {
  @Column({ name: "department_code", type: "varchar", length: 20 })
  departmentCode!: string;

  @Column({ type: "varchar", length: 255 })
  name!: string;
}
