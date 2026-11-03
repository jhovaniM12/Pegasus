import {
  Column,
  CreateDateColumn,
  PrimaryGeneratedColumn,
  Unique,
  UpdateDateColumn
} from "typeorm";

export abstract class PegasusBaseEntity {
  @PrimaryGeneratedColumn("uuid")
  id!: string;

  @CreateDateColumn({ name: "created_at", type: "timestamp" })
  createdAt!: Date;

  @UpdateDateColumn({ name: "updated_at", type: "timestamp" })
  updatedAt!: Date;
}

@Unique(["externalId", "sourceSystem"])
export abstract class SyncableEntity extends PegasusBaseEntity {
  @Column({ name: "external_id", type: "varchar", nullable: true })
  externalId!: string | null;

  @Column({ name: "source_system", type: "varchar", nullable: true })
  sourceSystem!: string | null;
}
