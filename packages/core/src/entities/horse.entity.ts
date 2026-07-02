import { Column, Entity, OneToMany, Unique } from "typeorm";
import { SyncableEntity } from "./base.entity.js";
import { FairEntry } from "./fair-entries.js";

@Entity({ name: "horses" })
@Unique("UQ_horses_registration_number", ["registrationNumber"])
export class Horse extends SyncableEntity {
  @Column({ name: "name", type: "varchar", nullable: true })
  name!: string | null;

  @Column({ name: "registration_number", type: "varchar" })
  registrationNumber!: string;

  @Column({ name: "birth_date", type: "date", nullable: true })
  birthDate!: string | null;

  @Column({ name: "color_code", type: "varchar", nullable: true })
  colorCode!: string | null;

  @Column({ name: "microchip_number", type: "varchar", nullable: true })
  microchipNumber!: string | null;

  @Column({ name: "association_code", type: "varchar", nullable: true })
  associationCode!: string | null;

  @Column({ name: "birth_city_code", type: "varchar", nullable: true })
  birthCityCode!: string | null;

  @Column({ name: "father_registration_number", type: "varchar", nullable: true })
  fatherRegistrationNumber!: string | null;

  @Column({ name: "mother_registration_number", type: "varchar", nullable: true })
  motherRegistrationNumber!: string | null;

  @OneToMany(() => FairEntry, (fairEntry) => fairEntry.horse)
  fairEntries!: FairEntry[];
}
