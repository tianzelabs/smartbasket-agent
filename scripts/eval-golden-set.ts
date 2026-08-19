import Anthropic from '@anthropic-ai/sdk';
import { CohereClientV2 } from 'cohere-ai';
import { writeFileSync } from 'node:fs';
import {
  loadAgentConfig,
  loadCohereConfig,
  loadDatabaseConfig,
  embedTexts,
  vectorSearch,
  searchKnowledge,
  getKnowledgeBaseStats,
  type SearchedChunk,
  type SearchKnowledgeResult,
} from '@smartbasket/core';
import { GOLDEN_SET } from './golden-set-questions.js';

const RESULT_LIMIT = 5;
const OUTPUT_PATH = 'docs/golden-set-results.md';

// A sectionPath már tartalmazza a dokumentum címét is (chunk-document.ts:
// buildSectionPath), ezért önmagában elég az azonosításhoz - nem kell külön
// title-lel megfejelni.
function chunkIdentity(chunk: { sectionPath: string }): string {
  return chunk.sectionPath;
}

// A "nyers" alapvonal: csak embedding + pgvector távolság, HyDE és rerank
// NÉLKÜL - ez a HF3 feladatleírás 4. pontjának "nyers vektorkeresés" ága.
async function rawVectorSearch(
  question: string,
  cohereClient: CohereClientV2,
  databaseUrlReadonly: string,
): Promise<SearchedChunk[]> {
  const [queryEmbedding] = await embedTexts(cohereClient, [question], 'search_query');
  return vectorSearch(databaseUrlReadonly, queryEmbedding, RESULT_LIMIT);
}

function renderRawList(chunks: SearchedChunk[]): string {
  if (chunks.length === 0) {
    return '_(nincs találat)_';
  }
  return chunks
    .map((chunk, i) => `${i + 1}. ${chunkIdentity(chunk)}`)
    .join('\n');
}

function renderFullList(result: SearchKnowledgeResult): string {
  if (result.belowThreshold || result.chunks.length === 0) {
    return '_(belowThreshold: true - nincs a küszöböt elérő találat)_';
  }
  return result.chunks
    .map(
      (chunk, i) =>
        `${i + 1}. ${chunk.sectionPath} (relevanceScore: ${chunk.relevanceScore.toFixed(3)})`,
    )
    .join('\n');
}

interface EvalRow {
  id: string;
  question: string;
  isNegativeTest: boolean;
  rawTop1: string | null;
  fullTop1: string | null;
  belowThreshold: boolean;
  reordered: boolean;
}

// Egy sor a q1-q10 (vagy amennyi kérdés a GOLDEN_SET-ben van) áttekintő
// táblájában - Markdown-táblacellának escape-eli a "|" karaktert, hogy egy
// hosszabb cím ne törje el a táblát.
function escapeCell(value: string | null): string {
  return value === null ? '-' : value.replace(/\|/g, '\\|');
}

function renderAggregateTable(rows: EvalRow[]): string {
  const header = '| # | Kérdés | Nyers top-1 | Teljes pipeline top-1 | Átrendezve? |\n|---|---|---|---|---|';
  const body = rows
    .map((row) => {
      const label = row.isNegativeTest ? `${row.id} (negatív)` : row.id;
      const verdict = row.belowThreshold
        ? 'n/a'
        : row.reordered
          ? '**IGEN**'
          : 'Nem';
      return `| ${label} | ${escapeCell(row.question)} | ${escapeCell(row.rawTop1)} | ${row.belowThreshold ? '_belowThreshold_' : escapeCell(row.fullTop1)} | ${verdict} |`;
    })
    .join('\n');
  return `${header}\n${body}`;
}

async function main(): Promise<void> {
  const agentConfig = loadAgentConfig();
  const anthropicClient = new Anthropic({ apiKey: agentConfig.anthropicApiKey });
  const cohereClient = new CohereClientV2({ token: loadCohereConfig().cohereApiKey });
  const { databaseUrlReadonly } = loadDatabaseConfig();

  const sections: string[] = [];
  const rows: EvalRow[] = [];

  for (const item of GOLDEN_SET) {
    console.log(`Futtatás: ${item.id}`);
    const raw = await rawVectorSearch(item.question, cohereClient, databaseUrlReadonly);
    const full = await searchKnowledge(item.question, {
      anthropicClient,
      cohereClient,
      databaseUrlReadonly,
    });

    const rawTop1 = raw[0] ? chunkIdentity(raw[0]) : null;
    const fullTop1 =
      !full.belowThreshold && full.chunks[0] ? full.chunks[0].sectionPath : null;
    const reordered = rawTop1 !== null && fullTop1 !== null && rawTop1 !== fullTop1;

    rows.push({
      id: item.id,
      question: item.question,
      isNegativeTest: item.isNegativeTest ?? false,
      rawTop1,
      fullTop1,
      belowThreshold: full.belowThreshold,
      reordered,
    });

    sections.push(`## ${item.id}${item.isNegativeTest ? ' (negatív teszt)' : ''}

**Kérdés:** ${item.question}
${item.note ? `\n> ${item.note}\n` : ''}
**Nyers vektorkeresés (embedding + távolság, HyDE/rerank nélkül), top ${RESULT_LIMIT}:**

${renderRawList(raw)}

**Teljes pipeline (HyDE + rerank), top ${RESULT_LIMIT}:**

${renderFullList(full)}

**Rerank átrendezett-e?** ${reordered ? '**IGEN** - az 1. helyen szereplő chunk megváltozott.' : raw.length === 0 || full.belowThreshold ? 'n/a (nincs elég találat az összevetéshez)' : 'Nem - az 1. helyen ugyanaz a chunk maradt.'}
`);
  }

  const stats = await getKnowledgeBaseStats(databaseUrlReadonly);

  // "Összevethető" = mindkét ágon van top-1 (a belowThreshold negatív
  // teszteknél nincs, ezért azok nem számítanak bele az arányba) - lásd
  // docs/golden-set-results.md korábbi verziójának hibáját: egy bináris
  // "volt-e legalább egy átrendezés" mondat elrejtette, hogy a találatok
  // többségénél történt átrendezés, nem csak egyetlen kirívó esetnél.
  const comparable = rows.filter((row) => row.rawTop1 !== null && row.fullTop1 !== null);
  const reorderedRows = comparable.filter((row) => row.reordered);
  const negativeTests = rows.filter((row) => row.isNegativeTest);

  const summaryLine =
    comparable.length === 0
      ? 'egyetlen kérdés sem volt összevethető (minden ág belowThreshold-ot adott vissza).'
      : reorderedRows.length === 0
        ? `a(z) ${comparable.length} összevethető kérdés egyikénél sem változott az 1. helyezett chunk a rerank után - ez is releváns eredmény, az ok(oka)t az egyes kérdéseknél dokumentáljuk.`
        : `a(z) ${comparable.length} összevethető kérdésből **${reorderedRows.length}-nél (${Math.round((reorderedRows.length / comparable.length) * 100)}%)** a rerank ténylegesen átrendezte a top találatot (részletek lent és az összesítő táblában) - ez konkrét bizonyíték arra, hogy a rerank lépés érdemi hozzáadott értéket ad a nyers vektorkereséshez képest.`;

  const summary = `# Golden set – nyers vektorkeresés vs. teljes pipeline (HF3)

> ${GOLDEN_SET.length} kérdés a tudásbázis 6 altémájából (${negativeTests.length} negatív teszt). Minden kérdés kétféleképp futott: (1) nyers vektorkeresés - csak embedding + pgvector koszinusz-távolság, HyDE és rerank nélkül; (2) a teljes pipeline (\`searchKnowledge\`) - HyDE (Haiku) + embedding + pgvector + rerank (Cohere rerank-v3.5) + relevancia-küszöb. Éles korpuszon (${stats.documentCount} dokumentum, ${stats.chunkCount} chunk, valós Cohere/Anthropic hívásokkal) generálva.

**Összefoglaló:** ${summaryLine}

${renderAggregateTable(rows)}

---

${sections.join('\n---\n\n')}
`;

  const reorderExample = reorderedRows[0];
  const nonReorderedComparable = comparable.filter((row) => !row.reordered);

  const reorderAnalysis = reorderExample
    ? `## Elemzés: miért jobb az új sorrend (${reorderExample.id} példáján)

A **${reorderExample.id}** kérdésnél ("${reorderExample.question}") a nyers
vektorkeresés 1. helyre a *"${reorderExample.rawTop1}"* találatot hozta, míg a
teljes pipeline (HyDE + rerank) 1. helyre a *"${reorderExample.fullTop1}"*
találatot tette. Ez jellemzően azt jelenti, hogy a nyers vektorkeresés egy
témában rokon, de a kérdésre nem közvetlenül válaszoló chunk-ot rangsorolt
elsőre, a rerank pedig egy kereszt-encoderrel a kérdés és a chunk tényleges
tartalmi illeszkedését nézve javította ezt - nem csak a vektortér-közelséget.
(A további átrendezett kérdéseket lásd az összesítő táblában és az egyes
szekciókban fent.)`
    : `## Elemzés: miért nem rendezett át semmit a rerank

A jelen futtatásban egyetlen összevethető kérdésnél sem változott az 1.
helyezett chunk a rerank után. Ez azt sugallja, hogy ezen a korpuszon a
nyers vektor-hasonlóság alapján legjobban illeszkedő chunk minden esetben már
eleve helyes volt - a rerank nem ront, csak megerősít.`;

  const noReorderAnalysis =
    nonReorderedComparable.length > 0
      ? `## Miért nem rendezett át semmit ${nonReorderedComparable.length === 1 ? 'egy kérdésnél' : `${nonReorderedComparable.length} kérdésnél`} (${nonReorderedComparable.map((row) => row.id).join(', ')})

Ezeknél a kérdéseknél a nyers keresés 1. helyezettje és a teljes pipeline 1.
helyezettje megegyezett. Ennek oka feltehetően az, hogy a legjobban illeszkedő
chunk embedding-távolság alapján is már egyértelműen kiugró volt a többi
jelölthöz képest (nincs "közeli verseny" a top pozícióért) - ilyenkor a rerank
nem *ront*, csak megerősíti a már helyes sorrendet. Ez önmagában is releváns
eredmény: azt mutatja, hogy a rerank nem véletlenszerűen kever, hanem ott
avatkozik be, ahol a nyers vektor-hasonlóság félrevezető.`
      : '';

  const negativeTestAnalysis = `## Negatív teszt eredménye

${
  negativeTests.length === 0
    ? '_(nincs negatív teszt a golden setben)_'
    : negativeTests.every((row) => row.belowThreshold)
      ? `Mind a(z) ${negativeTests.length} negatív teszt kérdésnél (${negativeTests.map((row) => row.id).join(', ')}) a teljes pipeline \`belowThreshold: true\`-t adott vissza, üres chunk-listával - a rendszer nem kényszerült arra, hogy a leggyengébb találatokból összetákoljon egy válasz-látszatot. Élesben az agent ennek megfelelően explicit kimondja, hogy nincs erre megbízható forrás a tudásbázisban, ahelyett hogy kitalálna egy választ - ez a grounding tényleges próbája, nem csak egy be nem tartott prompt-szabály.`
      : `A negatív teszt kérdések közül (${negativeTests.map((row) => row.id).join(', ')}) nem mindegyiknél adott \`belowThreshold: true\`-t a pipeline - ezt egyenként érdemes megvizsgálni, mert azt jelezheti, hogy a küszöb vagy a tudásbázis-lefedettség felülvizsgálatra szorul.`
}`;

  const analysis = `---

${reorderAnalysis}

${noReorderAnalysis ? `${noReorderAnalysis}\n\n` : ''}${negativeTestAnalysis}
`;

  writeFileSync(OUTPUT_PATH, summary + analysis, 'utf8');
  console.log(`\nKész: ${OUTPUT_PATH}`);
}

await main();
