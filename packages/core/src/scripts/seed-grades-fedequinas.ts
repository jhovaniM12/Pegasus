import "reflect-metadata";
import { Grade } from "../entities/grade.entity.js";
import { loadLocalEnv } from "../shared/load-env.js";

loadLocalEnv();

const SOURCE_SYSTEM = "FEDEQUINAS";

const FEDEQUINAS_GRADES: Array<{
  externalId: string;
  name: string;
  nomenclature: string;
}> = [
  { externalId: "1", name: "NACIONAL", nomenclature: "N" },
  { externalId: "2", name: 'EXPOSICION GRADO "A"', nomenclature: "A" },
  { externalId: "3", name: 'EXPOSICION GRADO "B"', nomenclature: "B" },
  { externalId: "4", name: "NACIONAL JINETES NO PROFESIONA", nomenclature: "N" },
  { externalId: "5", name: 'EXPOSICION DOBLE "AA"', nomenclature: "AA" },
  { externalId: "6", name: 'JNP GRADO "B"', nomenclature: "B" }
];

async function main(): Promise<void> {
  const { getDataSource } = await import("../database/data-source.js");
  const dataSource = await getDataSource();

  try {
    const gradeRepo = dataSource.getRepository(Grade);

    await gradeRepo.upsert(
      FEDEQUINAS_GRADES.map((grade) => ({
        externalId: grade.externalId,
        sourceSystem: SOURCE_SYSTEM,
        name: grade.name,
        nomenclature: grade.nomenclature
      })),
      {
        conflictPaths: ["externalId", "sourceSystem"],
        skipUpdateIfNoValuesChanged: true
      }
    );

    const loadedCount = await gradeRepo.count({
      where: { sourceSystem: SOURCE_SYSTEM }
    });

    console.log(`Grados Fedequinas cargados: ${loadedCount} de ${FEDEQUINAS_GRADES.length}.`);
  } finally {
    await dataSource.destroy();
  }
}

main().catch((error: unknown) => {
  console.error("Error al cargar grados Fedequinas:");
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
