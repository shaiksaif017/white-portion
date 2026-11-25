// One CSV cell, safe to open in Excel / Google Sheets: anything that starts like a
// formula (= + - @, or a tab / carriage return in front of one) is prefixed with ' so
// it shows as text instead of running (CSV/formula injection).
export function csvCell(value: unknown): string {
  let s = value === undefined || value === null ? "" : String(value);
  if (/^[\s]*[=+\-@]/.test(s) || /^[\t\r]/.test(s)) s = `'${s}`;
  return `"${s.replace(/"/g, '""')}"`;
}
