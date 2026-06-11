import "reflect-metadata";
import { Person } from "../entities/person.entity.js";
import { loadLocalEnv } from "../shared/load-env.js";

loadLocalEnv();

const SOURCE_SYSTEM = "FEDEQUINAS";

const FEDEQUINAS_PEOPLE: Array<{
  externalId: string;
  name: string;
  lastName: string;
  address?: string | null;
  indicative?: string | null;
  telephone?: string | null;
  phone?: string | null;
  avantelPhone?: string | null;
  email?: string | null;
}> = [
  {
    externalId: "93237635",
    name: "JAIRO ANDRES",
    lastName: "GONZALEZ A.",
    address: "CONJUNTO RESIDENCIAL CALLE REA",
    phone: "3105857588",
    email: "mvz_jairo@hotmail.com"
  }
];

async function main(): Promise<void> {
  const { getDataSource } = await import("../database/data-source.js");
  const dataSource = await getDataSource();

  try {
    const personRepo = dataSource.getRepository(Person);

    await personRepo.upsert(
      FEDEQUINAS_PEOPLE.map((person) => ({
        externalId: person.externalId,
        sourceSystem: SOURCE_SYSTEM,
        name: person.name,
        lastName: person.lastName,
        address: person.address ?? null,
        indicative: person.indicative ?? null,
        telephone: person.telephone ?? null,
        phone: person.phone ?? null,
        avantelPhone: person.avantelPhone ?? null,
        email: person.email ?? null
      })),
      {
        conflictPaths: ["externalId", "sourceSystem"],
        skipUpdateIfNoValuesChanged: true
      }
    );

    const loadedCount = await personRepo.count({
      where: { sourceSystem: SOURCE_SYSTEM }
    });

    console.log(`Personas Fedequinas cargadas: ${loadedCount} de ${FEDEQUINAS_PEOPLE.length}.`);
  } finally {
    await dataSource.destroy();
  }
}

main().catch((error: unknown) => {
  console.error("Error al cargar personas Fedequinas:");
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
