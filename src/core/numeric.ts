import type { NumericColumn, NumericExclusion } from "../domain/types.js";

/** Missing tokens are case insensitive after whitespace normalization. */
const MISSING = new Set(["", "na", "n/a", "null", "-"]);
const STRICT_DECIMAL = /^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?$/;

export function parseNumericCell(input: string | null | undefined):
  | { kind: "valid"; value: number }
  | { kind: "missing" | "invalid" } {
  const trimmed = (input ?? "").trim();
  if (MISSING.has(trimmed.toLowerCase())) return { kind: "missing" };
  if (!STRICT_DECIMAL.test(trimmed)) return { kind: "invalid" };
  const value = Number(trimmed);
  if (!Number.isFinite(value)) return { kind: "invalid" };
  return { kind: "valid", value };
}

/** Never coerces junk, nonfinite values, or missing text to zero. */
export function cleanNumericColumn(rows: readonly (string | null | undefined)[]): NumericColumn {
  const values: number[] = [];
  const exclusions: NumericExclusion[] = [];
  let missingCount = 0;
  let invalidCount = 0;
  rows.forEach((raw, rowIndex) => {
    const parsed = parseNumericCell(raw);
    if (parsed.kind === "valid") values.push(parsed.value);
    else {
      exclusions.push({ raw, rowIndex, kind: parsed.kind });
      if (parsed.kind === "missing") missingCount++;
      else invalidCount++;
    }
  });
  return { values, totalRows: rows.length, validCount: values.length, missingCount, invalidCount, exclusions };
}

export function assertFiniteNumbers(values: readonly number[]): void {
  for (const value of values) {
    if (!Number.isFinite(value)) throw new TypeError("Statistical calculations require finite numeric observations.");
  }
}
