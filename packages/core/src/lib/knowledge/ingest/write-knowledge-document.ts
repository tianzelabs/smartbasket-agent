import type { SmartBasketDatabase } from '../../database/connection.js';
import type { DocumentChunk } from '../chunking/chunk-document.js';

export interface KnowledgeDocumentMetadata {
  sourceUrl: string;
  title: string;
  topic: string;
  format: 'html' | 'pdf';
  contentHash: string;
  wordCount: number;
}

export interface ChunkToWrite extends DocumentChunk {
  chunkIndex: number;
  embedding: number[];
}

function toPgVectorLiteral(embedding: number[]): string {
  return `[${embedding.join(',')}]`;
}

// Egy dokumentum upsert + a chunkjainak teljes cseréje EGY tranzakcióban
// (write-product-snapshot.ts mintájára, konvenciok.md 8. pont): ha bármelyik
// lépés hibázik, a teljes tranzakció rollback-el, a DB az előző állapotban
// marad. A "teljes csere" (DELETE + újra INSERT) azért egyszerűbb és
// biztonságosabb egy diff-alapú frissítésnél, mint egy chunkolt
// dokumentumnál a chunk-határok gyakran eltolódnak egy tartalmi változásnál.
export async function writeKnowledgeDocument(
  db: SmartBasketDatabase,
  metadata: KnowledgeDocumentMetadata,
  chunks: ChunkToWrite[],
): Promise<void> {
  await db.query('BEGIN');
  try {
    const { rows } = await db.query<{ id: number }>(
      `INSERT INTO knowledge_documents (source_url, title, topic, format, content_hash, word_count)
       VALUES ($1, $2, $3, $4, $5, $6)
       ON CONFLICT (source_url) DO UPDATE SET
         title = EXCLUDED.title,
         topic = EXCLUDED.topic,
         format = EXCLUDED.format,
         content_hash = EXCLUDED.content_hash,
         fetched_at = now(),
         word_count = EXCLUDED.word_count
       RETURNING id`,
      [
        metadata.sourceUrl,
        metadata.title,
        metadata.topic,
        metadata.format,
        metadata.contentHash,
        metadata.wordCount,
      ],
    );
    const documentId = rows[0].id;

    await db.query('DELETE FROM knowledge_chunks WHERE document_id = $1', [
      documentId,
    ]);

    for (const chunk of chunks) {
      await db.query(
        `INSERT INTO knowledge_chunks (document_id, chunk_index, section_path, content, char_count, embedding)
         VALUES ($1, $2, $3, $4, $5, $6::vector)`,
        [
          documentId,
          chunk.chunkIndex,
          chunk.sectionPath,
          chunk.content,
          chunk.charCount,
          toPgVectorLiteral(chunk.embedding),
        ],
      );
    }

    await db.query('COMMIT');
  } catch (error) {
    await db.query('ROLLBACK').catch(() => undefined);
    throw error;
  }
}
