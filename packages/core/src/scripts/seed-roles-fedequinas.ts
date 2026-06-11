import "reflect-metadata";
import { Role } from "../entities/role.entity.js";
import { loadLocalEnv } from "../shared/load-env.js";

loadLocalEnv();

const SOURCE_SYSTEM = "FEDEQUINAS";

const FEDEQUINAS_ROLES: Array<{
  externalId: string;
  name: string;
  typeRole: string;
}> = [
  { externalId: "0", name: "NO VALIDO", typeRole: "D" },
  { externalId: "1", name: "DIRECTOR GENERAL", typeRole: "D" },
  { externalId: "2", name: "JUEZ", typeRole: "D" },
  { externalId: "3", name: "DIRECTOR TÉCNICO", typeRole: "D" },
  { externalId: "4", name: "ASISTENTE DE PISTA", typeRole: "D" },
  { externalId: "5", name: "LOCUTOR TÉCNICO", typeRole: "D" },
  { externalId: "6", name: "JEFE DE ALOJAMIENTO", typeRole: "D" },
  { externalId: "7", name: "JEFE DE PISTA", typeRole: "D" },
  { externalId: "8", name: "AUXILIARES DE PISTA", typeRole: "D" },
  { externalId: "A", name: "VOCAL 1", typeRole: "J" },
  { externalId: "B", name: "TERCEROS", typeRole: "D" },
  { externalId: "C", name: "ASOCIADOS", typeRole: "D" },
  { externalId: "D", name: "VEEDOR", typeRole: "D" },
  { externalId: "E", name: "VOCAL PRINCIPAL", typeRole: "J" },
  { externalId: "F", name: "VOCAL SUPLENTE", typeRole: "J" },
  { externalId: "G", name: "REVISOR FISCAL PPAL", typeRole: "J" },
  { externalId: "H", name: "REVISOR FISCAL SUPLENTE", typeRole: "J" },
  { externalId: "I", name: "INSPECTOR DE APEROS", typeRole: "D" },
  { externalId: "L", name: "PALAFRENERO", typeRole: "D" },
  { externalId: "M", name: "MONTADOR", typeRole: "D" },
  { externalId: "N", name: "EMPADRONADOR", typeRole: "D" },
  { externalId: "P", name: "PRESIDENTE", typeRole: "J" },
  { externalId: "R", name: "INSPECTOR DE REGISTROS", typeRole: "D" },
  { externalId: "S", name: "SECRETARIO", typeRole: "J" },
  { externalId: "T", name: "TESORERO", typeRole: "J" },
  { externalId: "V", name: "VICEPRESIDENTE", typeRole: "J" },
  { externalId: "Y", name: "DIRECTOR DE CONCURSO", typeRole: "D" },
  { externalId: "Z", name: "VETERINARIO AUTORIZADO", typeRole: "D" }
];

async function main(): Promise<void> {
  const { getDataSource } = await import("../database/data-source.js");
  const dataSource = await getDataSource();

  try {
    const roleRepo = dataSource.getRepository(Role);

    await roleRepo.upsert(
      FEDEQUINAS_ROLES.map((role) => ({
        externalId: role.externalId,
        sourceSystem: SOURCE_SYSTEM,
        name: role.name,
        typeRole: role.typeRole
      })),
      {
        conflictPaths: ["externalId", "sourceSystem"],
        skipUpdateIfNoValuesChanged: true
      }
    );

    const loadedCount = await roleRepo.count({
      where: { sourceSystem: SOURCE_SYSTEM }
    });

    console.log(`Roles Fedequinas cargados: ${loadedCount} de ${FEDEQUINAS_ROLES.length}.`);
  } finally {
    await dataSource.destroy();
  }
}

main().catch((error: unknown) => {
  console.error("Error al cargar roles Fedequinas:");
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
