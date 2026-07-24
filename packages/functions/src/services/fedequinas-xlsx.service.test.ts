import ExcelJS from "exceljs";
import { describe, expect, it } from "vitest";
import {
  excelSerialDateToIso,
  FEDEQUINAS_HEADERS,
  parseFedequinasXlsx,
  type FedequinasXlsxFile
} from "./fedequinas-xlsx.service.js";

async function xlsxFile(
  workbook: ExcelJS.Workbook,
  name = "archivo.xlsx"
): Promise<FedequinasXlsxFile> {
  const buffer = Buffer.from(await workbook.xlsx.writeBuffer());
  return {
    name,
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    size: buffer.length,
    buffer
  };
}

async function fairWorkbook(
  mutate?: (workbook: ExcelJS.Workbook, worksheet: ExcelJS.Worksheet) => void
): Promise<FedequinasXlsxFile> {
  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet("FEH_FERIAS");
  worksheet.addRow(FEDEQUINAS_HEADERS.FEH_FERIAS);
  worksheet.addRow([
    "00042",
    "2026",
    "Feria de prueba",
    new Date("2026-07-17T00:00:00.000Z"),
    new Date("2026-07-19T00:00:00.000Z"),
    "025875",
    "02",
    "",
    "130"
  ]);
  mutate?.(workbook, worksheet);
  const buffer = Buffer.from(await workbook.xlsx.writeBuffer());
  return {
    name: "FEH_FERIAS.xlsx",
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    size: buffer.length,
    buffer
  };
}

describe("parseFedequinasXlsx", () => {
  it("preserva texto, fechas y calcula checksum", async () => {
    const file = await fairWorkbook();
    const parsed = await parseFedequinasXlsx("FEH_FERIAS", file);

    expect(parsed.rows).toHaveLength(1);
    expect(parsed.rows[0].values.ID_FERIA).toBe("00042");
    expect(parsed.rows[0].values.CODIGO_CIUDAD).toBe("025875");
    expect(parsed.rows[0].values.FECHA_INICIO).toBe("2026-07-17");
    expect(parsed.checksum).toMatch(/^[a-f0-9]{64}$/);
  });

  it("preserva ceros a la izquierda y puntuación de identificadores formateados", async () => {
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet("FEH_FERIAS");
    worksheet.addRow(FEDEQUINAS_HEADERS.FEH_FERIAS);
    const row = worksheet.addRow([
      42,
      "2026",
      "Feria",
      46220,
      46222,
      "25.875-01",
      "02",
      "",
      "1"
    ]);
    row.getCell(1).numFmt = "00000";

    const parsed = await parseFedequinasXlsx("FEH_FERIAS", await xlsxFile(workbook));

    expect(parsed.rows[0].values).toMatchObject({
      ID_FERIA: "00042",
      CODIGO_CIUDAD: "25.875-01",
      OBSERVACIONES: ""
    });
  });

  it("rechaza libros con más de una hoja", async () => {
    const file = await fairWorkbook((workbook) => workbook.addWorksheet("otra"));

    await expect(parseFedequinasXlsx("FEH_FERIAS", file)).rejects.toThrow(
      "exactamente una hoja"
    );
  });

  it.each([
    ["faltantes", ["ID_FERIA"]],
    ["adicionales", [...FEDEQUINAS_HEADERS.FEH_FERIAS, "NO_ESPERADO"]]
  ])("rechaza encabezados %s", async (_case, headers) => {
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet("FEH_FERIAS");
    worksheet.addRow(headers);
    worksheet.addRow(headers.map(() => "x"));

    await expect(
      parseFedequinasXlsx("FEH_FERIAS", await xlsxFile(workbook, "FEH_FERIAS.xlsx"))
    ).rejects.toThrow("Encabezados inválidos");
  });

  it("rechaza extensión, archivo vacío y tamaño mayor a 10 MB", async () => {
    const file = await fairWorkbook();
    await expect(parseFedequinasXlsx("FEH_FERIAS", { ...file, name: "feria.xls" })).rejects.toThrow(
      ".xlsx"
    );
    await expect(
      parseFedequinasXlsx("FEH_FERIAS", { ...file, size: 0, buffer: Buffer.alloc(0) })
    ).rejects.toThrow("vacío");
    await expect(
      parseFedequinasXlsx("FEH_FERIAS", {
        ...file,
        size: 10 * 1024 * 1024 + 1
      })
    ).rejects.toThrow("10 MB");
  });

  it("ignora filas totalmente vacías y rechaza libros sin datos", async () => {
    const valid = await fairWorkbook((_workbook, worksheet) => worksheet.addRow([]));
    expect((await parseFedequinasXlsx("FEH_FERIAS", valid)).rows).toHaveLength(1);

    const workbook = new ExcelJS.Workbook();
    workbook.addWorksheet("FEH_FERIAS").addRow(FEDEQUINAS_HEADERS.FEH_FERIAS);
    await expect(parseFedequinasXlsx("FEH_FERIAS", await xlsxFile(workbook))).rejects.toThrow(
      "al menos una fila"
    );
  });
});

describe("excelSerialDateToIso", () => {
  it("convierte seriales Excel con el ajuste del año 1900", () => {
    expect(excelSerialDateToIso("1")).toBe("1899-12-31");
    expect(excelSerialDateToIso("2")).toBe("1900-01-01");
    expect(excelSerialDateToIso("45500")).toBe("2024-07-27");
  });
});
