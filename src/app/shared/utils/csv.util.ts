/** Quote a value for a CSV cell. */
export const csvCell = (v: unknown): string => `"${String(v ?? '').replace(/"/g, '""')}"`;

/** Build CSV text (with a BOM so Excel reads UTF-8) from a header row and data rows. */
export function toCsv(head: string[], rows: unknown[][]): string {
  return '﻿' + [head, ...rows].map(r => r.map(csvCell).join(',')).join('\r\n');
}

/** Parse CSV text into rows of cells, honouring quotes and skipping blank lines. */
export function parseCsv(input: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = '';
  let quoted = false;
  const text = input.replace(/^﻿/, '');
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (quoted) {
      if (c === '"') {
        if (text[i + 1] === '"') { cell += '"'; i++; } else quoted = false;
      } else cell += c;
    } else if (c === '"') quoted = true;
    else if (c === ',') { row.push(cell); cell = ''; }
    else if (c === '\n' || c === '\r') {
      if (c === '\r' && text[i + 1] === '\n') i++;
      row.push(cell); cell = '';
      if (row.some(x => x.trim())) rows.push(row);
      row = [];
    } else cell += c;
  }
  row.push(cell);
  if (row.some(x => x.trim())) rows.push(row);
  return rows;
}
