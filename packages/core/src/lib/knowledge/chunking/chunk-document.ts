import type { ExtractedBlock } from '../extraction/extracted-block.js';

export interface DocumentChunk {
  sectionPath: string;
  content: string;
  charCount: number;
}

// Karakter-alapú token-közelítés (~4 karakter/token magyar szövegen) -
// docs/rag-chunking-strategy.md indoklása szerint szándékosan nem valódi
// tokenizer: a chunkolásnak determinisztikus, függőségmentes függvénynek kell
// lennie, a pontos token-szám az embedding modellnél úgyis csak becslés.
const CHARS_PER_TOKEN = 4;
const TARGET_MAX_CHARS = 500 * CHARS_PER_TOKEN;
const HARD_MAX_CHARS = 700 * CHARS_PER_TOKEN;
const MIN_MERGE_CHARS = 60 * CHARS_PER_TOKEN;

interface SectionPath {
  title: string;
  h2: string | null;
  h3: string | null;
}

function buildSectionPath(path: SectionPath): string {
  return [path.title, path.h2, path.h3].filter((part): part is string => Boolean(part)).join(' > ');
}

// Egy blokk önmagában is túllépheti a kemény korlátot (pl. egy PDF-ből
// kinyert, nagyon hosszú bekezdés, amiben nincs listahatár). Ilyenkor
// determinisztikusan, szóhatáron feldaraboljuk - ez a chunkolás egyetlen
// ága, ami egy blokkot több chunkra bont.
function splitOversizedText(text: string): string[] {
  const parts: string[] = [];
  let remaining = text;

  while (remaining.length > HARD_MAX_CHARS) {
    let cut = remaining.lastIndexOf(' ', HARD_MAX_CHARS);
    if (cut <= 0) {
      cut = HARD_MAX_CHARS;
    }
    parts.push(remaining.slice(0, cut).trim());
    remaining = remaining.slice(cut).trim();
  }
  if (remaining.length > 0) {
    parts.push(remaining);
  }
  return parts;
}

export function chunkDocument(blocks: ExtractedBlock[], title: string): DocumentChunk[] {
  const chunks: DocumentChunk[] = [];
  const path: SectionPath = { title, h2: null, h3: null };
  let buffer: string[] = [];
  let bufferChars = 0;
  let lastFlushedSectionKey: string | null = null;

  function sectionKey(): string {
    return `${path.h2 ?? ''}::${path.h3 ?? ''}`;
  }

  function flush(): void {
    if (buffer.length === 0) {
      return;
    }
    const content = buffer.join('\n');
    const key = sectionKey();

    // Rövid maradék (pl. egy szakasz utolsó, magában túl kicsi listaeleme)
    // nem önálló chunk - hozzáfűzzük az előző, AZONOS szekcióból származó
    // chunkhoz, hogy ne keletkezzen egy pár szavas, kontextus nélküli chunk.
    const previous = chunks.at(-1);
    if (
      content.length < MIN_MERGE_CHARS &&
      previous &&
      key === lastFlushedSectionKey
    ) {
      previous.content = `${previous.content}\n${content}`;
      previous.charCount = previous.content.length;
    } else {
      chunks.push({
        sectionPath: buildSectionPath(path),
        content,
        charCount: content.length,
      });
      lastFlushedSectionKey = key;
    }

    buffer = [];
    bufferChars = 0;
  }

  function appendText(text: string, isListItem: boolean): void {
    const parts = text.length > HARD_MAX_CHARS ? splitOversizedText(text) : [text];

    for (const part of parts) {
      const rendered = isListItem ? `- ${part}` : part;

      if (bufferChars > 0 && bufferChars + rendered.length + 1 > HARD_MAX_CHARS) {
        flush();
      }

      buffer.push(rendered);
      bufferChars += rendered.length + 1;

      if (bufferChars >= TARGET_MAX_CHARS) {
        flush();
      }
    }
  }

  for (const block of blocks) {
    if (block.level === 2) {
      flush();
      path.h2 = block.text;
      path.h3 = null;
      continue;
    }
    if (block.level === 3) {
      flush();
      path.h3 = block.text;
      continue;
    }
    appendText(block.text, block.isListItem);
  }
  flush();

  return chunks;
}
