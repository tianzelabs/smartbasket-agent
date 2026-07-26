# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project status

Implementation is in progress, following `docs/proposal-implementacio.md` (phased plan: A = environment setup, B = 3 layered implementation phases, C = submission deliverables). Check that doc for what phase is currently done before assuming a module exists.

Read `docs/brs-smartbasket.md`, `docs/architektura.md`, `docs/konvenciok.md`, and `docs/stack.md` before implementation work — they are the authoritative spec (see "Claude Code convention" in `docs/konvenciok.md`). One remaining deliberate deviation from `docs/stack.md`: no Prisma/ORM (raw SQL migrations + the `pg` driver, per the project's own "SQL-first, no ORM" rule) and no manual seed data (the `products` table is only ever populated by the real GVH importer, never a fixture). The database itself briefly ran on SQLite before switching to Postgres — see `docs/db-migration-rationale.md` for why.

## What this project is

SmartBasket Agent is a TypeScript CLI application that lets Hungarian users compare grocery prices across retailers (Tesco, Lidl, Aldi, Rossmann, etc.) using natural-language questions. It is built as a coursework project ("AI Ágensfejlesztés az Alapoktól"). An AI agent translates natural-language questions into SQL queries against a local Postgres database (docker-compose), which is refreshed daily from the official GVH Árfigyelő dataset.

## Planned stack and commands

Nx monorepo, pnpm, TypeScript/Node.js LTS. Once scaffolded, the expected commands (from `docs/stack.md` / README) are:

```bash
pnpm install
pnpm smartbasket ask "<question>"   # e.g. pnpm smartbasket ask "Hol a legolcsóbb a Dove testápoló?"
pnpm test
```

Key libraries: `pg` (Postgres driver), Anthropic SDK (AI), Commander (CLI), Zod (validation), `xlsx` (Excel import), Vitest (tests), ESLint/Prettier. HF3 RAG layer adds: `cohere-ai` (embedding + rerank), `@mozilla/readability` + `jsdom` (HTML article extraction), `unpdf` (PDF text extraction) — see "HF3: RAG knowledge layer" below.

Local Postgres (docker-compose), matching the course's default stack — see `docs/db-migration-rationale.md` for why the project moved off its earlier SQLite deviation: SQLite has no role-based access control, so the read-only agent connection couldn't be enforced independently of the application code the way it can with a dedicated read-only Postgres role.

## Planned project structure

```
smartbasket/
├── apps/cli/          # CLI commands, user input, stdout, error display — NO business logic
├── packages/core/      # all business logic, no CLI-specific code
│   ├── agent/          # question handling, tool use, response generation
│   ├── tools/           # runSql, listCategories, downloadDailyExcel, parseExcel
│   ├── database/        # Postgres access (RW pool + RO pool)
│   ├── importer/        # Excel download + import pipeline
│   ├── parser/           # normalizes GVH Excel column names to English snake_case
│   ├── freshness/        # checkDatasetFreshness / ensureFreshDataset
│   ├── knowledge/        # HF3 RAG layer: extraction, chunking, embedding, rerank, search, ingest
│   ├── prompts/
│   └── logging/          # JSONL run logs
├── docs/
├── data/                # downloaded Excel files (DB itself lives in Postgres, not a file)
├── logs/                # JSONL agent run logs
└── scripts/
```

## Architecture (must-follow, from docs/architektura.md and docs/stack.md)

Request flow — every query goes through this pipeline, in order:

```
User → CLI → ensureFreshDataset()/checkDatasetFreshness() → Postgres → Agent (tool loop) → runSql() → Postgres → NL response
```

Non-negotiable design rules:

- **Freshness checking is deterministic application logic, not an LLM decision.** `checkDatasetFreshness()` runs before every question, inspecting `import_metadata` (via `vw_import_status`). The LLM never decides when to refresh data.
- **The LLM only ever reads the database, via the `runSql` tool.** It never downloads data, writes to the DB, or modifies data. It never invents prices, products, or retailers — if there's no data, it says so explicitly.
- **`runSql` runs on a dedicated read-only Postgres role (`smartbasket_ro`), guarded by four independent layers**: (1) the role's DB-server-enforced `SELECT`-only grant on the semantic views, (2) the SQL-guard permitting only `SELECT`/`WITH`, one statement at a time — `INSERT`, `UPDATE`, `DELETE`, `DROP`, `ALTER`, `CREATE`, `ATTACH`, `PRAGMA` are all forbidden, (3) every query wrapped in `START TRANSACTION READ ONLY`, (4) a `statement_timeout`. See `docs/db-migration-rationale.md`.
- **The agent queries semantic SQL views, never raw tables.** E.g. `vw_products` / `vw_categories` / `vw_best_prices` (aka `product_prices` in `docs/stack.md`, which renames columns like `minimum_price → min_price`, `retailer_name → retailer`, `category_name → category`). This keeps the LLM's schema simple/stable and reduces hallucination risk. Never point the LLM at `raw_products` directly.
- **Import is snapshot-based, transactional, and one-shot per day.** Pipeline: download → validate → parse → normalize → begin transaction → delete old snapshot → import new rows → update `import_metadata` → commit. Roll back the whole transaction on any failure. No historical price data is retained (out of scope for v1).
- **Tools are single-purpose**: one task, one input, one output. Don't build multi-purpose tools.
- **Every agent run is logged as JSONL** to `logs/`, containing timestamp, question, generated SQL, tool calls, response, and duration. Never log API keys, `.env` contents, or personal data.
- Config lives in `.env` (`ANTHROPIC_API_KEY`, `ARFIGYELO_DAILY_XLSX_URL`, `DATABASE_URL` (RW), `DATABASE_URL_READONLY` (RO)). Local Postgres is started with `docker compose up -d` before running anything.

## Data model (docs/stack.md)

`products` table (daily Árfigyelő snapshot, replaced wholesale each import): `product_identifier`, `product_name`, `category_identifier`, `category_name`, `retailer_name`, `unit`, `package_size`, `minimum_price`, `maximum_price`, `minimum_unit_price`, `maximum_unit_price`, `retailer_count`, `available_store_count`, `retailer_total_store_count`, `imported_at`. Composite index on `(product_identifier, retailer_name)`; single-column indexes on `category_name`, `retailer_name`, `product_name`.

`import_metadata` (tracks daily import state): `import_date`, `source_url`, `downloaded_at`, `imported_at`, `imported_rows`, `checksum`, `status`.

Data source: GVH Árfigyelő official daily XLSX feed (URL in `docs/brs-smartbasket.md`). No direct web scraping or live API calls happen at question-answering time — only from the locally imported Postgres snapshot.

## HF3: RAG knowledge layer

A second capability alongside price comparison: `searchKnowledge`, a third tool
(`packages/core/src/lib/knowledge/search/search-knowledge.ts`) wired into the same
`ask-agent.ts` tool-use loop as `runSql`/`listCategories` — the model decides which
tool(s) to call per question, including calling both for mixed price+advice questions.
No separate router component; see `docs/rag-provider-rationale.md` §5 for why.

- **Knowledge base**: NKFH/Nébih/GVH articles and guides on conscious, economical food
  shopping (planning, unit-price comparison, expiry labels, storage/waste, food safety,
  consumer rights) — a separate corpus from the price catalog, containing **no** live
  prices or stock data.
- **Schema** (`migrations/0002_knowledge_base.sql`): `knowledge_documents` +
  `knowledge_chunks` (`embedding vector(1024)`, pgvector, no ANN index — brute-force
  `ORDER BY embedding <=> ...` is faster and more accurate at this corpus size). The RO
  role only gets `SELECT` on `vw_knowledge_search`, never the raw tables — same pattern
  as `vw_products`/`vw_best_prices`.
- **Pipeline** (`knowledge/search/search-knowledge.ts`): HyDE (`claude-haiku-4-5`) →
  embed (Cohere `embed-v4.0`, `search_query`) → brute-force pgvector top 20 → rerank
  (Cohere `rerank-v3.5`) → top 5 → relevance-threshold check → grounded chunks or
  `belowThreshold: true`. Full rationale for every model/provider choice:
  `docs/rag-provider-rationale.md`.
- **Ingest** (`knowledge/ingest/`): two-stage, manifest-driven —
  `data/knowledge/sources.json` lists `{url, title, topic, format?}`;
  `pnpm knowledge:fetch` downloads to a local cache (`data/knowledge/raw/`, gitignored);
  `pnpm knowledge:ingest` extracts → chunks → embeds → writes, skipping documents whose
  content hash is unchanged, and deleting (cascade) documents no longer in the manifest.
  Maintenance plan (change detection, new/deleted docs, reindex triggers) + diagram:
  `docs/knowledge-base-architecture.md`.
- **Chunking** (`knowledge/chunking/chunk-document.ts`): heading-aware (H2/H3 hard
  boundaries), not fixed-size — rationale and unit-test coverage in
  `docs/rag-chunking-strategy.md`.
- **Grounding**: two independent layers, not prompt-only — a deterministic relevance
  threshold in `searchKnowledge` (returns no chunks + `belowThreshold: true` below it)
  plus an explicit system-prompt rule requiring source citation and an honest "no
  answer" instead of fabricating (`docs/system-prompt-improvements.md`, v2 → v3 diff).
- Config: `COHERE_API_KEY` (`.env.example`), loaded fail-fast via `loadCohereConfig()`,
  same pattern as `loadAgentConfig()`/`loadDatabaseConfig()`.

## Conventions (docs/konvenciok.md)

- **Language split**: code and database identifiers are English; documentation and CLI-facing text/output are Hungarian.
- **Naming**: files `kebab-case.ts` (e.g. `run-sql.ts`, `check-dataset-freshness.ts`); classes `PascalCase` (`SmartBasketAgent`, `ProductImporter`); functions `camelCase` (`checkDatasetFreshness()`, `downloadDailyExcel()`); constants `UPPER_SNAKE_CASE`.
- Favor the simplest solution, small single-purpose functions, deterministic behavior. Avoid overengineering, magic strings, global state, and duplicated logic.
- No empty `catch {}` blocks — every error is logged, rethrown, and given a human-readable message.
- Every new module gets a unit test. SQL logic, the parser, freshness checks, tools, and agent responses additionally get integration tests.

## Out of scope for v1 (docs/brs-smartbasket.md)

Online ordering, payments, user accounts, coupons, inventory management, historical price charts, OCR, web UI, mobile app, REST API, MCP server, multi-source data, route/cart optimization. These are documented future directions, not current work — don't build toward them speculatively.

<!-- nx configuration start-->
<!-- Leave the start & end comments to automatically receive updates. -->

# General Guidelines for working with Nx

- For navigating/exploring the workspace, invoke the `nx-workspace` skill first - it has patterns for querying projects, targets, and dependencies
- When running tasks (for example build, lint, test, e2e, etc.), always prefer running the task through `nx` (i.e. `nx run`, `nx run-many`, `nx affected`) instead of using the underlying tooling directly
- Prefix nx commands with the workspace's package manager (e.g., `pnpm nx build`, `npm exec nx test`) - avoids using globally installed CLI
- You have access to the Nx MCP server and its tools, use them to help the user
- For Nx plugin best practices, check `node_modules/@nx/<plugin>/PLUGIN.md`. Not all plugins have this file - proceed without it if unavailable.
- NEVER guess CLI flags - always check nx_docs or `--help` first when unsure

## Scaffolding & Generators

- For scaffolding tasks (creating apps, libs, project structure, setup), ALWAYS invoke the `nx-generate` skill FIRST before exploring or calling MCP tools

## When to use nx_docs

- USE for: advanced config options, unfamiliar flags, migration guides, plugin configuration, edge cases
- DON'T USE for: basic generator syntax (`nx g @nx/react:app`), standard commands, things you already know
- The `nx-generate` skill handles generator discovery internally - don't call nx_docs just to look up generator syntax

<!-- nx configuration end-->
