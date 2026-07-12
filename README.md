# 🛒 SmartBasket Agent

AI-powered shopping basket comparison agent for Hungarian retailers.

SmartBasket Agent uses the official **GVH Árfigyelő** daily product dataset to answer natural language shopping questions using SQL.

Instead of searching multiple retailer websites manually, users can simply ask questions like:

> *"Hol a legolcsóbb a Dove testápoló?"*

or

> *"Hasonlítsd össze a Tesco és a Lidl árait csirkemellre."*

The agent automatically refreshes the local database every day before answering.

---

# Features

- 🤖 AI Agent powered by Anthropic SDK
- 🗣️ Natural language interface
- 🛒 Shopping basket comparison
- 🔍 Text-to-SQL
- 📦 Official GVH Árfigyelő dataset
- 📅 Automatic daily dataset refresh
- 🗃️ SQLite database
- 💻 CLI application
- 📜 JSONL execution logs

---

# Architecture

```

User

↓

CLI

↓

Dataset Freshness Check

↓

Download Today's Excel (if needed)

↓

SQLite

↓

AI Agent

↓

runSql Tool

↓

Natural Language Answer

```

---

# Example Questions

```bash
smartbasket ask "Hol a legolcsóbb a Dove testápoló?"

smartbasket ask "Melyik üzletláncban a legolcsóbb a csirkemell?"

smartbasket ask "Hasonlítsd össze a Tesco és a Lidl árait."

smartbasket ask "Milyen kategóriák érhetők el?"

smartbasket ask "Mutasd a legolcsóbb narancsot."
```

---

# Project Structure

```
smartbasket/

├── apps/
│   └── cli/
│
├── packages/
│   └── core/
│
├── docs/
│
├── data/
│
├── logs/
│
├── scripts/
│
└── README.md
```

---

# Technology Stack

| Component | Technology |
|------------|------------|
| Language | TypeScript |
| Runtime | Node.js LTS |
| Package Manager | pnpm |
| Monorepo | Nx |
| Database | SQLite |
| SQLite Driver | better-sqlite3 |
| Excel Parser | xlsx |
| AI SDK | Anthropic SDK |
| CLI | Commander |
| Validation | Zod |
| Testing | Vitest |

---

# Data Source

Official daily dataset:

GVH Árfigyelő

https://cdnarfigyeloprodweu.azureedge.net/excel/arfigyelo_napi_termekadatok.xlsx

The dataset is downloaded automatically whenever the local snapshot is outdated.

The AI agent never queries external services directly during question answering.

---

# Database

SQLite

```
data/smartbasket.db
```

The database is refreshed from the official daily Excel snapshot.

The agent only performs **read-only SQL queries**.

---

# AI Agent

The SmartBasket Agent is intentionally simple.

Responsibilities:

- understand the user's question
- generate SQL
- call tools
- explain results

The agent **never**:

- invents prices
- invents products
- modifies the database
- downloads data

---

# Built-in Tools

## runSql

Executes read-only SQL queries.

Allowed:

- SELECT
- WITH

Forbidden:

- INSERT
- UPDATE
- DELETE
- DROP
- ALTER
- PRAGMA

---

## listCategories

Returns all available product categories.

Example:

```sql
SELECT DISTINCT category_name
FROM vw_categories
ORDER BY category_name;
```

---

# Automatic Dataset Refresh

Before every question:

```
Check today's dataset

↓

Today's data?

↓

YES → Ask Agent

↓

NO

↓

Download Excel

↓

Import SQLite

↓

Ask Agent
```

The AI model is not responsible for deciding when data should be refreshed.

---

# Logging

Every execution is stored as JSONL.

Each log contains:

- timestamp
- question
- generated SQL
- tool calls
- execution time
- final answer

---

# Development

Install dependencies

```bash
pnpm install
```

Run

```bash
pnpm smartbasket ask
```

Run tests

```bash
pnpm test
```

---

# Future Improvements

- Shopping basket optimization
- Travel cost estimation
- Historical price analysis
- Route optimization
- Web UI
- REST API
- MCP Server
- RAG
- Multi-agent workflow

---

# License

Educational project created for the

**AI Ágensfejlesztés az Alapoktól**

course.