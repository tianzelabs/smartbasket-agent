-- knowledge_documents / knowledge_chunks: a RAG-réteg tudásbázisa (HF3).
-- pgvector szükséges - lásd docker-compose.yml (pgvector/pgvector:pg17 image).
CREATE EXTENSION IF NOT EXISTS vector;

-- Egy sor = egy forrásdokumentum (NKFH/Nébih/GVH cikk vagy PDF). A content_hash
-- teszi lehetővé az inkrementális ingestet (docs/knowledge-base-architecture.md):
-- ha a forrás tartalma nem változott a hash-hez képest, nem kell újra
-- chunkolni/embeddelni.
CREATE TABLE knowledge_documents (
  id INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  source_url TEXT NOT NULL UNIQUE,
  title TEXT NOT NULL,
  topic TEXT NOT NULL,
  format TEXT NOT NULL CHECK (format IN ('html', 'pdf')),
  content_hash TEXT NOT NULL,
  published_at DATE,
  fetched_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  word_count INTEGER NOT NULL
);

-- Egy sor = egy chunk. embedding: Cohere embed-v4.0, Matryoshka-csonkolt 1024
-- dimenzióra (docs/rag-provider-rationale.md). A knowledge_chunks sosem íródik
-- közvetlenül az LLM-ből - csak az ingest scriptből (RW kapcsolat).
CREATE TABLE knowledge_chunks (
  id INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  document_id INTEGER NOT NULL REFERENCES knowledge_documents (id) ON DELETE CASCADE,
  chunk_index INTEGER NOT NULL,
  section_path TEXT NOT NULL,
  content TEXT NOT NULL,
  char_count INTEGER NOT NULL,
  embedding vector(1024) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (document_id, chunk_index)
);

CREATE INDEX idx_knowledge_chunks_document_id ON knowledge_chunks (document_id);

-- SZÁNDÉKOSAN NINCS vektor-index (HNSW/IVFFlat): pár száz - ~ezer chunk
-- méretben a pontos (brute-force) "ORDER BY embedding <=> query LIMIT n" scan
-- gyorsabb és pontosabb, mint egy ANN index build/tuning overhead-je -
-- docs/rag-provider-rationale.md.

-- Szemantikus view a searchKnowledge toolhoz (konvenciok.md 6. pont: az agent
-- soha nem éri el közvetlenül a nyers táblát). Ez adja a grounding-hoz
-- szükséges forrásmetaadatokat (title, source_url, published_at, section_path)
-- ÉS az embedding oszlopot is - ez utóbbi kivétel indoka: a vektor-hasonlóság
-- számítás (ORDER BY embedding <=> ...) csak akkor futtatható a RO
-- kapcsolaton, ha a view exponálja az embeddinget. A raw knowledge_chunks/
-- knowledge_documents táblára a smartbasket_ro szerep sosem kap jogot.
CREATE VIEW vw_knowledge_search AS
SELECT
  c.id AS chunk_id,
  c.content,
  c.section_path,
  c.embedding,
  d.title,
  d.source_url,
  d.topic,
  d.published_at
FROM knowledge_chunks c
JOIN knowledge_documents d ON d.id = c.document_id;

-- Read-only szerepkör jogosultsága (docs/db-migration-rationale.md mintájára):
-- NÉVSZERINT csak a vw_knowledge_search view-ra, sosem a raw
-- knowledge_documents/knowledge_chunks táblára.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'smartbasket_ro') THEN
    EXECUTE 'GRANT SELECT ON vw_knowledge_search TO smartbasket_ro';
  ELSE
    RAISE NOTICE 'smartbasket_ro szerep nem létezik - read-only grant kihagyva.';
  END IF;
END
$$;
