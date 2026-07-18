import { importDailyDataset } from '../importer/import-daily-dataset.js';
import { checkDatasetFreshness } from './check-dataset-freshness.js';

export interface EnsureFreshDatasetOptions {
  databaseUrl: string;
  databaseUrlReadonly: string;
  sourceUrl: string;
}

// BRS 5. pont: minden kérdés előtt ezt hívjuk meg. A felhasználónak nem kell
// külön frissítenie - ha a mai adat már megvan, nincs teendő.
export async function ensureFreshDataset(
  options: EnsureFreshDatasetOptions,
): Promise<void> {
  if (await checkDatasetFreshness(options.databaseUrlReadonly)) {
    return;
  }
  await importDailyDataset(options);
}
