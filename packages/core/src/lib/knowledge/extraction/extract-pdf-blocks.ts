import { extractText, getDocumentProxy } from 'unpdf';
import type { ExtractedBlock } from './extracted-block.js';
import { textToParagraphBlocks } from './text-to-paragraph-blocks.js';

// A PDF-ből kinyert szövegben nincs megbízható heading-jelölés (a PDF.js
// szöveg-extrakció nem őrzi meg a betűméretet/vastagságot ezen a szinten) -
// ezért PDF-nél a bekezdéshatár a chunk-határ (docs/rag-chunking-strategy.md).
export async function extractPdfBlocks(buffer: Buffer): Promise<ExtractedBlock[]> {
  const document = await getDocumentProxy(new Uint8Array(buffer));
  const { text } = await extractText(document, { mergePages: true });
  const blocks = textToParagraphBlocks(text);

  if (blocks.length === 0) {
    throw new Error('A PDF-ből nem sikerült szöveget kinyerni - üres vagy szkennelt dokumentum lehet.');
  }

  return blocks;
}
