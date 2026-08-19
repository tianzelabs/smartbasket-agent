import type { CohereClientV2 } from 'cohere-ai';

// embed-v4.0, Matryoshka-csonkolva 1024 dimenzióra (docs/rag-provider-rationale.md):
// a knowledge_chunks.embedding oszlop is vector(1024) - a kettőnek együtt kell
// változnia, ha valaha más dimenziót választanánk.
const EMBEDDING_MODEL = 'embed-v4.0';
const EMBEDDING_DIMENSIONS = 1024;

export type EmbedInputType = 'search_document' | 'search_query';

const RATE_LIMIT_MAX_RETRIES = 5;
const RATE_LIMIT_BACKOFF_MS = 65_000;

function isRateLimitError(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'statusCode' in error &&
    (error as { statusCode?: number }).statusCode === 429
  );
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// Egyetlen feladat: szöveg -> embedding vektor(ok), a Cohere embed-v4.0-lal.
// inputType kötelező paraméter (nem opcionális alapértelmezés), mert a
// dokumentum-indexelés ("search_document") és a lekérdezés-embedding
// ("search_query") tudatosan más módot használ - ez az aszimmetrikus keresés
// lényege, nem szabad véletlenül eltéveszteni.
//
// A trial Cohere kulcsok percenkénti token-limitje (429) valós, ismétlődő
// hiba nagyobb korpusz (100+ dokumentum) ingestjénél - egy percet vár és
// újrapróbálja, ahelyett hogy elszállna a teljes knowledge:ingest futás
// közepén (a hívó ingestDocument amúgy is tartalom-hash alapján idempotens,
// szóval egy sikertelen próbálkozás után a script újraindítása is biztonságos).
export async function embedTexts(
  client: CohereClientV2,
  texts: string[],
  inputType: EmbedInputType,
): Promise<number[][]> {
  if (texts.length === 0) {
    return [];
  }

  let attempt = 0;
  for (;;) {
    try {
      const response = await client.embed({
        texts,
        model: EMBEDDING_MODEL,
        inputType,
        outputDimension: EMBEDDING_DIMENSIONS,
        embeddingTypes: ['float'],
      });

      const embeddings = response.embeddings.float;
      if (!embeddings) {
        throw new Error(
          'A Cohere embed válasz nem tartalmazott float embeddinget - ellenőrizd az embeddingTypes paramétert.',
        );
      }

      return embeddings;
    } catch (error) {
      attempt += 1;
      if (!isRateLimitError(error) || attempt > RATE_LIMIT_MAX_RETRIES) {
        throw error;
      }
      console.warn(
        `Cohere embed rate limit (429) - várakozás ${RATE_LIMIT_BACKOFF_MS / 1000}s, majd újrapróbálkozás (${attempt}/${RATE_LIMIT_MAX_RETRIES})...`,
      );
      await sleep(RATE_LIMIT_BACKOFF_MS);
    }
  }
}
