import { Column, Entity, JoinColumn, ManyToOne } from "typeorm";
import { PegasusBaseEntity } from "./base.entity.js";
import { Person } from "./person.entity.js";

export type UserRole = "ROOT" | "ADMIN" | "JUDGE" | "STAFF" | "VIEWER";

@Entity({ name: "users" })
export class User extends PegasusBaseEntity {
  @Column({ name: "person_id", type: "uuid", nullable: true })
  personId!: string | null;

  @ManyToOne(() => Person, { nullable: true })
  @JoinColumn({ name: "person_id" })
  person!: Person | null;

  @Column({ name: "email", type: "varchar", nullable: true, unique: true })
  email!: string | null;

  @Column({ name: "password_hash", type: "varchar", nullable: true })
  passwordHash!: string | null;

  @Column({ name: "role", type: "varchar" })
  role!: UserRole;

  @Column({ name: "is_active", type: "boolean", default: true })
  isActive!: boolean;

  @Column({ name: "last_login_at", type: "timestamp", nullable: true })
  lastLoginAt!: Date | null;
}
