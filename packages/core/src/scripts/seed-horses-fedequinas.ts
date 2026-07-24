import "reflect-metadata";
import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { Horse } from "../entities/horse.entity.js";
import { loadLocalEnv } from "../shared/load-env.js";

loadLocalEnv();

const SOURCE_SYSTEM = "FEDEQUINAS";
const BATCH_SIZE = 50;
const HORSES_FILE = join(
  dirname(fileURLToPath(import.meta.url)),
  "informacion-ejemplares.json"
);

type HorseJsonRow = {
  NUMERO_REGISTRO?: string | null;
  NOMBRE_EJEMPLAR?: string | null;
  FECHA_NACIMIENTO?: string | null;
  CODIGO_COLOR?: string | null;
  NUMERO_MICROCHIP?: string | null;
  CODIGO_ASOCIACION?: string | null;
  CODIGO_CIUDAD_NACIMIENTO?: string | null;
  NUMERO_REGISTRO_PADRE?: string | null;
  NOMBRE_PADRE?: string | null;
  NUMERO_REGISTRO_MADRE?: string | null;
  NOMBRE_MADRE?: string | null;
};

function loadHorses(): HorseJsonRow[] {
  if (!existsSync(HORSES_FILE)) {
    throw new Error(
      `No se encontró informacion-ejemplares.json en ${HORSES_FILE}. Copia allí el archivo INFORMACION_EJEMPLARES exportado por Fedequinas.`
    );
  }

  const content = readFileSync(HORSES_FILE, "utf8");
  const rows = JSON.parse(content) as HorseJsonRow[];

  if (!Array.isArray(rows) || rows.length === 0) {
    throw new Error("informacion-ejemplares.json está vacío o tiene un formato inválido.");
  }

  return rows;
}

function clean(value: string | null | undefined): string | null {
  const trimmed = value?.trim();

  return trimmed ? trimmed : null;
}

function normalizeDate(value: string | null | undefined): string | null {
  const trimmed = clean(value);

  if (!trimmed) {
    return null;
  }

  return trimmed.slice(0, 10);
}

function validateUniqueRegistrationNumbers(rows: HorseJsonRow[]): void {
  const seen = new Set<string>();

  for (const [index, row] of rows.entries()) {
    const registrationNumber = clean(row.NUMERO_REGISTRO);

    if (!registrationNumber) {
      throw new Error(`Ejemplar fila ${index + 1}: NUMERO_REGISTRO es obligatorio.`);
    }

    if (Object.hasOwn(row, "NOMBRE_EJEMPLAR") && !clean(row.NOMBRE_EJEMPLAR)) {
      throw new Error(
        `Ejemplar ${registrationNumber}: NOMBRE_EJEMPLAR viene en el archivo pero está vacío.`
      );
    }

    if (seen.has(registrationNumber)) {
      throw new Error(`Ejemplar duplicado en archivo: NUMERO_REGISTRO="${registrationNumber}".`);
    }

    seen.add(registrationNumber);
  }
}

function mapHorseRow(row: HorseJsonRow) {
  const registrationNumber = clean(row.NUMERO_REGISTRO);

  if (!registrationNumber) {
    throw new Error("NUMERO_REGISTRO es obligatorio para crear un ejemplar.");
  }

  return {
    externalId: registrationNumber,
    sourceSystem: SOURCE_SYSTEM,
    name: clean(row.NOMBRE_EJEMPLAR),
    registrationNumber,
    birthDate: normalizeDate(row.FECHA_NACIMIENTO),
    colorCode: clean(row.CODIGO_COLOR),
    microchipNumber: clean(row.NUMERO_MICROCHIP),
    associationCode: clean(row.CODIGO_ASOCIACION),
    birthCityCode: clean(row.CODIGO_CIUDAD_NACIMIENTO),
    fatherRegistrationNumber: clean(row.NUMERO_REGISTRO_PADRE),
    fatherName: clean(row.NOMBRE_PADRE),
    motherRegistrationNumber: clean(row.NUMERO_REGISTRO_MADRE),
    motherName: clean(row.NOMBRE_MADRE)
  };
}

async function main(): Promise<void> {
  const rows = loadHorses();
  validateUniqueRegistrationNumbers(rows);

  const { getDataSource } = await import("../database/data-source.js");
  const dataSource = await getDataSource();

  try {
    const horseRepo = dataSource.getRepository(Horse);
    const mappedHorses = rows.map(mapHorseRow);

    for (let offset = 0; offset < mappedHorses.length; offset += BATCH_SIZE) {
      const batch = mappedHorses.slice(offset, offset + BATCH_SIZE);

      await horseRepo.upsert(batch, {
        conflictPaths: ["registrationNumber"],
        skipUpdateIfNoValuesChanged: true
      });
    }

    const loadedCount = await horseRepo.count({
      where: { sourceSystem: SOURCE_SYSTEM }
    });

    console.log(`Ejemplares Fedequinas cargados: ${loadedCount} de ${rows.length}.`);
  } finally {
    await dataSource.destroy();
  }
}

main().catch((error: unknown) => {
  console.error("Error al cargar ejemplares Fedequinas:");
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
