import { Column, Entity, JoinColumn, ManyToOne} from "typeorm";
import { SyncableEntity } from "./base.entity.js";
import { Fair } from "./fair.entity.js";
import { Person } from "./person.entity.js";
import { Role } from "./role.entity.js";

@Entity({ name: "fair_staff" })
export class FairStaff extends SyncableEntity {
  @Column({ name: "fair_id", type: "uuid" })
  fairId!: string;

  @ManyToOne(() => Fair, { nullable: false })
  @JoinColumn({ name: "fair_id" })
  fair!: Fair;

  @Column({ name: "person_id", type: "uuid" })
  personId!: string;

  @ManyToOne(() => Person, { nullable: false })
  @JoinColumn({ name: "person_id" })
  person!: Person;

  @Column({ name: "role_id", type: "uuid" })
  roleId!: string;

  @ManyToOne(() => Role, { nullable: false })
  @JoinColumn({ name: "role_id" })
  role!: Role;

}