import "reflect-metadata";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { Category } from "../entities/category.entity.js";
import { EquineType } from "../entities/equine-type.entity.js";
import { Gait } from "../entities/gait.entity.js";
import { Grouping } from "../entities/grouping.entity.js";
import { Sex } from "../entities/sex.entity.js";
import { loadLocalEnv } from "../shared/load-env.js";

loadLocalEnv();

const SOURCE_SYSTEM = "FEDEQUINAS";
const BATCH_SIZE = 50;
const CATEGORIAS_FILE = join(dirname(fileURLToPath(import.meta.url)), "categorias.json");

type CategoriaJsonRow = {
  CODIGO_CATEGORIA: string;
  CODIGO_SEXO: string;
  CODIGO_TIPO_ANDAR: string;
  NOMBRE_CATEGORIA: string;
  EDAD_MAXIMA: string;
  EDAD_MINIMA: string;
  GRANDES_CAMP: string;
  CODIGO_TIP_EQUINO: string;
  SIGUIENTE_CATEGORIA: string;
  AGRUPADOR: string;
};

type LookupMaps = {
  sexes: Map<string, string>;
  gaits: Map<string, string>;
  equineTypes: Map<string, string>;
  groupings: Map<string, string>;
};

function loadCategorias(): CategoriaJsonRow[] {
  const content = readFileSync(CATEGORIAS_FILE, "utf8");
  const rows = JSON.parse(content) as CategoriaJsonRow[];

  if (!Array.isArray(rows) || rows.length === 0) {
    throw new Error("categorias.json está vacío o tiene un formato inválido.");
  }

  return rows;
}

async function buildLookupMaps(dataSource: Awaited<ReturnType<typeof import("../database/data-source.js")["getDataSource"]>>): Promise<LookupMaps> {
  const [sexes, gaits, equineTypes, groupings] = await Promise.all([
    dataSource.getRepository(Sex).find({
      where: { sourceSystem: SOURCE_SYSTEM },
      select: { id: true, externalId: true }
    }),
    dataSource.getRepository(Gait).find({
      where: { sourceSystem: SOURCE_SYSTEM },
      select: { id: true, externalId: true }
    }),
    dataSource.getRepository(EquineType).find({
      where: { sourceSystem: SOURCE_SYSTEM },
      select: { id: true, externalId: true }
    }),
    dataSource.getRepository(Grouping).find({
      where: { sourceSystem: SOURCE_SYSTEM },
      select: { id: true, externalId: true }
    })
  ]);

  const toMap = (rows: Array<{ id: string; externalId: string | null }>): Map<string, string> => {
    const map = new Map<string, string>();

    for (const row of rows) {
      if (row.externalId) {
        map.set(row.externalId, row.id);
      }
    }

    return map;
  };

  return {
    sexes: toMap(sexes),
    gaits: toMap(gaits),
    equineTypes: toMap(equineTypes),
    groupings: toMap(groupings)
  };
}

function resolveInternalId(
  map: Map<string, string>,
  externalId: string,
  catalogName: string,
  categoryCode: string
): string {
  const internalId = map.get(externalId);

  if (!internalId) {
    throw new Error(
      `Categoría ${categoryCode}: no se encontró ${catalogName} con external_id="${externalId}" y source_system="${SOURCE_SYSTEM}".`
    );
  }

  return internalId;
}

function mapCategoriaRow(row: CategoriaJsonRow, lookups: LookupMaps) {
  const categoryCode = row.CODIGO_CATEGORIA.trim();
  const nextCategoryCode = row.SIGUIENTE_CATEGORIA.trim();

  return {
    externalId: categoryCode,
    sourceSystem: SOURCE_SYSTEM,
    name: row.NOMBRE_CATEGORIA.trim(),
    sexId: resolveInternalId(lookups.sexes, row.CODIGO_SEXO.trim(), "sexo", categoryCode),
    gaitId: resolveInternalId(lookups.gaits, row.CODIGO_TIPO_ANDAR.trim(), "tipo de andar", categoryCode),
    equineTypeId: resolveInternalId(
      lookups.equineTypes,
      row.CODIGO_TIP_EQUINO.trim(),
      "tipo de equino",
      categoryCode
    ),
    minAgeMonths: Number(row.EDAD_MINIMA),
    maxAgeMonths: Number(row.EDAD_MAXIMA),
    nextCategoryCode: nextCategoryCode === "0" ? undefined : nextCategoryCode,
    groupingId: resolveInternalId(lookups.groupings, row.AGRUPADOR.trim(), "agrupador", categoryCode),
    largeCamps: Number.parseInt(row.GRANDES_CAMP, 10)
  };
}

async function main(): Promise<void> {
  const categorias = loadCategorias();
  const { getDataSource } = await import("../database/data-source.js");
  const dataSource = await getDataSource();

  try {
    const lookups = await buildLookupMaps(dataSource);
    const mappedCategories = categorias.map((row) => mapCategoriaRow(row, lookups));
    const categoryRepo = dataSource.getRepository(Category);

    for (let offset = 0; offset < mappedCategories.length; offset += BATCH_SIZE) {
      const batch = mappedCategories.slice(offset, offset + BATCH_SIZE);

      await categoryRepo.upsert(batch, {
        conflictPaths: ["externalId", "sourceSystem"],
        skipUpdateIfNoValuesChanged: true
      });
    }

    const loadedCount = await categoryRepo.count({
      where: { sourceSystem: SOURCE_SYSTEM }
    });

    console.log(`Categorías Fedequinas cargadas: ${loadedCount} de ${categorias.length}.`);
  } finally {
    await dataSource.destroy();
  }
}

main().catch((error: unknown) => {
  console.error("Error al cargar categorías Fedequinas:");
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
