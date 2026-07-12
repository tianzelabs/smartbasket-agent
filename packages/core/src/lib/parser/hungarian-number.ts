// A GVH Árfigyelő Excel magyar tizedesvesszős formátumban adja az árakat
// és mennyiségeket (pl. "499,0000"), sosem ezres elválasztóval.
export function parseHungarianNumber(raw: string): number {
  const normalized = raw.trim().replace(',', '.');
  const value = Number(normalized);
  if (Number.isNaN(value)) {
    throw new Error(`Nem szám formátumú érték: "${raw}"`);
  }
  return value;
}
