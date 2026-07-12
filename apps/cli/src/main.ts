import { createInterface } from 'node:readline/promises';
import {
  echo,
  ensureFreshDataset,
  resolveDatabasePath,
  resolveSourceUrl,
  runMigrations,
} from '@smartbasket/core';
import { Command } from 'commander';

const program = new Command();

// rl.question() ismételt hívása pipe-olt (nem TTY) stdin-en elakad: a 'line'
// esemény azonnal tüzel, amint a puffer kész, függetlenül attól, hogy éppen
// figyelünk-e rá - ezért async iterátorral olvassuk a sorokat.
async function runInteractiveEcho(): Promise<void> {
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  rl.prompt();
  for await (const line of rl) {
    if (line.trim() === 'exit') {
      break;
    }
    console.log(echo(line));
    rl.prompt();
  }
  rl.close();
}

program
  .name('smartbasket')
  .description('SmartBasket Agent - AI-alapú bevásárlókosár-összehasonlító CLI')
  .version('0.1.0');

program
  .command('ask')
  .argument('[kérdés]', 'a feltenni kívánt természetes nyelvű kérdés')
  .description('Kérdés feltevése a SmartBasket agentnek')
  .action(async (question: string | undefined) => {
    if (question) {
      console.log(echo(question));
      return;
    }
    await runInteractiveEcho();
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
