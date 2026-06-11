import "reflect-metadata";
import { Gait } from "../entities/gait.entity.js";
import { loadLocalEnv } from "../shared/load-env.js";

loadLocalEnv();

const SOURCE_SYSTEM = "FEDEQUINAS";

const FEDEQUINAS_GAITS: Array<{
  externalId: string;
  name: string;
}> = [
  { externalId: "P1", name: "TROTE Y GALOPE COLOMBIANOS" },
  { externalId: "P2", name: "TROCHA Y GALOPE COLOMBIANO" },
  { externalId: "P3", name: "TROCHA COLOMBIANA" },
  { externalId: "P4", name: "PASO FINO COLOMBIANO" },
  { externalId: "P5", name: "SIN PASO" }
];

async function main(): Promise<void> {
  const { getDataSource } = await import("../database/data-source.js");
  const dataSource = await getDataSource();

  try {
    const gaitRepo = dataSource.getRepository(Gait);

    await gaitRepo.upsert(
      FEDEQUINAS_GAITS.map((gait) => ({
        externalId: gait.externalId,
        sourceSystem: SOURCE_SYSTEM,
        name: gait.name
      })),
      {
        conflictPaths: ["externalId", "sourceSystem"],
        skipUpdateIfNoValuesChanged: true
      }
    );

    const loadedCount = await gaitRepo.count({
      where: { sourceSystem: SOURCE_SYSTEM }
    });

    console.log(`Tipos de andar Fedequinas cargados: ${loadedCount} de ${FEDEQUINAS_GAITS.length}.`);
  } finally {
    await dataSource.destroy();
  }
}

main().catch((error: unknown) => {
  console.error("Error al cargar tipos de andar Fedequinas:");
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
