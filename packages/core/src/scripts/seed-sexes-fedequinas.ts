import "reflect-metadata";
import { Sex } from "../entities/sex.entity.js";
import { loadLocalEnv } from "../shared/load-env.js";

loadLocalEnv();

const SOURCE_SYSTEM = "FEDEQUINAS";

const FEDEQUINAS_SEXES: Array<{
  externalId: string;
  name: string;
}> = [
  { externalId: "1", name: "MACHO" },
  { externalId: "2", name: "HEMBRA" }
];

async function main(): Promise<void> {
  const { getDataSource } = await import("../database/data-source.js");
  const dataSource = await getDataSource();

  try {
    const sexRepo = dataSource.getRepository(Sex);

    await sexRepo.upsert(
      FEDEQUINAS_SEXES.map((sex) => ({
        externalId: sex.externalId,
        sourceSystem: SOURCE_SYSTEM,
        name: sex.name
      })),
      {
        conflictPaths: ["externalId", "sourceSystem"],
        skipUpdateIfNoValuesChanged: true
      }
    );

    const loadedCount = await sexRepo.count({
      where: { sourceSystem: SOURCE_SYSTEM }
    });

    console.log(`Sexos Fedequinas cargados: ${loadedCount} de ${FEDEQUINAS_SEXES.length}.`);
  } finally {
    await dataSource.destroy();
  }
}

main().catch((error: unknown) => {
  console.error("Error al cargar sexos Fedequinas:");
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
