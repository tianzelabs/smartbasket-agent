# 🛒 SmartBasket Agent

AI-alapú bevásárlókosár-összehasonlító alkalmazás magyarországi üzletláncok számára.

A SmartBasket Agent a **GVH Árfigyelő** hivatalos napi termékadatait használja, és természetes nyelvű kérdésekre válaszol SQL-lekérdezések segítségével.

A rendszer minden lekérdezés előtt automatikusan ellenőrzi, hogy a helyi adatbázis tartalmazza-e az aktuális napi adatokat. Szükség esetén letölti a legfrissebb adatállományt, frissíti az SQLite adatbázist, majd ezután válaszolja meg a felhasználó kérdését.

---

# Fő funkciók

- 🤖 AI Agent természetes nyelvű kérdésekhez
- 🛒 Bevásárlókosár összehasonlítás
- 🔍 Text-to-SQL lekérdezések
- 📦 Hivatalos GVH Árfigyelő adatok
- 📅 Automatikus napi adatfrissítés
- 🗃️ SQLite adatbázis
- 💻 CLI alkalmazás
- 📜 JSONL naplózás

---

# Példák

```bash
smartbasket ask "Hol a legolcsóbb a Dove testápoló?"

smartbasket ask "Hasonlítsd össze a Tesco és a Lidl árait."

smartbasket ask "Melyik üzletláncban a legolcsóbb a csirkemell?"

smartbasket ask "Milyen kategóriák érhetők el?"
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
│   └── cli/
├── packages/
│   └── core/
├── docs/
├── data/
├── logs/
└── README.md
```

---

# Fejlesztés

Függőségek telepítése:

```bash
pnpm install
```

Alkalmazás indítása:

```bash
pnpm smartbasket ask
```

Tesztek futtatása:

```bash
pnpm test
```

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
