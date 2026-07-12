import { existsSync } from 'node:fs';
import Database from 'better-sqlite3';
import { todayIsoDate } from './local-date.js';

// Determinisztikus alkalmazáslogika, NEM LLM-döntés (architektura.md 9. pont,
// konvenciok.md 12. pont): az agent minden kérdés előtt ezen keresztül tudja
// meg, hogy van-e mai, sikeresen importált adat.
export function checkDatasetFreshness(
  dbPath: string,
  today: string = todayIsoDate(),
): boolean {
  if (!existsSync(dbPath)) {
    return false;
  }

  const db = new Database(dbPath, { readonly: true });
  try {
    const row = db
      .prepare(
        "SELECT 1 FROM import_metadata WHERE import_date = ? AND status = 'success' LIMIT 1",
      )
      .get(today);
    return row !== undefined;
  } finally {
    db.close();
  }
}
