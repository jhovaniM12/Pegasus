import "reflect-metadata";
import { User } from "../entities/user.entity.js";
import { hashPassword } from "../shared/password.js";
import { loadLocalEnv } from "../shared/load-env.js";

loadLocalEnv();

const ROOT_EMAIL = process.env.ROOT_EMAIL ?? "root@pegaso.com";
const ROOT_PASSWORD = process.env.ROOT_PASSWORD;

async function main(): Promise<void> {
  if (!ROOT_PASSWORD) {
    throw new Error("ROOT_PASSWORD es requerido para crear o actualizar el usuario root.");
  }

  const { getDataSource } = await import("../database/data-source.js");
  const dataSource = await getDataSource();

  try {
    const userRepo = dataSource.getRepository(User);
    const email = ROOT_EMAIL.toLowerCase();
    const passwordHash = await hashPassword(ROOT_PASSWORD);

    await userRepo.upsert(
      {
        email,
        passwordHash,
        role: "ROOT",
        personId: null,
        isActive: true
      },
      {
        conflictPaths: ["email"],
        skipUpdateIfNoValuesChanged: true
      }
    );

    console.log(`Usuario root listo: ${email}.`);
  } finally {
    await dataSource.destroy();
  }
}

main().catch((error: unknown) => {
  console.error("Error al cargar usuario root:");
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
