import { Column, Entity, Unique } from "typeorm";
import { PegasusBaseEntity } from "./base.entity.js";

@Unique("UQ_system_settings_key", ["key"])
@Entity({ name: "system_settings" })
export class SystemSetting extends PegasusBaseEntity {
  @Column({ name: "key", type: "varchar" })
  key!: string;

  @Column({ name: "integer_value", type: "integer" })
  integerValue!: number;
}
