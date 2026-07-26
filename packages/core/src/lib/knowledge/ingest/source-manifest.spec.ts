import { describe, expect, it } from 'vitest';
import { parseSourceManifest } from './source-manifest.js';

describe('parseSourceManifest', () => {
  it('infers html format from a non-.pdf URL', () => {
    const [entry] = parseSourceManifest([
      { url: 'https://nkfh.gov.hu/cikk-1', title: 'Cikk', topic: 'tervezés' },
    ]);

    expect(entry.format).toBe('html');
  });

  it('infers pdf format from a .pdf URL', () => {
    const [entry] = parseSourceManifest([
      {
        url: 'https://nebih.gov.hu/utmutato.pdf',
        title: 'Útmutató',
        topic: 'tárolás',
      },
    ]);

    expect(entry.format).toBe('pdf');
  });

  it('honors an explicit format override', () => {
    const [entry] = parseSourceManifest([
      {
        url: 'https://example.com/dynamic-viewer',
        title: 'Cikk',
        topic: 'tervezés',
        format: 'pdf',
      },
    ]);

    expect(entry.format).toBe('pdf');
  });

  it('derives a stable, filesystem-safe cacheKey from the URL', () => {
    const first = parseSourceManifest([
      { url: 'https://nkfh.gov.hu/cikk-1', title: 'Cikk', topic: 'x' },
    ]);
    const second = parseSourceManifest([
      { url: 'https://nkfh.gov.hu/cikk-1', title: 'Más cím', topic: 'y' },
    ]);

    expect(first[0].cacheKey).toBe(second[0].cacheKey);
    expect(first[0].cacheKey).toMatch(/^[0-9a-f]{16}$/);
  });

  it('rejects an entry with an invalid URL', () => {
    expect(() =>
      parseSourceManifest([{ url: 'nem-url', title: 'x', topic: 'y' }]),
    ).toThrow();
  });

  it('rejects an entry missing a required field', () => {
    expect(() =>
      parseSourceManifest([{ url: 'https://example.com', title: 'x' }]),
    ).toThrow();
  });
});
