import type Anthropic from '@anthropic-ai/sdk';
import type { CohereClientV2 } from 'cohere-ai';
import { embedTexts } from '../embedding/embed-texts.js';
import { rerankItems } from '../rerank/rerank-items.js';
import { generateHypotheticalAnswer } from './hyde.js';
import { vectorSearch } from './vector-search.js';

const CANDIDATE_LIMIT = 20;
const RESULT_LIMIT = 5;

// Kezdeti, ideiglenes érték - a golden set negatív teszt kérdéseinek (nincs
// releváns tartalom a tudásbázisban) tényleges rerank-score eloszlásából kell
// véglegesíteni és dokumentálni docs/golden-set-results.md-ben. Ez a
// grounding determinisztikus rétege (docs/rag-provider-rationale.md): ha a
// legjobb találat is a küszöb alatt van, a tool nem ad vissza chunköt, hogy
// az agent ne "kényszerüljön" válaszolni gyenge találatokból.
const RELEVANCE_THRESHOLD = 0.2;

export interface SearchKnowledgeChunk {
  content: string;
  title: string;
  sourceUrl: string;
  sectionPath: string;
  relevanceScore: number;
}

export interface SearchKnowledgeResult {
  belowThreshold: boolean;
  chunks: SearchKnowledgeChunk[];
}

export interface SearchKnowledgeDeps {
  anthropicClient: Anthropic;
  cohereClient: CohereClientV2;
  databaseUrlReadonly?: string;
}

// A teljes keresési pipeline: HyDE (Haiku) -> embed (Cohere embed-v4.0,
// search_query) -> brute-force pgvector top 20 -> rerank (Cohere rerank-v3.5,
// az EREDETI kérdéssel, nem a HyDE-szöveggel - a rerank egy kereszt-encoder,
// ami a valódi kérdés-dokumentum párt pontozza, nem kell neki a HyDE
// stílus-hidalás) -> top 5 -> küszöbszűrés.
export async function searchKnowledge(
  question: string,
  deps: SearchKnowledgeDeps,
): Promise<SearchKnowledgeResult> {
  const hypotheticalAnswer = await generateHypotheticalAnswer(
    deps.anthropicClient,
    question,
  );
  const [queryEmbedding] = await embedTexts(
    deps.cohereClient,
    [hypotheticalAnswer],
    'search_query',
  );

  const candidates = await vectorSearch(
    deps.databaseUrlReadonly,
    queryEmbedding,
    CANDIDATE_LIMIT,
  );
  if (candidates.length === 0) {
    return { belowThreshold: true, chunks: [] };
  }

  const reranked = await rerankItems(
    deps.cohereClient,
    question,
    candidates,
    (chunk) => chunk.content,
    RESULT_LIMIT,
  );

  const topScore = reranked[0]?.relevanceScore ?? 0;
  if (topScore < RELEVANCE_THRESHOLD) {
    return { belowThreshold: true, chunks: [] };
  }

  return {
    belowThreshold: false,
    chunks: reranked.map(({ item, relevanceScore }) => ({
      content: item.content,
      title: item.title,
      sourceUrl: item.sourceUrl,
      sectionPath: item.sectionPath,
      relevanceScore,
    })),
  };
}

export const SEARCH_KNOWLEDGE_TOOL_DEFINITION: Anthropic.Tool = {
  name: 'searchKnowledge',
  description:
    'A tudásbázisban keres (NKFH/Nébih/GVH cikkek a tudatos és gazdaságos ' +
    'élelmiszer-vásárlásról: vásárlástervezés, egységár-összehasonlítás, ' +
    'lejárati dátumok/címkék, tárolás és pazarlás-csökkentés, ' +
    'élelmiszerbiztonság, fogyasztói jogok). NEM aznapi, valós árakért való - ' +
    'arra a runSql tool szolgál. Akkor hívd, ha a kérdés arról szól, mit/' +
    'mennyit érdemes venni, hogyan tárolni, mit jelent egy címke, vagy ' +
    'megéri-e egy akció - ne SQL-szerű vagy kulcsszavas inputot adj, hanem a ' +
    'felhasználó kérdését természetes nyelven.',
  input_schema: {
    type: 'object',
    properties: {
      question: {
        type: 'string',
        description: 'A felhasználó eredeti kérdése, természetes nyelven.',
      },
    },
    required: ['question'],
  },
};
