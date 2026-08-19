import { JSDOM } from 'jsdom';
import { Readability } from '@mozilla/readability';
import type { ExtractedBlock } from './extracted-block.js';

const HEADING_LEVEL: Record<string, 2 | 3> = {
  H1: 2,
  H2: 2,
  H3: 3,
  H4: 3,
};
const CONTENT_TAGS = new Set(['H1', 'H2', 'H3', 'H4', 'P', 'LI', 'BLOCKQUOTE']);

// Nagyon rövid kinyert tartalom (pl. egy majdnem üres oldal, ahol a
// Readability a maradék navigációs szöveget "tartalomnak" hiszi) nem megbízható
// forrás egy tudásbázis-chunkhoz - inkább hibázzon korán, mint hogy szemetet
// indexeljünk (docs/rag-chunking-strategy.md).
const MIN_CONTENT_CHARS = 200;

// A portal.nebih.gov.hu sablon egy "Friss hírek" dobozt fűz az <article> UTÁN,
// ugyanabba a szülő konténerbe - a Readability ezt néhány (rövidebb törzsű)
// oldalon tévesen a cikktörzs részének ítéli, és a doboz cikk-címei (pl. egy
// aktuális állatjárvány-hírről) idegen H2-ként szivárognak be a
// tudásbázisunkba, teljesen más témájú chunk-ként (lásd docs/golden-set-results.md
// q9 negatív tesztjének korábbi zajos találatát). Ez oldalsablon-specifikus
// szemét, nem tartalom - kiszedjük a DOM-ból a Readability előtt.
const BOILERPLATE_SELECTORS = ['.nebih-article-small', '.news-title-display-page'];

function stripKnownBoilerplate(document: Document): void {
  for (const selector of BOILERPLATE_SELECTORS) {
    for (const element of document.querySelectorAll(selector)) {
      element.remove();
    }
  }
}

// Readability (Firefox Reader Mode ugyanezt használja) kiszedi a navigációt,
// lábléceket, "kapcsolódó cikkek" dobozokat - csak a cikktörzs HTML-jét adja
// vissza. Utána azt a törzset járjuk be elem-szinten, hogy megtartsuk a
// heading-struktúrát a chunkolás számára (docs/rag-chunking-strategy.md).
export function extractHtmlBlocks(html: string, sourceUrl: string): ExtractedBlock[] {
  const dom = new JSDOM(html, { url: sourceUrl });
  stripKnownBoilerplate(dom.window.document);
  const reader = new Readability(dom.window.document);
  const article = reader.parse();

  if (!article || !article.content) {
    throw new Error(
      `Nem sikerült kinyerni a cikktörzset: ${sourceUrl} - a Readability nem talált olvasható tartalmat.`,
    );
  }

  const contentDom = new JSDOM(article.content);
  const blocks: ExtractedBlock[] = [];

  for (const element of contentDom.window.document.body.children) {
    collectBlocks(element, blocks);
  }

  const totalChars = blocks.reduce((sum, block) => sum + block.text.length, 0);
  if (totalChars < MIN_CONTENT_CHARS) {
    throw new Error(
      `Nem sikerült kinyerni a cikktörzset: ${sourceUrl} - a talált tartalom túl rövid (${totalChars} karakter), valószínűleg navigáció/lábléc maradt csak.`,
    );
  }

  return blocks;
}

function collectBlocks(element: Element, blocks: ExtractedBlock[]): void {
  const tag = element.tagName;

  if (!CONTENT_TAGS.has(tag)) {
    for (const child of element.children) {
      collectBlocks(child, blocks);
    }
    return;
  }

  const text = element.textContent?.trim() ?? '';
  if (!text) {
    return;
  }

  const level = HEADING_LEVEL[tag];
  blocks.push({
    level: level ?? 0,
    text,
    isListItem: tag === 'LI',
  });
}
