# SmartBasket Agent – Chunking-stratégia (HF3 RAG-réteg)

> A HF3 feladatleírás direkt túlegyszerűsítettnek nevezi az órán látott bekezdés-alapú
> chunkolást, és megköveteli, hogy a saját stratégia a saját tudásbázis tagoltságából
> következzen, ne a bevetett technikák számából. Ez a dokumentum leírja, mi a tudásbázis
> tényleges szerkezete, milyen chunkolási szabályokat vezettünk ebből le, és mit nyerünk
> vele a fix méretű/karakteres darabolással szemben.

---

## 1. A tudásbázis tagoltsága, amiből a stratégia következik

A korpusz (NKFH/Nébih/GVH cikkek és néhány PDF-útmutató, téma:
_"Tudatos és gazdaságos élelmiszer-vásárlás Magyarországon"_) két formátumban érkezik:

- **HTML cikkek** - hivatalos fogyasztóvédelmi portálok tipikus szerkezetében: egy vezető
  bekezdés, majd **H2 alcímekkel** tagolt szakaszok (pl. "Tervezés", "Tárolás", "Fogyasztói
  jogok"), néha **H3 alszekciókkal** (pl. egy "Tárolás" szakaszon belül "Hűtőszekrény",
  "Fagyasztás"), és számozott/pontozott listákkal (konkrét tanácsok).
- **PDF útmutatók** (pl. Nébih lejárati útmutató) - a PDF.js-alapú szövegkinyerés (`unpdf`)
  nem őrzi meg a betűméretet/vastagságot erre a célra megbízhatóan, ezért ezekből **nincs
  heading-jelölés**, csak bekezdéshatár.

Ez a kétféle szerkezet két, egymástól explicit elválasztott kinyerési útra bomlik
(`packages/core/src/lib/knowledge/extraction/`), amik egy **közös blokk-reprezentációba**
(`ExtractedBlock`: `level` 0/2/3, `text`, `isListItem`) futnak be - a chunkoló modul
(`chunking/chunk-document.ts`) ezt a közös reprezentációt dolgozza fel, nem tudja (és nem
kell tudnia), hogy a forrás HTML vagy PDF volt.

## 2. A döntés: heading-aware szemantikus chunkolás, nem fix méretű ablak

**Mit csinálunk:** a H2/H3 heading egy **hard boundary** - egy chunk sosem lép át két
különböző alcím alatti tartalmon. Egy szakaszon belül a bekezdések/listaelemek egy
pufferbe gyűlnek, amíg el nem érik a célméretet, vagy amíg a szakasz véget nem ér.

**Miért nem fix karakterszámú/token-ablakos darabolás:** a hivatalos cikkek H2-szakaszai
(gyakorlatilag) önmagukban is teljes, önálló tanácsegységek ("hogyan tárolj", "mit jelent
a dátumjelölés", "mihez van jogod, ha lejárt terméket vettél"). Egy fix méretű ablak
középen vágna át egy ilyen egységen, és a rerank/grounding lépés fél gondolatot kapna
kontextus nélkül - pont az ellentéte annak, amit a HF3 4. pontja ("mutasd be, hogy a
rerank mit javít") demonstrálni akar.

**Miért nem tisztán mondat-alapú (pl. LangChain `RecursiveCharacterTextSplitter`
alapértelmezés):** az egyáltalán nem használja ki, hogy a forrás dokumentumok explicit,
szerzői szándék szerinti tagolással (H2/H3) érkeznek - ez lenne a "felesleges
túlbonyolítás" fordítottja: egy generikus eszközt bevetni ott, ahol a struktúra már adott.

## 3. Konkrét szabályok (`chunk-document.ts`)

| Paraméter | Érték | Indoklás |
|---|---|---|
| Célméret | ~500 token (~2000 karakter) | elég egy teljes tanács-egységhez, nem túl sok a rerankhez |
| Kemény felső korlát | ~700 token (~2800 karakter) | HF3 feladatleírás explicit korlátja |
| Minimum-összevonási küszöb | ~60 token (~240 karakter) | ennél kisebb maradékot nem hagyunk önálló chunknak |
| Token-számítás | karakterszám / 4 (közelítés) | lásd 4. pont |

- **H2/H3-nál mindig flush**: a puffer lezárul, a szekció-útvonal (`sectionPath`, pl.
  `"Cikk címe > Tárolás > Hűtőszekrény"`) frissül.
- **Célméret elérésekor flush**: egy hosszú szakasz több, azonos `sectionPath`-ú chunkra
  bomlik - ez szándékos, nem hiba.
- **Rövid maradék összevonása**: ha egy szakasz végén a puffer a minimum-küszöb alatt
  marad, az UGYANAZON szekcióból származó előző chunkhoz fűzzük, nem hozunk létre egy
  pár szavas, kontextus nélküli chunköt. Szekcióhatáron **sosem** vonunk össze - ez a
  "ne lépjen át más tematikus szakaszon" szabály közvetlen következménye.
- **Túlméretes egyetlen blokk** (jellemzően PDF-bekezdés, ahol nincs lista/heading
  darabolási pont): szóhatáron, determinisztikusan feldaraboljuk a kemény korlátnál.
- **Listaelemek**: `- ` prefixszel kerülnek a chunk szövegébe, hogy a lista-jelleg
  grounding közben is látszódjon, de önmagukban (a minimum-küszöb miatt) nem válnak
  önálló, néhány szavas chunkká.

## 4. Miért karakterszám-közelítés, nem valódi tokenizer

A chunkolásnak **determinisztikus, függőségmentes függvénynek** kell lennie (HF3
feladatleírás 2. pont: "legalább pár unit teszt legyen rajta"). Egy valódi
tokenizer (pl. a Cohere `embed-v4.0` BPE-táblája) hálózati hívást vagy egy becsomagolt
szótárfájlt igényelne - ez a chunkolást kevésbé tesztelhetővé, lassabbá és egy külső
függőségtől érzékennyé tenné egy olyan lépésben, ahol elég a nagyságrendi pontosság
("kb. 500 token" vs. "pontosan 487 token"). A ~4 karakter/token közelítés magyar
szövegen elfogadott ökölszabály.

## 5. Metaadatok minden chunkon

Minden `DocumentChunk` (`chunk-document.ts`) hordozza:

- `sectionPath` - a dokumentum címe + a heading-hierarchia (grounding + citáció alapja)
- `content` - a chunk tényleges szövege
- `charCount` - a méretkorlátok betartásának ellenőrzéséhez

Az ingest (`knowledge/ingest/ingest-document.ts`) ehhez a `knowledge_documents` táblán
keresztül hozzáfűzi a `source_url`/`title`/`topic`/`published_at` szintű metaadatokat is
(`0002_knowledge_base.sql`, `vw_knowledge_search` view) - a `searchKnowledge` tool és a
grounding-szabály (`docs/system-prompt-improvements.md` v3 diff) ezen keresztül tud
mindig forráshivatkozással válaszolni.

## 6. Determinisztikus unit tesztek

`packages/core/src/lib/knowledge/chunking/chunk-document.spec.ts` (10 teszt) és
`packages/core/src/lib/knowledge/extraction/*.spec.ts` fedik le:

- H2/H3-határ sosem lép át (két külön szekció sosem olvad egy chunkba)
- H3 a H2 alatt, alszekcióként jelenik meg a `sectionPath`-ban
- rövid maradék összevonása AZONOS szekción belül, de sosem szekcióhatáron át
- célméretnél flush, ugyanabban a szekcióban folytatva
- kemény korlátnál egyetlen túlméretes blokk is determinisztikusan feldarabolódik
- PDF-stílusú (csak level 0) blokkok tisztán bekezdés-akkumulációval chunkolódnak
- listaelemek `- ` prefixet kapnak, bekezdések nem
- azonos bemenet mindig azonos kimenetet ad (determinizmus-teszt)
