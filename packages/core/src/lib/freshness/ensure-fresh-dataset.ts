import { importDailyDataset } from '../importer/import-daily-dataset.js';
import { checkDatasetFreshness } from './check-dataset-freshness.js';

export interface EnsureFreshDatasetOptions {
  dbPath: string;
  sourceUrl: string;
}

// BRS 5. pont: minden kérdés előtt ezt hívjuk meg. A felhasználónak nem kell
// külön frissítenie - ha a mai adat már megvan, nincs teendő.
export async function ensureFreshDataset(
  options: EnsureFreshDatasetOptions,
): Promise<void> {
  if (checkDatasetFreshness(options.dbPath)) {
    return;
  }
  await importDailyDataset(options);
}
