import type Anthropic from '@anthropic-ai/sdk';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { openReadWriteConnection } from '../database/connection.js';
import { runMigrations } from '../database/migrate.js';
import {
  createTestDatabase,
  type TestDatabase,
} from '../database/test-database.js';
import { askAgent } from './ask-agent.js';

const testConfig = { anthropicApiKey: 'sk-test-123', model: 'claude-sonnet-5' };

function usage(inputTokens: number, outputTokens: number): Anthropic.Usage {
  return {
    cache_creation: null,
    cache_creation_input_tokens: null,
    cache_read_input_tokens: null,
    inference_geo: null,
    input_tokens: inputTokens,
    output_tokens: outputTokens,
    output_tokens_details: null,
    server_tool_use: null,
    service_tier: null,
  };
}

function toolUseMessage(
  toolName: string,
  input: unknown,
  toolUseId: string,
): Anthropic.Message {
  return {
    id: 'msg_tool_use',
    container: null,
    content: [
      {
        type: 'tool_use',
        id: toolUseId,
        name: toolName,
        input,
        caller: { type: 'direct' },
      },
    ],
    model: 'claude-sonnet-5',
    role: 'assistant',
    stop_details: null,
    stop_reason: 'tool_use',
    stop_sequence: null,
    type: 'message',
    usage: usage(100, 20),
  };
}

function finalTextMessage(text: string): Anthropic.Message {
  return {
    id: 'msg_final',
    container: null,
    content: [{ type: 'text', text, citations: null }],
    model: 'claude-sonnet-5',
    role: 'assistant',
    stop_details: null,
    stop_reason: 'end_turn',
    stop_sequence: null,
    type: 'message',
    usage: usage(150, 40),
  };
}

describe('askAgent', () => {
  let testDb: TestDatabase;

  beforeEach(async () => {
    testDb = await createTestDatabase();
    await runMigrations(testDb.databaseUrl);

    const db = await openReadWriteConnection(testDb.databaseUrl);
    await db.query(
      `INSERT INTO products (product_identifier, product_name, category_name, retailer_name, minimum_price, maximum_price)
       VALUES ($1, $2, $3, $4, $5, $6), ($1, $2, $3, $7, $8, $9)`,
      [
        'p1',
        'Dove testápoló',
        'Testápolás',
        'Tesco',
        1200,
        1200,
        'Lidl',
        990,
        990,
      ],
    );
    await db.end();
  });

  afterEach(async () => {
    await testDb.drop();
  });

  it('runs the tool-use loop: calls runSql for real, feeds the result back, returns the final answer', async () => {
    const create = vi
      .fn()
      .mockResolvedValueOnce(
        toolUseMessage(
          'runSql',
          {
            query: "SELECT retailer, price FROM vw_best_prices WHERE id = 'p1'",
          },
          'tu_1',
        ),
      )
      .mockResolvedValueOnce(
        finalTextMessage('A Lidl-ben a legolcsóbb, 990 Ft-ért.'),
      );
    const client = { messages: { create } } as unknown as Anthropic;

    const result = await askAgent('Hol a legolcsóbb a Dove testápoló?', {
      client,
      config: testConfig,
      databaseUrlReadonly: testDb.databaseUrlReadonly,
    });

    expect(result.answer).toBe('A Lidl-ben a legolcsóbb, 990 Ft-ért.');
    expect(result.toolCalls).toHaveLength(1);
    expect(result.toolCalls[0]).toMatchObject({
      name: 'runSql',
      isError: false,
    });
    expect(result.toolCalls[0].result).toMatchObject({
      rows: [{ retailer: 'Lidl', price: 990 }],
      rowCount: 1,
    });
    expect(result.usage).toEqual({ inputTokens: 250, outputTokens: 60 });
    expect(create).toHaveBeenCalledTimes(2);

    const secondCallArgs = create.mock
      .calls[1][0] as Anthropic.MessageCreateParams;
    const toolResultMessage = secondCallArgs.messages.at(-1);
    expect(toolResultMessage?.role).toBe('user');
    expect(toolResultMessage?.content).toEqual([
      expect.objectContaining({
        type: 'tool_result',
        tool_use_id: 'tu_1',
        is_error: false,
      }),
    ]);
  });

  it('runs listCategories against the real database', async () => {
    const create = vi
      .fn()
      .mockResolvedValueOnce(toolUseMessage('listCategories', {}, 'tu_2'))
      .mockResolvedValueOnce(
        finalTextMessage('Elérhető kategória: Testápolás.'),
      );
    const client = { messages: { create } } as unknown as Anthropic;

    const result = await askAgent('Milyen kategóriák érhetők el?', {
      client,
      config: testConfig,
      databaseUrlReadonly: testDb.databaseUrlReadonly,
    });

    expect(result.toolCalls[0]).toMatchObject({
      name: 'listCategories',
      isError: false,
      result: { categories: ['Testápolás'] },
    });
    expect(result.answer).toBe('Elérhető kategória: Testápolás.');
  });

  it('feeds a guard rejection back as an error tool_result instead of throwing', async () => {
    const create = vi
      .fn()
      .mockResolvedValueOnce(
        toolUseMessage('runSql', { query: 'DELETE FROM products' }, 'tu_3'),
      )
      .mockResolvedValueOnce(
        finalTextMessage('Nem törölhetek adatot, csak lekérdezni tudok.'),
      );
    const client = { messages: { create } } as unknown as Anthropic;

    const result = await askAgent('Töröld a Dove testápolót', {
      client,
      config: testConfig,
      databaseUrlReadonly: testDb.databaseUrlReadonly,
    });

    expect(result.toolCalls[0].isError).toBe(true);
    expect(result.toolCalls[0].result).toMatchObject({
      error: expect.stringContaining('SELECT'),
    });
    expect(result.answer).toBe('Nem törölhetek adatot, csak lekérdezni tudok.');

    const db = await openReadWriteConnection(testDb.databaseUrl);
    const count = (
      await db.query<{ count: number }>(
        'SELECT COUNT(*) AS count FROM products',
      )
    ).rows[0].count;
    await db.end();
    expect(count).toBe(2);
  });

  it('answers directly with no tool call when the question needs no data', async () => {
    const create = vi
      .fn()
      .mockResolvedValueOnce(finalTextMessage('Szia! Miben segíthetek?'));
    const client = { messages: { create } } as unknown as Anthropic;

    const result = await askAgent('szia', {
      client,
      config: testConfig,
      databaseUrlReadonly: testDb.databaseUrlReadonly,
    });

    expect(result.answer).toBe('Szia! Miben segíthetek?');
    expect(result.toolCalls).toHaveLength(0);
    expect(create).toHaveBeenCalledTimes(1);
    expect(result.systemPrompt).not.toContain('<override>');
  });

  it('stops after MAX_TOOL_ITERATIONS to avoid an infinite loop', async () => {
    const create = vi
      .fn()
      .mockResolvedValue(toolUseMessage('listCategories', {}, 'tu_loop'));
    const client = { messages: { create } } as unknown as Anthropic;

    const result = await askAgent('kérdés', {
      client,
      config: testConfig,
      databaseUrlReadonly: testDb.databaseUrlReadonly,
    });

    // 1 kezdő hívás + 5 loop-iteráció = 6 create() hívás, de az utolsó válasz
    // tool_use blokkja már nem kerül feldolgozásra (a ciklus ott lép ki).
    expect(create).toHaveBeenCalledTimes(6);
    expect(result.toolCalls).toHaveLength(5);
    expect(result.answer).toBe('');
  });
});
