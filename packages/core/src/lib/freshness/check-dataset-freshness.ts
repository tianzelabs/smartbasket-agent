import { runReadOnlyQuery } from '../tools/run-sql/db-readonly.js';
import { todayIsoDate } from './local-date.js';

// Determinisztikus alkalmazáslogika, NEM LLM-döntés (architektura.md 9. pont,
// konvenciok.md 12. pont): az agent minden kérdés előtt ezen keresztül tudja
// meg, hogy van-e mai, sikeresen importált adat. A smartbasket_ro szerepkörön
// olvas, a vw_import_status view-n keresztül (docs/db-migration-rationale.md).
// A CLI ezt runMigrations() UTÁN hívja, tehát a view ekkor már létezik.
export async function checkDatasetFreshness(
  databaseUrlReadonly?: string,
  today: string = todayIsoDate(),
): Promise<boolean> {
  const { rows } = await runReadOnlyQuery(
    'SELECT 1 FROM vw_import_status WHERE import_date = $1 AND status = $2 LIMIT 1',
    databaseUrlReadonly,
    [today, 'success'],
  );
  return rows.length > 0;
}
