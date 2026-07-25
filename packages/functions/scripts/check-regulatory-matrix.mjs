#!/usr/bin/env node
/**
 * Gate CI: ninguna regla CONFIRMADA/DECISIÓN_OPERATIVA sin prueba;
 * ninguna REQUIERE_EXPERTO marcada como implementada silenciosamente.
 */
import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "../../..");
const matrixPath = resolve(root, "docs/MATRIZ_REGLAMENTARIA_JUZGAMIENTO.md");
const matrix = readFileSync(matrixPath, "utf8");

const rowRe =
  /^\|\s*(R-[A-Z0-9-]+)\s*\|\s*([^|]+)\|\s*([^|]+)\|\s*([^|]+)\|\s*(CONFIRMADA|DECISIÓN_OPERATIVA|REQUIERE_EXPERTO|EXCEPCIÓN_CONOCIDA)\s*\|\s*([^|]+)\|/gm;

const rows = [];
for (const match of matrix.matchAll(rowRe)) {
  rows.push({
    id: match[1].trim(),
    status: match[5].trim(),
    test: match[6].trim()
  });
}

if (rows.length === 0) {
  console.error("No se encontraron filas de reglas en la matriz reglamentaria.");
  process.exit(1);
}

const errors = [];
for (const row of rows) {
  const testEmpty = !row.test || row.test === "—" || row.test.toLowerCase() === "n/a";
  if (
    (row.status === "CONFIRMADA" || row.status === "DECISIÓN_OPERATIVA") &&
    testEmpty
  ) {
    errors.push(`${row.id}: ${row.status} sin prueba declarada`);
  }
  if (row.status === "REQUIERE_EXPERTO") {
    const claimsImplemented =
      /implementad|habilitad|activo/i.test(row.test) && !/documentado/i.test(row.test);
    if (claimsImplemented) {
      errors.push(`${row.id}: REQUIERE_EXPERTO no puede habilitarse silenciosamente (${row.test})`);
    }
  }
}

if (errors.length > 0) {
  console.error("Gate reglamentario falló:\n" + errors.map((e) => ` - ${e}`).join("\n"));
  process.exit(1);
}

console.log(`Gate reglamentario OK (${rows.length} reglas).`);
