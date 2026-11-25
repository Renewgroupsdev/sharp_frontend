import { toCsv } from './csv.util';
import { fileStamp, saveBlob } from './export.util';

/** Downloads rows as a CSV file named `<name>-<date>.csv` (UTF-8 with a BOM so Excel reads it). */
export function downloadCsv(name: string, head: string[], rows: unknown[][]): void {
  saveBlob(new Blob([toCsv(head, rows)], { type: 'text/csv;charset=utf-8' }), `${name}-${fileStamp()}.csv`);
}
