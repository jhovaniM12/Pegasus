import { Column, Entity, Unique } from "typeorm";
import { PegasusBaseEntity } from "../../shared/base.entity.js";

@Unique("UQ_judging_reminders_name", ["name"])
@Entity({ name: "judging_reminders" })
export class JudgingReminder extends PegasusBaseEntity {
  @Column({ name: "name", type: "varchar" })
  name!: string;

  @Column({ name: "icon", type: "varchar" })
  icon!: string;

  @Column({ name: "is_active", type: "boolean", default: true })
  isActive!: boolean;
}
