import { describe, expect, it } from 'vitest';
import type { ExtractedBlock } from '../extraction/extracted-block.js';
import { chunkDocument } from './chunk-document.js';

function block(level: 0 | 2 | 3, text: string, isListItem = false): ExtractedBlock {
  return { level, text, isListItem };
}

function paragraph(charLength: number, filler = 'a'): string {
  return filler.repeat(charLength);
}

describe('chunkDocument', () => {
  it('keeps a single short section as one chunk with the title as section path', () => {
    const chunks = chunkDocument(
      [block(0, 'Ez egy rövid bevezető bekezdés.')],
      'Teszt cikk',
    );

    expect(chunks).toHaveLength(1);
    expect(chunks[0].sectionPath).toBe('Teszt cikk');
    expect(chunks[0].content).toBe('Ez egy rövid bevezető bekezdés.');
  });

  it('starts a new section path at each H2 boundary and never merges across it', () => {
    const chunks = chunkDocument(
      [
        block(2, 'Tervezés'),
        block(0, 'Készíts bevásárlólistát.'),
        block(2, 'Tárolás'),
        block(0, 'Tartsd a hűtőt 0-5°C között.'),
      ],
      'Tudatos vásárlás',
    );

    expect(chunks).toHaveLength(2);
    expect(chunks[0].sectionPath).toBe('Tudatos vásárlás > Tervezés');
    expect(chunks[0].content).toBe('Készíts bevásárlólistát.');
    expect(chunks[1].sectionPath).toBe('Tudatos vásárlás > Tárolás');
    expect(chunks[1].content).toBe('Tartsd a hűtőt 0-5°C között.');
  });

  it('tracks H3 as a sub-path under the current H2', () => {
    const chunks = chunkDocument(
      [
        block(2, 'Tárolás'),
        block(3, 'Hűtőszekrény'),
        block(0, 'Tartsd 0-5°C között.'),
      ],
      'Tudatos vásárlás',
    );

    expect(chunks[0].sectionPath).toBe(
      'Tudatos vásárlás > Tárolás > Hűtőszekrény',
    );
  });

  it('merges a short trailing remainder into the previous chunk of the same section', () => {
    const chunks = chunkDocument(
      [
        block(2, 'Bevásárlólista'),
        block(0, paragraph(1900)),
        block(0, 'rövid utóirat', true),
      ],
      'Cikk',
    );

    expect(chunks).toHaveLength(1);
    expect(chunks[0].content.endsWith('- rövid utóirat')).toBe(true);
  });

  it('does not merge a short remainder across a section boundary', () => {
    const chunks = chunkDocument(
      [
        block(2, 'Első szakasz'),
        block(0, 'rövid'),
        block(2, 'Második szakasz'),
        block(0, 'másik rövid'),
      ],
      'Cikk',
    );

    expect(chunks).toHaveLength(2);
    expect(chunks[0].content).toBe('rövid');
    expect(chunks[1].content).toBe('másik rövid');
  });

  it('flushes once the buffer reaches the target size, starting a fresh chunk in the same section', () => {
    const chunks = chunkDocument(
      [
        block(2, 'Hosszú szakasz'),
        block(0, paragraph(1900)),
        block(0, paragraph(1900)),
      ],
      'Cikk',
    );

    expect(chunks).toHaveLength(2);
    expect(chunks[0].sectionPath).toBe('Cikk > Hosszú szakasz');
    expect(chunks[1].sectionPath).toBe('Cikk > Hosszú szakasz');
    expect(chunks[0].charCount).toBeLessThanOrEqual(2800);
  });

  it('never lets a single chunk exceed the hard max, splitting an oversized block deterministically', () => {
    const hugeParagraph = Array.from({ length: 1000 }, () => 'szó').join(' ');
    const chunks = chunkDocument([block(0, hugeParagraph)], 'Cikk');

    expect(chunks.length).toBeGreaterThan(1);
    for (const chunk of chunks) {
      expect(chunk.charCount).toBeLessThanOrEqual(2800);
    }
    expect(chunks.map((chunk) => chunk.content).join(' ')).toContain('szó');
  });

  it('chunks PDF-style blocks (no headings) purely by paragraph accumulation', () => {
    const chunks = chunkDocument(
      [block(0, paragraph(1000)), block(0, paragraph(1000)), block(0, paragraph(1000))],
      'PDF dokumentum',
    );

    expect(chunks.length).toBeGreaterThanOrEqual(2);
    for (const chunk of chunks) {
      expect(chunk.sectionPath).toBe('PDF dokumentum');
    }
  });

  it('prefixes list items with a dash while keeping paragraphs plain', () => {
    const chunks = chunkDocument(
      [
        block(0, 'Bevezető bekezdés.'),
        block(0, 'Első lépés', true),
        block(0, 'Második lépés', true),
      ],
      'Cikk',
    );

    expect(chunks[0].content).toBe(
      'Bevezető bekezdés.\n- Első lépés\n- Második lépés',
    );
  });

  it('is deterministic: same input always produces the same output', () => {
    const blocks = [
      block(2, 'Szakasz'),
      block(0, 'Tartalom egy.'),
      block(0, 'Tartalom kettő.', true),
    ];

    const first = chunkDocument(blocks, 'Cikk');
    const second = chunkDocument(blocks, 'Cikk');

    expect(first).toEqual(second);
  });
});
