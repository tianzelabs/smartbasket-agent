import type Anthropic from '@anthropic-ai/sdk';
import { runReadOnlyQuery } from '../run-sql/db-readonly.js';

export interface ListCategoriesResult {
  categories: string[];
}

interface CategoryRow {
  category: string;
}

// A projekt kötelező, saját toolja (BRS FR-06): SELECT DISTINCT
// category_name a vw_categories view-n keresztül. Az agent akkor hívja, ha
// bizonytalan egy kategória pontos nevében.
export async function listCategories(
  databaseUrlReadonly?: string,
): Promise<ListCategoriesResult> {
  const { rows } = await runReadOnlyQuery(
    'SELECT category FROM vw_categories',
    databaseUrlReadonly,
  );
  return {
    categories: (rows as unknown as CategoryRow[]).map((row) => row.category),
  };
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
