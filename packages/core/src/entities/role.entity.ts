import { Column, Entity } from "typeorm";
import { SyncableEntity } from "./base.entity.js";

@Entity({ name: "roles" })
export class Role extends SyncableEntity {
  @Column({ type: "varchar" })
  name!: string;

  @Column({ name: "type_role", type: "char", length: 1 })
  typeRole!: string;
}
