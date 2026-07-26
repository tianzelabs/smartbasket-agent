import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { rawCachePath, readRawCache, writeRawCache } from './raw-cache.js';

describe('raw-cache', () => {
  let dir: string;

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'smartbasket-raw-cache-'));
  });

  afterEach(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  it('builds a path from cacheDir, cacheKey and format', () => {
    expect(rawCachePath(dir, 'abc123', 'pdf')).toBe(join(dir, 'abc123.pdf'));
  });

  it('writes and reads back the same bytes, creating the directory if needed', () => {
    const path = rawCachePath(join(dir, 'nested'), 'key1', 'html');

    writeRawCache(path, Buffer.from('<html></html>'));

    expect(readRawCache(path).toString()).toBe('<html></html>');
  });

  it('overwrites an existing cache file on re-fetch', () => {
    const path = rawCachePath(dir, 'key2', 'html');

    writeRawCache(path, Buffer.from('régi'));
    writeRawCache(path, Buffer.from('friss'));

    expect(readRawCache(path).toString()).toBe('friss');
  });
});
