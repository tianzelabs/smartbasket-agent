# Mérési terv (HF5)

Minden sor forrása vagy **létező, ma is naplózott** adat (`logs/*.jsonl`,
`logs/escalations.jsonl`), vagy explicit meg van jelölve, hogy még
**beépítendő** mérőpont. Egyik szám sem becslés a metrikaforrásra nézve - a
konkrét példaértékek a [`docs/demo-transcript.md`](demo-transcript.md) három
valós futásából származnak (2026-08-19).

| Mit mérünk | Honnan lesz adat | Hogyan riportáljuk | Kinek | Forrás típusa | Példa (3 demo-futásból) |
|---|---|---|---|---|---|
| Válaszidő (kérdéstől válaszig) | `askAgent()` `durationMs` mezője, minden `ask` hívás JSONL sorában (`logs/*.jsonl`) | heti automatikus összesítő (átlag, p95) | folyamatgazda | **mért** | 10 562 / 18 124 / 11 115 ms a 3 demo-kérdésre - a RAG-ág (searchKnowledge, HyDE+embedding+rerank+2. LLM-hívás) érezhetően lassabb, mint a tiszta SQL-ág |
| Eszkalációs arány (agent bizonytalan vagy panaszt észlel → emberhez irányít) | `logs/escalations.jsonl` sorainak száma / az adott időszak összes `ask` kérdése (`logs/*.jsonl` sorainak száma) | havi egy dia a vezetői riportban | szponzor | **mért** (számláló már létezik: `escalateToHuman` minden hívása egy sort ír) | 1 eszkaláció / 3 demo-kérdés = 33% - kis mintán nem reprezentatív, de a mechanizmus működik |
| Tool-hiba arány (SQL guard elutasítás, DB-hiba - nem eszkaláció, hanem tényleges végrehajtási hiba) | `toolCalls[].isError` mező a JSONL-ben | heti automatikus összesítő | fejlesztőcsapat | **mért**, de ma nincs külön dashboard hozzá - csak a nyers JSONL-ben elérhető | 0/3 a demókban (a guard sosem dobott hibát ezen a 3 kérdésen) |
| Token-költség kérdésenként | `usage.inputTokens` / `usage.outputTokens` a JSONL-ben, Anthropic/Cohere árlistával szorozva | heti automatikus összesítő | folyamatgazda | **mért** | pl. a panasz-demón 9203 be / 416 ki token (Sonnet 5) - ár-only kérdés kb. $0,03-0,05, RAG-os kérdés a [`README.md`](../README.md) költségbecslése szerint +1,5-2 cent |
| Megoldott fájdalom lefedettsége (#1, #2): hány kérdés volt olyan, ami korábban kollégát igényelt volna, most önkiszolgáló | `toolCalls` tartalma: `runSql`/`listCategories`/`searchKnowledge` sikeres hívás `escalateToHuman` NÉLKÜL egy `ask` soron belül | heti automatikus összesítő | folyamatgazda | **mért** | 2/3 demo-kérdés (ár + RAG) önkiszolgáló maradt, csak a panasz igényelt embert |
| Ügyfél-elégedettség az önkiszolgáló válasszal | nincs ma adatforrás - a CLI nem kér visszajelzést | - | - | **beépítendő**: egy egyszerű 👍/👎 prompt a válasz után, naplózva a JSONL-be |
| Kollégák tényleges időmegtakarítása (mennyi emberi munkaórát vált ki az önkiszolgálás) | nincs ma adatforrás - nincs "mi lett volna, ha ezt egy kolléga válaszolja meg" alapérték | - | - | **beépítendő**: pilot előtt/után mért összehasonlítás kellene (pl. ügyfélszolgálati jegyszám csökkenés a bevezetés utáni hetekben) |

## Megjegyzések

- **Legalább egy metrika a megoldott fájdalmakhoz kötődik** (megoldott fájdalom lefedettsége), **legalább egy a hibát méri, nem csak a sikert** - és itt tudatosan kettő van: az eszkalációs arány ("az agent tudja, hogy nem tudja") és a tool-hiba arány ("az agent tévedett/a védőréteg elkapta") két különböző dolgot mér, nem ugyanaz.
- A táblázat minden "mért" sora ma is valóban létező naplóadatra épül, nem tervezett jövőbeli instrumentálásra - ez a `logs/` mappa jelenlegi tartalmából (`logs/*.jsonl`, `logs/escalations.jsonl`) közvetlenül számolható, akár egy egyszerű `jq`/szkript összesítéssel is.
- A minta (3 demo-kérdés) túl kicsi ahhoz, hogy a példaértékek (pl. 33% eszkalációs arány) bármilyen valós arányt tükrözzenek - ezek csak azt bizonyítják, hogy a mérőszám ténylegesen számolható a naplóból, nem azt, hogy ez a végleges célérték.
