import { createHash, createHmac, timingSafeEqual } from "node:crypto";
import {
  Category,
  City,
  Fair,
  FairCategoryStage,
  FairEntry,
  FairStaff,
  getDataSource,
  Grade,
  Horse,
  Person,
  Role,
  SyncBatch,
  SyncError,
  SyncMapping
} from "@pegasus/core";
import type { DataSource, EntityManager, ObjectLiteral, Repository } from "typeorm";
import { BadRequestError } from "../lib/errors.js";
import {
  excelSerialDateToIso,
  FEDEQUINAS_FILE_KINDS,
  parseFedequinasXlsx,
  type FedequinasFileKind,
  type FedequinasRow,
  type FedequinasXlsxFile,
  type ParsedFedequinasWorkbook
} from "./fedequinas-xlsx.service.js";
import {
  hasProtectedFairEntryChanges,
  isImportIdentityLocked,
  type ProtectedFairEntryFields
} from "./fedequinas-import-rules.js";

const SOURCE_SYSTEM = "FEDEQUINAS";
const TOKEN_TTL_MS = 30 * 60 * 1000;

export type FedequinasIssue = {
  severity: "warning" | "error";
  row: number;
  code: string;
  message: string;
};

export type FedequinasCounts = {
  total: number;
  inserts: number;
  updates: number;
  skips: number;
  warnings: number;
  errors: number;
};

export type FedequinasPreview = {
  checksum: string;
  previewToken: string;
  detectedFairExternalId: string;
  headers: string[];
  counts: FedequinasCounts;
  issues: FedequinasIssue[];
};

type PreviewAction = "insert" | "update" | "skip";
type PreparedRow = {
  rowNumber: number;
  values: FedequinasRow;
  externalId: string;
  rowHash: string;
  action: PreviewAction;
  issues: FedequinasIssue[];
};

type Analysis = Omit<FedequinasPreview, "previewToken"> & {
  parsed: ParsedFedequinasWorkbook;
  preparedRows: PreparedRow[];
};

type EntryPreviewCache = {
  fair: Fair | null;
  categoriesByExternalId: Map<string, Category>;
  horsesByRegistration: Map<string, Horse>;
  entriesByExternalId: Map<string, FairEntry>;
  entriesBySequence: Map<number, FairEntry>;
  mappingsByExternalId: Map<string, SyncMapping>;
  lockedCategoryIds: Set<string>;
};

type TokenPayload = {
  checksum: string;
  fileKind: FedequinasFileKind;
  fairExternalId: string;
  expiresAt: number;
};

class FedequinasRowError extends Error {
  constructor(
    readonly code: string,
    message: string
  ) {
    super(message);
    this.name = "FedequinasRowError";
  }
}

function required(row: FedequinasRow, key: string): string {
  const value = row[key]?.trim();
  if (!value) throw new FedequinasRowError("REQUIRED_FIELD", `${key} es obligatorio.`);
  return value;
}

function optional(row: FedequinasRow, key: string): string | null {
  return row[key]?.trim() || null;
}

function integer(value: string, field: string): number {
  if (!/^-?\d+$/.test(value.trim())) {
    throw new FedequinasRowError("INVALID_NUMBER", `${field} debe ser un entero.`);
  }
  return Number.parseInt(value, 10);
}

function stableHash(value: Record<string, unknown>): string {
  const ordered = Object.fromEntries(Object.entries(value).sort(([a], [b]) => a.localeCompare(b)));
  return createHash("sha256").update(JSON.stringify(ordered)).digest("hex");
}

function mappingEntityName(fileKind: FedequinasFileKind): string {
  switch (fileKind) {
    case "FEH_FERIAS":
      return "fairs";
    case "FEH_PERSONAL_FERIA":
      return "fair_staff";
    case "FEH_INSCRIPCIONES_FERIA":
      return "fair_entries";
    case "FEH_INSCRIPCIONES_FERIA_PADRES":
      return "horses";
  }
}

function previousFileKind(fileKind: FedequinasFileKind): FedequinasFileKind | null {
  switch (fileKind) {
    case "FEH_FERIAS":
      return null;
    case "FEH_PERSONAL_FERIA":
      return "FEH_FERIAS";
    case "FEH_INSCRIPCIONES_FERIA":
      return "FEH_PERSONAL_FERIA";
    case "FEH_INSCRIPCIONES_FERIA_PADRES":
      return "FEH_INSCRIPCIONES_FERIA";
  }
}

function tokenSecret(): string {
  const secret = process.env.SESSION_SECRET;
  if (!secret) throw new Error("SESSION_SECRET no está configurado.");
  return secret;
}

function createPreviewToken(payload: TokenPayload): string {
  const encoded = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const signature = createHmac("sha256", tokenSecret()).update(encoded).digest("base64url");
  return `${encoded}.${signature}`;
}

function verifyPreviewToken(token: string, expected: Omit<TokenPayload, "expiresAt">): void {
  const tokenParts = token.split(".");
  if (tokenParts.length !== 2) throw new BadRequestError("previewToken inválido.");
  const [encoded, signature] = tokenParts;
  if (!encoded || !signature) throw new BadRequestError("previewToken inválido.");

  const expectedSignature = createHmac("sha256", tokenSecret()).update(encoded).digest();
  let receivedSignature: Buffer;
  try {
    receivedSignature = Buffer.from(signature, "base64url");
  } catch {
    throw new BadRequestError("previewToken inválido.");
  }
  if (
    receivedSignature.toString("base64url") !== signature ||
    receivedSignature.length !== expectedSignature.length ||
    !timingSafeEqual(receivedSignature, expectedSignature)
  ) {
    throw new BadRequestError("previewToken inválido.");
  }

  let payload: TokenPayload;
  try {
    payload = JSON.parse(Buffer.from(encoded, "base64url").toString("utf8")) as TokenPayload;
  } catch {
    throw new BadRequestError("previewToken inválido.");
  }
  if (payload.expiresAt < Date.now()) throw new BadRequestError("El previewToken expiró.");
  if (
    payload.checksum !== expected.checksum ||
    payload.fileKind !== expected.fileKind ||
    payload.fairExternalId !== expected.fairExternalId
  ) {
    throw new BadRequestError("El archivo no coincide con la vista previa confirmada.");
  }
}

function issue(
  severity: FedequinasIssue["severity"],
  row: number,
  code: string,
  message: string
): FedequinasIssue {
  return { severity, row, code, message };
}

function rowExternalId(fileKind: FedequinasFileKind, row: FedequinasRow): string {
  switch (fileKind) {
    case "FEH_FERIAS":
      return required(row, "ID_FERIA");
    case "FEH_PERSONAL_FERIA":
      return required(row, "ID_PERSONAL_FERIA");
    case "FEH_INSCRIPCIONES_FERIA":
    case "FEH_INSCRIPCIONES_FERIA_PADRES":
      return [
        required(row, "ID_FERIA"),
        required(row, "NUMERO_INSCRIPCION"),
        required(row, "NUMERO_REGISTRO")
      ].join(":");
  }
}

function rowHashPayload(fileKind: FedequinasFileKind, row: FedequinasRow): Record<string, unknown> {
  switch (fileKind) {
    case "FEH_FERIAS":
      return {
        id: required(row, "ID_FERIA"),
        year: integer(required(row, "ANO"), "ANO"),
        name: required(row, "DESCRIPCION"),
        startDate: excelSerialDateToIso(required(row, "FECHA_INICIO")),
        endDate: excelSerialDateToIso(required(row, "FECHA_FIN")),
        city: required(row, "CODIGO_CIUDAD"),
        grade: required(row, "CODIGO_GRADO"),
        comments: optional(row, "OBSERVACIONES"),
        registeredCount: integer(required(row, "INSCRITOS"), "INSCRITOS")
      };
    case "FEH_PERSONAL_FERIA":
      return {
        staffId: required(row, "ID_PERSONAL_FERIA"),
        fairId: required(row, "ID_FERIA"),
        personId: required(row, "ID_PERSONAL"),
        roleId: required(row, "ID_ROL"),
        name: required(row, "NOMBRE")
      };
    case "FEH_INSCRIPCIONES_FERIA":
      return {
        fairId: required(row, "ID_FERIA"),
        inscription: required(row, "NUMERO_INSCRIPCION"),
        registration: required(row, "NUMERO_REGISTRO"),
        category: required(row, "CODIGO_CATEGORIA"),
        position: integer(required(row, "POSICION_PISTA"), "POSICION_PISTA"),
        riderName: required(row, "MONTADOR"),
        riderDocument: optional(row, "ID_MONTADOR"),
        fairSequence: integer(required(row, "CONSECUTIVO_FERIA"), "CONSECUTIVO_FERIA")
      };
    case "FEH_INSCRIPCIONES_FERIA_PADRES":
      return {
        fairId: required(row, "ID_FERIA"),
        inscription: required(row, "NUMERO_INSCRIPCION"),
        registration: required(row, "NUMERO_REGISTRO"),
        horseName: optional(row, "NOMBRE_EJEMPLAR"),
        fatherName: optional(row, "PADRE"),
        motherName: optional(row, "MADRE")
      };
  }
}

async function lookupByExternalId<T extends ObjectLiteral>(
  repository: Repository<T>,
  externalId: string
): Promise<T | null> {
  return repository.findOne({
    where: { externalId, sourceSystem: SOURCE_SYSTEM } as never
  });
}

async function assertPreviousStep(
  dataSource: DataSource,
  fileKind: FedequinasFileKind,
  fairExternalId: string
): Promise<void> {
  const previous = previousFileKind(fileKind);
  if (!previous) return;

  const batch = await dataSource.getRepository(SyncBatch).findOne({
    where: {
      sourceSystem: SOURCE_SYSTEM,
      fileKind: previous,
      fairExternalId,
      status: "COMPLETED"
    },
    order: { startedAt: "DESC" }
  });
  if (!batch) {
    throw new BadRequestError(
      `Debe completar ${previous} para la feria ${fairExternalId} antes de cargar ${fileKind}.`
    );
  }
}

async function targetExists(
  manager: EntityManager,
  fileKind: FedequinasFileKind,
  externalId: string,
  row: FedequinasRow,
  entryCache?: EntryPreviewCache
): Promise<boolean> {
  switch (fileKind) {
    case "FEH_FERIAS":
      return Boolean(await lookupByExternalId(manager.getRepository(Fair), externalId));
    case "FEH_PERSONAL_FERIA":
      return Boolean(await lookupByExternalId(manager.getRepository(FairStaff), externalId));
    case "FEH_INSCRIPCIONES_FERIA": {
      if (entryCache) {
        return Boolean(
          entryCache.entriesByExternalId.get(externalId) ??
            entryCache.entriesBySequence.get(
              integer(required(row, "CONSECUTIVO_FERIA"), "CONSECUTIVO_FERIA")
            )
        );
      }
      const repository = manager.getRepository(FairEntry);
      const exact = await lookupByExternalId(repository, externalId);
      if (exact) return true;
      const fair = await lookupByExternalId(manager.getRepository(Fair), required(row, "ID_FERIA"));
      return Boolean(
        fair &&
          (await repository.findOne({
            where: {
              fairId: fair.id,
              fairSequence: integer(required(row, "CONSECUTIVO_FERIA"), "CONSECUTIVO_FERIA")
            }
          }))
      );
    }
    case "FEH_INSCRIPCIONES_FERIA_PADRES": {
      const registrationNumber = required(row, "NUMERO_REGISTRO");
      if (entryCache) {
        return entryCache.horsesByRegistration.has(registrationNumber);
      }
      return Boolean(
        await manager.getRepository(Horse).findOne({
          where: { registrationNumber }
        })
      );
    }
  }
}

async function validateReferences(
  manager: EntityManager,
  fileKind: FedequinasFileKind,
  rowNumber: number,
  row: FedequinasRow,
  entryCache?: EntryPreviewCache
): Promise<FedequinasIssue[]> {
  const issues: FedequinasIssue[] = [];
  const fairExternalId = required(row, "ID_FERIA");

  switch (fileKind) {
    case "FEH_FERIAS": {
      const city = await lookupByExternalId(manager.getRepository(City), required(row, "CODIGO_CIUDAD"));
      const grade = await lookupByExternalId(
        manager.getRepository(Grade),
        required(row, "CODIGO_GRADO")
      );
      if (!city) issues.push(issue("error", rowNumber, "CITY_NOT_FOUND", "La ciudad no existe."));
      if (!grade) issues.push(issue("error", rowNumber, "GRADE_NOT_FOUND", "El grado no existe."));
      break;
    }
    case "FEH_PERSONAL_FERIA": {
      const fair = await lookupByExternalId(manager.getRepository(Fair), fairExternalId);
      const role = await lookupByExternalId(manager.getRepository(Role), required(row, "ID_ROL"));
      if (!fair) issues.push(issue("error", rowNumber, "FAIR_NOT_FOUND", "La feria no existe."));
      if (!role) issues.push(issue("error", rowNumber, "ROLE_NOT_FOUND", "El rol no existe."));
      break;
    }
    case "FEH_INSCRIPCIONES_FERIA": {
      const fair =
        entryCache?.fair ??
        (await lookupByExternalId(manager.getRepository(Fair), fairExternalId));
      const category =
        entryCache?.categoriesByExternalId.get(required(row, "CODIGO_CATEGORIA")) ??
        (entryCache
          ? null
          : await lookupByExternalId(
              manager.getRepository(Category),
              required(row, "CODIGO_CATEGORIA")
            ));
      if (!fair) issues.push(issue("error", rowNumber, "FAIR_NOT_FOUND", "La feria no existe."));
      if (!category) {
        issues.push(issue("error", rowNumber, "CATEGORY_NOT_FOUND", "La categoría no existe."));
      }
      if (fair && category) {
        const externalId = rowExternalId(fileKind, row);
        const repository = manager.getRepository(FairEntry);
        const exact =
          entryCache?.entriesByExternalId.get(externalId) ??
          (entryCache ? null : await lookupByExternalId(repository, externalId));
        const candidate =
          exact ??
          (entryCache
            ? entryCache.entriesBySequence.get(
                integer(required(row, "CONSECUTIVO_FERIA"), "CONSECUTIVO_FERIA")
              )
            : await repository.findOne({
                where: {
                  fairId: fair.id,
                  fairSequence: integer(required(row, "CONSECUTIVO_FERIA"), "CONSECUTIVO_FERIA")
                }
              }));
        if (candidate) {
          try {
            const next = {
              categoryId: category.id,
              trackPosition: integer(required(row, "POSICION_PISTA"), "POSICION_PISTA"),
              inscriptionNumber: required(row, "NUMERO_INSCRIPCION"),
              registrationNumber: required(row, "NUMERO_REGISTRO")
            };
            if (entryCache) {
              assertEntryMutableFromCache(candidate, next, entryCache.lockedCategoryIds);
            } else {
              await assertEntryMutable(manager, candidate, next);
            }
          } catch (error) {
            issues.push(
              issue(
                "error",
                rowNumber,
                error instanceof FedequinasRowError ? error.code : "ENTRY_LOCKED",
                error instanceof Error ? error.message : "La entrada no se puede modificar."
              )
            );
          }
        }
      }
      const registrationNumber = required(row, "NUMERO_REGISTRO");
      const horseExists = entryCache
        ? entryCache.horsesByRegistration.has(registrationNumber)
        : Boolean(
            await manager.getRepository(Horse).findOne({
              where: { registrationNumber }
            })
          );
      if (!horseExists) {
        issues.push(
          issue(
            "warning",
            rowNumber,
            "HORSE_PENDING",
            "El caballo aún no existe; la entrada se importará pendiente de enriquecimiento."
          )
        );
      }
      if (!optional(row, "ID_MONTADOR")) {
        issues.push(
          issue("warning", rowNumber, "RIDER_DOCUMENT_MISSING", "Falta el documento del montador.")
        );
      }
      break;
    }
    case "FEH_INSCRIPCIONES_FERIA_PADRES": {
      const fair =
        entryCache?.fair ??
        (entryCache
          ? null
          : await lookupByExternalId(manager.getRepository(Fair), fairExternalId));
      if (!fair) {
        issues.push(issue("error", rowNumber, "FAIR_NOT_FOUND", "La feria no existe."));
        break;
      }
      const externalId = rowExternalId(fileKind, row);
      const entry =
        entryCache?.entriesByExternalId.get(externalId) ??
        (entryCache
          ? null
          : await lookupByExternalId(manager.getRepository(FairEntry), externalId));
      if (!entry) {
        issues.push(
          issue(
            "warning",
            rowNumber,
            "ENTRY_NOT_FOUND",
            "No existe la inscripción; la fila queda pendiente sin afectar las demás."
          )
        );
      }
      if (!optional(row, "NOMBRE_EJEMPLAR")) {
        issues.push(issue("warning", rowNumber, "HORSE_NAME_MISSING", "Falta el nombre del caballo."));
      }
      if (!optional(row, "PADRE") || !optional(row, "MADRE")) {
        issues.push(issue("warning", rowNumber, "GENEALOGY_MISSING", "La genealogía está incompleta."));
      }
      break;
    }
  }

  return issues;
}

async function loadEntryPreviewCache(
  manager: EntityManager,
  fairExternalId: string,
  rows: ParsedFedequinasWorkbook["rows"],
  fileKind: "FEH_INSCRIPCIONES_FERIA" | "FEH_INSCRIPCIONES_FERIA_PADRES" =
    "FEH_INSCRIPCIONES_FERIA"
): Promise<EntryPreviewCache> {
  const fair = await lookupByExternalId(manager.getRepository(Fair), fairExternalId);
  const categoryExternalIds = [
    ...new Set(rows.map(({ values }) => values.CODIGO_CATEGORIA?.trim()).filter(Boolean))
  ] as string[];
  const registrationNumbers = [
    ...new Set(rows.map(({ values }) => values.NUMERO_REGISTRO?.trim()).filter(Boolean))
  ] as string[];
  const externalIds = rows.flatMap(({ values }) => {
    try {
      return [rowExternalId("FEH_INSCRIPCIONES_FERIA", values)];
    } catch {
      return [];
    }
  });

  // Este cache también se carga desde el EntityManager de una transacción durante apply.
  // Un QueryRunner usa un único cliente de pg, por lo que no admite consultas concurrentes
  // de forma segura (pg 9 las rechaza). Mantener estas lecturas secuenciales evita que el
  // proceso corte el socket en importaciones grandes.
  const categories = categoryExternalIds.length
    ? await manager.getRepository(Category).find({
        where: categoryExternalIds.map((externalId) => ({
          externalId,
          sourceSystem: SOURCE_SYSTEM
        }))
      })
    : [];
  const horses = registrationNumbers.length
    ? await manager.getRepository(Horse).find({
        where: registrationNumbers.map((registrationNumber) => ({ registrationNumber }))
      })
    : [];
  const entries =
    fileKind === "FEH_INSCRIPCIONES_FERIA_PADRES"
      ? externalIds.length
        ? await manager.getRepository(FairEntry).find({
            where: externalIds.map((externalId) => ({
              externalId,
              sourceSystem: SOURCE_SYSTEM
            }))
          })
        : []
      : fair
        ? await manager.getRepository(FairEntry).find({ where: { fairId: fair.id } })
        : [];
  const mappings = externalIds.length
    ? await manager.getRepository(SyncMapping).find({
        where: externalIds.map((externalId) => ({
          sourceSystem: SOURCE_SYSTEM,
          entityName: mappingEntityName(fileKind),
          externalId
        }))
      })
    : [];
  const stages = fair
    ? await manager.getRepository(FairCategoryStage).find({ where: { fairId: fair.id } })
    : [];

  return {
    fair,
    categoriesByExternalId: new Map(
      categories.flatMap((category) =>
        category.externalId ? [[category.externalId, category] as const] : []
      )
    ),
    horsesByRegistration: new Map(horses.map((horse) => [horse.registrationNumber, horse])),
    entriesByExternalId: new Map(
      entries.flatMap((entry) => (entry.externalId ? [[entry.externalId, entry] as const] : []))
    ),
    entriesBySequence: new Map(entries.map((entry) => [entry.fairSequence, entry])),
    mappingsByExternalId: new Map(mappings.map((mapping) => [mapping.externalId, mapping])),
    lockedCategoryIds: new Set(
      stages.filter((stage) => isImportIdentityLocked(stage.status)).map((stage) => stage.categoryId)
    )
  };
}

async function analyze(
  dataSource: DataSource,
  fileKind: FedequinasFileKind,
  file: FedequinasXlsxFile
): Promise<Analysis> {
  const parsed = await parseFedequinasXlsx(fileKind, file);
  let fairIds: Set<string>;
  try {
    fairIds = new Set(parsed.rows.map(({ values }) => required(values, "ID_FERIA")));
  } catch (error) {
    throw new BadRequestError(
      error instanceof Error ? error.message : "ID_FERIA es obligatorio en todas las filas."
    );
  }
  if (fairIds.size !== 1) {
    throw new BadRequestError("Todas las filas del archivo deben pertenecer a la misma feria.");
  }
  const detectedFairExternalId = [...fairIds][0];
  await assertPreviousStep(dataSource, fileKind, detectedFairExternalId);

  const preparedRows: PreparedRow[] = [];
  const allIssues: FedequinasIssue[] = [];
  const seen = new Set<string>();
  const manager = dataSource.manager;
  const entryCache =
    fileKind === "FEH_INSCRIPCIONES_FERIA" ||
    fileKind === "FEH_INSCRIPCIONES_FERIA_PADRES"
      ? await loadEntryPreviewCache(manager, detectedFairExternalId, parsed.rows, fileKind)
      : undefined;

  for (const { rowNumber, values } of parsed.rows) {
    try {
      const externalId = rowExternalId(fileKind, values);
      if (seen.has(externalId)) {
        throw new FedequinasRowError("DUPLICATE_EXTERNAL_ID", `Clave duplicada: ${externalId}.`);
      }
      seen.add(externalId);
      const rowHash = stableHash(rowHashPayload(fileKind, values));
      const rowIssues = await validateReferences(manager, fileKind, rowNumber, values, entryCache);
      const mapping =
        entryCache?.mappingsByExternalId.get(externalId) ??
        (entryCache
          ? null
          : await manager.getRepository(SyncMapping).findOne({
              where: {
                sourceSystem: SOURCE_SYSTEM,
                entityName: mappingEntityName(fileKind),
                externalId
              }
            }));
      const hasMissingParentEntry = rowIssues.some((entry) => entry.code === "ENTRY_NOT_FOUND");
      const action: PreviewAction = hasMissingParentEntry
        ? "skip"
        : mapping?.rowHash === rowHash
          ? "skip"
          : (mapping || (await targetExists(manager, fileKind, externalId, values, entryCache)))
            ? "update"
            : "insert";
      preparedRows.push({ rowNumber, values, externalId, rowHash, action, issues: rowIssues });
      allIssues.push(...rowIssues);
    } catch (error) {
      const rowIssue = issue(
        "error",
        rowNumber,
        error instanceof FedequinasRowError ? error.code : "ROW_ERROR",
        error instanceof Error ? error.message : "Error desconocido al validar la fila."
      );
      allIssues.push(rowIssue);
      preparedRows.push({
        rowNumber,
        values,
        externalId: "",
        rowHash: "",
        action: "skip",
        issues: [rowIssue]
      });
    }
  }

  const counts: FedequinasCounts = {
    total: parsed.rows.length,
    inserts: preparedRows.filter((row) => row.action === "insert" && !row.issues.some(isError)).length,
    updates: preparedRows.filter((row) => row.action === "update" && !row.issues.some(isError)).length,
    skips: preparedRows.filter((row) => row.action === "skip" && !row.issues.some(isError)).length,
    warnings: new Set(
      allIssues.filter((entry) => entry.severity === "warning").map((entry) => entry.row)
    ).size,
    errors: new Set(
      allIssues.filter((entry) => entry.severity === "error").map((entry) => entry.row)
    ).size
  };
  return {
    checksum: parsed.checksum,
    detectedFairExternalId,
    headers: parsed.headers,
    counts,
    issues: allIssues,
    parsed,
    preparedRows
  };
}

function isError(entry: FedequinasIssue): boolean {
  return entry.severity === "error";
}

export async function previewFedequinasImport(
  fileKind: FedequinasFileKind,
  file: FedequinasXlsxFile,
  dataSource?: DataSource
): Promise<FedequinasPreview> {
  const source = dataSource ?? (await getDataSource());
  const analysis = await analyze(source, fileKind, file);
  const previewToken = createPreviewToken({
    checksum: analysis.checksum,
    fileKind,
    fairExternalId: analysis.detectedFairExternalId,
    expiresAt: Date.now() + TOKEN_TTL_MS
  });

  return {
    checksum: analysis.checksum,
    previewToken,
    detectedFairExternalId: analysis.detectedFairExternalId,
    headers: analysis.headers,
    counts: analysis.counts,
    issues: analysis.issues
  };
}

async function saveMapping(
  manager: EntityManager,
  batch: SyncBatch,
  fileKind: FedequinasFileKind,
  externalId: string,
  internalId: string,
  rowHash: string
): Promise<void> {
  const repository = manager.getRepository(SyncMapping);
  let mapping = await repository.findOne({
    where: { sourceSystem: SOURCE_SYSTEM, entityName: mappingEntityName(fileKind), externalId }
  });
  mapping ??= repository.create({
    sourceSystem: SOURCE_SYSTEM,
    entityName: mappingEntityName(fileKind),
    externalId,
    internalId,
    rowHash,
    lastSeenBatchId: batch.id
  });
  mapping.internalId = internalId;
  mapping.rowHash = rowHash;
  mapping.lastSeenBatchId = batch.id;
  await repository.save(mapping);
}

async function touchMapping(
  manager: EntityManager,
  batch: SyncBatch,
  fileKind: FedequinasFileKind,
  externalId: string
): Promise<void> {
  const repository = manager.getRepository(SyncMapping);
  const mapping = await repository.findOne({
    where: { sourceSystem: SOURCE_SYSTEM, entityName: mappingEntityName(fileKind), externalId }
  });
  if (!mapping) return;
  mapping.lastSeenBatchId = batch.id;
  await repository.save(mapping);
}

async function applyFair(manager: EntityManager, row: PreparedRow, batch: SyncBatch): Promise<void> {
  const values = row.values;
  const city = await lookupByExternalId(manager.getRepository(City), required(values, "CODIGO_CIUDAD"));
  const grade = await lookupByExternalId(
    manager.getRepository(Grade),
    required(values, "CODIGO_GRADO")
  );
  if (!city || !grade) throw new FedequinasRowError("CATALOG_NOT_FOUND", "Faltan catálogos.");

  const repository = manager.getRepository(Fair);
  let entity = await lookupByExternalId(repository, row.externalId);
  entity ??= repository.create({ externalId: row.externalId, sourceSystem: SOURCE_SYSTEM });
  Object.assign(entity, {
    name: required(values, "DESCRIPCION"),
    year: integer(required(values, "ANO"), "ANO"),
    startDate: excelSerialDateToIso(required(values, "FECHA_INICIO")),
    endDate: excelSerialDateToIso(required(values, "FECHA_FIN")),
    cityId: city.id,
    gradeId: grade.id,
    comments: optional(values, "OBSERVACIONES") ?? entity.comments,
    registeredCount: integer(required(values, "INSCRITOS"), "INSCRITOS")
  });
  const saved = await repository.save(entity);
  await saveMapping(manager, batch, "FEH_FERIAS", row.externalId, saved.id, row.rowHash);
}

async function applyStaff(manager: EntityManager, row: PreparedRow, batch: SyncBatch): Promise<void> {
  const values = row.values;
  const fair = await lookupByExternalId(manager.getRepository(Fair), required(values, "ID_FERIA"));
  const role = await lookupByExternalId(manager.getRepository(Role), required(values, "ID_ROL"));
  if (!fair || !role) throw new FedequinasRowError("DEPENDENCY_NOT_FOUND", "Falta feria o rol.");

  const personExternalId = required(values, "ID_PERSONAL");
  const personRepository = manager.getRepository(Person);
  let person = await lookupByExternalId(personRepository, personExternalId);
  person ??= personRepository.create({
    externalId: personExternalId,
    sourceSystem: SOURCE_SYSTEM,
    lastName: null
  });
  person.name = required(values, "NOMBRE");
  person = await personRepository.save(person);

  const staffRepository = manager.getRepository(FairStaff);
  let staff = await lookupByExternalId(staffRepository, row.externalId);
  staff ??= staffRepository.create({
    externalId: row.externalId,
    sourceSystem: SOURCE_SYSTEM
  });
  Object.assign(staff, { fairId: fair.id, personId: person.id, roleId: role.id });
  staff = await staffRepository.save(staff);
  await saveMapping(manager, batch, "FEH_PERSONAL_FERIA", row.externalId, staff.id, row.rowHash);
}

async function assertEntryMutable(
  manager: EntityManager,
  existing: FairEntry,
  next: ProtectedFairEntryFields
): Promise<void> {
  if (!hasProtectedFairEntryChanges(existing, next)) return;
  const stages = await manager.getRepository(FairCategoryStage).find({
    where: [
      { fairId: existing.fairId, categoryId: existing.categoryId },
      { fairId: existing.fairId, categoryId: next.categoryId }
    ]
  });
  if (stages.some((stage) => isImportIdentityLocked(stage.status))) {
    throw new FedequinasRowError(
      "JUDGING_ALREADY_STARTED",
      "No se puede cambiar categoría, posición, inscripción o registro porque la categoría inició pre-pista/juzgamiento."
    );
  }
}

function assertEntryMutableFromCache(
  existing: FairEntry,
  next: ProtectedFairEntryFields,
  lockedCategoryIds: Set<string>
): void {
  if (!hasProtectedFairEntryChanges(existing, next)) return;
  if (
    lockedCategoryIds.has(existing.categoryId) ||
    lockedCategoryIds.has(next.categoryId)
  ) {
    throw new FedequinasRowError(
      "JUDGING_ALREADY_STARTED",
      "No se puede cambiar categoría, posición, inscripción o registro porque la categoría inició pre-pista/juzgamiento."
    );
  }
}

async function applyEntry(manager: EntityManager, row: PreparedRow, batch: SyncBatch): Promise<void> {
  const values = row.values;
  const fair = await lookupByExternalId(manager.getRepository(Fair), required(values, "ID_FERIA"));
  const category = await lookupByExternalId(
    manager.getRepository(Category),
    required(values, "CODIGO_CATEGORIA")
  );
  if (!fair || !category) {
    throw new FedequinasRowError("DEPENDENCY_NOT_FOUND", "Falta feria o categoría.");
  }
  const registrationNumber = required(values, "NUMERO_REGISTRO");
  const horse = await manager.getRepository(Horse).findOne({ where: { registrationNumber } });
  const position = integer(required(values, "POSICION_PISTA"), "POSICION_PISTA");
  const fairSequence = integer(required(values, "CONSECUTIVO_FERIA"), "CONSECUTIVO_FERIA");
  const repository = manager.getRepository(FairEntry);
  let entry = await lookupByExternalId(repository, row.externalId);
  entry ??= await repository.findOne({ where: { fairId: fair.id, fairSequence } });
  if (entry) {
    await assertEntryMutable(
      manager,
      entry,
      {
        categoryId: category.id,
        trackPosition: position,
        inscriptionNumber: required(values, "NUMERO_INSCRIPCION"),
        registrationNumber
      }
    );
    entry.externalId = row.externalId;
    entry.sourceSystem = SOURCE_SYSTEM;
  }
  entry ??= repository.create({
    externalId: row.externalId,
    sourceSystem: SOURCE_SYSTEM,
    fairId: fair.id,
    inscriptionNumber: required(values, "NUMERO_INSCRIPCION"),
    registrationNumber
  });
  Object.assign(entry, {
    fairId: fair.id,
    inscriptionNumber: required(values, "NUMERO_INSCRIPCION"),
    registrationNumber,
    horseId: horse?.id ?? entry.horseId ?? null,
    categoryId: category.id,
    trackPosition: position,
    riderName: required(values, "MONTADOR"),
    riderDocumentNumber: optional(values, "ID_MONTADOR") ?? entry.riderDocumentNumber ?? null,
    receipt: entry.receipt ?? null,
    participate: entry.participate ?? true,
    fairSequence,
    isChild: entry.isChild ?? null
  });
  entry = await repository.save(entry);
  await saveMapping(manager, batch, "FEH_INSCRIPCIONES_FERIA", row.externalId, entry.id, row.rowHash);
}

function enrichment(values: Record<string, string | null>): Record<string, string> {
  return Object.fromEntries(
    Object.entries(values).filter((entry): entry is [string, string] => Boolean(entry[1]))
  );
}

async function applyParents(manager: EntityManager, row: PreparedRow, batch: SyncBatch): Promise<void> {
  const values = row.values;
  const entry = await lookupByExternalId(manager.getRepository(FairEntry), row.externalId);
  if (!entry) return;

  const registrationNumber = required(values, "NUMERO_REGISTRO");
  const repository = manager.getRepository(Horse);
  let horse = await repository.findOne({ where: { registrationNumber } });
  horse ??= repository.create({
    externalId: registrationNumber,
    sourceSystem: SOURCE_SYSTEM,
    registrationNumber
  });
  Object.assign(
    horse,
    enrichment({
      name: optional(values, "NOMBRE_EJEMPLAR"),
      fatherName: optional(values, "PADRE"),
      motherName: optional(values, "MADRE")
    })
  );
  horse = await repository.save(horse);
  if (entry.horseId !== horse.id) {
    entry.horseId = horse.id;
    await manager.getRepository(FairEntry).save(entry);
  }
  await saveMapping(
    manager,
    batch,
    "FEH_INSCRIPCIONES_FERIA_PADRES",
    row.externalId,
    horse.id,
    row.rowHash
  );
}

async function applyPreparedRow(
  manager: EntityManager,
  fileKind: FedequinasFileKind,
  row: PreparedRow,
  batch: SyncBatch
): Promise<void> {
  switch (fileKind) {
    case "FEH_FERIAS":
      return applyFair(manager, row, batch);
    case "FEH_PERSONAL_FERIA":
      return applyStaff(manager, row, batch);
    case "FEH_INSCRIPCIONES_FERIA":
      return applyEntry(manager, row, batch);
    case "FEH_INSCRIPCIONES_FERIA_PADRES":
      return applyParents(manager, row, batch);
  }
}

async function persistIssue(
  manager: EntityManager,
  batch: SyncBatch,
  fileKind: FedequinasFileKind,
  row: PreparedRow,
  entry: FedequinasIssue
): Promise<void> {
  await manager.getRepository(SyncError).save(
    manager.getRepository(SyncError).create({
      batchId: batch.id,
      entityName: mappingEntityName(fileKind),
      rowNumber: entry.row,
      externalId: row.externalId || null,
      errorCode: entry.severity === "warning" ? `WARNING_${entry.code}` : entry.code,
      errorMessage: entry.message,
      rawRow: row.values
    })
  );
}

async function applyEntriesBulk(
  manager: EntityManager,
  analysis: Analysis,
  batch: SyncBatch
): Promise<void> {
  const cache = await loadEntryPreviewCache(
    manager,
    analysis.detectedFairExternalId,
    analysis.parsed.rows
  );
  if (!cache.fair) {
    throw new FedequinasRowError("DEPENDENCY_NOT_FOUND", "La feria no existe.");
  }

  const entriesToSave: FairEntry[] = [];

  for (const row of analysis.preparedRows) {
    if (row.action === "skip") continue;
    const values = row.values;
    const category = cache.categoriesByExternalId.get(required(values, "CODIGO_CATEGORIA"));
    if (!category) {
      throw new FedequinasRowError("DEPENDENCY_NOT_FOUND", "La categoría no existe.");
    }

    const registrationNumber = required(values, "NUMERO_REGISTRO");
    const position = integer(required(values, "POSICION_PISTA"), "POSICION_PISTA");
    const fairSequence = integer(
      required(values, "CONSECUTIVO_FERIA"),
      "CONSECUTIVO_FERIA"
    );
    const next = {
      categoryId: category.id,
      trackPosition: position,
      inscriptionNumber: required(values, "NUMERO_INSCRIPCION"),
      registrationNumber
    };
    let entry =
      cache.entriesByExternalId.get(row.externalId) ??
      cache.entriesBySequence.get(fairSequence);

    if (entry) {
      assertEntryMutableFromCache(entry, next, cache.lockedCategoryIds);
      entry.externalId = row.externalId;
      entry.sourceSystem = SOURCE_SYSTEM;
    } else {
      entry = manager.getRepository(FairEntry).create({
        externalId: row.externalId,
        sourceSystem: SOURCE_SYSTEM,
        fairId: cache.fair.id,
        inscriptionNumber: next.inscriptionNumber,
        registrationNumber
      });
    }

    Object.assign(entry, {
      fairId: cache.fair.id,
      inscriptionNumber: next.inscriptionNumber,
      registrationNumber,
      horseId:
        cache.horsesByRegistration.get(registrationNumber)?.id ?? entry.horseId ?? null,
      categoryId: category.id,
      trackPosition: position,
      riderName: required(values, "MONTADOR"),
      riderDocumentNumber: optional(values, "ID_MONTADOR") ?? entry.riderDocumentNumber ?? null,
      receipt: entry.receipt ?? null,
      participate: entry.participate ?? true,
      fairSequence,
      isChild: entry.isChild ?? null
    });
    entriesToSave.push(entry);
  }

  const savedEntries = entriesToSave.length
    ? await manager.getRepository(FairEntry).save(entriesToSave, { chunk: 100 })
    : [];
  const savedByExternalId = new Map(
    savedEntries.flatMap((entry) =>
      entry.externalId ? [[entry.externalId, entry] as const] : []
    )
  );
  const mappingRepository = manager.getRepository(SyncMapping);
  const mappingsToSave: SyncMapping[] = [];

  for (const row of analysis.preparedRows) {
    const mapping = cache.mappingsByExternalId.get(row.externalId);
    if (row.action === "skip") {
      if (mapping) {
        mapping.lastSeenBatchId = batch.id;
        mappingsToSave.push(mapping);
      }
      continue;
    }

    const savedEntry = savedByExternalId.get(row.externalId);
    if (!savedEntry) {
      throw new Error(`No se persistió la inscripción ${row.externalId}.`);
    }
    const nextMapping =
      mapping ??
      mappingRepository.create({
        sourceSystem: SOURCE_SYSTEM,
        entityName: mappingEntityName("FEH_INSCRIPCIONES_FERIA"),
        externalId: row.externalId,
        internalId: savedEntry.id,
        rowHash: row.rowHash,
        lastSeenBatchId: batch.id
      });
    nextMapping.internalId = savedEntry.id;
    nextMapping.rowHash = row.rowHash;
    nextMapping.lastSeenBatchId = batch.id;
    mappingsToSave.push(nextMapping);
  }

  if (mappingsToSave.length) {
    await mappingRepository.save(mappingsToSave, { chunk: 100 });
  }

  const issueRepository = manager.getRepository(SyncError);
  const issues = analysis.preparedRows.flatMap((row) =>
    row.issues.map((entry) =>
      issueRepository.create({
        batchId: batch.id,
        entityName: mappingEntityName("FEH_INSCRIPCIONES_FERIA"),
        rowNumber: entry.row,
        externalId: row.externalId || null,
        errorCode: entry.severity === "warning" ? `WARNING_${entry.code}` : entry.code,
        errorMessage: entry.message,
        rawRow: row.values
      })
    )
  );
  if (issues.length) {
    await issueRepository.save(issues, { chunk: 100 });
  }
}

async function applyParentsBulk(
  manager: EntityManager,
  analysis: Analysis,
  batch: SyncBatch
): Promise<void> {
  const cache = await loadEntryPreviewCache(
    manager,
    analysis.detectedFairExternalId,
    analysis.parsed.rows,
    "FEH_INSCRIPCIONES_FERIA_PADRES"
  );
  if (!cache.fair) {
    throw new FedequinasRowError("DEPENDENCY_NOT_FOUND", "La feria no existe.");
  }

  const horseRepository = manager.getRepository(Horse);
  const horsesByRegistration = new Map(cache.horsesByRegistration);
  const horsesToSave = new Map<string, Horse>();

  for (const row of analysis.preparedRows) {
    if (row.action === "skip") continue;
    const registrationNumber = required(row.values, "NUMERO_REGISTRO");
    let horse = horsesByRegistration.get(registrationNumber);
    horse ??= horseRepository.create({
      externalId: registrationNumber,
      sourceSystem: SOURCE_SYSTEM,
      registrationNumber
    });
    Object.assign(
      horse,
      enrichment({
        name: optional(row.values, "NOMBRE_EJEMPLAR"),
        fatherName: optional(row.values, "PADRE"),
        motherName: optional(row.values, "MADRE")
      })
    );
    horsesByRegistration.set(registrationNumber, horse);
    horsesToSave.set(registrationNumber, horse);
  }

  if (horsesToSave.size) {
    await horseRepository.save([...horsesToSave.values()], { chunk: 100 });
  }

  const entriesToSave: FairEntry[] = [];
  for (const row of analysis.preparedRows) {
    if (row.action === "skip") continue;
    const entry = cache.entriesByExternalId.get(row.externalId);
    const horse = horsesByRegistration.get(required(row.values, "NUMERO_REGISTRO"));
    if (!entry || !horse?.id) {
      throw new Error(`No se pudo enlazar el ejemplar de la inscripción ${row.externalId}.`);
    }
    if (entry.horseId !== horse.id) {
      entry.horseId = horse.id;
      entriesToSave.push(entry);
    }
  }
  if (entriesToSave.length) {
    await manager.getRepository(FairEntry).save(entriesToSave, { chunk: 100 });
  }

  const mappingRepository = manager.getRepository(SyncMapping);
  const mappingsToSave: SyncMapping[] = [];
  for (const row of analysis.preparedRows) {
    const mapping = cache.mappingsByExternalId.get(row.externalId);
    if (row.action === "skip") {
      if (mapping) {
        mapping.lastSeenBatchId = batch.id;
        mappingsToSave.push(mapping);
      }
      continue;
    }
    const horse = horsesByRegistration.get(required(row.values, "NUMERO_REGISTRO"));
    if (!horse?.id) throw new Error(`No se persistió el ejemplar ${row.externalId}.`);
    const nextMapping =
      mapping ??
      mappingRepository.create({
        sourceSystem: SOURCE_SYSTEM,
        entityName: mappingEntityName("FEH_INSCRIPCIONES_FERIA_PADRES"),
        externalId: row.externalId,
        internalId: horse.id,
        rowHash: row.rowHash,
        lastSeenBatchId: batch.id
      });
    nextMapping.internalId = horse.id;
    nextMapping.rowHash = row.rowHash;
    nextMapping.lastSeenBatchId = batch.id;
    mappingsToSave.push(nextMapping);
  }
  if (mappingsToSave.length) {
    await mappingRepository.save(mappingsToSave, { chunk: 100 });
  }

  const issueRepository = manager.getRepository(SyncError);
  const issues = analysis.preparedRows.flatMap((row) =>
    row.issues.map((entry) =>
      issueRepository.create({
        batchId: batch.id,
        entityName: mappingEntityName("FEH_INSCRIPCIONES_FERIA_PADRES"),
        rowNumber: entry.row,
        externalId: row.externalId || null,
        errorCode: entry.severity === "warning" ? `WARNING_${entry.code}` : entry.code,
        errorMessage: entry.message,
        rawRow: row.values
      })
    )
  );
  if (issues.length) {
    await issueRepository.save(issues, { chunk: 100 });
  }
}

export async function applyFedequinasImport(
  fileKind: FedequinasFileKind,
  file: FedequinasXlsxFile,
  previewToken: string,
  createdBy: string,
  dataSource?: DataSource,
  expectedChecksum?: string
): Promise<{ batch: SyncBatch; result: FedequinasPreview }> {
  const source = dataSource ?? (await getDataSource());
  const analysis = await analyze(source, fileKind, file);
  if (expectedChecksum && analysis.checksum !== expectedChecksum) {
    throw new BadRequestError("El checksum enviado no coincide con el archivo confirmado.");
  }
  verifyPreviewToken(previewToken, {
    checksum: analysis.checksum,
    fileKind,
    fairExternalId: analysis.detectedFairExternalId
  });
  if (analysis.counts.errors > 0) {
    throw new BadRequestError("La importación contiene errores bloqueantes; corríjalos y analice de nuevo.");
  }

  const batchRepository = source.getRepository(SyncBatch);
  let batch = await batchRepository.save(
    batchRepository.create({
      sourceSystem: SOURCE_SYSTEM,
      entityName: mappingEntityName(fileKind),
      fileKind,
      fairExternalId: analysis.detectedFairExternalId,
      fileName: file.name,
      fileSize: file.size,
      fileChecksum: analysis.checksum,
      status: "PROCESSING",
      totalRows: analysis.counts.total,
      insertedRows: 0,
      updatedRows: 0,
      skippedRows: 0,
      failedRows: 0,
      warningRows: 0,
      startedAt: new Date(),
      finishedAt: null,
      errorMessage: null,
      createdBy
    })
  );

  try {
    await source.transaction(async (manager) => {
      if (fileKind === "FEH_INSCRIPCIONES_FERIA") {
        await applyEntriesBulk(manager, analysis, batch);
        return;
      }
      if (fileKind === "FEH_INSCRIPCIONES_FERIA_PADRES") {
        await applyParentsBulk(manager, analysis, batch);
        return;
      }
      for (const row of analysis.preparedRows) {
        for (const rowIssue of row.issues) {
          await persistIssue(manager, batch, fileKind, row, rowIssue);
        }
        if (row.action === "skip") {
          await touchMapping(manager, batch, fileKind, row.externalId);
        } else {
          await applyPreparedRow(manager, fileKind, row, batch);
        }
      }
    });
    batch.insertedRows = analysis.counts.inserts;
    batch.updatedRows = analysis.counts.updates;
    batch.skippedRows = analysis.counts.skips;
    batch.warningRows = analysis.counts.warnings;
    batch.status = "COMPLETED";
    batch.finishedAt = new Date();
    batch = await batchRepository.save(batch);
  } catch (error) {
    batch.status = "FAILED";
    batch.finishedAt = new Date();
    batch.errorMessage = error instanceof Error ? error.message : "Error desconocido.";
    await batchRepository.save(batch);
    throw error;
  }

  return {
    batch,
    result: {
      checksum: analysis.checksum,
      previewToken,
      detectedFairExternalId: analysis.detectedFairExternalId,
      headers: analysis.headers,
      counts: analysis.counts,
      issues: analysis.issues
    }
  };
}

export type FedequinasStepStatus = {
  fileKind: FedequinasFileKind;
  status: "LOCKED" | "READY" | "COMPLETED" | "COMPLETED_WITH_WARNINGS" | "FAILED";
  batch: {
    id: string;
    fileName: string;
    checksum: string;
    startedAt: string;
    finishedAt: string | null;
    counts: FedequinasCounts;
  } | null;
};

export async function getFedequinasFairStatus(
  fairExternalId: string,
  dataSource?: DataSource
): Promise<{ fairExternalId: string; steps: FedequinasStepStatus[] }> {
  const source = dataSource ?? (await getDataSource());
  const steps: FedequinasStepStatus[] = [];
  let previousCompleted = true;

  for (const fileKind of FEDEQUINAS_FILE_KINDS) {
    const batch = await source.getRepository(SyncBatch).findOne({
      where: { sourceSystem: SOURCE_SYSTEM, fileKind, fairExternalId },
      order: { startedAt: "DESC" }
    });
    let status: FedequinasStepStatus["status"];
    if (batch?.status === "FAILED") status = "FAILED";
    else if (batch?.status === "COMPLETED") {
      status = batch.warningRows > 0 ? "COMPLETED_WITH_WARNINGS" : "COMPLETED";
    } else status = previousCompleted ? "READY" : "LOCKED";

    steps.push({
      fileKind,
      status,
      batch: batch
        ? {
            id: batch.id,
            fileName: batch.fileName,
            checksum: batch.fileChecksum,
            startedAt: batch.startedAt.toISOString(),
            finishedAt: batch.finishedAt?.toISOString() ?? null,
            counts: {
              total: batch.totalRows,
              inserts: batch.insertedRows,
              updates: batch.updatedRows,
              skips: batch.skippedRows,
              warnings: batch.warningRows,
              errors: batch.failedRows
            }
          }
        : null
    });
    previousCompleted = status === "COMPLETED" || status === "COMPLETED_WITH_WARNINGS";
  }

  return { fairExternalId, steps };
}
