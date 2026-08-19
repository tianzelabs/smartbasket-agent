import type Anthropic from '@anthropic-ai/sdk';
import { appendFileSync, mkdirSync } from 'node:fs';
import { dirname } from 'node:path';

export interface EscalateToHumanInput {
  question: string;
  reason: string;
}

export interface EscalateToHumanResult {
  escalated: true;
  message: string;
}

export interface EscalationLogEntry {
  timestamp: string;
  question: string;
  reason: string;
}

const DEFAULT_ESCALATIONS_LOG_PATH = 'logs/escalations.jsonl';

// HF5: a rendszer egyetlen emberi jóváhagyási pontja. Ha az agent bizonytalan
// (searchKnowledge belowThreshold) vagy a kérdés panasz/reklamáció jellegű,
// NEM próbál találgatva végleges választ adni - ide ír egy sort, és emberi
// kollégához irányítja az ügyfelet. Egy közös, futásokon átívelő fájl (nem
// egy-egy CLI-futáshoz új fájl, mint agent-log.ts), hogy az eszkalációs arány
// mérhető legyen az összes eddigi kérdésből - lásd docs/measurement-plan.md.
// Ma batch-jellegű: a kollégának néznie kell a fájlt, nincs élő
// értesítés/queue - lásd docs/business-case.md "mi nincs benne" szakasza.
export function escalateToHuman(
  input: EscalateToHumanInput,
  logFilePath = DEFAULT_ESCALATIONS_LOG_PATH,
): EscalateToHumanResult {
  mkdirSync(dirname(logFilePath), { recursive: true });
  const entry: EscalationLogEntry = {
    timestamp: new Date().toISOString(),
    question: input.question,
    reason: input.reason,
  };
  appendFileSync(logFilePath, `${JSON.stringify(entry)}\n`, 'utf8');

  return {
    escalated: true,
    message:
      'Ezt a kérdést egy kollégánknak továbbítottuk, hamarosan felveszi veled a kapcsolatot.',
  };
}

export const ESCALATE_TO_HUMAN_TOOL_DEFINITION: Anthropic.Tool = {
  name: 'escalateToHuman',
  description:
    'Emberi kollégához irányítja a kérdést ahelyett, hogy az agent találgatna. ' +
    'Akkor hívd, ha a searchKnowledge belowThreshold: true-t adott vissza és a ' +
    'kérdés adatra sem válaszolható meg (runSql/listCategories), VAGY ha a ' +
    'kérdés panasz, reklamáció, számlázási vita, adatmódosítási/törlési kérés, ' +
    'vagy bármi olyan, amit nem tudsz a meglévő toolokkal megválaszolni. Ne ' +
    'találj ki választ csak azért, hogy elkerüld ezt a hívást.',
  input_schema: {
    type: 'object',
    properties: {
      question: {
        type: 'string',
        description: 'A felhasználó eredeti kérdése, változtatás nélkül.',
      },
      reason: {
        type: 'string',
        description:
          'Rövid indoklás, miért nem válaszolható meg a meglévő toolokkal ' +
          '(pl. "nincs releváns forrás a tudásbázisban", "reklamáció, nem ' +
          'ár/tanács jellegű kérdés").',
      },
    },
    required: ['question', 'reason'],
  },
};
