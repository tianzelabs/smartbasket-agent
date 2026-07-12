# 🛒 SmartBasket Agent

AI-alapú bevásárlókosár-összehasonlító alkalmazás magyarországi üzletláncok számára.

A SmartBasket Agent a **GVH Árfigyelő** hivatalos napi termékadatait használja, és természetes nyelvű kérdésekre válaszol SQL-lekérdezések segítségével.

A rendszer minden lekérdezés előtt automatikusan ellenőrzi, hogy a helyi adatbázis tartalmazza-e az aktuális napi adatokat. Szükség esetén letölti a legfrissebb adatállományt, frissíti az SQLite adatbázist, majd ezután válaszolja meg a felhasználó kérdését.

---

# Fő funkciók

- 🤖 AI Agent természetes nyelvű kérdésekhez, kézzel írt tool-use loop-pal (`@anthropic-ai/sdk` felett, nem a SDK toolRunner helperje)
- 🛒 Bevásárlókosár összehasonlítás
- 🔍 Text-to-SQL lekérdezések a `runSql` read-only toollal (SQL-guard + read-only SQLite-kapcsolat, kettős védelem)
- 🏷️ `listCategories` saját tool - az elérhető termékkategóriák listázása
- 📦 Hivatalos GVH Árfigyelő adatok
- 📅 Automatikus napi adatfrissítés minden kérdés előtt
- 🗃️ SQLite adatbázis, szemantikus SQL view-kkal (`vw_products`, `vw_categories`, `vw_best_prices`)
- 💻 CLI alkalmazás (`ask`, `refresh`, `--show-prompt`)
- 📜 JSONL naplózás minden kérdéshez (system prompt, generált SQL, tool-hívások, válasz, token-felhasználás)

---

# Példák

```bash
pnpm smartbasket ask "Hol a legolcsóbb a Dove testápoló?"

pnpm smartbasket ask "Hasonlítsd össze a Tesco és a Lidl árait."

pnpm smartbasket ask "Melyik üzletláncban a legolcsóbb a csirkemell?"

pnpm smartbasket ask "Milyen kategóriák érhetők el?"
```

---

# Architektúra

```
Felhasználó
      │
      ▼
CLI
      │
      ▼
Adatfrissítés ellenőrzése
      │
      ▼
SQLite adatbázis
      │
      ▼
AI Agent
      │
      ▼
runSql Tool
      │
      ▼
Természetes nyelvű válasz
```

---

# Technológiai stack

| Komponens         | Technológia    |
| ----------------- | -------------- |
| Nyelv             | TypeScript     |
| Runtime           | Node.js        |
| Monorepo          | Nx             |
| Adatbázis         | SQLite         |
| SQLite Driver     | better-sqlite3 |
| AI                | Anthropic SDK  |
| CLI               | Commander      |
| Validáció         | Zod            |
| Excel feldolgozás | xlsx           |
| Tesztelés         | Vitest         |

---

# Adatforrás

A projekt a GVH Árfigyelő hivatalos napi termékadatait használja.

A rendszer a nyers adatokat SQLite adatbázisba importálja, és az AI Agent kizárólag ezt a helyi adatbázist kérdezi le.

---

# Projekt struktúra

```
smartbasket-agent/

├── apps/
│   └── cli/                 # commander CLI (ask, refresh), csak I/O
├── packages/
│   └── core/src/lib/
│       ├── agent/            # askAgent - kézzel írt tool-use loop
│       ├── tools/             # runSql (guard + read-only kapcsolat), listCategories
│       ├── prompts/           # system prompt (v2, ld. docs/system-prompt-improvements.md)
│       ├── config/            # Zod-validált ANTHROPIC_API_KEY/MODEL, fail-fast
│       ├── logging/           # JSONL napló
│       ├── database/          # SQLite kapcsolat + migráció
│       ├── importer/          # GVH Excel letöltés + tranzakciós import
│       ├── parser/            # GVH Excel -> normalizált angol mezőnevek
│       └── freshness/         # checkDatasetFreshness / ensureFreshDataset
├── scripts/                  # db:migrate, db:refresh (kézi, opcionális)
├── docs/                     # BRS, architektúra, konvenciók, terv, ROI, system prompt
├── data/                     # smartbasket.db (nincs verziózva)
├── logs/                     # JSONL naplók (nincs verziózva)
├── .env.example
└── README.md
```

Kapcsolódó dokumentumok:

- `docs/brs-smartbasket.md`, `docs/architektura.md`, `docs/konvenciok.md`, `docs/stack.md` - eredeti specifikáció
- `docs/proposal-implementacio.md` - fázisolt implementációs terv
- `docs/system-prompt.md` / `docs/system-prompt-improvements.md` - system prompt v1 és a javított v2 indoklással
- `docs/roi.md` - ROI-levezetés
- `docs/plugins.md` - a telepített Claude Code plugin-ök indoklása

---

# Telepítés

```bash
pnpm install
cp .env.example .env
# töltsd ki az ANTHROPIC_API_KEY-t a .env-ben
```

Az adatbázis séma és a napi GVH-adat automatikusan létrejön/frissül minden `ask` előtt - nincs külön migrációs vagy seed-lépés, amit kézzel el kellene indítani.

---

# Használat

```bash
# egyszeri kérdés
pnpm smartbasket ask "Hol a legolcsóbb a Dove testápoló?"

# interaktív mód (readline, "exit"-ig)
pnpm smartbasket ask

# a teljes system promptot és a tool-hívásokat is kiírja
pnpm smartbasket ask "Milyen kategóriák érhetők el?" --show-prompt

# adatbázis manuális frissítése (ask előtt is automatikusan lefut)
pnpm smartbasket refresh

# CLI súgó
pnpm smartbasket --help
```

Minden `ask` JSONL naplót ír a `logs/` mappába (kérdés, generált SQL, tool-hívások, válasz, token-felhasználás, futási idő).

---

# Fejlesztés

```bash
pnpm exec nx run-many -t build,lint,typecheck,test   # teljes ellenőrzés
pnpm exec nx test core                               # csak a packages/core tesztjei
pnpm db:migrate                                       # séma migráció kézzel (opcionális, ask/refresh is lefuttatja)
pnpm db:refresh                                       # adatfrissítés kézzel (opcionális, ask is lefuttatja)
```

A fejlesztés fázisolt terve, minden fázis commit/PR-jával: `docs/proposal-implementacio.md`.

---

# Jövőbeli fejlesztések

- bevásárlókosár-optimalizálás
- útvonal- és utazási költség számítás
- történeti árak elemzése
- webes felület
- REST API
- MCP Server
- több adatforrás támogatása

---

# Oktatási cél

A projekt az **AI Ágensfejlesztés az Alapoktól** kurzus beadandó feladataként készül.

A cél egy valós üzleti problémát megoldó AI agent megvalósítása, amely természetes nyelvű kérdéseket SQL-lekérdezésekké alakít, és hivatalos adatok alapján ad megbízható válaszokat.
