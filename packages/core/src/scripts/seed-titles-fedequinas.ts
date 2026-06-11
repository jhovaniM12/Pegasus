import "reflect-metadata";
import { Title } from "../entities/title.entity.js";
import { loadLocalEnv } from "../shared/load-env.js";

loadLocalEnv();

const SOURCE_SYSTEM = "FEDEQUINAS";

const FEDEQUINAS_TITLES: Array<{
  externalId: string;
  name: string;
}> = [
  { externalId: "1", name: "Jefe de Raza" },
  { externalId: "2", name: "Yegua con Mejor descendencia" },
  { externalId: "3", name: "Ejemplar Nacional" },
  { externalId: "4", name: "Campeón de Campeones" },
  { externalId: "5", name: "Campeona de Campeonas" },
  { externalId: "6", name: "Gran Campeón" },
  { externalId: "7", name: "Gran Campeona" },
  { externalId: "8", name: "Gran Campeón Reservado" },
  { externalId: "9", name: "Gran Campeona Reservada" },
  { externalId: "10", name: "Fuera de Concurso" },
  { externalId: "11", name: "Mejor Grupo de Yeguas para Cría" },
  { externalId: "12", name: "Mejor Grupo de Yeguas con Cría" },
  { externalId: "13", name: "Mejor Potro o Potranca Adiestrado(a) a la Cuerda" },
  { externalId: "14", name: "Campeón Joven o Campeona Joven" },
  { externalId: "15", name: "Mejor Caballo Castrado" },
  { externalId: "16", name: "Mejor Mular" },
  { externalId: "17", name: "Primero" },
  { externalId: "18", name: "Segundo" },
  { externalId: "19", name: "Tercero" },
  { externalId: "20", name: "Cuarto" },
  { externalId: "21", name: "Quinto" },
  { externalId: "22", name: "Mejor Criador" },
  { externalId: "23", name: "Mejor Expositor" },
  { externalId: "24", name: "Mejor Mular" },
  { externalId: "25", name: "Campeón Asnal Criollo Macho" },
  { externalId: "26", name: "Campeón Reservado Asnal Criollo Macho" },
  { externalId: "27", name: "Campeón Asnal Criollo Hembra" },
  { externalId: "28", name: "Campeón Reservado Asnal Criollo Hembra" },
  { externalId: "29", name: "Jefe de Raza Asnal" },
  { externalId: "30", name: "Mejor Descendencia Hembra Asnal" },
  { externalId: "31", name: "Mejor Grupo Burras con Cría" },
  { externalId: "32", name: "Mejor Grupo Burras para Cría" },
  { externalId: "33", name: "PRIMER PUESTO" },
  { externalId: "34", name: "SEGUNDO PUESTO" },
  { externalId: "35", name: "TERCER PUESTO" },
  { externalId: "36", name: "CUARTO PUESTO" },
  { externalId: "37", name: "QUINTO PUESTO" },
  { externalId: "38", name: "PRIMER PUESTO DESCENDENCIA" },
  { externalId: "39", name: "SEGUNDO PUESTO DESCENDENCIA" },
  { externalId: "40", name: "TERCER PUESTO DESCENDENCIA" },
  { externalId: "41", name: "CUARTO PUESTO DESCENDENCIA" },
  { externalId: "42", name: "QUINTO PUESTO DESCENDENCIA" },
  { externalId: "43", name: "MEJOR EJEMPLAR ABIERTA JNP" },
  { externalId: "44", name: "Fuera de Concurso" },
  { externalId: "45", name: "Fuera de Concurso" }
];

async function main(): Promise<void> {
  const { getDataSource } = await import("../database/data-source.js");
  const dataSource = await getDataSource();

  try {
    const titleRepo = dataSource.getRepository(Title);

    await titleRepo.upsert(
      FEDEQUINAS_TITLES.map((title) => ({
        externalId: title.externalId,
        sourceSystem: SOURCE_SYSTEM,
        name: title.name
      })),
      {
        conflictPaths: ["externalId", "sourceSystem"],
        skipUpdateIfNoValuesChanged: true
      }
    );

    const loadedCount = await titleRepo.count({
      where: { sourceSystem: SOURCE_SYSTEM }
    });

    console.log(`Títulos Fedequinas cargados: ${loadedCount} de ${FEDEQUINAS_TITLES.length}.`);
  } finally {
    await dataSource.destroy();
  }
}

main().catch((error: unknown) => {
  console.error("Error al cargar títulos Fedequinas:");
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
