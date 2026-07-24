import {
  Category,
  City,
  Fair,
  FairCategoryStage,
  FairEntry,
  FairStaff,
  Grade,
  Horse,
  Person,
  Role,
  SyncBatch,
  SyncError,
  SyncMapping
} from "@pegasus/core";
import ExcelJS from "exceljs";
import type { DataSource, EntityManager } from "typeorm";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  applyFedequinasImport,
  getFedequinasFairStatus,
  previewFedequinasImport
} from "./fedequinas-sync.service.js";
import {
  FEDEQUINAS_HEADERS,
  type FedequinasXlsxFile
} from "./fedequinas-xlsx.service.js";

async function buildFairFile(comments: string): Promise<FedequinasXlsxFile> {
  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet("FEH_FERIAS");
  worksheet.addRow(FEDEQUINAS_HEADERS.FEH_FERIAS);
  worksheet.addRow([
    "999992078",
    "2026",
    "COPA COLOMBIA - VILLETA",
    "2026-07-17",
    "2026-07-19",
    "25875",
    "2",
    comments,
    "270"
  ]);
  const buffer = Buffer.from(await workbook.xlsx.writeBuffer());
  return {
    name: "FEH_FERIAS.xlsx",
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    size: buffer.length,
    buffer
  };
}

async function buildFile(
  fileKind: keyof typeof FEDEQUINAS_HEADERS,
  rows: Array<Record<string, string>>
): Promise<FedequinasXlsxFile> {
  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet(fileKind);
  worksheet.addRow(FEDEQUINAS_HEADERS[fileKind]);
  for (const row of rows) {
    worksheet.addRow(FEDEQUINAS_HEADERS[fileKind].map((header) => row[header] ?? ""));
  }
  const buffer = Buffer.from(await workbook.xlsx.writeBuffer());
  return {
    name: `${fileKind}.xlsx`,
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    size: buffer.length,
    buffer
  };
}

type MemoryRecord = Record<string, unknown>;

function memoryDataSource(
  seeds: Array<[unknown, MemoryRecord[]]>,
  options: { failSaveEntity?: unknown } = {}
) {
  const state = new Map<unknown, MemoryRecord[]>(
    seeds.map(([entity, records]) => [entity, records.map((record) => ({ ...record }))])
  );
  let sequence = 0;
  let failed = false;

  function recordsFor(entity: unknown): MemoryRecord[] {
    const existing = state.get(entity);
    if (existing) return existing;
    const created: MemoryRecord[] = [];
    state.set(entity, created);
    return created;
  }

  function matches(record: MemoryRecord, where: MemoryRecord): boolean {
    return Object.entries(where).every(([key, value]) => record[key] === value);
  }

  const repositories = new Map<unknown, MemoryRecord>();
  function getRepository(entity: unknown): MemoryRecord {
    const existing = repositories.get(entity);
    if (existing) return existing;
    const repository = {
      findOne: vi.fn(async ({ where }: { where: MemoryRecord }) => {
        return recordsFor(entity).find((record) => matches(record, where)) ?? null;
      }),
      find: vi.fn(async ({ where }: { where: MemoryRecord | MemoryRecord[] }) => {
        const alternatives = Array.isArray(where) ? where : [where];
        return recordsFor(entity).filter((record) =>
          alternatives.some((candidate) => matches(record, candidate))
        );
      }),
      create: vi.fn((values: MemoryRecord) => ({ ...values })),
      save: vi.fn(async (value: MemoryRecord | MemoryRecord[]) => {
        if (options.failSaveEntity === entity && !failed) {
          failed = true;
          throw new Error("fallo de persistencia simulado");
        }
        const values = Array.isArray(value) ? value : [value];
        for (const entry of values) {
          entry.id ??= `memory-${sequence++}`;
          const records = recordsFor(entity);
          const index = records.findIndex((record) => record.id === entry.id);
          if (index >= 0) records[index] = entry;
          else records.push(entry);
        }
        return value;
      })
    };
    repositories.set(entity, repository);
    return repository;
  }

  const manager = { getRepository } as unknown as EntityManager;
  const transaction = vi.fn(async (callback: (transactionManager: EntityManager) => unknown) => {
    const snapshot = new Map(
      Array.from(state, ([entity, records]) => [
        entity,
        records.map((record) => ({ ...record }))
      ])
    );
    try {
      return await callback(manager);
    } catch (error) {
      state.clear();
      for (const [entity, records] of snapshot) state.set(entity, records);
      throw error;
    }
  });
  const source = {
    manager,
    getRepository,
    transaction
  } as unknown as DataSource;

  return {
    source,
    transaction,
    records: (entity: unknown) => recordsFor(entity),
    repository: (entity: unknown) => getRepository(entity)
  };
}

function completedBatch(fileKind: string, fairExternalId = "FERIA-1"): MemoryRecord {
  return {
    id: `batch-${fileKind}`,
    sourceSystem: "FEDEQUINAS",
    fileKind,
    fairExternalId,
    status: "COMPLETED",
    startedAt: new Date()
  };
}

const fairSeed = {
  id: "fair-id",
  externalId: "FERIA-1",
  sourceSystem: "FEDEQUINAS"
};

function previewDataSource() {
  const save = vi.fn();
  const getRepository = vi.fn((entity: unknown) => ({
    findOne: vi.fn(async () => {
      if (entity === City) return { id: "city-id" };
      if (entity === Grade) return { id: "grade-id" };
      if (entity === Fair || entity === SyncMapping) return null;
      return null;
    }),
    save
  }));

  return {
    source: { manager: { getRepository }, getRepository } as unknown as DataSource,
    save
  };
}

function applyDataSource() {
  const batchCreate = vi.fn((values: Record<string, unknown>) => ({ id: "batch-id", ...values }));
  const batchSave = vi.fn(async (value: Record<string, unknown>) => value);
  const fairSave = vi.fn(async (value: Record<string, unknown>) => ({ id: "fair-id", ...value }));
  const mappingSave = vi.fn(async (value: Record<string, unknown>) => value);
  const repositories = new Map<unknown, Record<string, unknown>>();
  repositories.set(City, { findOne: vi.fn(async () => ({ id: "city-id" })) });
  repositories.set(Grade, { findOne: vi.fn(async () => ({ id: "grade-id" })) });
  repositories.set(Fair, {
    findOne: vi.fn(async () => null),
    create: vi.fn((values) => values),
    save: fairSave
  });
  repositories.set(SyncMapping, {
    findOne: vi.fn(async () => null),
    create: vi.fn((values) => values),
    save: mappingSave
  });
  repositories.set(SyncBatch, {
    findOne: vi.fn(async () => null),
    create: batchCreate,
    save: batchSave
  });
  const getRepository = vi.fn((entity: unknown) => repositories.get(entity));
  const manager = { getRepository };
  const source = {
    manager,
    getRepository,
    transaction: vi.fn(async (callback: (entityManager: typeof manager) => unknown) =>
      callback(manager)
    )
  } as unknown as DataSource;

  return { source, batchCreate, batchSave };
}

describe("sincronización Fedequinas preview/apply", () => {
  beforeEach(() => {
    process.env.SESSION_SECRET = "test-secret";
  });

  it("preview no escribe y devuelve un contrato serializable", async () => {
    const file = await buildFairFile("Primera carga");
    const { source, save } = previewDataSource();
    const result = await previewFedequinasImport("FEH_FERIAS", file, source);

    expect(save).not.toHaveBeenCalled();
    expect(result.detectedFairExternalId).toBe("999992078");
    expect(result.counts).toEqual({
      total: 1,
      inserts: 1,
      updates: 0,
      skips: 0,
      warnings: 0,
      errors: 0
    });
    expect(result.previewToken).toContain(".");
    expect(JSON.stringify(result)).toContain(result.checksum);
  });

  it("rechaza apply si cambió el archivo después del preview", async () => {
    const original = await buildFairFile("Primera carga");
    const changed = await buildFairFile("Archivo modificado");
    const { source, save } = previewDataSource();
    const preview = await previewFedequinasImport("FEH_FERIAS", original, source);

    await expect(
      applyFedequinasImport("FEH_FERIAS", changed, preview.previewToken, "user-id", source)
    ).rejects.toThrow("no coincide");
    expect(save).not.toHaveBeenCalled();
  });

  it("rechaza apply si el checksum multipart no coincide", async () => {
    const file = await buildFairFile("Primera carga");
    const { source, save } = previewDataSource();
    const preview = await previewFedequinasImport("FEH_FERIAS", file, source);

    await expect(
      applyFedequinasImport(
        "FEH_FERIAS",
        file,
        preview.previewToken,
        "user-id",
        source,
        "b".repeat(64)
      )
    ).rejects.toThrow("checksum enviado");
    expect(save).not.toHaveBeenCalled();
  });

  it("rechaza tokens alterados aunque el archivo conserve su checksum", async () => {
    const file = await buildFairFile("Primera carga");
    const { source } = previewDataSource();
    const preview = await previewFedequinasImport("FEH_FERIAS", file, source);
    const alteredToken = `${preview.previewToken.slice(0, -1)}x`;

    await expect(
      applyFedequinasImport("FEH_FERIAS", file, alteredToken, "user-id", source)
    ).rejects.toThrow("previewToken inválido");
  });

  it("rechaza archivos con filas de ferias distintas y pasos fuera de orden", async () => {
    const mixedFairs = await buildFile("FEH_FERIAS", [
      {
        ID_FERIA: "FERIA-1",
        ANO: "2026",
        DESCRIPCION: "Uno",
        FECHA_INICIO: "2026-01-01",
        FECHA_FIN: "2026-01-02",
        CODIGO_CIUDAD: "1",
        CODIGO_GRADO: "1",
        INSCRITOS: "2"
      },
      {
        ID_FERIA: "FERIA-2",
        ANO: "2026",
        DESCRIPCION: "Dos",
        FECHA_INICIO: "2026-01-01",
        FECHA_FIN: "2026-01-02",
        CODIGO_CIUDAD: "1",
        CODIGO_GRADO: "1",
        INSCRITOS: "2"
      }
    ]);
    const empty = memoryDataSource([]);
    await expect(previewFedequinasImport("FEH_FERIAS", mixedFairs, empty.source)).rejects.toThrow(
      "misma feria"
    );

    const staff = await buildFile("FEH_PERSONAL_FERIA", [
      {
        ID_PERSONAL_FERIA: "PF-1",
        ID_FERIA: "FERIA-1",
        ID_PERSONAL: "CC-1",
        ID_ROL: "ROL-1",
        NOMBRE: "Persona"
      }
    ]);
    await expect(
      previewFedequinasImport("FEH_PERSONAL_FERIA", staff, empty.source)
    ).rejects.toThrow("Debe completar FEH_FERIAS");
  });

  it("aplica Personal atómicamente y revierte persona si falla el staff", async () => {
    const file = await buildFile("FEH_PERSONAL_FERIA", [
      {
        ID_PERSONAL_FERIA: "PF-1",
        ID_FERIA: "FERIA-1",
        ID_PERSONAL: "CC.001-2",
        ID_ROL: "ROL-1",
        NOMBRE: "Ana Pérez"
      }
    ]);
    const memory = memoryDataSource(
      [
        [Fair, [fairSeed]],
        [Role, [{ id: "role-id", externalId: "ROL-1", sourceSystem: "FEDEQUINAS" }]],
        [SyncBatch, [completedBatch("FEH_FERIAS")]]
      ],
      { failSaveEntity: FairStaff }
    );
    const preview = await previewFedequinasImport("FEH_PERSONAL_FERIA", file, memory.source);

    await expect(
      applyFedequinasImport("FEH_PERSONAL_FERIA", file, preview.previewToken, "user-id", memory.source)
    ).rejects.toThrow("fallo de persistencia simulado");
    expect(memory.transaction).toHaveBeenCalledOnce();
    expect(memory.records(Person)).toHaveLength(0);
    expect(memory.records(FairStaff)).toHaveLength(0);
    expect(memory.records(SyncBatch).at(-1)).toMatchObject({ status: "FAILED" });
  });

  it("importa inscripción sin caballo con warnings y conserva ID_MONTADOR vacío", async () => {
    const file = await buildFile("FEH_INSCRIPCIONES_FERIA", [
      {
        ID_FERIA: "FERIA-1",
        NUMERO_INSCRIPCION: "0007-A",
        NUMERO_REGISTRO: "REG.001-9",
        CODIGO_CATEGORIA: "CAT-1",
        POSICION_PISTA: "3",
        MONTADOR: "Montador",
        ID_MONTADOR: "",
        CONSECUTIVO_FERIA: "10"
      }
    ]);
    const memory = memoryDataSource([
      [Fair, [fairSeed]],
      [Category, [{ id: "category-id", externalId: "CAT-1", sourceSystem: "FEDEQUINAS" }]],
      [SyncBatch, [completedBatch("FEH_PERSONAL_FERIA")]]
    ]);
    const preview = await previewFedequinasImport("FEH_INSCRIPCIONES_FERIA", file, memory.source);

    expect(preview.counts).toMatchObject({ inserts: 1, warnings: 1, errors: 0 });
    expect(preview.issues.map((entry) => entry.code)).toEqual([
      "HORSE_PENDING",
      "RIDER_DOCUMENT_MISSING"
    ]);

    await applyFedequinasImport(
      "FEH_INSCRIPCIONES_FERIA",
      file,
      preview.previewToken,
      "user-id",
      memory.source
    );
    expect(memory.records(FairEntry)).toContainEqual(
      expect.objectContaining({
        externalId: "FERIA-1:0007-A:REG.001-9",
        horseId: null,
        riderDocumentNumber: null
      })
    );
  });

  it("analiza y aplica inscripciones en bloques independientemente del número de filas", async () => {
    const rows = Array.from({ length: 50 }, (_, index) => ({
      ID_FERIA: "FERIA-1",
      NUMERO_INSCRIPCION: String(index + 1),
      NUMERO_REGISTRO: `REG-${index + 1}`,
      CODIGO_CATEGORIA: "CAT-1",
      POSICION_PISTA: String(index + 1),
      MONTADOR: `Montador ${index + 1}`,
      ID_MONTADOR: String(index + 1),
      CONSECUTIVO_FERIA: String(index + 1)
    }));
    const file = await buildFile("FEH_INSCRIPCIONES_FERIA", rows);
    const memory = memoryDataSource([
      [Fair, [fairSeed]],
      [Category, [{ id: "category-id", externalId: "CAT-1", sourceSystem: "FEDEQUINAS" }]],
      [SyncBatch, [completedBatch("FEH_PERSONAL_FERIA")]]
    ]);

    const preview = await previewFedequinasImport(
      "FEH_INSCRIPCIONES_FERIA",
      file,
      memory.source
    );

    expect(preview.counts).toMatchObject({ total: 50, inserts: 50, errors: 0 });
    expect(memory.repository(Fair).findOne).toHaveBeenCalledOnce();
    expect(memory.repository(Category).find).toHaveBeenCalledOnce();
    expect(memory.repository(Horse).find).toHaveBeenCalledOnce();
    expect(memory.repository(FairEntry).find).toHaveBeenCalledOnce();
    expect(memory.repository(SyncMapping).find).toHaveBeenCalledOnce();
    expect(memory.repository(FairCategoryStage).find).toHaveBeenCalledOnce();
    expect(memory.repository(FairEntry).findOne).not.toHaveBeenCalled();
    expect(memory.repository(Horse).findOne).not.toHaveBeenCalled();
    expect(memory.repository(SyncMapping).findOne).not.toHaveBeenCalled();

    await applyFedequinasImport(
      "FEH_INSCRIPCIONES_FERIA",
      file,
      preview.previewToken,
      "user-id",
      memory.source
    );

    expect(memory.records(FairEntry)).toHaveLength(50);
    expect(memory.records(SyncMapping)).toHaveLength(50);
    expect(memory.repository(FairEntry).save).toHaveBeenCalledOnce();
    expect(memory.repository(SyncMapping).save).toHaveBeenCalledOnce();
    expect(memory.repository(SyncError).save).toHaveBeenCalledOnce();
    expect(memory.repository(Horse).findOne).not.toHaveBeenCalled();
  });

  it("Padres crea y actualiza caballos, enlaza y aísla una fila sin inscripción", async () => {
    const rows = [
      {
        ID_FERIA: "FERIA-1",
        NUMERO_INSCRIPCION: "1",
        NUMERO_REGISTRO: "REG-1",
        NOMBRE_EJEMPLAR: "Nombre actualizado",
        PADRE: "",
        MADRE: "",
        CODIGO_CATEGORIA: "CAT-1",
        POSICION_PISTA: "1",
        ID_MONTADOR: "1",
        MONTADOR: "Uno"
      },
      {
        ID_FERIA: "FERIA-1",
        NUMERO_INSCRIPCION: "2",
        NUMERO_REGISTRO: "REG-2",
        NOMBRE_EJEMPLAR: "Nuevo",
        PADRE: "Padre nuevo",
        MADRE: "Madre nueva",
        CODIGO_CATEGORIA: "CAT-1",
        POSICION_PISTA: "2",
        ID_MONTADOR: "2",
        MONTADOR: "Dos"
      },
      {
        ID_FERIA: "FERIA-1",
        NUMERO_INSCRIPCION: "3",
        NUMERO_REGISTRO: "REG-3",
        NOMBRE_EJEMPLAR: "Pendiente",
        PADRE: "Padre",
        MADRE: "Madre",
        CODIGO_CATEGORIA: "CAT-1",
        POSICION_PISTA: "3",
        ID_MONTADOR: "3",
        MONTADOR: "Tres"
      }
    ];
    const file = await buildFile("FEH_INSCRIPCIONES_FERIA_PADRES", rows);
    const memory = memoryDataSource([
      [Fair, [fairSeed]],
      [
        FairEntry,
        [
          {
            id: "entry-1",
            externalId: "FERIA-1:1:REG-1",
            sourceSystem: "FEDEQUINAS",
            horseId: "horse-1"
          },
          {
            id: "entry-2",
            externalId: "FERIA-1:2:REG-2",
            sourceSystem: "FEDEQUINAS",
            horseId: null
          }
        ]
      ],
      [
        Horse,
        [
          {
            id: "horse-1",
            registrationNumber: "REG-1",
            name: "Nombre anterior",
            fatherName: "Padre existente",
            motherName: "Madre existente",
            birthDate: "2020-01-01"
          }
        ]
      ],
      [SyncBatch, [completedBatch("FEH_INSCRIPCIONES_FERIA")]]
    ]);
    const preview = await previewFedequinasImport(
      "FEH_INSCRIPCIONES_FERIA_PADRES",
      file,
      memory.source
    );

    expect(preview.counts).toMatchObject({ inserts: 1, updates: 1, skips: 1, errors: 0 });
    expect(preview.issues).toContainEqual(
      expect.objectContaining({ code: "ENTRY_NOT_FOUND", row: 4 })
    );

    await applyFedequinasImport(
      "FEH_INSCRIPCIONES_FERIA_PADRES",
      file,
      preview.previewToken,
      "user-id",
      memory.source
    );
    expect(memory.records(Horse).find((horse) => horse.registrationNumber === "REG-1")).toMatchObject({
      name: "Nombre actualizado",
      fatherName: "Padre existente",
      motherName: "Madre existente",
      birthDate: "2020-01-01"
    });
    const createdHorse = memory.records(Horse).find((horse) => horse.registrationNumber === "REG-2");
    expect(createdHorse).toMatchObject({
      name: "Nuevo",
      fatherName: "Padre nuevo",
      motherName: "Madre nueva"
    });
    expect(memory.records(FairEntry).find((entry) => entry.id === "entry-2")?.horseId).toBe(
      createdHorse?.id
    );
    expect(memory.records(Horse).some((horse) => horse.registrationNumber === "REG-3")).toBe(false);
  });

  it("segunda carga queda skipped y una actualización segura preserva datos operativos", async () => {
    const row = {
      ID_FERIA: "FERIA-1",
      NUMERO_INSCRIPCION: "10",
      NUMERO_REGISTRO: "REG-10",
      CODIGO_CATEGORIA: "CAT-1",
      POSICION_PISTA: "4",
      MONTADOR: "Nombre inicial",
      ID_MONTADOR: "CC-10",
      CONSECUTIVO_FERIA: "10"
    };
    const original = await buildFile("FEH_INSCRIPCIONES_FERIA", [row]);
    const existingEntry = {
      id: "entry-10",
      externalId: "FERIA-1:10:REG-10",
      sourceSystem: "FEDEQUINAS",
      fairId: "fair-id",
      inscriptionNumber: "10",
      registrationNumber: "REG-10",
      horseId: "horse-10",
      categoryId: "category-id",
      trackPosition: 4,
      riderName: "Anterior",
      riderDocumentNumber: "ANTERIOR",
      receipt: "RECIBO-1",
      participate: false,
      fairSequence: 10,
      isChild: true
    };
    const memory = memoryDataSource([
      [Fair, [fairSeed]],
      [Category, [{ id: "category-id", externalId: "CAT-1", sourceSystem: "FEDEQUINAS" }]],
      [Horse, [{ id: "horse-10", registrationNumber: "REG-10" }]],
      [FairEntry, [existingEntry]],
      [SyncBatch, [completedBatch("FEH_PERSONAL_FERIA")]]
    ]);
    const firstPreview = await previewFedequinasImport(
      "FEH_INSCRIPCIONES_FERIA",
      original,
      memory.source
    );
    await applyFedequinasImport(
      "FEH_INSCRIPCIONES_FERIA",
      original,
      firstPreview.previewToken,
      "user-id",
      memory.source
    );

    const secondPreview = await previewFedequinasImport(
      "FEH_INSCRIPCIONES_FERIA",
      original,
      memory.source
    );
    expect(secondPreview.counts).toMatchObject({ inserts: 0, updates: 0, skips: 1 });

    const changed = await buildFile("FEH_INSCRIPCIONES_FERIA", [
      { ...row, MONTADOR: "Nombre seguro", ID_MONTADOR: "CC-11" }
    ]);
    const changedPreview = await previewFedequinasImport(
      "FEH_INSCRIPCIONES_FERIA",
      changed,
      memory.source
    );
    expect(changedPreview.counts.updates).toBe(1);
    await applyFedequinasImport(
      "FEH_INSCRIPCIONES_FERIA",
      changed,
      changedPreview.previewToken,
      "user-id",
      memory.source
    );

    expect(memory.records(FairEntry)[0]).toMatchObject({
      riderName: "Nombre seguro",
      riderDocumentNumber: "CC-11",
      receipt: "RECIBO-1",
      participate: false,
      isChild: true
    });
  });

  it("rechaza cambios de identidad operativa cuando la categoría ya inició", async () => {
    const file = await buildFile("FEH_INSCRIPCIONES_FERIA", [
      {
        ID_FERIA: "FERIA-1",
        NUMERO_INSCRIPCION: "10",
        NUMERO_REGISTRO: "REG-10",
        CODIGO_CATEGORIA: "CAT-1",
        POSICION_PISTA: "99",
        MONTADOR: "Montador",
        ID_MONTADOR: "10",
        CONSECUTIVO_FERIA: "10"
      }
    ]);
    const memory = memoryDataSource([
      [Fair, [fairSeed]],
      [Category, [{ id: "category-id", externalId: "CAT-1", sourceSystem: "FEDEQUINAS" }]],
      [
        FairEntry,
        [
          {
            id: "entry-10",
            externalId: "FERIA-1:10:REG-10",
            sourceSystem: "FEDEQUINAS",
            fairId: "fair-id",
            categoryId: "category-id",
            trackPosition: 4,
            inscriptionNumber: "10",
            registrationNumber: "REG-10",
            fairSequence: 10
          }
        ]
      ],
      [
        FairCategoryStage,
        [
          {
            id: "stage-id",
            fairId: "fair-id",
            categoryId: "category-id",
            status: "JUDGING_STARTED"
          }
        ]
      ],
      [Horse, [{ id: "horse-10", registrationNumber: "REG-10" }]],
      [SyncBatch, [completedBatch("FEH_PERSONAL_FERIA")]]
    ]);

    const preview = await previewFedequinasImport("FEH_INSCRIPCIONES_FERIA", file, memory.source);

    expect(preview.counts.errors).toBe(1);
    expect(preview.issues).toContainEqual(
      expect.objectContaining({ code: "JUDGING_ALREADY_STARTED" })
    );
  });

  it("crea el batch con columnas Fedequinas explícitas", async () => {
    const file = await buildFairFile("Primera carga");
    const { source, batchCreate, batchSave } = applyDataSource();
    const preview = await previewFedequinasImport("FEH_FERIAS", file, source);

    const result = await applyFedequinasImport(
      "FEH_FERIAS",
      file,
      preview.previewToken,
      "user-id",
      source
    );

    expect(batchCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        entityName: "fairs",
        fileKind: "FEH_FERIAS",
        fairExternalId: "999992078",
        warningRows: 0
      })
    );
    expect(batchSave).toHaveBeenLastCalledWith(
      expect.objectContaining({ status: "COMPLETED", warningRows: 0 })
    );
    expect(result.batch.entityName).toBe("fairs");
  });

  it("consulta estado por fileKind y fairExternalId y usa warningRows", async () => {
    const findOne = vi.fn(async ({ where }: { where: { fileKind: string } }) => {
      if (where.fileKind !== "FEH_FERIAS") return null;
      return {
        id: "batch-id",
        sourceSystem: "FEDEQUINAS",
        entityName: "fairs",
        fileKind: "FEH_FERIAS",
        fairExternalId: "999992078",
        fileName: "FEH_FERIAS.xlsx",
        fileChecksum: "a".repeat(64),
        status: "COMPLETED",
        totalRows: 3,
        insertedRows: 2,
        updatedRows: 0,
        skippedRows: 1,
        failedRows: 0,
        warningRows: 2,
        startedAt: new Date("2026-07-23T20:00:00.000Z"),
        finishedAt: new Date("2026-07-23T20:01:00.000Z")
      };
    });
    const source = {
      getRepository: vi.fn((entity: unknown) => {
        expect(entity).toBe(SyncBatch);
        return { findOne };
      })
    } as unknown as DataSource;

    const result = await getFedequinasFairStatus("999992078", source);

    expect(findOne).toHaveBeenCalledWith({
      where: {
        sourceSystem: "FEDEQUINAS",
        fileKind: "FEH_FERIAS",
        fairExternalId: "999992078"
      },
      order: { startedAt: "DESC" }
    });
    expect(result.steps[0]).toMatchObject({
      status: "COMPLETED_WITH_WARNINGS",
      batch: {
        counts: { warnings: 2, errors: 0 }
      }
    });
    expect(result.steps[1].status).toBe("READY");
  });
});
