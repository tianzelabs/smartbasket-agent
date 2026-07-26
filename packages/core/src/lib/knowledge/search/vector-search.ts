import { runReadOnlyQuery } from '../../tools/run-sql/db-readonly.js';

export interface SearchedChunk {
  chunkId: number;
  content: string;
  sectionPath: string;
  title: string;
  sourceUrl: string;
  topic: string;
  publishedAt: string | null;
}

function toPgVectorLiteral(embedding: number[]): string {
  return `[${embedding.join(',')}]`;
}

// Brute-force pontos legközelebbi szomszéd keresés a vw_knowledge_search
// view-n - SZÁNDÉKOSAN nincs ANN index (HNSW/IVFFlat), lásd
// 0002_knowledge_base.sql indoklása: pár száz - ezer chunk méretben ez
// gyorsabb és pontosabb. A runReadOnlyQuery ugyanazt a négyrétegű védelmet
// adja (RO szerepkör + READ ONLY tranzakció + statement_timeout), mint a
// runSql toolnál (docs/db-migration-rationale.md) - itt a lekérdezés fix,
// nem az LLM generálja.
export async function vectorSearch(
  databaseUrlReadonly: string | undefined,
  queryEmbedding: number[],
  limit: number,
): Promise<SearchedChunk[]> {
  const { rows } = await runReadOnlyQuery(
    `SELECT chunk_id, content, section_path, title, source_url, topic, published_at
     FROM vw_knowledge_search
     ORDER BY embedding <=> $1::vector
     LIMIT $2`,
    databaseUrlReadonly,
    [toPgVectorLiteral(queryEmbedding), limit],
  );

  return rows.map((row) => ({
    chunkId: row.chunk_id as number,
    content: row.content as string,
    sectionPath: row.section_path as string,
    title: row.title as string,
    sourceUrl: row.source_url as string,
    topic: row.topic as string,
    publishedAt: row.published_at as string | null,
  }));
}
