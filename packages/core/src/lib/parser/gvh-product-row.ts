import { z } from 'zod';
import { parseHungarianNumber } from './hungarian-number.js';

// A GVH Árfigyelő Excel nyers, magyar nyelvű oszlopfejlécei. Minden cella
// szövegként érkezik (xlsx sheet_to_json), ezért a határon (rendszerhatár =
// külső fájl) itt validálunk, mielőtt bármit is normalizálnánk - konvenciok.md.
const RawGvhRowSchema = z.object({
  'Termék azonosító': z.string(),
  'Termék név': z.string(),
  'Kategória azonosító': z.string(),
  'Kategória név': z.string(),
  'Üzletlánc név': z.string(),
  Egység: z.string().nullable(),
  Kiszerelés: z.string().nullable(),
  'Minimum ár': z.string(),
  'Maximum ár': z.string(),
  'Minimum egységár': z.string().nullable(),
  'Maximum egységár': z.string().nullable(),
  'Hány üzletláncban elérhető': z.string().nullable(),
  'Hány boltban elérhető': z.string().nullable(),
  'Üzletlánc összes boltja': z.string().nullable(),
});

export interface GvhProductRow {
  productIdentifier: string;
  productName: string;
  categoryIdentifier: number | null;
  categoryName: string;
  retailerName: string;
  unit: string | null;
  packageSize: number | null;
  minimumPrice: number;
  maximumPrice: number;
  minimumUnitPrice: number | null;
  maximumUnitPrice: number | null;
  retailerCount: number | null;
  availableStoreCount: number | null;
  retailerTotalStoreCount: number | null;
}

function parseOptionalNumber(raw: string | null): number | null {
  if (raw === null || raw.trim() === '') {
    return null;
  }
  return parseHungarianNumber(raw);
}

// Excel sor -> normalizált, angol mezőnevű objektum (architektura.md 11. pont).
export function normalizeGvhRow(raw: unknown): GvhProductRow {
  const row = RawGvhRowSchema.parse(raw);

  return {
    productIdentifier: row['Termék azonosító'].trim(),
    productName: row['Termék név'].trim(),
    categoryIdentifier: parseOptionalNumber(row['Kategória azonosító']),
    categoryName: row['Kategória név'].trim(),
    retailerName: row['Üzletlánc név'].trim(),
    unit: row.Egység?.trim() || null,
    packageSize: parseOptionalNumber(row.Kiszerelés),
    minimumPrice: parseHungarianNumber(row['Minimum ár']),
    maximumPrice: parseHungarianNumber(row['Maximum ár']),
    minimumUnitPrice: parseOptionalNumber(row['Minimum egységár']),
    maximumUnitPrice: parseOptionalNumber(row['Maximum egységár']),
    retailerCount: parseOptionalNumber(row['Hány üzletláncban elérhető']),
    availableStoreCount: parseOptionalNumber(row['Hány boltban elérhető']),
    retailerTotalStoreCount: parseOptionalNumber(
      row['Üzletlánc összes boltja'],
    ),
  };
}
