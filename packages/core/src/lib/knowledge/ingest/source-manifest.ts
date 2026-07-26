import { readFileSync } from 'node:fs';
import { z } from 'zod';
import { sha256Hex } from './content-hash.js';

const SourceEntrySchema = z.object({
  url: z.string().url(),
  title: z.string().min(1),
  topic: z.string().min(1),
  format: z.enum(['html', 'pdf']).optional(),
});

export interface SourceEntry {
  url: string;
  title: string;
  topic: string;
  format: 'html' | 'pdf';
  // Fájlrendszer-biztos azonosító a nyers cache fájlnevéhez (raw-cache.ts) -
  // az URL-ből származtatva, hogy ne kelljen kézzel id-t kitalálni minden
  // manifest-sorhoz.
  cacheKey: string;
}

function inferFormat(url: string): 'html' | 'pdf' {
  return url.toLowerCase().endsWith('.pdf') ? 'pdf' : 'html';
}

// A manifest a tudásbázis "forrás igazsága" (docs/knowledge-base-architecture.md):
// új dokumentum = új sor, törölt dokumentum = eltávolított sor - a
// syncKnowledgeBase ez alapján dönti el, mit kell törölni a DB-ből.
export function parseSourceManifest(json: unknown): SourceEntry[] {
  const entries = z.array(SourceEntrySchema).parse(json);
  return entries.map((entry) => ({
    url: entry.url,
    title: entry.title,
    topic: entry.topic,
    format: entry.format ?? inferFormat(entry.url),
    cacheKey: sha256Hex(entry.url).slice(0, 16),
  }));
}

export function loadSourceManifest(path: string): SourceEntry[] {
  const raw = readFileSync(path, 'utf8');
  return parseSourceManifest(JSON.parse(raw));
}
