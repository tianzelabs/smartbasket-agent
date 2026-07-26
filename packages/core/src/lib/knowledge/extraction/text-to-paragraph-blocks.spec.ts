import { describe, expect, it } from 'vitest';
import { textToParagraphBlocks } from './text-to-paragraph-blocks.js';

describe('textToParagraphBlocks', () => {
  it('splits text into level-0 blocks on blank lines', () => {
    const blocks = textToParagraphBlocks(
      'Első bekezdés.\n\nMásodik bekezdés.',
    );

    expect(blocks).toEqual([
      { level: 0, text: 'Első bekezdés.', isListItem: false },
      { level: 0, text: 'Második bekezdés.', isListItem: false },
    ]);
  });

  it('collapses internal whitespace/line-wraps within a paragraph', () => {
    const blocks = textToParagraphBlocks('Egy   sorokra\ntördelt\nbekezdés.');

    expect(blocks).toEqual([
      { level: 0, text: 'Egy sorokra tördelt bekezdés.', isListItem: false },
    ]);
  });

  it('drops empty paragraphs produced by multiple blank lines', () => {
    const blocks = textToParagraphBlocks('Első.\n\n\n\nMásodik.');

    expect(blocks).toHaveLength(2);
  });

  it('returns an empty array for blank input', () => {
    expect(textToParagraphBlocks('   \n\n  ')).toEqual([]);
  });
});
