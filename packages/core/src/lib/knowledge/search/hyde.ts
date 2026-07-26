import type Anthropic from '@anthropic-ai/sdk';

// Olcsó, gyors modell (docs/rag-provider-rationale.md, README költségbecslés):
// a HyDE-hívás feladata egy rövid bekezdés megírása, nem összetett érvelés -
// nem indokolt rá a fő agent modellt (Sonnet) használni.
const HYDE_MODEL = 'claude-haiku-4-5';
const HYDE_MAX_TOKENS = 300;

const HYDE_SYSTEM_PROMPT =
  'Írj egy rövid (3-5 mondatos), magyar nyelvű bekezdést, ami egy hivatalos ' +
  'fogyasztóvédelmi tájékoztató cikk (NKFH, Nébih vagy GVH) részlete lehetne, ' +
  'és ténylegesen megválaszolja a felhasználó kérdését a tudatos, gazdaságos ' +
  'élelmiszer-vásárlás témakörében. Ne jelezd, hogy ez feltételezés vagy ' +
  'AI-generált szöveg - úgy írd meg, mintha egy valódi cikkből idéznél.';

// HyDE (Hypothetical Document Embeddings): a nyers kérdés helyett egy
// hipotetikus, cikk-stílusú válaszbekezdés embeddingjét hasonlítjuk a
// tudásbázis chunkjaihoz. Ennek az az oka, hogy egy kérdés ("Meddig ehető a
// lejárt tejtermék?") és egy arra válaszoló cikkrészlet stilisztikailag
// távolabb áll egymástól embedding-térben, mint két hasonló stílusú
// (válasz-jellegű) szöveg - a HyDE-bekezdés áthidalja ezt a stílusrést.
export async function generateHypotheticalAnswer(
  client: Anthropic,
  question: string,
): Promise<string> {
  const response = await client.messages.create({
    model: HYDE_MODEL,
    max_tokens: HYDE_MAX_TOKENS,
    system: HYDE_SYSTEM_PROMPT,
    messages: [{ role: 'user', content: question }],
  });

  const text = response.content
    .filter(
      (block): block is Anthropic.TextBlock => block.type === 'text',
    )
    .map((block) => block.text)
    .join('\n')
    .trim();

  if (!text) {
    throw new Error('A HyDE-hívás nem adott vissza szöveges választ.');
  }

  return text;
}
