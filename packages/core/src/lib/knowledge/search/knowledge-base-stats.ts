import { runReadOnlyQuery } from '../../tools/run-sql/db-readonly.js';

export interface KnowledgeBaseStats {
  documentCount: number;
  chunkCount: number;
}

// A golden-set eval script (scripts/eval-golden-set.ts) ezzel írja ki a
// futtatáskori korpuszméretet a docs/golden-set-results.md fejlécébe -
// korábban ez hardcode-olt szám volt, ami a tudásbázis bővítése után
// hallgatólagosan hamissá vált volna.
export async function getKnowledgeBaseStats(
  databaseUrlReadonly?: string,
): Promise<KnowledgeBaseStats> {
  const { rows } = await runReadOnlyQuery(
    `SELECT
       COUNT(DISTINCT source_url)::int AS document_count,
       COUNT(*)::int AS chunk_count
     FROM vw_knowledge_search`,
    databaseUrlReadonly,
  );

  return {
    documentCount: rows[0]?.document_count as number,
    chunkCount: rows[0]?.chunk_count as number,
  };
}
