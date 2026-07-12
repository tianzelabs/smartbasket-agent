import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { appendAgentLog, createLogFilePath } from './agent-log.js';

describe('createLogFilePath', () => {
  it('creates a .jsonl path timestamped under the given logs directory', () => {
    const filePath = createLogFilePath('logs');
    expect(filePath).toMatch(/^logs\/.+\.jsonl$/);
  });
});

describe('appendAgentLog', () => {
  let dir: string;

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'smartbasket-logs-'));
  });

  afterEach(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  it('creates the logs directory and appends one JSON line per call', () => {
    const filePath = join(dir, 'nested', 'session.jsonl');

    appendAgentLog(filePath, {
      timestamp: '2026-07-12T20:00:00.000Z',
      question: 'szia',
      systemPrompt: '<role>...</role>',
      answer: 'Szia! Miben segíthetek?',
      model: 'claude-sonnet-5',
      usage: { input_tokens: 10, output_tokens: 5 },
      toolCalls: [],
      durationMs: 42,
    });
    appendAgentLog(filePath, {
      timestamp: '2026-07-12T20:00:05.000Z',
      question: 'hol a legolcsóbb a tej?',
      systemPrompt: '<role>...</role>',
      answer: 'A Lidl-ben a legolcsóbb.',
      model: 'claude-sonnet-5',
      usage: { input_tokens: 12, output_tokens: 8 },
      toolCalls: [
        {
          name: 'runSql',
          input: { query: 'SELECT * FROM vw_best_prices' },
          result: {},
          isError: false,
        },
      ],
      durationMs: 55,
    });

    const lines = readFileSync(filePath, 'utf8').trim().split('\n');
    expect(lines).toHaveLength(2);
    expect(JSON.parse(lines[0])).toMatchObject({ question: 'szia' });
    expect(JSON.parse(lines[1])).toMatchObject({
      question: 'hol a legolcsóbb a tej?',
    });
  });
});
