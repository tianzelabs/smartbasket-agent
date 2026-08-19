# SmartBasket Agent – RAG keresési pipeline: provider- és routing-döntések (HF3)

> A HF3 feladatleírás kötelezővé teszi: embedding+vektor-tárolás, HyDE, rerank, grounding,
> és **legalább két különböző provider** modelljét, szereposztással és indoklással. Ez a
> dokumentum leírja a szereposztást, a modellválasztásokat, a vektor-tárolás/index döntést,
> és a query-routing tervet - mindegyiknél azt is, milyen alternatívát vetettünk el és miért.

---

## 1. Multi-provider szereposztás

| Lépés | Provider | Modell | Miért ez |
|---|---|---|---|
| Fő agent-loop (tool-use, végső válasz) | Anthropic | `claude-sonnet-5` | Már bekötve a HF1-ből (`ask-agent.ts`) - nem indokolt lecserélni egy jól működő, tesztelt komponenst csak azért, hogy "két teljesen külön LLM-et" mutassunk. |
| HyDE (hipotetikus válasz generálása) | Anthropic | `claude-haiku-4-5` | Olcsó, gyors modell egy rövid, séma nélküli generálási feladathoz - nem indokolt rá a drágább Sonnet-et hívni minden egyes kérdésnél (lásd README költségbecslés). |
| Embedding | Cohere | `embed-v4.0` (1024 dim, Matryoshka-csonkolva) | Cohere multilingual embedding modellje kifejezetten a magyar nyelvet is lefedő, aszimmetrikus (query/document) kereséshez készült - ez pontosan a mi use case-ünk. |
| Rerank | Cohere | `rerank-v3.5` | Cohere jelenlegi többnyelvű rerank endpointja - ugyanaz a provider, mint az embedding, egy API-kulcs, egy SDK (`cohere-ai`). |

**Miért nem vezettünk be egy harmadik (pl. Gemini) providert HyDE-re/routingra:**
a HF1 repo a beadáskor kizárólag `@anthropic-ai/sdk`-t tartalmazta függőségként
(`packages/core/package.json`). Egy harmadik LLM SDK bevezetése (Gemini) csak azért, hogy
"HyDE-t más provider csinálja", megduplázná a hitelesítést/konfigurációt és a hibalehetőségeket
egy már működő tool-use loop mellett - ezzel szemben a Sonnet/Haiku megkülönböztetés
(ugyanaz a provider, más modell-tier) is valódi, indokolható szereposztás: **nem az számít,
hogy két külön cégtől jön-e a hívás, hanem hogy a feladat nehézségéhez illő modellt
használjuk-e.** A ténylegesen "két különböző provider" feltételt a Cohere (embedding+rerank)
bevezetése adja - ez viszont *funkcionálisan* indokolt (multilingual retrieval), nem
kirakati.

## 2. Vektor-tárolás: pgvector, nincs ANN-index

- **pgvector** a meglévő Postgres-adatbázisban (`0002_knowledge_base.sql`), nem külön
  vektor-DB - a HF1 már Postgres-re állt (lásd `docs/db-migration-rationale.md`), és a
  projekt mérete (136 dokumentum, 326 chunk - a "néhány száz - ~1500 chunk" becsült
  sávon belül) messze nem indokol egy külön infrastruktúra-komponenst.
- **`vector(1024)`**: az `embed-v4.0` alapértelmezett kimenete 1536 dimenzió, de a modell
  Matryoshka-reprezentációt használ, ami lehetővé teszi a csonkolást (256/512/1024/1536)
  minimális minőségromlással. 1024-et választottunk: kisebb tárolási/összehasonlítási
  költség, a mi korpuszméretünknél a minőségkülönbség elhanyagolható.
- **Nincs HNSW/IVFFlat index**: pár száz - ezer sornál egy brute-force pontos legközelebbi
  szomszéd keresés (`ORDER BY embedding <=> $1::vector LIMIT n`, lásd
  `knowledge/search/vector-search.ts`) gyorsabb és **pontosabb**, mint egy ANN-index
  build/tuning overhead-je - egy HNSW index most tisztán korai optimalizálás lenne, amit
  a feladatleírás explicit nem díjaz ("a felesleges túlbonyolítás sem érdem").
- **A `searchKnowledge` tool a `vw_knowledge_search` szemantikus view-n keresztül olvas**,
  a `smartbasket_ro` szerepkör csak erre kap `SELECT`-et - a raw
  `knowledge_documents`/`knowledge_chunks` táblára soha, ugyanazzal a mintával, mint a
  `vw_products`/`vw_best_prices` (`docs/db-migration-rationale.md`).

## 3. A keresési pipeline lépésről lépésre (`knowledge/search/search-knowledge.ts`)

```
kérdés
  -> HyDE (Haiku): rövid, cikk-stílusú hipotetikus válasz
  -> embed (Cohere embed-v4.0, inputType: search_query) a HyDE-szövegre
  -> brute-force pgvector top 20 (vw_knowledge_search)
  -> rerank (Cohere rerank-v3.5) - az EREDETI kérdéssel, nem a HyDE-szöveggel
  -> top 5
  -> relevancia-küszöb ellenőrzés
  -> {chunks, belowThreshold}
```

**Miért a HyDE-szöveget embeddeljük, nem a nyers kérdést:** egy kérdés
("Meddig ehető a lejárt tejtermék?") és egy arra válaszoló cikkrészlet stilisztikailag
távolabb áll egymástól embedding-térben, mint két hasonló stílusú (válasz-jellegű) szöveg -
a HyDE-bekezdés áthidalja ezt a stílusrést, mielőtt embeddelnénk.

**Miért a rerank az EREDETI kérdéssel fut, nem a HyDE-szöveggel:** a rerank egy
kereszt-encoder, ami közvetlenül egy (kérdés, dokumentum) párt pontoz - neki nem kell a
HyDE stílus-hidalás, sőt, a HyDE-szöveg esetleges pontatlanságai (hallucinált részletek)
itt csak zajt vinnének be. A rerank a felhasználó tényleges szándékához méri a
találatokat, nem a közvetítő hipotézishez.

**Miért `embed-v4.0` `search_document`/`search_query` inputType megkülönböztetéssel:**
ez a Cohere aszimmetrikus keresési módja - az ingestnél a chunkokat
`search_document`-ként, keresésnél a (HyDE) query-t `search_query`-ként embeddeljük
(`embedding/embed-texts.ts`). Ha ezt összekevernénk, a keresés minősége mérhetően
romlana - ezért az `EmbedInputType` explicit, kötelező paraméter, nincs alapértelmezése.

## 4. Grounding: kétrétegű védelem, nem csak prompt-szabály

A feladatleírás explicit kimondja: "ha egyetlen kérdésnél sem rendez át semmit [a
rerank], az is eredmény... a grounding próbája [a negatív teszt]... enélkül a
prompt-szabály csak dísz." Ennek megfelelően a "nincs a tudásbázisban" állapot **két,
egymástól független rétegen** dől el:

1. **Determinisztikus réteg (`search-knowledge.ts`, `RELEVANCE_THRESHOLD`)**: ha a top
   reranked találat relevancia-pontszáma a küszöb alatt van, a tool `belowThreshold: true`-t
   ad vissza ÉS **üres chunk-listát** - nem küld "majdnem jó" találatokat az agentnek,
   amikből az kényszerűen összerakhatna egy válasz-látszatot.
2. **Szemantikus réteg (system prompt, `<rules>`)**: még ha kapott is chunköt az agent,
   a promptnak explicit elő kell írnia, hogy ha a tartalom ténylegesen nem válaszolja meg
   a kérdést, mondja ki - ne "használja fel", amit kapott, csak mert kapott valamit.

A küszöb pontos számértékét a golden set negatív teszt kérdéseinek valós rerank-score
eloszlásából kalibráljuk (lásd `docs/golden-set-results.md`), nem elméleti becslésből -
ez a szám a valós adaton kerül véglegesítésre és dokumentálásra.

## 5. Query-routing: a meglévő tool-loop, nem egy külön router-komponens

A `searchKnowledge` egy **harmadik tool** a meglévő, kézzel írt tool-use loopban
(`ask-agent.ts`), a `runSql`/`listCategories` mellett - **nem** egy explicit,
tool-hívás előtti osztályozó lépés. Ennek két oka van:

1. **Konzisztencia a meglévő architektúrával**: a HF1 óta a `runSql` vs. `listCategories`
   közötti választást is maga a modell dönti el a tool-leírások alapján, egy külön
   routing-réteg nélkül. Egy párhuzamos, promptot megkerülő döntési mechanizmus
   bevezetése a `searchKnowledge`-hez inkonzisztens lenne ezzel, és egy új,
   dokumentálatlan hibaforrást (a router téves döntését) adna a rendszerhez.
2. **A "vegyes" kérdések természetes kezelése**: mivel a modell egy körben több toolt is
   hívhat (`toolUseBlocks` ciklus, `ask-agent.ts`), egy "megéri-e ma megvenni X-et
   Y áron nagy kiszerelésben" jellegű kérdésnél magától hívja meg mindkét toolt - egy
   előzetes bináris router ("ár vs. tudás") ezt csak megnehezítené, mert előre el
   kellene döntenie, hogy a kérdés melyik kategóriába tartozik, miközben valójában
   mindkettőbe tartozik.

A "routing-indoklás" tehát a system promptban él (`<task>`, `<knowledge>` blokkok -
lásd `docs/system-prompt-improvements.md` v2 → v3 diff), nem egy külön kódmodulban.
