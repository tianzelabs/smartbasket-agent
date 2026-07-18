# SmartBasket Agent — implementációs terv (proposal)

> **Utólagos kiegészítés:** ez a doksi az A/B/C fázisok tervét és a tényleges
> build-történetét írja le úgy, ahogy akkor (SQLite-tal) készült - szándékosan
> nem íródott át. A projekt azóta, tanári visszajelzésre válaszul, Postgresre
> állt át (két DB-szerepkör, RW/RO) - ld. `docs/db-migration-rationale.md`.
> Ahol a szöveg SQLite-ot vagy `better-sqlite3`-at említ, az a build-időpontra
> vonatkozik, nem a jelenlegi állapotra.

> Forrás: `brs-smartbasket.md`, `architektura.md`, `stack.md`, `konvenciok.md`.
> A terv két nagy részből áll: **A) a környezet létrehozása** (mérföldkő: kész, futó, valós adattal feltöltött, tesztelhető projekt) és **B) az implementáció 3 fázisa** (echo → LLM DB nélkül → SQL-es agent). Ezt egy **C) beadási követelmények** blokk zárja (saját tool, ROI, system prompt, README).
> Minden fázis kicsi, önállóan tesztelhető increment. A fázis végén **te tesztelsz**, utána egy **commit** zárja (Conventional Commits, `dev` branch).

---

## Alapelvek (minden fázisra érvényes)

- **Context7 először.** Minden kódolási lépés előtt a releváns library doksit (Nx, better-sqlite3, `@anthropic-ai/sdk`, commander, Zod, `xlsx`, Vitest) Context7-tel beolvassuk, csak utána kódolunk.
- **Framework-agnostic core.** A `packages/core` nem ismeri a CLI-t (`architektura.md` 5. pont). Az `apps/cli` csak I/O.
- **Saját agent-loop.** Az `askAgent` kézzel írt tool-use loop az `@anthropic-ai/sdk` `messages.create` fölött — **nem** a SDK `toolRunner` helperje és nem agent-framework, hogy a mechanika látható maradjon ("az alapoktól" kurzuscél).
- **Nincs ORM.** A `konvenciok.md` 6. pontja szerint az agent SQL-lel dolgozik, nem ORM-en keresztül — ezért **nincs Prisma**. A séma sima SQL migrációs fájlokból jön létre (`packages/core/database/migrations/*.sql`), amit egy kis migrációs futtató alkalmaz `better-sqlite3`-mal.
- **Két SQLite-kapcsolat, két jog.** Az importer/migráció egy READ-WRITE kapcsolaton ír; az agent `runSql` toolja egy külön, `better-sqlite3` `{ readonly: true }` móddal nyitott kapcsolaton fut. Emellett egy SQL-guard (csak `SELECT`/`WITH`, egy statement, tiltott kulcsszavak) a második védelmi réteg — ez a Postgres-referenciák RW/RO role-párjának SQLite-natív megfelelője.
- **Nincs manuális seed.** A `products` tábla kizárólag a valós GVH Árfigyelő napi Excel-importból töltődik fel (`ARFIGYELO_DAILY_XLSX_URL`) — ez maga a termék egyik fő funkciója (BRS 5. pont), nem helyettesíthető statikus fixture-rel.
- **Átláthatóság.** Minden interakció JSONL-be naplózva (`logs/`); `--show-prompt` a teljes promptot kiírja.
- **Konvenciók.** TS strict, `unknown` a külső inputra, Zod a határokon, kis fókuszált fájlok, nincs `console.log` a termékkódban → strukturált logger, XML-szerűen tagolt system prompt.
- **TDD ahol értelmes.** SQL-guard, parser, freshness, tool-ok egységteszttel; cél a kritikus komponenseknél magas lefedettség.

## Megerősített döntések

1. **Modell:** alapból egy aktuális Claude modell (`claude-sonnet-5`), `.env`-ből felülírhatóan (`ANTHROPIC_MODEL`); költségérzékeny futtatáshoz `claude-haiku-4-5` is beállítható.
2. **Adatforrás:** nincs manuális/fixture seed; a `checkDatasetFreshness`/`refreshDataset` pipeline tölti be a valós adatot a live GVH URL-ről, determinisztikus alkalmazáslogikaként (nem LLM-döntés).
3. **System prompt:** a kurzus nem adott át fájlt ehhez a repóhoz — én írok egy első („kapott") verziót a BRS alapján, majd egy tudatosan javított v2-t, írásos indoklással (`docs/system-prompt.md` + `docs/system-prompt-improvements.md`).
4. **Adatbázis-réteg:** eredetileg SQLite + `better-sqlite3` volt (nincs Docker, nincs ORM az agent SQL-je előtt); a projekt azóta Postgresre állt át, `pg`-vel, továbbra is ORM nélkül — lásd `docs/db-migration-rationale.md`.
5. **Plugin-ök:** `context7`, `semgrep`, `commit-commands` — telepítve projekt-scope-ban, indoklás: `docs/plugins.md`-ben (C fázis).
6. **API kulcs:** a felhasználó helyben állítja be `.env`-ben (`ANTHROPIC_API_KEY`), amikor a B2 fázis teszteléséhez elérünk.

---

# A) A KÖRNYEZET LÉTREHOZÁSA

> **Mérföldkő:** a projekt felépül, az SQLite séma migrálva, valós GVH-adat betöltve, és egy üres CLI elindul. Innentől minden fázis erre épül.

### A1 — Nx monorepo + tooling váz

- `pnpm` (corepack), Nx workspace (`packages/*` + `apps/*` a `pnpm-workspace.yaml`-ban).
- TypeScript **strict**, ESLint + Prettier, Vitest, `tsx`. `.env.example` bővítése.
- **Tesztelés (te):** `pnpm nx report`, `pnpm prettier --check .`, lint zöld.
- **Commit:** `chore: scaffold nx workspace and tooling`

### A2 — `packages/core` és `apps/cli` váz (üres)

- `packages/core` (framework-agnostic mag), `apps/cli` (CLI belépési pont, egyelőre üres).
- Smoke-teszt mindkét projektben.
- **Tesztelés (te):** `pnpm nx build core`, `pnpm nx build cli`, `pnpm nx test core` zöld.
- **Commit:** `chore: add core lib and cli app skeletons`

### A3 — SQLite séma + migráció (`packages/core/database`)

- Sima SQL migrációs fájl a `products` és `import_metadata` táblákkal (`stack.md` séma szerint), + szemantikus view-k (`vw_products`, `vw_categories`, `vw_best_prices`) a `konvenciok.md` 6. pontja szerint.
- Kis migrációs futtató (`better-sqlite3`), `data/smartbasket.db` létrehozása.
- **Tesztelés (te):** migráció lefut, `sqlite3 data/smartbasket.db '.schema'` mutatja a táblákat/view-kat.
- **Commit:** `feat: add sqlite schema, migrations and semantic views`

### A4 — Adatfrissítő pipeline (parser + importer + freshness)

- `parser`: GVH Excel → normalizált angol mezőnevek.
- `importer`: download → validate → parse → normalize → tranzakció → régi snapshot törlése → új import → `import_metadata` frissítés → commit; hiba esetén rollback.
- `freshness`: `checkDatasetFreshness()` / `ensureFreshDataset()` — determinisztikus, nem LLM-döntés.
- **Tesztelés (te):** valós lefuttatás a live GVH URL ellen; `select count(*) from products;` értelmes számot ad; `import_metadata` egy friss sort tartalmaz.
- **Commit:** `feat: add gvh excel importer and dataset freshness check`

### A5 — Üres CLI elindul (LLM és agent nélkül)

- `apps/cli`: commander program `smartbasket` névvel, `ask`/`refresh` parancsok regisztrálva, placeholder válasz.
- **Tesztelés (te):** `pnpm smartbasket --help` tisztán kiírja a használatot.
- **Commit:** `feat: bootstrap empty smartbasket cli entrypoint`

**→ Mérföldkő kész: a környezet fut, valós adat van benne, tesztelhető.**

---

# B) AZ IMPLEMENTÁCIÓ — 3 FÁZIS

> Rétegről rétegre: előbb a CLI-mechanika (echo), majd az LLM (DB nélkül), végül az SQL-es tool-use. Mindegyik fázis előtt Context7, után a TE teszted, majd commit.

## 1. fázis — CLI visszhang (echo), LLM nélkül

**Cél:** a CLI-n keresztül interaktálsz, a program visszaírja, amit beírtál. Még nincs LLM, nincs DB.

- `smartbasket ask "<kérdés>"` → visszhangozza a szöveget; argumentum nélkül interaktív readline mód (`exit`-ig).
- Az echo-logika tiszta függvény a `packages/core`-ban, a CLI csak I/O.
- **Tesztelés (te):** `smartbasket ask "szia"` → `echo: szia`; interaktív módban több sor visszhangzik, `exit` kilép.
- **Commit:** `feat: cli echo loop (single-shot and interactive)`

## 2. fázis — LLM, adatbázis nélkül

**Cél:** a CLI egy sima LLM-hívásba van kötve. Az agent válaszol, de nincs DB-hozzáférése: adatra vonatkozó kérdésnél őszintén jelzi, hogy nem fér hozzá, és nem tud válaszolni.

- `packages/core`: `askAgent(question)` egyetlen `messages.create` hívással, tool nélkül. System prompt: `docs/system-prompt.md` + kifejezett megkötés — "nincs adatbázis-hozzáférésed; adat-kérdésnél mondd meg őszintén".
- `ANTHROPIC_API_KEY`/`ANTHROPIC_MODEL` `.env`-ből, Zod-validált config, fail-fast indításkor.
- Naplózás bevezetése: `logs/<timestamp>.jsonl`; `--show-prompt` kapcsoló.
- **Tesztelés (te):** általános kérdésre értelmes válasz; adat-kérdésnél ("hol a legolcsóbb a tej?") őszinte "nincs DB-hozzáférésem" válasz, nem talál ki számot; `logs/` alatt JSONL keletkezik.
- **Commit:** `feat: wire cli to llm (no db) with jsonl logging and --show-prompt`

## 3. fázis — SQL-es interakció (runSql + listCategories)

**Cél:** bekötjük a `runSql` és `listCategories` toolokat. Az agent a kérdésből SQL-t ír, lefuttatja a katalóguson, és valós, természetes nyelvű választ ad.

- `packages/core/tools/run-sql`: READ-ONLY kapcsolat + SQL-guard (csak `SELECT`/`WITH`, egy statement, tiltott kulcsszavak, kötelező `LIMIT`).
- `packages/core/tools/list-categories` (**a projekt saját, kötelező toolja**): `SELECT DISTINCT category_name FROM vw_categories`, az agent akkor hívja, ha bizonytalan a kategóriában.
- Kézzel írt tool-use loop: amíg `stop_reason === "tool_use"`, lefuttatja a hívott toolt, `tool_result`-ot visszaad, újra hív.
- `ask` előtt automatikusan lefut `ensureFreshDataset()` (BRS 5. pont: a felhasználónak ezt nem kell külön indítania).
- Naplózás bővítése: generált SQL + eredmény + tool-lépések.
- **Tesztelés (te):** demo-flow — "Hol a legolcsóbb a Dove testápoló?" → helyes SQL → helyes válasz; "Milyen kategóriák érhetők el?" → `listCategories` hívás; módosító kérdésnél ("töröld a...") az agent nem módosít (csak SELECT, RO kapcsolat is tiltja).
- **Commit:** `feat: add read-only runSql and listCategories tools with tool-use loop`

**→ v1 kész:** természetes nyelvű kérdés → helyes SQL → helyes válasz, naplózva, read-only, `--show-prompt`-tal átlátható.

---

# C) BEADÁSI KÖVETELMÉNYEK LEZÁRÁSA

> A kötelező, kódon kívüli deliverable-ök. Nem blokkolják B-t, de a beadás előtt mindnek meg kell lennie.

- **`docs/system-prompt.md`** — az első ("kapott") verzió, `<role>/<schema>/<rules>/<behavior>/<tools>` taggekkel, a B2/B3 fázisokban ez megy a modellnek.
- **`docs/system-prompt-improvements.md`** — tudatosan javított v2 + indoklás (mit és miért javítottunk: pl. kétértelmű kérdésnél visszakérdezés, ár-mezők egyértelműsítése, hallucináció elleni explicit szabályok).
- **`docs/roi.md`** — ROI-levezetés egy 5 fős iroda megtakarítására, számokkal (idő/fő/hét × óradíj vs. a rendszer üzemeltetési költsége).
- **`docs/plugins.md`** — a 3 telepített plugin (`context7`, `semgrep`, `commit-commands`) rövid indoklása.
- **README.md** — telepítés, `.env.example`, használati példák frissítése a végleges CLI-hez.
- **`.env.example`** — `ANTHROPIC_API_KEY`, `ANTHROPIC_MODEL`, `ARFIGYELO_DAILY_XLSX_URL`, DB-elérési út.
- **Repo-igényesség** — tiszta `git status`, nincs commitolt `.env`/`data/*.db`/`node_modules`.

---

## Fázis-összefoglaló (mérföldkövek és commitok)

| #   | Fázis                      | Eredmény                                    | Commit (típus) |
| --- | -------------------------- | ------------------------------------------- | -------------- |
| A1  | Nx + tooling               | workspace, lint/teszt fut                   | `chore`        |
| A2  | core + cli váz             | buildelhető skeletonok                      | `chore`        |
| A3  | SQLite séma + migráció     | `products`/`import_metadata` + view-k       | `feat`         |
| A4  | Importer + freshness       | valós GVH-adat az adatbázisban              | `feat`         |
| A5  | Üres CLI                   | `smartbasket --help` fut                    | `feat`         |
| B1  | CLI echo                   | visszhang single-shot + interaktív          | `feat`         |
| B2  | LLM, DB nélkül             | válaszol; adat-kérdésnél őszinte "nincs DB" | `feat`         |
| B3  | runSql + listCategories    | NL → SQL → NL válasz, read-only, saját tool | `feat`         |
| C   | ROI, system prompt, README | beadási dokumentumok készen                 | `docs`         |

Minden sor végén: **te tesztelsz → ha zöld, commitolunk.**
