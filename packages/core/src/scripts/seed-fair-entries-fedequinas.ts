import "reflect-metadata";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { Category } from "../entities/category.entity.js";
import { Fair } from "../entities/fair.entity.js";
import { FairEntry } from "../entities/fair-entries.js";
import { Horse } from "../entities/horse.entity.js";
import { loadLocalEnv } from "../shared/load-env.js";

loadLocalEnv();

const SOURCE_SYSTEM = "FEDEQUINAS";
const BATCH_SIZE = 50;
const INSCRIPCIONES_FILE = join(
  dirname(fileURLToPath(import.meta.url)),
  "incripciones-montadores.json"
);

type InscripcionJsonRow = {
  ID_FERIA: string;
  NUMERO_INSCRIPCION: string;
  NUMERO_REGISTRO: string;
  CODIGO_CATEGORIA: string;
  POSICION_PISTA: string;
  MONTADOR: string;
  ID_MONTADOR: string;
  RECIBO: string;
  PARTICIPA: string;
  CONSECUTIVO_FERIA: string;
  ES_HIJO: string;
};

type LookupMap = Map<string, string>;

function loadInscripciones(): InscripcionJsonRow[] {
  const content = readFileSync(INSCRIPCIONES_FILE, "utf8");
  const rows = JSON.parse(content) as InscripcionJsonRow[];

  if (!Array.isArray(rows) || rows.length === 0) {
    throw new Error("incripciones-montadores.json está vacío o tiene un formato inválido.");
  }

  return rows;
}

function toLookupMap(rows: Array<{ id: string; externalId: string | null }>): LookupMap {
  const map = new Map<string, string>();

  for (const row of rows) {
    if (row.externalId) {
      map.set(row.externalId, row.id);
    }
  }

  return map;
}

function resolveInternalId(
  map: LookupMap,
  externalId: string,
  catalogName: string,
  inscriptionNumber: string
): string {
  const internalId = map.get(externalId);

  if (!internalId) {
    throw new Error(
      `Inscripción ${inscriptionNumber}: no se encontró ${catalogName} con external_id="${externalId}" y source_system="${SOURCE_SYSTEM}".`
    );
  }

  return internalId;
}

function parseFlag(value: string): boolean {
  return value.trim() === "1";
}

function mapInscripcionRow(
  row: InscripcionJsonRow,
  fairLookup: LookupMap,
  categoryLookup: LookupMap,
  horseLookup: LookupMap,
  unresolvedRegistrations: Set<string>
) {
  const inscriptionNumber = row.NUMERO_INSCRIPCION.trim();
  const fairExternalId = row.ID_FERIA.trim();
  const categoryExternalId = row.CODIGO_CATEGORIA.trim();
  const registrationNumber = row.NUMERO_REGISTRO.trim();
  const horseId = horseLookup.get(registrationNumber) ?? null;
  const stableExternalId = `${fairExternalId}:${inscriptionNumber}:${registrationNumber}`;

  if (!horseId) {
    unresolvedRegistrations.add(registrationNumber || `(vacío en inscripción ${inscriptionNumber})`);
  }

  return {
    externalId: stableExternalId,
    sourceSystem: SOURCE_SYSTEM,
    fairId: resolveInternalId(fairLookup, fairExternalId, "feria", inscriptionNumber),
    inscriptionNumber,
    registrationNumber,
    horseId,
    categoryId: resolveInternalId(
      categoryLookup,
      categoryExternalId,
      "categoría",
      inscriptionNumber
    ),
    trackPosition: Number.parseInt(row.POSICION_PISTA, 10),
    riderName: row.MONTADOR.trim(),
    riderDocumentNumber: row.ID_MONTADOR.trim(),
    receipt: row.RECIBO.trim(),
    participate: parseFlag(row.PARTICIPA),
    fairSequence: Number.parseInt(row.CONSECUTIVO_FERIA, 10),
    isChild: parseFlag(row.ES_HIJO)
  };
}

async function main(): Promise<void> {
  const inscripciones = loadInscripciones();
  const { getDataSource } = await import("../database/data-source.js");
  const dataSource = await getDataSource();

  try {
    const [fairs, categories, horses] = await Promise.all([
      dataSource.getRepository(Fair).find({
        where: { sourceSystem: SOURCE_SYSTEM },
        select: { id: true, externalId: true }
      }),
      dataSource.getRepository(Category).find({
        where: { sourceSystem: SOURCE_SYSTEM },
        select: { id: true, externalId: true }
      }),
      dataSource.getRepository(Horse).find({
        where: { sourceSystem: SOURCE_SYSTEM },
        select: { id: true, registrationNumber: true }
      })
    ]);

    const fairLookup = toLookupMap(fairs);
    const categoryLookup = toLookupMap(categories);
    const horseLookup = new Map(horses.map((horse) => [horse.registrationNumber, horse.id]));
    const unresolvedRegistrations = new Set<string>();
    const mappedEntries = inscripciones.map((row) =>
      mapInscripcionRow(row, fairLookup, categoryLookup, horseLookup, unresolvedRegistrations)
    );
    const fairEntryRepo = dataSource.getRepository(FairEntry);

    for (let offset = 0; offset < mappedEntries.length; offset += BATCH_SIZE) {
      const batch = mappedEntries.slice(offset, offset + BATCH_SIZE);

      await fairEntryRepo.upsert(batch, {
        conflictPaths: ["externalId", "sourceSystem"],
        skipUpdateIfNoValuesChanged: true
      });
    }

    const loadedCount = await fairEntryRepo.count({
      where: { sourceSystem: SOURCE_SYSTEM }
    });

    console.log(`Inscripciones Fedequinas cargadas: ${loadedCount} de ${inscripciones.length}.`);

    if (unresolvedRegistrations.size > 0) {
      console.warn(
        `Inscripciones sin ejemplar relacionado en horses: ${unresolvedRegistrations.size}. ` +
          `NUMERO_REGISTRO pendientes: ${Array.from(unresolvedRegistrations).join(", ")}.`
      );
    }
  } finally {
    await dataSource.destroy();
  }
}

main().catch((error: unknown) => {
  console.error("Error al cargar inscripciones Fedequinas:");
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
