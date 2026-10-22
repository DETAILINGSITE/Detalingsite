/**
 * CSV writer for admin exports. Neutralises spreadsheet formula injection: any cell
 * starting with = + - @ (or tab/CR) is prefixed with a single quote.
 */
export interface CsvColumn<T> {
  header: string;
  value: (row: T) => string | number | boolean | null | undefined | Date;
}

const DANGEROUS = /^[=+\-@\t\r]/;

export function csvCell(raw: string | number | boolean | null | undefined | Date): string {
  if (raw === null || raw === undefined) return "";
  let value = raw instanceof Date ? raw.toISOString() : String(raw);
  if (typeof raw === "string" && DANGEROUS.test(value)) value = `'${value}`;
  if (/[",\r\n]/.test(value)) value = `"${value.replace(/"/g, '""')}"`;
  return value;
}

export function toCsv<T>(rows: readonly T[], columns: readonly CsvColumn<T>[]): string {
  const header = columns.map((c) => csvCell(c.header)).join(",");
  const body = rows.map((r) => columns.map((c) => csvCell(c.value(r))).join(","));
  // BOM so Excel opens UTF-8 correctly.
  return "﻿" + [header, ...body].join("\r\n") + "\r\n";
}
