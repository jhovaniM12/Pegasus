import "reflect-metadata";
import { City } from "../entities/city.entity.js";
import { Fair } from "../entities/fair.entity.js";
import { Grade } from "../entities/grade.entity.js";
import { loadLocalEnv } from "../shared/load-env.js";

loadLocalEnv();

const SOURCE_SYSTEM = "FEDEQUINAS";

const FEDEQUINAS_FAIRS: Array<{
  externalId: string;
  name: string;
  year: number;
  startDate: string;
  endDate: string;
  cityExternalId: string;
  gradeExternalId: string;
  comments?: string;
  registeredCount?: number;
}> = [
  {
    externalId: "999992036",
    name: "EXPOSEDE",
    year: 2026,
    startDate: "2026-05-20",
    endDate: "2026-05-23",
    cityExternalId: "5615",
    gradeExternalId: "3",
    registeredCount: 200
  }
];

type LookupMap = Map<string, string>;

async function buildLookupMap(
  rows: Array<{ id: string; externalId: string | null }>
): Promise<LookupMap> {
  const map = new Map<string, string>();

  for (const row of rows) {
    if (row.externalId) {
      map.set(row.externalId, row.id);
    }
  }

  return map;
}

function cityExternalIdCandidates(code: string): string[] {
  const trimmed = code.trim();
  const candidates = [trimmed];

  if (/^\d+$/.test(trimmed)) {
    candidates.push(trimmed.padStart(5, "0"));
  }

  return [...new Set(candidates)];
}

function resolveInternalId(
  map: LookupMap,
  externalId: string,
  catalogName: string,
  fairExternalId: string
): string {
  const internalId = map.get(externalId);

  if (!internalId) {
    throw new Error(
      `Feria ${fairExternalId}: no se encontró ${catalogName} con external_id="${externalId}" y source_system="${SOURCE_SYSTEM}".`
    );
  }

  return internalId;
}

function resolveCityId(map: LookupMap, cityExternalId: string, fairExternalId: string): string {
  for (const candidate of cityExternalIdCandidates(cityExternalId)) {
    const internalId = map.get(candidate);

    if (internalId) {
      return internalId;
    }
  }

  throw new Error(
    `Feria ${fairExternalId}: no se encontró ciudad con external_id="${cityExternalId}" (ni variantes con ceros a la izquierda) y source_system="${SOURCE_SYSTEM}".`
  );
}

async function main(): Promise<void> {
  const { getDataSource } = await import("../database/data-source.js");
  const dataSource = await getDataSource();

  try {
    const [cities, grades] = await Promise.all([
      dataSource.getRepository(City).find({
        where: { sourceSystem: SOURCE_SYSTEM },
        select: { id: true, externalId: true }
      }),
      dataSource.getRepository(Grade).find({
        where: { sourceSystem: SOURCE_SYSTEM },
        select: { id: true, externalId: true }
      })
    ]);

    const cityLookup = await buildLookupMap(cities);
    const gradeLookup = await buildLookupMap(grades);
    const fairRepo = dataSource.getRepository(Fair);

    await fairRepo.upsert(
      FEDEQUINAS_FAIRS.map((fair) => ({
        externalId: fair.externalId,
        sourceSystem: SOURCE_SYSTEM,
        name: fair.name,
        year: fair.year,
        startDate: fair.startDate,
        endDate: fair.endDate,
        cityId: resolveCityId(cityLookup, fair.cityExternalId, fair.externalId),
        gradeId: resolveInternalId(
          gradeLookup,
          fair.gradeExternalId,
          "grado",
          fair.externalId
        ),
        comments: fair.comments,
        registeredCount: fair.registeredCount
      })),
      {
        conflictPaths: ["externalId", "sourceSystem"],
        skipUpdateIfNoValuesChanged: true
      }
    );

    const loadedCount = await fairRepo.count({
      where: { sourceSystem: SOURCE_SYSTEM }
    });

    console.log(`Ferias Fedequinas cargadas: ${loadedCount} de ${FEDEQUINAS_FAIRS.length}.`);
  } finally {
    await dataSource.destroy();
  }
}

main().catch((error: unknown) => {
  console.error("Error al cargar ferias Fedequinas:");
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
