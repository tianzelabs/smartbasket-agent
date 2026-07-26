import type { CohereClientV2 } from 'cohere-ai';

// rerank-v3.5: Cohere jelenlegi többnyelvű rerank modellje - lásd
// docs/rag-provider-rationale.md.
const RERANK_MODEL = 'rerank-v3.5';

export interface RerankedItem<T> {
  item: T;
  relevanceScore: number;
}

// Generikus, hogy a chunk-objektumokat (nem csak nyers szöveget) is vissza
// tudja adni relevancia-sorrendben - a hívó adja meg, hogyan nyerjen ki
// szöveget egy elemből (getText).
export async function rerankItems<T>(
  client: CohereClientV2,
  query: string,
  items: T[],
  getText: (item: T) => string,
  topN: number,
): Promise<RerankedItem<T>[]> {
  if (items.length === 0) {
    return [];
  }

  const response = await client.rerank({
    model: RERANK_MODEL,
    query,
    documents: items.map(getText),
    topN,
  });

  return response.results.map((result) => ({
    item: items[result.index],
    relevanceScore: result.relevanceScore,
  }));
}
