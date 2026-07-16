import "reflect-metadata";
import { Fair } from "../entities/fair.entity.js";
import { FairStaff } from "../entities/fair-staff.js";
import { Person } from "../entities/person.entity.js";
import { Role } from "../entities/role.entity.js";
import { loadLocalEnv } from "../shared/load-env.js";

loadLocalEnv();

const SOURCE_SYSTEM = "FEDEQUINAS";

const FEDEQUINAS_FAIR_STAFF: Array<{
  externalId: string;
  fairExternalId: string;
  personExternalId: string;
  roleExternalId: string;
}> = [
  {
    externalId: "manual-staff-juez-2",
    fairExternalId: "999992036",
    personExternalId: "manual-juez-2",
    roleExternalId: "2"
  },
  {
    externalId: "manual-staff-juez-jairo",
    fairExternalId: "999992036",
    personExternalId: "93237635",
    roleExternalId: "2"
  },
  {
    externalId: "manual-staff-juez-3",
    fairExternalId: "999992036",
    personExternalId: "manual-juez-3",
    roleExternalId: "2"
  }
];

type LookupMap = Map<string, string>;

function toLookupMap(rows: Array<{ id: string; externalId: string | null }>): LookupMap {
  const map = new Map<string, string>();

  for (const row of rows) {
    if (row.externalId) {
      map.set(row.externalId, row.id);
    }
  }

  return map;
}

function resolveInternalId(
  map: LookupMap,
  externalId: string,
  catalogName: string,
  staffExternalId: string
): string {
  const internalId = map.get(externalId);

  if (!internalId) {
    throw new Error(
      `Personal de feria ${staffExternalId}: no se encontró ${catalogName} con external_id="${externalId}" y source_system="${SOURCE_SYSTEM}".`
    );
  }

  return internalId;
}

async function main(): Promise<void> {
  const { getDataSource } = await import("../database/data-source.js");
  const dataSource = await getDataSource();

  try {
    const [fairs, people, roles] = await Promise.all([
      dataSource.getRepository(Fair).find({
        where: { sourceSystem: SOURCE_SYSTEM },
        select: { id: true, externalId: true }
      }),
      dataSource.getRepository(Person).find({
        select: { id: true, externalId: true }
      }),
      dataSource.getRepository(Role).find({
        where: { sourceSystem: SOURCE_SYSTEM },
        select: { id: true, externalId: true }
      })
    ]);

    const fairLookup = toLookupMap(fairs);
    const personLookup = toLookupMap(people);
    const roleLookup = toLookupMap(roles);
    const fairStaffRepo = dataSource.getRepository(FairStaff);

    await fairStaffRepo.upsert(
      FEDEQUINAS_FAIR_STAFF.map((staff) => ({
        externalId: staff.externalId,
        sourceSystem: SOURCE_SYSTEM,
        fairId: resolveInternalId(fairLookup, staff.fairExternalId, "feria", staff.externalId),
        personId: resolveInternalId(
          personLookup,
          staff.personExternalId,
          "persona",
          staff.externalId
        ),
        roleId: resolveInternalId(roleLookup, staff.roleExternalId, "rol", staff.externalId)
      })),
      {
        conflictPaths: ["externalId", "sourceSystem"],
        skipUpdateIfNoValuesChanged: true
      }
    );

    const loadedCount = await fairStaffRepo.count({
      where: { sourceSystem: SOURCE_SYSTEM }
    });

    console.log(`Personal de feria Fedequinas cargado: ${loadedCount} de ${FEDEQUINAS_FAIR_STAFF.length}.`);
  } finally {
    await dataSource.destroy();
  }
}

main().catch((error: unknown) => {
  console.error("Error al cargar personal de feria Fedequinas:");
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
