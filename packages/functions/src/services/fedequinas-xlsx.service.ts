import { createHash } from "node:crypto";
import ExcelJS from "exceljs";
import { BadRequestError } from "../lib/errors.js";

export const FEDEQUINAS_FILE_KINDS = [
  "FEH_FERIAS",
  "FEH_PERSONAL_FERIA",
  "FEH_INSCRIPCIONES_FERIA",
  "FEH_INSCRIPCIONES_FERIA_PADRES"
] as const;

export type FedequinasFileKind = (typeof FEDEQUINAS_FILE_KINDS)[number];
export type FedequinasRow = Record<string, string>;

const MAX_XLSX_SIZE_BYTES = 10 * 1024 * 1024;

export const FEDEQUINAS_HEADERS: Record<FedequinasFileKind, readonly string[]> = {
  FEH_FERIAS: [
    "ID_FERIA",
    "ANO",
    "DESCRIPCION",
    "FECHA_INICIO",
    "FECHA_FIN",
    "CODIGO_CIUDAD",
    "CODIGO_GRADO",
    "OBSERVACIONES",
    "INSCRITOS"
  ],
  FEH_PERSONAL_FERIA: [
    "ID_PERSONAL_FERIA",
    "ID_FERIA",
    "ID_PERSONAL",
    "ID_ROL",
    "NOMBRE"
  ],
  FEH_INSCRIPCIONES_FERIA: [
    "ID_FERIA",
    "NUMERO_INSCRIPCION",
    "NUMERO_REGISTRO",
    "CODIGO_CATEGORIA",
    "POSICION_PISTA",
    "MONTADOR",
    "ID_MONTADOR",
    "CONSECUTIVO_FERIA"
  ],
  FEH_INSCRIPCIONES_FERIA_PADRES: [
    "ID_FERIA",
    "NUMERO_INSCRIPCION",
    "NUMERO_REGISTRO",
    "NOMBRE_EJEMPLAR",
    "PADRE",
    "MADRE",
    "CODIGO_CATEGORIA",
    "POSICION_PISTA",
    "ID_MONTADOR",
    "MONTADOR"
  ]
};

export type FedequinasXlsxFile = {
  name: string;
  type: string;
  size: number;
  buffer: Buffer;
};

export type ParsedFedequinasWorkbook = {
  checksum: string;
  headers: string[];
  rows: Array<{ rowNumber: number; values: FedequinasRow }>;
};

function validateFile(file: FedequinasXlsxFile): void {
  if (!file.name.trim().toLowerCase().endsWith(".xlsx")) {
    throw new BadRequestError("El archivo debe tener extensión .xlsx.");
  }
  if (file.size <= 0 || file.buffer.length <= 0) {
    throw new BadRequestError("El archivo XLSX está vacío.");
  }
  if (file.size > MAX_XLSX_SIZE_BYTES || file.buffer.length > MAX_XLSX_SIZE_BYTES) {
    throw new BadRequestError("El archivo XLSX supera el tamaño máximo permitido de 10 MB.");
  }
}

function dateToText(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function cellToText(cell: ExcelJS.Cell): string {
  if (cell.value === null || cell.value === undefined) return "";
  if (cell.value instanceof Date) return dateToText(cell.value);
  if (typeof cell.value === "number" && /^0+$/.test(cell.numFmt)) {
    return String(cell.value).padStart(cell.numFmt.length, "0");
  }

  if (typeof cell.value === "object" && "result" in cell.value) {
    const result = cell.value.result;
    if (result instanceof Date) return dateToText(result);
    return result === null || result === undefined ? "" : String(result).trim();
  }

  return cell.text.trim();
}

function validateHeaders(fileKind: FedequinasFileKind, headers: string[]): void {
  const expected = FEDEQUINAS_HEADERS[fileKind];
  const missing = expected.filter((header) => !headers.includes(header));
  const extra = headers.filter((header) => !expected.includes(header));
  const duplicates = headers.filter((header, index) => headers.indexOf(header) !== index);

  if (headers.some((header) => !header)) {
    throw new BadRequestError("El XLSX contiene encabezados vacíos en la fila 1.");
  }
  if (missing.length || extra.length || duplicates.length || headers.length !== expected.length) {
    const details = [
      missing.length ? `faltantes: ${missing.join(", ")}` : null,
      extra.length ? `no esperados: ${extra.join(", ")}` : null,
      duplicates.length ? `duplicados: ${[...new Set(duplicates)].join(", ")}` : null
    ].filter(Boolean);
    throw new BadRequestError(`Encabezados inválidos para ${fileKind} (${details.join("; ")}).`);
  }
}

export function excelSerialDateToIso(value: string): string {
  const serial = Number(value);
  if (!Number.isFinite(serial)) return value.trim().slice(0, 10);

  const wholeDays = Math.floor(serial);
  const excelEpoch = Date.UTC(1899, 11, 30);
  return new Date(excelEpoch + wholeDays * 86_400_000).toISOString().slice(0, 10);
}

export async function parseFedequinasXlsx(
  fileKind: FedequinasFileKind,
  file: FedequinasXlsxFile
): Promise<ParsedFedequinasWorkbook> {
  validateFile(file);
  const workbook = new ExcelJS.Workbook();

  try {
    await workbook.xlsx.load(file.buffer as never);
  } catch {
    throw new BadRequestError("El archivo no es un XLSX válido.");
  }

  if (workbook.worksheets.length !== 1) {
    throw new BadRequestError("El XLSX debe contener exactamente una hoja.");
  }

  const worksheet = workbook.worksheets[0];
  const headers = Array.from(
    { length: worksheet.actualColumnCount },
    (_, index) => cellToText(worksheet.getRow(1).getCell(index + 1))
  );
  validateHeaders(fileKind, headers);

  const rows: ParsedFedequinasWorkbook["rows"] = [];
  for (let rowNumber = 2; rowNumber <= worksheet.rowCount; rowNumber += 1) {
    const worksheetRow = worksheet.getRow(rowNumber);
    const values: FedequinasRow = {};
    headers.forEach((header, index) => {
      values[header] = cellToText(worksheetRow.getCell(index + 1));
    });
    if (Object.values(values).some((value) => value !== "")) {
      rows.push({ rowNumber, values });
    }
  }

  if (rows.length === 0) {
    throw new BadRequestError("El XLSX debe incluir al menos una fila de datos.");
  }

  return {
    checksum: createHash("sha256").update(file.buffer).digest("hex"),
    headers,
    rows
  };
}
