# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project status

This repository is currently **documentation-only** — no `package.json`, no source code, no tests exist yet. Everything below is the *specified* architecture from `docs/` that must be followed once implementation begins. Do not assume any file, module, or command mentioned here already exists; check first.

Read `docs/brs-smartbasket.md`, `docs/architektura.md`, `docs/konvenciok.md`, and `docs/stack.md` before starting implementation work — they are the authoritative spec and are treated as binding by this project (see "Claude Code convention" below).

## What this project is

SmartBasket Agent is a TypeScript CLI application that lets Hungarian users compare grocery prices across retailers (Tesco, Lidl, Aldi, Rossmann, etc.) using natural-language questions. It is built as a coursework project ("AI Ágensfejlesztés az Alapoktól"). An AI agent translates natural-language questions into SQL queries against a local SQLite database, which is refreshed daily from the official GVH Árfigyelő dataset.

## Planned stack and commands

Nx monorepo, pnpm, TypeScript/Node.js LTS. Once scaffolded, the expected commands (from `docs/stack.md` / README) are:

```bash
pnpm install
pnpm smartbasket ask "<question>"   # e.g. pnpm smartbasket ask "Hol a legolcsóbb a Dove testápoló?"
pnpm test
```

Key libraries: `better-sqlite3` (SQLite driver), Anthropic SDK (AI), Commander (CLI), Zod (validation), `xlsx` (Excel import), Vitest (tests), ESLint/Prettier.

SQLite was chosen over the course's default PostgreSQL because this is a single-user, local, no-concurrent-write CLI app fed by one daily Excel snapshot — no Docker or DB server needed.

## Planned project structure

```
smartbasket/
├── apps/cli/          # CLI commands, user input, stdout, error display — NO business logic
├── packages/core/      # all business logic, no CLI-specific code
│   ├── agent/          # question handling, tool use, response generation
│   ├── tools/           # runSql, listCategories, downloadDailyExcel, parseExcel
│   ├── database/        # SQLite access
│   ├── importer/        # Excel download + import pipeline
│   ├── parser/           # normalizes GVH Excel column names to English snake_case
│   ├── freshness/        # checkDatasetFreshness / ensureFreshDataset
│   ├── prompts/
│   └── logging/          # JSONL run logs
├── docs/
├── data/                # data/smartbasket.db + downloaded Excel files
├── logs/                # JSONL agent run logs
└── scripts/
```

## Architecture (must-follow, from docs/architektura.md and docs/stack.md)

Request flow — every query goes through this pipeline, in order:

```
User → CLI → ensureFreshDataset()/checkDatasetFreshness() → SQLite → Agent (tool loop) → runSql() → SQLite → NL response
```

Non-negotiable design rules:

- **Freshness checking is deterministic application logic, not an LLM decision.** `checkDatasetFreshness()` runs before every question, inspecting `import_metadata`. The LLM never decides when to refresh data.
- **The LLM only ever reads the database, via the `runSql` tool.** It never downloads data, writes to the DB, or modifies data. It never invents prices, products, or retailers — if there's no data, it says so explicitly.
- **`runSql` only permits `SELECT` / `WITH`, one statement at a time.** `INSERT`, `UPDATE`, `DELETE`, `DROP`, `ALTER`, `CREATE`, `ATTACH`, `PRAGMA` are all forbidden.
- **The agent queries semantic SQL views, never raw tables.** E.g. `vw_products` / `vw_categories` / `vw_best_prices` (aka `product_prices` in `docs/stack.md`, which renames columns like `minimum_price → min_price`, `retailer_name → retailer`, `category_name → category`). This keeps the LLM's schema simple/stable and reduces hallucination risk. Never point the LLM at `raw_products` directly.
- **Import is snapshot-based, transactional, and one-shot per day.** Pipeline: download → validate → parse → normalize → begin transaction → delete old snapshot → import new rows → update `import_metadata` → commit. Roll back the whole transaction on any failure. No historical price data is retained (out of scope for v1).
- **Tools are single-purpose**: one task, one input, one output. Don't build multi-purpose tools.
- **Every agent run is logged as JSONL** to `logs/`, containing timestamp, question, generated SQL, tool calls, response, and duration. Never log API keys, `.env` contents, or personal data.
- Config lives in `.env` (`ANTHROPIC_API_KEY`, `ARFIGYELO_DAILY_XLSX_URL`, DB path).

## Data model (docs/stack.md)

`products` table (daily Árfigyelő snapshot, replaced wholesale each import): `product_identifier`, `product_name`, `category_identifier`, `category_name`, `retailer_name`, `unit`, `package_size`, `minimum_price`, `maximum_price`, `minimum_unit_price`, `maximum_unit_price`, `retailer_count`, `available_store_count`, `retailer_total_store_count`, `imported_at`. Composite index on `(product_identifier, retailer_name)`; single-column indexes on `category_name`, `retailer_name`, `product_name`.

`import_metadata` (tracks daily import state): `import_date`, `source_url`, `downloaded_at`, `imported_at`, `imported_rows`, `checksum`, `status`.

Data source: GVH Árfigyelő official daily XLSX feed (URL in `docs/brs-smartbasket.md`). No direct web scraping or live API calls happen at question-answering time — only from the locally imported SQLite snapshot.

## Conventions (docs/konvenciok.md)

- **Language split**: code and database identifiers are English; documentation and CLI-facing text/output are Hungarian.
- **Naming**: files `kebab-case.ts` (e.g. `run-sql.ts`, `check-dataset-freshness.ts`); classes `PascalCase` (`SmartBasketAgent`, `ProductImporter`); functions `camelCase` (`checkDatasetFreshness()`, `downloadDailyExcel()`); constants `UPPER_SNAKE_CASE`.
- Favor the simplest solution, small single-purpose functions, deterministic behavior. Avoid overengineering, magic strings, global state, and duplicated logic.
- No empty `catch {}` blocks — every error is logged, rethrown, and given a human-readable message.
- Every new module gets a unit test. SQL logic, the parser, freshness checks, tools, and agent responses additionally get integration tests.

## Out of scope for v1 (docs/brs-smartbasket.md)

Online ordering, payments, user accounts, coupons, inventory management, historical price charts, OCR, web UI, mobile app, REST API, MCP server, multi-source data, route/cart optimization. These are documented future directions, not current work — don't build toward them speculatively.
