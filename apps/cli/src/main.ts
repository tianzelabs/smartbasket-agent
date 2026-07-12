import {
  ensureFreshDataset,
  resolveDatabasePath,
  resolveSourceUrl,
  runMigrations,
} from '@smartbasket/core';
import { Command } from 'commander';

const program = new Command();

program
  .name('smartbasket')
  .description('SmartBasket Agent - AI-alapú bevásárlókosár-összehasonlító CLI')
  .version('0.1.0');

program
  .command('ask')
  .argument('[kérdés]', 'a feltenni kívánt természetes nyelvű kérdés')
  .description('Kérdés feltevése a SmartBasket agentnek')
  .action((question: string | undefined) => {
    console.log('Az "ask" parancs még nincs implementálva.');
    if (question) {
      console.log(`Kérdés: ${question}`);
    }
  });

program
  .command('refresh')
  .description(
    'Frissíti a helyi adatbázist a legfrissebb GVH Árfigyelő adatokkal, ha szükséges',
  )
  .action(async () => {
    const dbPath = resolveDatabasePath();
    try {
      runMigrations(dbPath);
      await ensureFreshDataset({ dbPath, sourceUrl: resolveSourceUrl() });
      console.log(`Az adatbázis friss: ${dbPath}`);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.error(`Hiba történt az adatfrissítés során: ${message}`);
      process.exitCode = 1;
    }
  });

program.parseAsync(process.argv).catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`Váratlan hiba: ${message}`);
  process.exitCode = 1;
});
