import { existsSync } from "node:fs";
import { dirname, parse, resolve } from "node:path";
import ExcelJS from "exceljs";
import { describe, expect, it } from "vitest";

function resolveRepoRootFromCwd(): string {
  let current = resolve(process.cwd());
  const filesystemRoot = parse(current).root;

  while (!existsSync(resolve(current, "pnpm-workspace.yaml"))) {
    if (current === filesystemRoot) {
      throw new Error(`No se encontró la raíz del repo desde cwd=${process.cwd()}.`);
    }
    current = dirname(current);
  }
  return current;
}

function rowsFromSheet(
  sheet: ExcelJS.Worksheet,
  headerRowNumber: number,
  firstDataRowNumber: number
): Array<Record<string, string>> {
  const headerRow = sheet.getRow(headerRowNumber);
  const headers = Array.from(
    { length: headerRow.cellCount },
    (_, index) => headerRow.getCell(index + 1).text.trim()
  );
  const rows: Array<Record<string, string>> = [];

  for (let rowNumber = firstDataRowNumber; rowNumber <= sheet.rowCount; rowNumber += 1) {
    const row = sheet.getRow(rowNumber);
    const values = Object.fromEntries(
      headers.map((header, index) => [header, row.getCell(index + 1).text.trim()])
    );
    if (Object.values(values).some(Boolean)) rows.push(values);
  }
  return rows;
}

function compoundKey(row: Record<string, string>): string {
  return [row.ID_FERIA, row.NUMERO_INSCRIPCION, row.NUMERO_REGISTRO].join(":");
}

const villetaFixturePath = resolve(
  resolveRepoRootFromCwd(),
  "docs/planos/COPA COLOMBIA - VILLETA-INFO.xlsx"
);

describe("aceptación XLSX Copa Colombia Villeta", () => {
  it.skipIf(!existsSync(villetaFixturePath))(
    "conserva las 270 inscripciones y cruza 269 filas de Padres",
    async () => {
      const workbook = new ExcelJS.Workbook();
      await workbook.xlsx.readFile(villetaFixturePath);
      const inscriptionsSheet = workbook.getWorksheet("FEH_INSCRIPCIONES_FERIA");
      const parentsSheet = workbook.getWorksheet("FEH_INSCRIPCIONES_FERIA_PADRES");
      expect(inscriptionsSheet, "Falta FEH_INSCRIPCIONES_FERIA").toBeDefined();
      expect(parentsSheet, "Falta FEH_INSCRIPCIONES_FERIA_PADRES").toBeDefined();

      const inscriptions = rowsFromSheet(inscriptionsSheet!, 12, 13);
      const parents = rowsFromSheet(parentsSheet!, 4, 5);
      expect(inscriptions).toHaveLength(270);

      const inscriptionFrequency = new Map<string, number>();
      for (const row of inscriptions) {
        inscriptionFrequency.set(
          row.NUMERO_INSCRIPCION,
          (inscriptionFrequency.get(row.NUMERO_INSCRIPCION) ?? 0) + 1
        );
      }
      const repeated = Array.from(inscriptionFrequency).filter(([, count]) => count > 1);
      expect(repeated).toHaveLength(3);
      expect(repeated.map(([, count]) => count)).toEqual([3, 3, 3]);
      expect(repeated.reduce((total, [, count]) => total + count, 0)).toBe(9);
      expect(new Set(inscriptions.map(compoundKey)).size).toBe(270);

      const parentKeys = new Set(parents.map(compoundKey));
      const matched = inscriptions.filter((row) => parentKeys.has(compoundKey(row)));
      const pending = inscriptions.filter((row) => !parentKeys.has(compoundKey(row)));
      expect(parents).toHaveLength(269);
      expect(matched).toHaveLength(269);
      expect(pending).toHaveLength(1);
      expect(pending[0]).toMatchObject({ NUMERO_INSCRIPCION: "358054" });
    }
  );
});
