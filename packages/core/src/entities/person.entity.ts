import { Column, Entity } from "typeorm";
import { SyncableEntity } from "./base.entity.js";

@Entity({ name: "people" })
export class Person extends SyncableEntity {
  @Column({ name: "name", type: "varchar" })
  name!: string;

  @Column({ name: "last_name", type: "varchar", nullable: true })
  lastName!: string | null;

  @Column({ name: "address", type: "varchar", nullable: true })
  address!: string | null;

  @Column({ name: "indicative", type: "varchar", nullable: true })
  indicative!: string | null;

  @Column({ name: "telephone", type: "varchar", nullable: true })
  telephone!: string | null;

  @Column({ name: "phone", type: "varchar", nullable: true })
  phone!: string | null;

  @Column({ name: "avantel_phone", type: "varchar", nullable: true })
  avantelPhone!: string | null;

  @Column({ name: "email", type: "varchar", nullable: true })
  email!: string | null;
}
