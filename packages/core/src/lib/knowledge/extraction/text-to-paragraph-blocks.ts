import type { ExtractedBlock } from './extracted-block.js';

const PARAGRAPH_BREAK = /\n\s*\n+/;

// Kivéve a PDF-kinyerésből (extract-pdf-blocks.ts), hogy önmagában,
// determinisztikusan tesztelhető legyen - nincs heading-jelölés, csak
// bekezdéshatár (docs/rag-chunking-strategy.md).
export function textToParagraphBlocks(text: string): ExtractedBlock[] {
  return text
    .split(PARAGRAPH_BREAK)
    .map((paragraph) => paragraph.replace(/\s+/g, ' ').trim())
    .filter((paragraph) => paragraph.length > 0)
    .map((paragraph): ExtractedBlock => ({
      level: 0,
      text: paragraph,
      isListItem: false,
    }));
}
