import type { CohereClientV2 } from 'cohere-ai';

// embed-v4.0, Matryoshka-csonkolva 1024 dimenzióra (docs/rag-provider-rationale.md):
// a knowledge_chunks.embedding oszlop is vector(1024) - a kettőnek együtt kell
// változnia, ha valaha más dimenziót választanánk.
const EMBEDDING_MODEL = 'embed-v4.0';
const EMBEDDING_DIMENSIONS = 1024;

export type EmbedInputType = 'search_document' | 'search_query';

// Egyetlen feladat: szöveg -> embedding vektor(ok), a Cohere embed-v4.0-lal.
// inputType kötelező paraméter (nem opcionális alapértelmezés), mert a
// dokumentum-indexelés ("search_document") és a lekérdezés-embedding
// ("search_query") tudatosan más módot használ - ez az aszimmetrikus keresés
// lényege, nem szabad véletlenül eltéveszteni.
export async function embedTexts(
  client: CohereClientV2,
  texts: string[],
  inputType: EmbedInputType,
): Promise<number[][]> {
  if (texts.length === 0) {
    return [];
  }

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
}
