import "reflect-metadata";
import { DataSource } from "typeorm";
import {
  Category,
  City,
  EquineType,
  Fair,
  FairEntry,
  FairResult,
  FairStaff,
  DisqualificationReason,
  FaConsolidatedResult,
  FaJudgeEntryDecision,
  FaJudgeForm,
  FairCategoryStage,
  Gait,
  Grade,
  Grouping,
  JudgingParticipant,
  JudgingRound,
  JudgingRoundForm,
  JudgingRoundFormDesertedPosition,
  JudgingRoundEntry,
  JudgingRoundResult,
  JudgingRoundDesertedResult,
  TieBreakTest,
  NotificationOutbox,
  Person,
  Role,
  Sex,
  Title,
  User,
  VeterinaryCheck,
  WorkflowEvent
} from "../entities/index.js";
import { CreateInitialSchema1717430400000 } from "../migrations/1717430400000-CreateInitialSchema.js";
import { ExpandGradesNomenclature1717430400001 } from "../migrations/1717430400001-ExpandGradesNomenclature.js";
import { DropFairsStatusColumn1717430400002 } from "../migrations/1717430400002-DropFairsStatusColumn.js";
import { AddFairsRegisteredCount1717430400003 } from "../migrations/1717430400003-AddFairsRegisteredCount.js";
import { CreateFairEntriesTable1717430400004 } from "../migrations/1717430400004-CreateFairEntriesTable.js";
import { AddCategoryAgeCheck1717430400005 } from "../migrations/1717430400005-AddCategoryAgeCheck.js";
import { AlterPeopleTable1717430400006 } from "../migrations/1717430400006-AlterPeopleTable.js";
import { CreateFairStaffTable1717430400007 } from "../migrations/1717430400007-CreateFairStaffTable.js";
import { CreateFairResultsTable1717430400008 } from "../migrations/1717430400008-CreateFairResultsTable.js";
import { AlterFairResultsUniqueConstraint1717430400009 } from "../migrations/1717430400009-AlterFairResultsUniqueConstraint.js";
import { CreateUsersTable1717430400010 } from "../migrations/1717430400010-CreateUsersTable.js";
import { AddUserAccessCode1717430400011 } from "../migrations/1717430400011-AddUserAccessCode.js";
import { CreateStagedFlowTables1717430400012 } from "../migrations/1717430400012-CreateStagedFlowTables.js";
import { AddNotificationInboxFields1717430400013 } from "../migrations/1717430400013-AddNotificationInboxFields.js";
import { CreateJudgingRoundsTables1717430400014 } from "../migrations/1717430400014-CreateJudgingRoundsTables.js";
import { AddDesertedSupport1717430400015 } from "../migrations/1717430400015-AddDesertedSupport.js";
import { loadLocalEnv } from "../shared/load-env.js";

loadLocalEnv();

const databaseUrl = process.env.DATABASE_URL;

export const AppDataSource = new DataSource({
  type: "postgres",
  url: databaseUrl,
  host: databaseUrl ? undefined : process.env.DB_HOST ?? "localhost",
  port: databaseUrl ? undefined : Number(process.env.DB_PORT ?? 5432),
  username: databaseUrl ? undefined : process.env.DB_USERNAME ?? "postgres",
  password: databaseUrl ? undefined : process.env.DB_PASSWORD ?? "postgres",
  database: databaseUrl ? undefined : process.env.DB_NAME ?? "pegasus",
  synchronize: false,
  logging: process.env.TYPEORM_LOGGING === "true",
  // Pool de conexiones explícito: mantiene conexiones calientes y limita
  // el tiempo de espera para adquirir una conexión libre.
  extra: {
    max: 5,
    min: 1,
    idleTimeoutMillis: 30_000,
    connectionTimeoutMillis: 5_000,
  },
  entities: [
    Category,
    City,
    EquineType,
    Fair,
    FairEntry,
    FairResult,
    FairStaff,
    DisqualificationReason,
    FaConsolidatedResult,
    FaJudgeEntryDecision,
    FaJudgeForm,
    FairCategoryStage,
    Gait,
    Grade,
    Grouping,
    JudgingParticipant,
    JudgingRound,
    JudgingRoundForm,
    JudgingRoundFormDesertedPosition,
    JudgingRoundEntry,
    JudgingRoundResult,
    JudgingRoundDesertedResult,
    TieBreakTest,
    NotificationOutbox,
    Person,
    Role,
    Sex,
    Title,
    User,
    VeterinaryCheck,
    WorkflowEvent
  ],
  migrations: [
    CreateInitialSchema1717430400000,
    ExpandGradesNomenclature1717430400001,
    DropFairsStatusColumn1717430400002,
    AddFairsRegisteredCount1717430400003,
    CreateFairEntriesTable1717430400004,
    AddCategoryAgeCheck1717430400005,
    AlterPeopleTable1717430400006,
    CreateFairStaffTable1717430400007,
    CreateFairResultsTable1717430400008,
    AlterFairResultsUniqueConstraint1717430400009,
    CreateUsersTable1717430400010,
    AddUserAccessCode1717430400011,
    CreateStagedFlowTables1717430400012,
    AddNotificationInboxFields1717430400013,
    CreateJudgingRoundsTables1717430400014,
    AddDesertedSupport1717430400015
  ]
});

export async function getDataSource(): Promise<DataSource> {
  if (!AppDataSource.isInitialized) {
    await AppDataSource.initialize();
  }

  return AppDataSource;
}
