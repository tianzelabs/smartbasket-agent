import { appendFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';

export interface AgentLogEntry {
  timestamp: string;
  question: string;
  systemPrompt: string;
  answer: string;
  model: string;
  usage: unknown;
  durationMs: number;
}

// Egy CLI-futáshoz egy log-fájl (architektura.md 13. pont); a CLI a folyamat
// indulásakor egyszer hívja meg, majd minden egyes kérdés ide kerül JSONL
// sorként - így interaktív módban egy fájlban látszik a teljes beszélgetés.
export function createLogFilePath(logsDir = 'logs'): string {
  const fileName = `${new Date().toISOString().replace(/[:.]/g, '-')}.jsonl`;
  return join(logsDir, fileName);
}

// Nincs API kulcs vagy .env tartalom naplózva - konvenciok.md 10. pont.
export function appendAgentLog(
  logFilePath: string,
  entry: AgentLogEntry,
): void {
  mkdirSync(dirname(logFilePath), { recursive: true });
  appendFileSync(logFilePath, `${JSON.stringify(entry)}\n`, 'utf8');
}
