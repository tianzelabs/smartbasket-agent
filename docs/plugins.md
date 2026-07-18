# SmartBasket Agent – telepített plugin-ök indoklása

> A `claude-plugins-official` piactérről telepítve, projekt-scope-ban (`.claude/settings.json`, verziózva - lásd a `chore: install context7, semgrep, and commit-commands plugins` commitot). Mindhárom kifejezetten ehhez a projekthez lett választva, nem generikus feltöltés.

## `context7`

**Mit csinál:** naprakész, verzió-specifikus library-dokumentációt húz be a kontextusba (Upstash Context7 MCP szerver).

**Miért ehhez a projekthez:** a stack több, gyakran változó API-jú csomagot használ (Nx 23, `@anthropic-ai/sdk` tool-use API-ja, `pg`, `commander`, Zod v4, Vitest). A fejlesztés során többször is előfordult, hogy egy API-részlet (pl. az Anthropic SDK pontos `ToolUseBlock`/`Usage` típusai, vagy a Zod v4 hibaformátuma) eltért a képzési adatokból megjegyzettől - ezeket a `node_modules`-ban lévő tényleges `.d.ts` fájlok közvetlen elolvasásával oldottuk meg. A Context7 ugyanezt a célt szolgálja rendszeresebben: elavult, "megjegyzett" API-forma helyett a ténylegesen telepített verzió dokumentációját adja, csökkentve a hibás kódgenerálás kockázatát.

## `semgrep`

**Mit csinál:** valós idejű biztonsági mintaellenőrzés, amely a kódírás közben jelez SQL-injection- és más OWASP-jellegű kockázatokra.

**Miért ehhez a projekthez:** a projekt legnagyobb biztonsági felszíne a `runSql` tool (`packages/core/src/lib/tools/run-sql/`) - az agent a felhasználó természetes nyelvű kérdéséből generál SQL-t, ORM réteg nélkül (a `konvenciok.md` explicit "SQL-first, nem ORM" döntése miatt). Ez pontosan az a mintázat, amit egy statikus biztonsági szkenner a legjobban tud ellenőrizni: SELECT-only guard (`sql-guard.ts`), read-only Postgres-kapcsolat egy dedikált, csak SELECT-jogú DB-szerepkörön (`db-readonly.ts`, `smartbasket_ro` - lásd `docs/db-migration-rationale.md`), paraméterezett/validált input a tool-határon. Nem ORM-projektnél, ahol a védelem kézzel írt kóddal (guard + regex + kapcsolat-szintű jogosultság) valósul meg, a semgrep egy második, automatizált védelmi réteg a kódolási hibák ellen.

## `commit-commands`

**Mit csinál:** strukturált git commit/push/PR munkafolyamat-parancsok.

**Miért ehhez a projekthez:** a feladat kiértékelési szempontjai kifejezetten előírják a "rendszeres, kis, fókuszált commitok" és a követhető commit-history meglétét (Agentic munkamód + commitok, 15% súly). A projekt implementációja 8 fázisra bomlott (A1-A5, B1-B3), mindegyik saját branch-en, saját PR-ral, Conventional Commits formátumú üzenetekkel - ez a plugin egységesíti és gyorsítja ezt a már amúgy is előírt munkafolyamatot.

---

## Miért nem Prisma vagy más DB-plugin

Fontolóra vettük a `prisma` plugint is (mivel a piactéren elérhető), de a projekt saját döntése (`docs/proposal-implementacio.md`, "Megerősített döntések" szakasz) kifejezetten a `pg` driverrel, sima SQL migrációkkal tette le a voksot, Prisma/ORM nélkül - ez a `konvenciok.md` "SQL-first, nem ORM-en keresztül" szabályának közvetlen következménye, és a projekt Postgresre állása (`docs/db-migration-rationale.md`) sem változtatott rajta. A Prisma plugin telepítése ezért félrevezető lett volna (nem használt technológiát reklámozna).
