import { describe, expect, it } from 'vitest';
import { utils, write } from 'xlsx';
import { parseGvhExcelBuffer } from './parse-gvh-excel.js';

const HEADER = [
  'Termék azonosító',
  'Termék név',
  'Kategória azonosító',
  'Kategória név',
  'Üzletlánc név',
  'Egység',
  'Kiszerelés',
  'Minimum ár',
  'Maximum ár',
  'Minimum egységár',
  'Maximum egységár',
  'Hány üzletláncban elérhető',
  'Hány boltban elérhető',
  'Üzletlánc összes boltja',
];

function buildGvhWorkbookBuffer(sheetName: string, rows: string[][]): Buffer {
  const sheet = utils.aoa_to_sheet([HEADER, ...rows]);
  const workbook = utils.book_new();
  utils.book_append_sheet(workbook, sheet, sheetName);
  return write(workbook, { type: 'buffer', bookType: 'xlsx' }) as Buffer;
}

describe('parseGvhExcelBuffer', () => {
  it('extracts the import date from the sheet name', () => {
    const buffer = buildGvhWorkbookBuffer('Napi feltöltések - 2026-07-12', [
      [
        '0000000022989',
        'SÁRGARÉPA CSOMÓS  ',
        '36',
        'Sárgarépa',
        'Tesco',
        'db',
        '1',
        '499,0000',
        '499,0000',
        '499,0000',
        '499,0000',
        '1',
        '99',
        '197',
      ],
    ]);

    const { importDate } = parseGvhExcelBuffer(buffer);

    expect(importDate).toBe('2026-07-12');
  });

  it('throws a clear error when the sheet name has no date', () => {
    const buffer = buildGvhWorkbookBuffer('Napi feltöltések', [
      [
        '0000000022989',
        'Termék',
        '36',
        'Kategória',
        'Tesco',
        'db',
        '1',
        '100,0000',
        '100,0000',
        '100,0000',
        '100,0000',
        '1',
        '10',
        '20',
      ],
    ]);

    expect(() => parseGvhExcelBuffer(buffer)).toThrow(/dátumot/);
  });

  it('normalizes Hungarian decimal-comma prices and trims text fields', () => {
    const buffer = buildGvhWorkbookBuffer('Napi feltöltések - 2026-07-12', [
      [
        '0000000022989',
        'SÁRGARÉPA CSOMÓS  ',
        '36',
        'Sárgarépa',
        'Tesco',
        'db',
        '1',
        '499,0000',
        '650,5000',
        '499,0000',
        '650,5000',
        '2',
        '99',
        '197',
      ],
    ]);

    const { rows } = parseGvhExcelBuffer(buffer);

    expect(rows).toEqual([
      {
        productIdentifier: '0000000022989',
        productName: 'SÁRGARÉPA CSOMÓS',
        categoryIdentifier: 36,
        categoryName: 'Sárgarépa',
        retailerName: 'Tesco',
        unit: 'db',
        packageSize: 1,
        minimumPrice: 499,
        maximumPrice: 650.5,
        minimumUnitPrice: 499,
        maximumUnitPrice: 650.5,
        retailerCount: 2,
        availableStoreCount: 99,
        retailerTotalStoreCount: 197,
      },
    ]);
  });

  it('parses every row of a multi-row sheet', () => {
    const buffer = buildGvhWorkbookBuffer('Napi feltöltések - 2026-07-12', [
      [
        '0000000022989',
        'Sárgarépa',
        '36',
        'Zöldség',
        'Tesco',
        'db',
        '1',
        '499,0000',
        '499,0000',
        '499,0000',
        '499,0000',
        '1',
        '99',
        '197',
      ],
      [
        '0000000023023',
        'Karfiol',
        '45',
        'Zöldség',
        'Lidl',
        'db',
        '1',
        '649,0000',
        '649,0000',
        '649,0000',
        '649,0000',
        '1',
        '178',
        '197',
      ],
    ]);

    const { rows } = parseGvhExcelBuffer(buffer);

    expect(rows).toHaveLength(2);
    expect(rows.map((row) => row.retailerName)).toEqual(['Tesco', 'Lidl']);
  });
});
