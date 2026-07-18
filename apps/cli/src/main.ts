import { createInterface } from 'node:readline/promises';
import {
  appendAgentLog,
  askAgent,
  createLogFilePath,
  ensureFreshDataset,
  loadDatabaseConfig,
  resolveSourceUrl,
  runMigrations,
} from '@smartbasket/core';
import { Command } from 'commander';

const program = new Command();
const logFilePath = createLogFilePath();

async function handleAsk(question: string, showPrompt: boolean): Promise<void> {
  const { databaseUrl, databaseUrlReadonly } = loadDatabaseConfig();
  try {
    // BRS 5. pont: minden kérdés előtt ellenőrizzük/frissítjük az adatot -
    // ezt nem az LLM dönti el, alkalmazáslogika.
    await runMigrations(databaseUrl);
    await ensureFreshDataset({
      databaseUrl,
      databaseUrlReadonly,
      sourceUrl: resolveSourceUrl(),
    });

    const result = await askAgent(question, { databaseUrlReadonly });

    if (showPrompt) {
      console.log('--- system prompt ---');
      console.log(result.systemPrompt);
      console.log('--- üzenetek ---');
      console.log(JSON.stringify(result.messages, null, 2));
      console.log('--- tool hívások ---');
      console.log(JSON.stringify(result.toolCalls, null, 2));
      console.log('--- válasz ---');
    }
    console.log(result.answer);

    appendAgentLog(logFilePath, {
      timestamp: new Date().toISOString(),
      question,
      systemPrompt: result.systemPrompt,
      answer: result.answer,
      model: result.model,
      usage: result.usage,
      toolCalls: result.toolCalls,
      durationMs: result.durationMs,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`Hiba történt a válasz generálása során: ${message}`);
    process.exitCode = 1;
  }
}

// rl.question() ismételt hívása pipe-olt (nem TTY) stdin-en elakad: a 'line'
// esemény azonnal tüzel, amint a puffer kész, függetlenül attól, hogy éppen
// figyelünk-e rá - ezért async iterátorral olvassuk a sorokat.
async function runInteractiveAsk(showPrompt: boolean): Promise<void> {
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  rl.prompt();
  for await (const line of rl) {
    if (line.trim() === 'exit') {
      break;
    }
    await handleAsk(line, showPrompt);
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
  .option(
    '--show-prompt',
    'a teljes system promptot és üzenet-tömböt is kiírja',
  )
  .action(
    async (question: string | undefined, options: { showPrompt?: boolean }) => {
      const showPrompt = options.showPrompt ?? false;
      if (question) {
        await handleAsk(question, showPrompt);
        return;
      }
      await runInteractiveAsk(showPrompt);
    },
  );

program
  .command('refresh')
  .description(
    'Frissíti a helyi adatbázist a legfrissebb GVH Árfigyelő adatokkal, ha szükséges',
  )
  .action(async () => {
    const { databaseUrl, databaseUrlReadonly } = loadDatabaseConfig();
    try {
      await runMigrations(databaseUrl);
      await ensureFreshDataset({
        databaseUrl,
        databaseUrlReadonly,
        sourceUrl: resolveSourceUrl(),
      });
      console.log('Az adatbázis friss.');
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
