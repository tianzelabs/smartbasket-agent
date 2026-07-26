import { createHash } from 'node:crypto';

// Determinisztikus tartalom-ujjlenyomat: ez teszi lehetővé az inkrementális
// ingestet (docs/knowledge-base-architecture.md) - ha egy forrás hash-e
// megegyezik a knowledge_documents-ben tárolttal, nem kell újra
// chunkolni/embeddelni.
export function sha256Hex(data: Buffer | string): string {
  return createHash('sha256').update(data).digest('hex');
}
