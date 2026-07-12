import { read, utils } from 'xlsx';
import { type GvhProductRow, normalizeGvhRow } from './gvh-product-row.js';

export interface ParsedGvhDataset {
  importDate: string;
  rows: GvhProductRow[];
}

const SHEET_NAME_DATE_PATTERN = /(\d{4}-\d{2}-\d{2})/;

// A GVH munkalap neve "Napi feltöltések - YYYY-MM-DD" alakú - ez az adat
// tényleges, hivatalos napja, megbízhatóbb mint a letöltés időpontja.
function extractImportDate(sheetName: string): string {
  const match = SHEET_NAME_DATE_PATTERN.exec(sheetName);
  if (!match) {
    throw new Error(`A munkalap neve nem tartalmaz dátumot: "${sheetName}"`);
  }
  return match[1];
}

export function parseGvhExcelBuffer(buffer: Buffer): ParsedGvhDataset {
  const workbook = read(buffer, { type: 'buffer' });
  const sheetName = workbook.SheetNames[0];
  if (!sheetName) {
    throw new Error('Az Excel fájl nem tartalmaz munkalapot.');
  }

  const sheet = workbook.Sheets[sheetName];
  const rawRows = utils.sheet_to_json(sheet, { defval: null });

  return {
    importDate: extractImportDate(sheetName),
    rows: rawRows.map(normalizeGvhRow),
  };
}
