import { Column, Entity } from "typeorm";
import { SyncableEntity } from "./base.entity.js";

@Entity({ name: "groupings" })
export class Grouping extends SyncableEntity {
  @Column({
    name: "group_permission_code",
    type: "varchar",
    length: 20,
    nullable: true
  })
  groupPermissionCode!: string;
}