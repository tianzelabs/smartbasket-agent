import type Anthropic from '@anthropic-ai/sdk';
import { openReadOnlyConnection } from '../run-sql/db-readonly.js';

export interface ListCategoriesResult {
  categories: string[];
}

interface CategoryRow {
  category: string;
}

// A projekt kötelező, saját toolja (BRS FR-06): SELECT DISTINCT
// category_name a vw_categories view-n keresztül. Az agent akkor hívja, ha
// bizonytalan egy kategória pontos nevében.
export function listCategories(dbPath: string): ListCategoriesResult {
  const db = openReadOnlyConnection(dbPath);
  try {
    const rows = db
      .prepare('SELECT category FROM vw_categories')
      .all() as CategoryRow[];
    return { categories: rows.map((row) => row.category) };
  } finally {
    db.close();
  }
}

export const LIST_CATEGORIES_TOOL_DEFINITION: Anthropic.Tool = {
  name: 'listCategories',
  description:
    'Az összes elérhető termékkategória listája (SELECT DISTINCT category_name). Akkor hívd, ha nem vagy biztos egy kategória pontos nevében, mielőtt a runSql toolt használnád.',
  input_schema: {
    type: 'object',
    properties: {},
  },
};
