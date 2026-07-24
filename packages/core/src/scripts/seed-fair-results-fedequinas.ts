import "reflect-metadata";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { Category } from "../entities/category.entity.js";
import { Fair } from "../entities/fair.entity.js";
import { FairEntry } from "../entities/fair-entries.js";
import { FairResult } from "../entities/fair-results.js";
import { Grade } from "../entities/grade.entity.js";
import { Title } from "../entities/title.entity.js";
import { loadLocalEnv } from "../shared/load-env.js";

loadLocalEnv();

const SOURCE_SYSTEM = "FEDEQUINAS";
const BATCH_SIZE = 50;
const RESULTADOS_FILE = join(dirname(fileURLToPath(import.meta.url)), "resultados-feria.json");

type ResultadoJsonRow = {
  ID_FERIA: string;
  NUMERO_INSCRIPCION: string;
  NUMERO_REGISTRO: string;
  CODIGO_GRADO: string;
  CODIGO_CATEGORIA: string;
  CODIGO_TITULO: string;
  PUESTO_OBTENIDO: string;
  PUNTAJE_EJEMPLAR: string;
};

type LookupMap = Map<string, string>;

function loadResultados(): ResultadoJsonRow[] {
  const content = readFileSync(RESULTADOS_FILE, "utf8");
  const rows = JSON.parse(content) as ResultadoJsonRow[];

  if (!Array.isArray(rows) || rows.length === 0) {
    throw new Error("resultados-feria.json está vacío o tiene un formato inválido.");
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
      `Resultado inscripción ${inscriptionNumber}: no se encontró ${catalogName} con external_id="${externalId}" y source_system="${SOURCE_SYSTEM}".`
    );
  }

  return internalId;
}

function mapResultadoRow(
  row: ResultadoJsonRow,
  fairLookup: LookupMap,
  fairEntryLookup: LookupMap,
  gradeLookup: LookupMap,
  categoryLookup: LookupMap,
  titleLookup: LookupMap
) {
  const inscriptionNumber = row.NUMERO_INSCRIPCION;
  const fairEntryExternalId = `${row.ID_FERIA}:${inscriptionNumber}:${row.NUMERO_REGISTRO}`;

  return {
    externalId: null,
    sourceSystem: SOURCE_SYSTEM,
    fairId: resolveInternalId(fairLookup, row.ID_FERIA, "feria", inscriptionNumber),
    fairEntryId: resolveInternalId(
      fairEntryLookup,
      fairEntryExternalId,
      "inscripción",
      inscriptionNumber
    ),
    gradeId: resolveInternalId(gradeLookup, row.CODIGO_GRADO, "grado", inscriptionNumber),
    categoryId: resolveInternalId(
      categoryLookup,
      row.CODIGO_CATEGORIA,
      "categoría",
      inscriptionNumber
    ),
    titleId: resolveInternalId(titleLookup, row.CODIGO_TITULO, "título", inscriptionNumber),
    positionObtained: Number(row.PUESTO_OBTENIDO),
    score: Number(row.PUNTAJE_EJEMPLAR)
  };
}

async function main(): Promise<void> {
  const { getDataSource } = await import("../database/data-source.js");
  const dataSource = await getDataSource();
  const resultados = loadResultados();

  try {
    const [fairs, fairEntries, grades, categories, titles] = await Promise.all([
      dataSource.getRepository(Fair).find({
        where: { sourceSystem: SOURCE_SYSTEM },
        select: { id: true, externalId: true }
      }),
      dataSource.getRepository(FairEntry).find({
        where: { sourceSystem: SOURCE_SYSTEM },
        select: { id: true, externalId: true }
      }),
      dataSource.getRepository(Grade).find({
        where: { sourceSystem: SOURCE_SYSTEM },
        select: { id: true, externalId: true }
      }),
      dataSource.getRepository(Category).find({
        where: { sourceSystem: SOURCE_SYSTEM },
        select: { id: true, externalId: true }
      }),
      dataSource.getRepository(Title).find({
        where: { sourceSystem: SOURCE_SYSTEM },
        select: { id: true, externalId: true }
      })
    ]);

    const fairLookup = toLookupMap(fairs);
    const fairEntryLookup = toLookupMap(fairEntries);
    const gradeLookup = toLookupMap(grades);
    const categoryLookup = toLookupMap(categories);
    const titleLookup = toLookupMap(titles);
    const fairResultRepo = dataSource.getRepository(FairResult);

    const mappedRows = resultados.map((row) =>
      mapResultadoRow(
        row,
        fairLookup,
        fairEntryLookup,
        gradeLookup,
        categoryLookup,
        titleLookup
      )
    );

    for (let offset = 0; offset < mappedRows.length; offset += BATCH_SIZE) {
      const batch = mappedRows.slice(offset, offset + BATCH_SIZE);

      await fairResultRepo.upsert(batch, {
        conflictPaths: ["fairId", "fairEntryId", "categoryId", "titleId"],
        skipUpdateIfNoValuesChanged: true
      });
    }

    const loadedCount = await fairResultRepo.count({
      where: { sourceSystem: SOURCE_SYSTEM }
    });

    console.log(`Resultados de feria Fedequinas cargados: ${loadedCount} de ${resultados.length}.`);
  } finally {
    await dataSource.destroy();
  }
}

main().catch((error: unknown) => {
  console.error("Error al cargar resultados de feria Fedequinas:");
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
