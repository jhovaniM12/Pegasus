import { createHash } from "node:crypto";
import {
  Category,
  Fair,
  FairEntry,
  FairStaff,
  FairResult,
  getDataSource,
  Horse,
  Person,
  Role,
  SyncBatch,
  SyncError,
  SyncMapping,
  type SyncBatchStatus
} from "@pegasus/core";
import { In, type DataSource, type EntityManager } from "typeorm";
import { BadRequestError, ForbiddenError, NotFoundError } from "../lib/errors.js";
import type { PaginationQuery } from "../lib/pagination.js";

const SOURCE_SYSTEM = "FEDEQUINAS";
const MAX_CSV_SIZE_BYTES = 10 * 1024 * 1024;
const SUPPORTED_ENTITIES = new Set(["people", "horses", "fair_staff", "fair_entries"]);
const SYNC_CLEANUP_TABLES = [
  "judging_round_entry_reminder_history",
  "judging_round_entry_reminders",
  "judging_round_form_deserted_positions",
  "judging_round_entries",
  "judging_round_results",
  "judging_round_deserted_results",
  "tie_break_tests",
  "judging_round_forms",
  "judging_rounds",
  "fa_consolidated_results",
  "fa_judge_entry_decisions",
  "fa_judge_forms",
  "judging_participants",
  "veterinary_checks",
  "fair_category_stages",
  "notification_outbox",
  "fair_results",
  "fair_entries",
  "horses",
  "sync_errors",
  "sync_mappings",
  "sync_batches"
] as const;
const FILTERED_SYNC_CLEANUP_TABLES = ["fair_staff", "people"] as const;
const PRESERVED_CATALOG_TABLES = [
  "cities",
  "roles",
  "grades",
  "sexes",
  "gaits",
  "equine_types",
  "titles",
  "groupings",
  "categories"
] as const;

type CsvRow = Record<string, string>;

export type SyncRunFile = {
  name: string;
  type: string;
  size: number;
  buffer: Buffer;
};

export type SyncSummary = {
  entityName: string;
  lastBatch: SyncBatch | null;
};

type SyncCounters = {
  totalRows: number;
  insertedRows: number;
  updatedRows: number;
  skippedRows: number;
  failedRows: number;
};

type NormalizedRecord = {
  externalId: string;
  rowHashPayload: Record<string, string | number | boolean | null>;
  entityValues: Record<string, unknown>;
};

type RowSyncContext = {
  manager: EntityManager;
  batch: SyncBatch;
  seenExternalIds: Set<string>;
};

function clean(value: string | undefined | null): string | null {
  const trimmed = value?.trim();

  return trimmed ? trimmed : null;
}

function requireValue(row: CsvRow, key: string, label = key): string {
  const value = clean(row[key]);

  if (!value) {
    throw new RowValidationError("REQUIRED_FIELD", `${label} es obligatorio.`);
  }

  return value;
}

function normalizeHeaderKey(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9]/g, "")
    .toUpperCase();
}

function readAliasedValue(row: CsvRow, aliases: string[]): string | null {
  const normalizedAliases = new Set(aliases.map(normalizeHeaderKey));

  for (const [key, value] of Object.entries(row)) {
    if (normalizedAliases.has(normalizeHeaderKey(key))) {
      return clean(value);
    }
  }

  return null;
}

function requireAliasedValue(row: CsvRow, aliases: string[], label: string): string {
  const value = readAliasedValue(row, aliases);

  if (!value) {
    throw new RowValidationError("REQUIRED_FIELD", `${label} es obligatorio.`);
  }

  return value;
}

function splitFullName(fullName: string | null): { name: string | null; lastName: string | null } {
  if (!fullName) {
    return { name: null, lastName: null };
  }

  const parts = fullName.split(/\s+/).filter(Boolean);

  if (parts.length <= 1) {
    return { name: fullName, lastName: "" };
  }

  const splitIndex = Math.ceil(parts.length / 2);

  return {
    name: parts.slice(0, splitIndex).join(" "),
    lastName: parts.slice(splitIndex).join(" ")
  };
}

function parseBooleanFlag(value: string): boolean {
  return value.trim() === "1";
}

function parseInteger(value: string, fieldName: string): number {
  const parsed = Number.parseInt(value.trim(), 10);

  if (!Number.isFinite(parsed)) {
    throw new RowValidationError("INVALID_NUMBER", `${fieldName} debe ser numérico.`);
  }

  return parsed;
}

function normalizeDate(value: string | null): string | null {
  if (!value) return null;

  return value.slice(0, 10);
}

function hashString(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

function hashBuffer(value: Buffer): string {
  return createHash("sha256").update(value).digest("hex");
}

function stableJson(value: Record<string, unknown>): string {
  const ordered: Record<string, unknown> = {};

  for (const key of Object.keys(value).sort()) {
    ordered[key] = value[key];
  }

  return JSON.stringify(ordered);
}

function readCsvText(buffer: Buffer): string {
  const utf8 = buffer.toString("utf8");

  if (!utf8.includes("\uFFFD")) {
    return utf8.replace(/^\uFEFF/, "");
  }

  return buffer.toString("latin1").replace(/^\uFEFF/, "");
}

function splitCsvLine(line: string, delimiter: string): string[] {
  const values: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];
    const nextChar = line[index + 1];

    if (char === '"' && inQuotes && nextChar === '"') {
      current += '"';
      index += 1;
      continue;
    }

    if (char === '"') {
      inQuotes = !inQuotes;
      continue;
    }

    if (char === delimiter && !inQuotes) {
      values.push(current);
      current = "";
      continue;
    }

    current += char;
  }

  values.push(current);
  return values.map((value) => value.trim());
}

function splitCsvRecords(text: string): string[] {
  const records: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    const nextChar = text[index + 1];

    if (char === '"' && inQuotes && nextChar === '"') {
      current += char + nextChar;
      index += 1;
      continue;
    }

    if (char === '"') {
      inQuotes = !inQuotes;
      current += char;
      continue;
    }

    if ((char === "\n" || char === "\r") && !inQuotes) {
      if (char === "\r" && nextChar === "\n") {
        index += 1;
      }
      records.push(current);
      current = "";
      continue;
    }

    current += char;
  }

  if (current.length > 0) {
    records.push(current);
  }

  return records.filter((record) => record.trim().length > 0);
}

function detectDelimiter(headerRecord: string): string {
  const commaCount = splitCsvLine(headerRecord, ",").length;
  const semicolonCount = splitCsvLine(headerRecord, ";").length;

  return semicolonCount > commaCount ? ";" : ",";
}

function parseCsv(buffer: Buffer): CsvRow[] {
  const records = splitCsvRecords(readCsvText(buffer));

  if (records.length < 2) {
    throw new BadRequestError("El CSV debe incluir encabezados y al menos una fila.");
  }

  const delimiter = detectDelimiter(records[0]);
  const headers = splitCsvLine(records[0], delimiter).map((header) => header.trim());

  if (headers.some((header) => !header)) {
    throw new BadRequestError("El CSV contiene encabezados vacíos.");
  }

  return records.slice(1).map((record) => {
    const values = splitCsvLine(record, delimiter);
    const row: CsvRow = {};

    headers.forEach((header, index) => {
      row[header] = values[index] ?? "";
    });

    return row;
  });
}

function assertAllowedEntity(entityName: string): void {
  if (!SUPPORTED_ENTITIES.has(entityName)) {
    throw new BadRequestError(`Entidad de sincronización no soportada: ${entityName}.`);
  }
}

function validateRunFile(file: SyncRunFile): void {
  const fileName = file.name.trim();

  if (!fileName.toLowerCase().endsWith(".csv")) {
    throw new BadRequestError("El archivo debe tener extensión .csv.");
  }

  if (file.size <= 0) {
    throw new BadRequestError("El archivo CSV está vacío.");
  }

  if (file.size > MAX_CSV_SIZE_BYTES) {
    throw new BadRequestError("El archivo CSV supera el tamaño máximo permitido de 10 MB.");
  }

  if (file.type && !["text/csv", "application/csv", "application/vnd.ms-excel"].includes(file.type)) {
    throw new BadRequestError("El tipo MIME del archivo no es compatible con CSV.");
  }
}

class RowValidationError extends Error {
  constructor(
    readonly code: string,
    message: string
  ) {
    super(message);
    this.name = "RowValidationError";
  }
}

function duplicateGuard(context: RowSyncContext, externalId: string): void {
  if (context.seenExternalIds.has(externalId)) {
    throw new RowValidationError(
      "DUPLICATE_EXTERNAL_ID",
      `external_id duplicado en el CSV: ${externalId}.`
    );
  }

  context.seenExternalIds.add(externalId);
}

async function normalizeHorseRow(row: CsvRow, context: RowSyncContext): Promise<NormalizedRecord> {
  const registrationNumber = requireValue(row, "NUMERO_REGISTRO");
  duplicateGuard(context, registrationNumber);

  if (Object.hasOwn(row, "NOMBRE_EJEMPLAR") && !clean(row.NOMBRE_EJEMPLAR)) {
    throw new RowValidationError(
      "REQUIRED_FIELD",
      "NOMBRE_EJEMPLAR viene en el archivo pero está vacío."
    );
  }

  const payload = {
    externalId: registrationNumber,
    sourceSystem: SOURCE_SYSTEM,
    name: clean(row.NOMBRE_EJEMPLAR),
    registrationNumber,
    birthDate: normalizeDate(clean(row.FECHA_NACIMIENTO)),
    colorCode: clean(row.CODIGO_COLOR),
    microchipNumber: clean(row.NUMERO_MICROCHIP),
    associationCode: clean(row.CODIGO_ASOCIACION),
    birthCityCode: clean(row.CODIGO_CIUDAD_NACIMIENTO),
    fatherRegistrationNumber: clean(row.NUMERO_REGISTRO_PADRE),
    motherRegistrationNumber: clean(row.NUMERO_REGISTRO_MADRE)
  };

  return {
    externalId: registrationNumber,
    rowHashPayload: payload,
    entityValues: payload
  };
}

async function normalizePersonRow(row: CsvRow, context: RowSyncContext): Promise<NormalizedRecord> {
  const externalId = requireAliasedValue(
    row,
    ["NUMERO_DOCUMENTO", "ID_PERSONAL", "DOCUMENTO", "CEDULA", "IDENTIFICACION"],
    "NUMERO_DOCUMENTO"
  );
  duplicateGuard(context, externalId);

  const fullName = readAliasedValue(row, [
    "NOMBRE_COMPLETO",
    "NOMBRE_PERSONA",
    "PERSONA",
    "NOMBRE_Y_APELLIDOS"
  ]);
  const derivedName = splitFullName(fullName);
  const name =
    readAliasedValue(row, ["NOMBRE", "NOMBRES", "PRIMER_NOMBRE", "NAME"]) ??
    derivedName.name ??
    externalId;
  const lastName =
    readAliasedValue(row, ["APELLIDO", "APELLIDOS", "PRIMER_APELLIDO", "LAST_NAME"]) ??
    derivedName.lastName ??
    "";
  const payload = {
    externalId,
    sourceSystem: SOURCE_SYSTEM,
    name,
    lastName,
    address: readAliasedValue(row, ["DIRECCION", "DIRECCIÓN", "ADDRESS"]),
    indicative: readAliasedValue(row, ["INDICATIVO"]),
    telephone: readAliasedValue(row, ["TELEFONO", "TELÉFONO"]),
    phone: readAliasedValue(row, ["CELULAR", "TELEFONO_CELULAR", "MOVIL", "MÓVIL"]),
    avantelPhone: readAliasedValue(row, ["AVANTEL"]),
    email: readAliasedValue(row, ["EMAIL", "CORREO", "CORREO_ELECTRONICO", "CORREO_ELECTRÓNICO"])
  };

  return {
    externalId,
    rowHashPayload: payload,
    entityValues: payload
  };
}

async function resolveLookupId(
  manager: EntityManager,
  entity: typeof Fair | typeof Category | typeof Role,
  externalId: string,
  label: string
): Promise<string> {
  const row = await manager.getRepository(entity).findOne({
    where: { externalId, sourceSystem: SOURCE_SYSTEM },
    select: { id: true }
  });

  if (!row) {
    throw new RowValidationError(
      "LOOKUP_NOT_FOUND",
      `No se encontró ${label} con external_id="${externalId}".`
    );
  }

  return row.id;
}

async function resolvePersonId(manager: EntityManager, externalId: string): Promise<string> {
  const person = await manager.getRepository(Person).findOne({
    where: { externalId, sourceSystem: SOURCE_SYSTEM },
    select: { id: true }
  });

  if (!person) {
    throw new RowValidationError(
      "LOOKUP_NOT_FOUND",
      `No se encontró persona con external_id="${externalId}".`
    );
  }

  return person.id;
}

async function normalizeFairStaffRow(
  row: CsvRow,
  context: RowSyncContext
): Promise<NormalizedRecord> {
  const fairExternalId = requireAliasedValue(row, ["ID_FERIA", "CODIGO_FERIA"], "ID_FERIA");
  const personExternalId = requireAliasedValue(
    row,
    ["ID_PERSONAL", "NUMERO_DOCUMENTO", "DOCUMENTO", "CEDULA", "ID_PERSONA"],
    "ID_PERSONAL o NUMERO_DOCUMENTO"
  );
  const roleExternalId = requireAliasedValue(
    row,
    ["CODIGO_ROL", "ID_ROL", "ROL", "CODIGO_CARGO"],
    "CODIGO_ROL"
  );
  const externalId =
    readAliasedValue(row, [
      "ID_PERSONAL_FERIA",
      "CODIGO_PERSONAL_FERIA",
      "ID_STAFF",
      "ID",
      "ID_REGISTRO",
      "ID_PERSONAL_FERIA_ROL"
    ]) ?? `${fairExternalId}:${personExternalId}:${roleExternalId}`;
  duplicateGuard(context, externalId);

  const payload = {
    externalId,
    sourceSystem: SOURCE_SYSTEM,
    fairId: await resolveLookupId(context.manager, Fair, fairExternalId, "feria"),
    personId: await resolvePersonId(context.manager, personExternalId),
    roleId: await resolveLookupId(context.manager, Role, roleExternalId, "rol")
  };

  return {
    externalId,
    rowHashPayload: {
      ...payload,
      fairExternalId,
      personExternalId,
      roleExternalId
    },
    entityValues: payload
  };
}

async function normalizeFairEntryRow(
  row: CsvRow,
  context: RowSyncContext
): Promise<NormalizedRecord> {
  const inscriptionNumber = requireValue(row, "NUMERO_INSCRIPCION");
  duplicateGuard(context, inscriptionNumber);

  const fairExternalId = requireValue(row, "ID_FERIA");
  const categoryExternalId = requireValue(row, "CODIGO_CATEGORIA");
  const registrationNumber = requireValue(row, "NUMERO_REGISTRO");
  const horse = await context.manager.getRepository(Horse).findOne({
    where: { registrationNumber },
    select: { id: true }
  });

  if (!horse) {
    throw new RowValidationError(
      "HORSE_NOT_FOUND",
      `No se encontró ejemplar con NUMERO_REGISTRO="${registrationNumber}".`
    );
  }

  const payload = {
    externalId: inscriptionNumber,
    sourceSystem: SOURCE_SYSTEM,
    fairId: await resolveLookupId(context.manager, Fair, fairExternalId, "feria"),
    registrationNumber,
    horseId: horse.id,
    categoryId: await resolveLookupId(context.manager, Category, categoryExternalId, "categoría"),
    trackPosition: parseInteger(requireValue(row, "POSICION_PISTA"), "POSICION_PISTA"),
    riderName: requireValue(row, "MONTADOR"),
    riderDocumentNumber: requireValue(row, "ID_MONTADOR"),
    receipt: requireValue(row, "RECIBO"),
    participate: parseBooleanFlag(requireValue(row, "PARTICIPA")),
    fairSequence: parseInteger(requireValue(row, "CONSECUTIVO_FERIA"), "CONSECUTIVO_FERIA"),
    isChild: parseBooleanFlag(requireValue(row, "ES_HIJO"))
  };

  return {
    externalId: inscriptionNumber,
    rowHashPayload: payload,
    entityValues: payload
  };
}

async function normalizeRow(
  entityName: string,
  row: CsvRow,
  context: RowSyncContext
): Promise<NormalizedRecord> {
  if (entityName === "people") {
    return normalizePersonRow(row, context);
  }

  if (entityName === "horses") {
    return normalizeHorseRow(row, context);
  }

  if (entityName === "fair_staff") {
    return normalizeFairStaffRow(row, context);
  }

  return normalizeFairEntryRow(row, context);
}

function readRowExternalId(entityName: string, row: CsvRow): string | null {
  if (entityName === "people") {
    return readAliasedValue(row, [
      "NUMERO_DOCUMENTO",
      "ID_PERSONAL",
      "DOCUMENTO",
      "CEDULA",
      "IDENTIFICACION"
    ]);
  }

  if (entityName === "fair_staff") {
    const explicitId = readAliasedValue(row, [
      "ID_PERSONAL_FERIA",
      "CODIGO_PERSONAL_FERIA",
      "ID_STAFF",
      "ID",
      "ID_REGISTRO",
      "ID_PERSONAL_FERIA_ROL"
    ]);

    if (explicitId) {
      return explicitId;
    }

    const fairExternalId = readAliasedValue(row, ["ID_FERIA", "CODIGO_FERIA"]);
    const personExternalId = readAliasedValue(row, [
      "ID_PERSONAL",
      "NUMERO_DOCUMENTO",
      "DOCUMENTO",
      "CEDULA",
      "ID_PERSONA"
    ]);
    const roleExternalId = readAliasedValue(row, [
      "CODIGO_ROL",
      "ID_ROL",
      "ROL",
      "CODIGO_CARGO"
    ]);

    return fairExternalId && personExternalId && roleExternalId
      ? `${fairExternalId}:${personExternalId}:${roleExternalId}`
      : null;
  }

  if (entityName === "horses") {
    return clean(row.NUMERO_REGISTRO);
  }

  return clean(row.NUMERO_INSCRIPCION);
}

async function writeSyncError(
  manager: EntityManager,
  batch: SyncBatch,
  entityName: string,
  rowNumber: number,
  row: CsvRow,
  error: unknown
): Promise<void> {
  const externalId = readRowExternalId(entityName, row);
  const syncError = manager.getRepository(SyncError).create({
    batchId: batch.id,
    entityName,
    rowNumber,
    externalId,
    errorCode: error instanceof RowValidationError ? error.code : "ROW_ERROR",
    errorMessage: error instanceof Error ? error.message : "Error desconocido al procesar fila.",
    rawRow: row
  });

  await manager.getRepository(SyncError).save(syncError);
}

async function insertTargetEntity(
  manager: EntityManager,
  entityName: string,
  values: Record<string, unknown>
): Promise<{ id: string }> {
  if (entityName === "people") {
    return manager.getRepository(Person).save(manager.getRepository(Person).create(values));
  }

  if (entityName === "horses") {
    return manager.getRepository(Horse).save(manager.getRepository(Horse).create(values));
  }

  if (entityName === "fair_staff") {
    return manager.getRepository(FairStaff).save(manager.getRepository(FairStaff).create(values));
  }

  return manager.getRepository(FairEntry).save(manager.getRepository(FairEntry).create(values));
}

async function updateTargetEntity(
  manager: EntityManager,
  entityName: string,
  id: string,
  values: Record<string, unknown>
): Promise<void> {
  if (entityName === "people") {
    await manager.getRepository(Person).update(id, values);
    return;
  }

  if (entityName === "horses") {
    await manager.getRepository(Horse).update(id, values);
    return;
  }

  if (entityName === "fair_staff") {
    await manager.getRepository(FairStaff).update(id, values);
    return;
  }

  await manager.getRepository(FairEntry).update(id, values);
}

async function findExistingTargetEntity(
  manager: EntityManager,
  entityName: string,
  externalId: string
): Promise<{ id: string } | null> {
  const where = { externalId, sourceSystem: SOURCE_SYSTEM };

  if (entityName === "people") {
    return manager.getRepository(Person).findOne({ where, select: { id: true } });
  }

  if (entityName === "horses") {
    return manager.getRepository(Horse).findOne({ where, select: { id: true } });
  }

  if (entityName === "fair_staff") {
    return manager.getRepository(FairStaff).findOne({ where, select: { id: true } });
  }

  return manager.getRepository(FairEntry).findOne({ where, select: { id: true } });
}

async function upsertRow(
  manager: EntityManager,
  entityName: string,
  normalized: NormalizedRecord,
  batch: SyncBatch
): Promise<"inserted" | "updated" | "skipped"> {
  const mappingRepo = manager.getRepository(SyncMapping);
  const mapping = await mappingRepo.findOne({
    where: {
      sourceSystem: SOURCE_SYSTEM,
      entityName,
      externalId: normalized.externalId
    }
  });
  const rowHash = hashString(stableJson(normalized.rowHashPayload));

  if (mapping?.rowHash === rowHash) {
    mapping.lastSeenBatchId = batch.id;
    await mappingRepo.save(mapping);
    return "skipped";
  }

  if (!mapping) {
    const existing = await findExistingTargetEntity(manager, entityName, normalized.externalId);
    const saved = existing ?? await insertTargetEntity(manager, entityName, normalized.entityValues);

    if (existing) {
      await updateTargetEntity(manager, entityName, existing.id, normalized.entityValues);
    }

    await mappingRepo.save(
      mappingRepo.create({
        sourceSystem: SOURCE_SYSTEM,
        entityName,
        externalId: normalized.externalId,
        internalId: saved.id,
        rowHash,
        lastSeenBatchId: batch.id
      })
    );

    return existing ? "updated" : "inserted";
  }

  await updateTargetEntity(manager, entityName, mapping.internalId, normalized.entityValues);
  mapping.rowHash = rowHash;
  mapping.lastSeenBatchId = batch.id;
  await mappingRepo.save(mapping);

  return "updated";
}

export async function syncEntityFromCsv(
  entityName: string,
  file: SyncRunFile,
  createdBy: string
): Promise<SyncBatch> {
  assertAllowedEntity(entityName);
  validateRunFile(file);

  const dataSource = await getDataSource();
  const batchRepo = dataSource.getRepository(SyncBatch);
  const batch = await batchRepo.save(
    batchRepo.create({
      sourceSystem: SOURCE_SYSTEM,
      entityName,
      fileName: file.name,
      fileSize: file.size,
      fileChecksum: hashBuffer(file.buffer),
      status: "PROCESSING",
      startedAt: new Date(),
      finishedAt: null,
      errorMessage: null,
      createdBy
    })
  );

  try {
    const rows = parseCsv(file.buffer);
    const counters: SyncCounters = {
      totalRows: rows.length,
      insertedRows: 0,
      updatedRows: 0,
      skippedRows: 0,
      failedRows: 0
    };

    await dataSource.transaction(async (manager) => {
      const context: RowSyncContext = {
        manager,
        batch,
        seenExternalIds: new Set()
      };

      for (const [index, row] of rows.entries()) {
        try {
          const normalized = await normalizeRow(entityName, row, context);
          const result = await upsertRow(manager, entityName, normalized, batch);

          if (result === "inserted") counters.insertedRows += 1;
          if (result === "updated") counters.updatedRows += 1;
          if (result === "skipped") counters.skippedRows += 1;
        } catch (error) {
          counters.failedRows += 1;
          await writeSyncError(manager, batch, entityName, index + 2, row, error);
        }
      }
    });

    batch.totalRows = counters.totalRows;
    batch.insertedRows = counters.insertedRows;
    batch.updatedRows = counters.updatedRows;
    batch.skippedRows = counters.skippedRows;
    batch.failedRows = counters.failedRows;
    batch.status = counters.failedRows > 0 ? "COMPLETED_WITH_ERRORS" : "COMPLETED";
    batch.finishedAt = new Date();

    return batchRepo.save(batch);
  } catch (error) {
    batch.status = "FAILED";
    batch.finishedAt = new Date();
    batch.errorMessage = error instanceof Error ? error.message : "Error desconocido.";
    await batchRepo.save(batch);
    throw error;
  }
}

export async function listSyncBatches(
  pagination: PaginationQuery,
  filters: { entityName?: string; status?: SyncBatchStatus }
) {
  const dataSource = await getDataSource();
  const where = {
    ...(filters.entityName ? { entityName: filters.entityName } : {}),
    ...(filters.status ? { status: filters.status } : {})
  };

  const [items, total] = await dataSource.getRepository(SyncBatch).findAndCount({
    where,
    order: { startedAt: "DESC" },
    skip: (pagination.page - 1) * pagination.limit,
    take: pagination.limit
  });

  return { items, total };
}

export async function listSyncSummaries(): Promise<SyncSummary[]> {
  const dataSource = await getDataSource();

  return Promise.all(
    Array.from(SUPPORTED_ENTITIES).map(async (entityName) => ({
      entityName,
      lastBatch: await dataSource.getRepository(SyncBatch).findOne({
        where: { entityName, sourceSystem: SOURCE_SYSTEM },
        order: { startedAt: "DESC" }
      })
    }))
  );
}

export async function getSyncBatchById(id: string): Promise<SyncBatch> {
  const dataSource = await getDataSource();
  const batch = await dataSource.getRepository(SyncBatch).findOne({ where: { id } });

  if (!batch) {
    throw new NotFoundError("Lote de sincronización no encontrado.");
  }

  return batch;
}

export async function listSyncErrors(batchId: string, pagination: PaginationQuery) {
  const dataSource = await getDataSource();
  const [items, total] = await dataSource.getRepository(SyncError).findAndCount({
    where: { batchId },
    order: { rowNumber: "ASC" },
    skip: (pagination.page - 1) * pagination.limit,
    take: pagination.limit
  });

  return { items, total };
}

function isProductionEnvironment(): boolean {
  return (
    process.env.NODE_ENV === "production" ||
    process.env.VERCEL_ENV === "production" ||
    process.env.APP_ENV === "production"
  );
}

export type SyncCleanupResult = {
  ok: true;
  cleanedTables: string[];
  preservedCatalogTables: string[];
};

export async function cleanupDevelopmentSyncData(createdBy: string): Promise<SyncCleanupResult> {
  if (isProductionEnvironment()) {
    throw new ForbiddenError("La limpieza de desarrollo no está disponible en producción.");
  }

  const dataSource = await getDataSource();
  const environment = {
    nodeEnv: process.env.NODE_ENV ?? null,
    vercelEnv: process.env.VERCEL_ENV ?? null,
    appEnv: process.env.APP_ENV ?? null
  };

  await dataSource.transaction(async (manager) => {
    const tablesSql = SYNC_CLEANUP_TABLES.map((table) => `"${table}"`).join(",\n      ");

    await manager.query(`TRUNCATE TABLE
      ${tablesSql}
      RESTART IDENTITY CASCADE`);
    await manager.getRepository(FairStaff).delete({ sourceSystem: SOURCE_SYSTEM });
    await manager.query(
      `
        DELETE FROM "people" "person"
        WHERE "person"."source_system" = $1
          AND NOT EXISTS (
            SELECT 1
            FROM "users" "user"
            WHERE "user"."person_id" = "person"."id"
          )
          AND NOT EXISTS (
            SELECT 1
            FROM "fair_staff" "staff"
            WHERE "staff"."person_id" = "person"."id"
          )
      `,
      [SOURCE_SYSTEM]
    );
  });

  console.info("Sync development cleanup executed", {
    createdBy,
    executedAt: new Date().toISOString(),
    environment,
    cleanedTables: [...SYNC_CLEANUP_TABLES, ...FILTERED_SYNC_CLEANUP_TABLES],
    preservedCatalogTables: PRESERVED_CATALOG_TABLES
  });

  return {
    ok: true,
    cleanedTables: [...SYNC_CLEANUP_TABLES, ...FILTERED_SYNC_CLEANUP_TABLES],
    preservedCatalogTables: [...PRESERVED_CATALOG_TABLES]
  };
}
