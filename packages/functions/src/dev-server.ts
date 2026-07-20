import "reflect-metadata";
import { createAdaptorServer } from "@hono/node-server";
import { loadLocalEnv } from "@pegasus/core";
import { app } from "./app.js";

loadLocalEnv();

const basePort = Number(process.env.PORT ?? 3000);
const maxAttempts = 10;

function listen(port: number): Promise<ReturnType<typeof createAdaptorServer>> {
  return new Promise((resolve, reject) => {
    const server = createAdaptorServer({ fetch: app.fetch });

    server.once("error", (error: NodeJS.ErrnoException) => {
      reject(error);
    });

    server.listen(port, () => {
      resolve(server);
    });
  });
}

async function startDevServer(): Promise<void> {
  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    const port = basePort + attempt;

    try {
      await listen(port);

      if (attempt > 0) {
        console.warn(`Puerto ${basePort} ocupado. Usando http://localhost:${port}`);
      } else {
        console.log(`Pegaso API escuchando en http://localhost:${port}`);
      }

      return;
    } catch (error) {
      const errno = error as NodeJS.ErrnoException;

      if (errno.code !== "EADDRINUSE") {
        console.error("Error al iniciar el servidor:", errno.message);
        process.exit(1);
      }
    }
  }

  console.error(
    `No hay puertos libres entre ${basePort} y ${basePort + maxAttempts - 1}. ` +
      `Cierra el proceso que usa el puerto o define PORT manualmente.`
  );
  process.exit(1);
}

startDevServer();
