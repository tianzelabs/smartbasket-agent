import type Anthropic from '@anthropic-ai/sdk';
import { openReadOnlyConnection } from './db-readonly.js';
import { assertSafeSelect } from './sql-guard.js';

const MAX_ROWS = 200;

export interface RunSqlResult {
  rows: Record<string, unknown>[];
  rowCount: number;
  truncated: boolean;
}

// Read-only SQL futtatás a katalóguson, kizárólag a vw_ view-k ellen -
// erre kényszerít a rendelkezésre álló séma, a system prompt <schema>
// blokkja nem is említi a nyers products táblát.
export function runSql(dbPath: string, sql: string): RunSqlResult {
  assertSafeSelect(sql);

  const db = openReadOnlyConnection(dbPath);
  try {
    const rows = db.prepare(sql).all() as Record<string, unknown>[];
    const truncated = rows.length > MAX_ROWS;
    return {
      rows: truncated ? rows.slice(0, MAX_ROWS) : rows,
      rowCount: rows.length,
      truncated,
    };
  } finally {
    db.close();
  }
}

export const RUN_SQL_TOOL_DEFINITION: Anthropic.Tool = {
  name: 'runSql',
  description:
    'Read-only SQL (SELECT vagy WITH) lekérdezés futtatása a termékkatalóguson. Kizárólag a vw_products, vw_categories, vw_best_prices view-k ellen fut. Csak SELECT/WITH engedélyezett, egyetlen statement.',
  input_schema: {
    type: 'object',
    properties: {
      query: {
        type: 'string',
        description: 'A futtatandó SQL SELECT vagy WITH lekérdezés.',
      },
    },
    required: ['query'],
  },
};
