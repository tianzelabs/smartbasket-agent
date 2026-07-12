export class UnsafeSqlError extends Error {}

// Egyetlen SELECT/WITH statement engedélyezett (konvenciok.md 5. pont). Ez a
// projekt legnagyobb biztonsági felszíne: az agent felhasználói kérdésből
// generál SQL-t, ORM nélkül - ezért két védelmi réteg van: ez a guard, és a
// read-only SQLite-kapcsolat (db-readonly.ts), ami DB-szinten is tiltja az írást.
const FORBIDDEN_KEYWORDS = [
  'INSERT',
  'UPDATE',
  'DELETE',
  'DROP',
  'ALTER',
  'CREATE',
  'ATTACH',
  'DETACH',
  'PRAGMA',
  'REPLACE',
  'TRUNCATE',
  'VACUUM',
];

export function assertSafeSelect(sql: string): void {
  const trimmed = sql.trim();
  if (trimmed.length === 0) {
    throw new UnsafeSqlError('Üres SQL lekérdezés.');
  }

  const withoutTrailingSemicolon = trimmed.endsWith(';')
    ? trimmed.slice(0, -1)
    : trimmed;
  if (withoutTrailingSemicolon.includes(';')) {
    throw new UnsafeSqlError('Csak egyetlen SQL statement engedélyezett.');
  }

  if (!/^(select|with)\b/i.test(withoutTrailingSemicolon)) {
    throw new UnsafeSqlError('Csak SELECT vagy WITH lekérdezés engedélyezett.');
  }

  const upper = withoutTrailingSemicolon.toUpperCase();
  for (const keyword of FORBIDDEN_KEYWORDS) {
    if (new RegExp(`\\b${keyword}\\b`).test(upper)) {
      throw new UnsafeSqlError(`Tiltott SQL kulcsszó: ${keyword}`);
    }
  }
}
