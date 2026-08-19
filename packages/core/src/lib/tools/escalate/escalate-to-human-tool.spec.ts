import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { escalateToHuman } from './escalate-to-human-tool.js';

describe('escalateToHuman', () => {
  let dir: string;

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'smartbasket-escalations-'));
  });

  afterEach(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  it('creates the logs directory and appends one JSON line per call', () => {
    const filePath = join(dir, 'nested', 'escalations.jsonl');

    const result = escalateToHuman(
      { question: 'Reklamálni szeretnék', reason: 'panasz, nem ár jellegű kérdés' },
      filePath,
    );

    expect(result).toEqual({
      escalated: true,
      message:
        'Ezt a kérdést egy kollégánknak továbbítottuk, hamarosan felveszi veled a kapcsolatot.',
    });

    escalateToHuman(
      { question: 'Milyen hőmérsékleten tartsam a felvágottat?', reason: 'belowThreshold' },
      filePath,
    );

    const lines = readFileSync(filePath, 'utf8').trim().split('\n');
    expect(lines).toHaveLength(2);
    expect(JSON.parse(lines[0])).toMatchObject({
      question: 'Reklamálni szeretnék',
      reason: 'panasz, nem ár jellegű kérdés',
    });
    expect(JSON.parse(lines[1])).toMatchObject({
      question: 'Milyen hőmérsékleten tartsam a felvágottat?',
      reason: 'belowThreshold',
    });
    expect(JSON.parse(lines[0])).toHaveProperty('timestamp');
  });
});
