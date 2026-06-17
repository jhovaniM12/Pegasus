import "reflect-metadata";
import { DataSource } from "typeorm";
import {
  Category,
  City,
  EquineType,
  Fair,
  AwardDistinctive,
  JudgingReminder,
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
  JudgingRoundEntryReminder,
  JudgingRoundEntryReminderHistory,
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
import {
  AddDesertedSupport1717430400015,
  AddFairsRegisteredCount1717430400003,
  AddNotificationInboxFields1717430400013,
  AddUserAccessCode1717430400011,
  AlterFairResultsUniqueConstraint1717430400009,
  AlterPeopleTable1717430400006,
  CreateAwardDistinctives1717430400016,
  CreateJudgingReminders1717430400017,
  AddRoundEntryAnnotations1717430400018,
  AddRoundDisqualificationTraceability1717430400019,
  CreateFairEntriesTable1717430400004,
  CreateFairResultsTable1717430400008,
  CreateFairStaffTable1717430400007,
  CreateInitialSchema1717430400000,
  CreateJudgingRoundsTables1717430400014,
  CreateStagedFlowTables1717430400012,
  CreateUsersTable1717430400010,
  DropFairsStatusColumn1717430400002,
  ExpandGradesNomenclature1717430400001,
  AddCategoryAgeCheck1717430400005
} from "../migrations/index.js";
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
    AwardDistinctive,
    JudgingReminder,
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
    JudgingRoundEntryReminder,
    JudgingRoundEntryReminderHistory,
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
    AddDesertedSupport1717430400015,
    CreateAwardDistinctives1717430400016,
    CreateJudgingReminders1717430400017,
    AddRoundEntryAnnotations1717430400018,
    AddRoundDisqualificationTraceability1717430400019
  ]
});

export async function getDataSource(): Promise<DataSource> {
  if (!AppDataSource.isInitialized) {
    await AppDataSource.initialize();
  }

  return AppDataSource;
}
