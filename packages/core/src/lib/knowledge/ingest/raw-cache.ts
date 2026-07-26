import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';

export function rawCachePath(
  cacheDir: string,
  cacheKey: string,
  format: 'html' | 'pdf',
): string {
  return join(cacheDir, `${cacheKey}.${format}`);
}

// A helyi nyers cache (data/knowledge/raw/) teszi lehetővé, hogy a chunking-
// stratégián iterálva ne kelljen minden futtatásnál újra letölteni a
// forrásokat (docs/knowledge-base-architecture.md).
export function writeRawCache(path: string, buffer: Buffer): void {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, buffer);
}

export function readRawCache(path: string): Buffer {
  return readFileSync(path);
}
