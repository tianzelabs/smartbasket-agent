import type { CohereClientV2 } from 'cohere-ai';
import type { SmartBasketDatabase } from '../../database/connection.js';
import { chunkDocument } from '../chunking/chunk-document.js';
import { embedTexts } from '../embedding/embed-texts.js';
import { extractHtmlBlocks } from '../extraction/extract-html-blocks.js';
import { extractPdfBlocks } from '../extraction/extract-pdf-blocks.js';
import { sha256Hex } from './content-hash.js';
import type { SourceEntry } from './source-manifest.js';
import { writeKnowledgeDocument } from './write-knowledge-document.js';

export type IngestStatus = 'ingested' | 'skipped-unchanged';

export interface IngestResult {
  sourceUrl: string;
  status: IngestStatus;
  chunkCount: number;
}

function countWords(text: string): number {
  return text.split(/\s+/).filter((word) => word.length > 0).length;
}

// Egy forrás teljes feldolgozása: hash-összevetés (kihagyás, ha nem
// változott) -> kinyerés (HTML/PDF) -> chunkolás -> embedding -> DB-írás.
// docs/knowledge-base-architecture.md "honnan tudod, hogy egy dokumentum
// változott" kérdésére ez a determinisztikus válasz - nem az LLM dönti el.
export async function ingestDocument(
  db: SmartBasketDatabase,
  cohereClient: CohereClientV2,
  entry: SourceEntry,
  rawBuffer: Buffer,
): Promise<IngestResult> {
  const contentHash = sha256Hex(rawBuffer);

  const { rows } = await db.query<{ content_hash: string }>(
    'SELECT content_hash FROM knowledge_documents WHERE source_url = $1',
    [entry.url],
  );
  if (rows[0]?.content_hash === contentHash) {
    return { sourceUrl: entry.url, status: 'skipped-unchanged', chunkCount: 0 };
  }

  const blocks =
    entry.format === 'pdf'
      ? await extractPdfBlocks(rawBuffer)
      : extractHtmlBlocks(rawBuffer.toString('utf8'), entry.url);

  const chunks = chunkDocument(blocks, entry.title);
  const wordCount = blocks.reduce(
    (sum, block) => sum + countWords(block.text),
    0,
  );
  const embeddings = await embedTexts(
    cohereClient,
    chunks.map((chunk) => chunk.content),
    'search_document',
  );

  await writeKnowledgeDocument(
    db,
    {
      sourceUrl: entry.url,
      title: entry.title,
      topic: entry.topic,
      format: entry.format,
      contentHash,
      wordCount,
    },
    chunks.map((chunk, index) => ({
      ...chunk,
      chunkIndex: index,
      embedding: embeddings[index],
    })),
  );

  return { sourceUrl: entry.url, status: 'ingested', chunkCount: chunks.length };
}
