/**
 * Dependency-free, bounded CSV reader for the v0.1 single-column statistics workflow.
 * Strict UTF-8; commas, CRLF/LF/CR, escaped quotes and multiline quoted fields.
 * No implicit column coercion, automatic uploads or silent row truncation.
 */
import { cleanNumericColumn } from "../core/numeric.js";
import type { NumericColumn } from "../domain/types.js";

export const CSV_LIMITS = Object.freeze({ maxBytes: 5 * 1024 * 1024, maxDataRows: 50_000, maxColumns: 100 });

export type CsvIssueCode = "FILE_TOO_LARGE" | "INVALID_UTF8" | "EMPTY_CSV" | "MALFORMED_QUOTE" |
  "UNEXPECTED_QUOTE" | "FIELD_COUNT_MISMATCH" | "ROW_LIMIT" | "COLUMN_LIMIT" | "BLANK_HEADER";

export class CsvImportError extends Error {
  constructor(public readonly code: CsvIssueCode, message: string, public readonly row?: number) {
    super(message); this.name = "CsvImportError";
  }
}

export interface CsvHeader {
  readonly id: string; // index-derived internal key; duplicate display names cannot collide
  readonly index: number;
  readonly original: string;
  readonly display: string;
  readonly duplicate: boolean;
}
export interface CsvDataset {
  readonly headers: readonly CsvHeader[];
  readonly rows: readonly (readonly string[])[];
  readonly warnings: readonly string[];
  readonly totalRows: number;
  readonly byteLength: number;
}
export interface CsvColumnProfile {
  readonly header: CsvHeader;
  readonly numeric: NumericColumn;
  readonly eligible: boolean;
}

/** CSV has header row; malformed records reject rather than produce incorrect statistics. */
export function parseCsvText(source: string, byteLength?: number): CsvDataset {
  const bytes = byteLength ?? new TextEncoder().encode(source).byteLength;
  if (bytes > CSV_LIMITS.maxBytes) throw new CsvImportError("FILE_TOO_LARGE", `CSV exceeds the 5 MiB limit (${bytes} bytes).`);
  const input = source.charCodeAt(0) === 0xfeff ? source.slice(1) : source;
  if (input.trim().length === 0) throw new CsvImportError("EMPTY_CSV", "CSV is empty. Include a header row.");

  let row: string[] = [];
  let field = "";
  let state: "start" | "bare" | "quoted" | "closed" = "start";
  let logicalRow = 1;
  const allRows: string[][] = [];
  let endedWithNewline = false;
  const commitField = (): void => { row.push(field); field = ""; state = "start"; };
  const commitRow = (): void => {
    commitField();
    if (allRows.length === 0) {
      if (row.length > CSV_LIMITS.maxColumns) throw new CsvImportError("COLUMN_LIMIT", "CSV exceeds the 100-column limit.", logicalRow);
    } else {
      if (row.length !== allRows[0]!.length) {
        throw new CsvImportError("FIELD_COUNT_MISMATCH", `Row ${logicalRow} contains ${row.length} fields; expected ${allRows[0]!.length}.`, logicalRow);
      }
      if (allRows.length > CSV_LIMITS.maxDataRows) throw new CsvImportError("ROW_LIMIT", "CSV exceeds the 50,000 data-row limit.", logicalRow);
    }
    allRows.push(row);
    row = [];
    logicalRow++;
  };
  for (let i = 0; i < input.length; i++) {
    const ch = input[i]!;
    endedWithNewline = false;
    if (state === "quoted") {
      if (ch === '"') {
        if (input[i+1] === '"') { field += '"'; i++; }
        else state = "closed";
      } else field += ch;
      continue;
    }
    if (ch === ',') { commitField(); continue; }
    if (ch === '\r' || ch === '\n') {
      commitRow();
      if (ch === '\r' && input[i+1] === '\n') i++;
      endedWithNewline = true;
      continue;
    }
    if (ch === '"') {
      if (state === "start") { state = "quoted"; continue; }
      throw new CsvImportError("UNEXPECTED_QUOTE", `Unexpected quotation mark in row ${logicalRow}, field ${row.length+1}.`, logicalRow);
    }
    if (state === "closed") throw new CsvImportError("MALFORMED_QUOTE", `Unexpected character after a closing quote at row ${logicalRow}, field ${row.length+1}.`, logicalRow);
    field += ch;
    state = "bare";
  }
  if (state === "quoted") throw new CsvImportError("MALFORMED_QUOTE", `Unclosed quoted field in row ${logicalRow}.`, logicalRow);
  // No synthetic blank row for the terminal record delimiter. Interior blank rows remain data.
  if (!endedWithNewline) commitRow();
  if (!allRows.length || allRows[0]!.every(h=>h.length === 0)) throw new CsvImportError("EMPTY_CSV", "CSV must begin with nonempty column headers.");

  const rawHeaders = allRows[0]!;
  const seen = new Map<string,number>();
  const headers: CsvHeader[] = rawHeaders.map((header, index) => {
    const name = header.trim();
    if (!name) throw new CsvImportError("BLANK_HEADER", `Header ${index+1} is blank. Give each column a name.`, 1);
    const key = name.toLocaleLowerCase("en-US");
    const ordinal = (seen.get(key) ?? 0) + 1;
    seen.set(key, ordinal);
    return { id:`column-${index}`, index, original:header, display:ordinal===1?name:`${name} (${ordinal})`, duplicate:ordinal>1 };
  });
  const warnings: string[] = [];
  if (headers.some(h=>h.duplicate)) warnings.push("Duplicate headers were assigned unique display labels; original column order is preserved.");
  const rows = allRows.slice(1);
  return { headers, rows, warnings, totalRows:rows.length, byteLength:bytes };
}

/** Byte-oriented entry point; fatal decoder rejects malformed UTF-8 rather than substituting data. */
export function parseCsvBytes(bytes: Uint8Array): CsvDataset {
  if (bytes.byteLength > CSV_LIMITS.maxBytes) throw new CsvImportError("FILE_TOO_LARGE", `CSV exceeds the 5 MiB limit (${bytes.byteLength} bytes).`);
  let text: string;
  try { text = new TextDecoder("utf-8", { fatal:true }).decode(bytes); }
  catch { throw new CsvImportError("INVALID_UTF8", "File is not valid UTF-8. Save it as UTF-8 CSV and try again."); }
  return parseCsvText(text, bytes.byteLength);
}

export function profileCsvColumns(dataset: CsvDataset): readonly CsvColumnProfile[] {
  return dataset.headers.map(header => {
    const numeric = cleanNumericColumn(dataset.rows.map(row => row[header.index]));
    return { header, numeric, eligible:numeric.validCount > 0 };
  });
}

export function getColumnById(dataset: CsvDataset, columnId: string): CsvColumnProfile {
  const header = dataset.headers.find(x=>x.id===columnId);
  if (!header) throw new RangeError(`Unknown column: ${columnId}`);
  const numeric = cleanNumericColumn(dataset.rows.map(row=>row[header.index]));
  return { header, numeric, eligible:numeric.validCount > 0 };
}
