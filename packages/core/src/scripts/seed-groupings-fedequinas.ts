import "reflect-metadata";
import { Grouping } from "../entities/grouping.entity.js";
import { loadLocalEnv } from "../shared/load-env.js";

loadLocalEnv();

const SOURCE_SYSTEM = "FEDEQUINAS";

const FEDEQUINAS_GROUPINGS: Array<{
  externalId: string;
}> = [
  { externalId: "CDCA" },
  { externalId: "GCR" },
  { externalId: "GYCC" },
  { externalId: "GYPC" },
  { externalId: "JDRA" },
  { externalId: "JNPA" },
  { externalId: "MEDY" },
  { externalId: "REGU" },
  { externalId: "RFCO" }
];

async function main(): Promise<void> {
  const { getDataSource } = await import("../database/data-source.js");
  const dataSource = await getDataSource();

  try {
    const groupingRepo = dataSource.getRepository(Grouping);

    await groupingRepo.upsert(
      FEDEQUINAS_GROUPINGS.map((grouping) => ({
        externalId: grouping.externalId,
        sourceSystem: SOURCE_SYSTEM
      })),
      {
        conflictPaths: ["externalId", "sourceSystem"],
        skipUpdateIfNoValuesChanged: true
      }
    );

    const loadedCount = await groupingRepo.count({
      where: { sourceSystem: SOURCE_SYSTEM }
    });

    console.log(`Agrupadores Fedequinas cargados: ${loadedCount} de ${FEDEQUINAS_GROUPINGS.length}.`);
  } finally {
    await dataSource.destroy();
  }
}

main().catch((error: unknown) => {
  console.error("Error al cargar agrupadores Fedequinas:");
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
