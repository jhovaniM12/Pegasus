import "reflect-metadata";
import { EquineType } from "../entities/equine-type.entity.js";
import { loadLocalEnv } from "../shared/load-env.js";

loadLocalEnv();

const SOURCE_SYSTEM = "FEDEQUINAS";

const FEDEQUINAS_EQUINE_TYPES: Array<{
  externalId: string;
  name: string;
}> = [
  { externalId: "A", name: "ASNAL" },
  { externalId: "C", name: "CABALLAR" },
  { externalId: "E", name: "CASTRADO" },
  { externalId: "J", name: "JNP" },
  { externalId: "M", name: "MULAR" }
];

async function main(): Promise<void> {
  const { getDataSource } = await import("../database/data-source.js");
  const dataSource = await getDataSource();

  try {
    const equineTypeRepo = dataSource.getRepository(EquineType);

    await equineTypeRepo.upsert(
      FEDEQUINAS_EQUINE_TYPES.map((equineType) => ({
        externalId: equineType.externalId,
        sourceSystem: SOURCE_SYSTEM,
        name: equineType.name
      })),
      {
        conflictPaths: ["externalId", "sourceSystem"],
        skipUpdateIfNoValuesChanged: true
      }
    );

    const loadedCount = await equineTypeRepo.count({
      where: { sourceSystem: SOURCE_SYSTEM }
    });

    console.log(
      `Tipos de equino Fedequinas cargados: ${loadedCount} de ${FEDEQUINAS_EQUINE_TYPES.length}.`
    );
  } finally {
    await dataSource.destroy();
  }
}

main().catch((error: unknown) => {
  console.error("Error al cargar tipos de equino Fedequinas:");
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
