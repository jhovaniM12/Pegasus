import "reflect-metadata";
import { loadLocalEnv } from "../shared/load-env.js";

loadLocalEnv();

async function main(): Promise<void> {
  if (!process.env.DATABASE_URL) {
    console.error("DATABASE_URL no está definida. Crea .env en la raíz del monorepo.");
    process.exit(1);
  }

  const { getDataSource } = await import("../database/data-source.js");
  const dataSource = await getDataSource();

  try {
    const [{ ok }] = await dataSource.query("SELECT 1 AS ok");
    const [{ db }] = await dataSource.query("SELECT current_database() AS db");
    const [{ version }] = await dataSource.query("SELECT version() AS version");

    console.log("Conexión exitosa a PostgreSQL (Neon).");
    console.log(`Base de datos: ${db}`);
    console.log(`Ping: ${ok}`);
    console.log(`Motor: ${version}`);
  } finally {
    await dataSource.destroy();
  }
}

main().catch((error: unknown) => {
  console.error("Error al conectar con PostgreSQL:");
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
