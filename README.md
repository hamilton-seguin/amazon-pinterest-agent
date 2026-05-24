# amazon-pinterest-agent

A local Node.js / TypeScript CLI that turns Amazon affiliate products into reviewed Pinterest Pins. Runs once a day, manually. Uses **official APIs only** — no browser automation, no scraping.

## What it does

1. Pulls product candidates from Amazon's Product Advertising API (PA-API) for **travel**, **fashion**, **beauty**, and **baby** categories.
2. Filters out duplicates, banned categories, and low-quality listings.
3. Scores each survivor 0–100 on Pinterest click potential.
4. Generates Pin copy (deterministic template or optional Anthropic / OpenAI).
5. Lets you manually approve, skip, or edit each draft — via CLI **or** a local Tinder-style web UI (`npm run dev`).
6. Publishes approved drafts to a specific Pinterest board via Pinterest API v5.
7. Stores history locally so the same product is never re-published.

## Safety defaults

- `DRY_RUN=true` by default. Publishing is a no-op until you flip it to `false`.
- `AMAZON_PROVIDER=mock` by default. Runs end-to-end with no real API keys.
- Approval is **manual and explicit**. No "auto-publish everything" flag.
- Affiliate disclosure is appended to every Pin description.
- Banned phrases (`guaranteed`, `miracle`, `cures`, etc.) are stripped from generated copy.
- Restricted categories (supplements, vape, CBD, weapons, prescription) are filtered out.

## Setup

```bash
cd amazon-pinterest-agent
npm install
cp .env.example .env
```

Edit `.env`. The mock provider only needs `AMAZON_ASSOCIATE_TAG` to be set.

## Environment variables

| Variable                         | Required               | Notes                                           |
| -------------------------------- | ---------------------- | ----------------------------------------------- |
| `AMAZON_ACCESS_KEY`              | only when paapi+live   | PA-API key                                      |
| `AMAZON_SECRET_KEY`              | only when paapi+live   | PA-API secret (never logged)                    |
| `AMAZON_ASSOCIATE_TAG`           | **always**             | Your affiliate tag, appended to every link      |
| `AMAZON_MARKETPLACE`             | optional               | e.g. `www.amazon.com`                           |
| `PINTEREST_ACCESS_TOKEN`         | only when live publish | OAuth access token (never logged in full)       |
| `PINTEREST_BOARD_ID`             | only when live publish | Target board                                    |
| `ANTHROPIC_API_KEY`              | optional               | If `COPY_PROVIDER=anthropic`                    |
| `OPENAI_API_KEY`                 | optional               | If `COPY_PROVIDER=openai`                       |
| `AMAZON_PROVIDER`                | optional               | `mock` (default), `paapi`, or `playwright`      |
| `PLAYWRIGHT_HEADLESS`            | optional               | `false` (default) — set `true` once stable      |
| `AMAZON_BESTSELLER_MAX_PRODUCTS` | optional               | Total cap per `collect:amazon` run (default 10) |
| `COPY_PROVIDER`                  | optional               | `template` (default), `anthropic`, `openai`     |
| `DRY_RUN`                        | optional               | `true` (default) blocks live Pinterest calls    |
| `LOG_LEVEL`                      | optional               | `debug` \| `info` \| `warn` \| `error`          |
| `LOCAL_API_PORT`                 | optional               | Port for the local API bridge (default 5174)    |
| `APP_DATA_DIR`                   | optional               | Override JSON storage dir (used by tests)       |

Secrets must **never** be committed. `.env` is gitignored.

## Commands

```bash
npm run generate:candidates   # fetch from configured provider + score + draft
npm run collect:amazon        # temporary Playwright collector (Best Sellers)
npm run review:candidates     # interactive CLI approval
npm run publish:approved      # publish approved (respects DRY_RUN)
npm run clear:candidates      # empty data/candidates.json
npm run daily                 # full pipeline; pick a source mode via flag
npm run dev                   # local visual review UI (API bridge + Vite frontend)
npm run dev:api               # local API bridge only (port 5174)
npm run dev:web               # Vite frontend only (port 5173)
npm run build:web             # production build of the review UI → dist-client/
npm run test                  # Vitest unit + integration suite (no network/data writes)
npm run test:watch            # Vitest in watch mode
npm run test:coverage         # Vitest with v8 coverage report
```

Tests use a temporary `APP_DATA_DIR` per test, never touch `data/*.json`, and
mock all external services (Amazon / Pinterest / OpenAI / Anthropic).

### `daily` modes

| Invocation               | Source                                      |
| ------------------------ | ------------------------------------------- |
| `npm run daily`          | Amazon PA-API. Errors if keys are missing.  |
| `npm run daily --mock`   | Mock fixtures. No keys needed.              |
| `npm run daily --manual` | Playwright Best Sellers collector → drafts. |

Each mode runs the full chain: **fetch → score → draft → manual review → publish**.
Publishing always respects `DRY_RUN=true`.

`--mock` and `--manual` are mutually exclusive. Both `npm run daily --manual` and
`npm run daily -- --manual` work — the script reads `npm_config_*` env vars and
`process.argv` for flag detection.

## Temporary Playwright fallback (until PA-API access is granted)

Amazon Associate accounts need validation before PA-API keys are issued. While
waiting, you can populate `data/candidates.json` from Amazon Best Sellers pages
using a Playwright collector. **This is a fallback, not the long-term path.**

What it does:

- Visits each configured Best Sellers URL (defaults to amazon.fr).
- Extracts ASIN, title, image, optional price/rating/reviews/rank.
- Detects access challenges / CAPTCHA and stops gracefully — never tries to bypass them.
- Uses polite delays between pages. No stealth plugins, no proxies, no fake identities.
- Browser is **headful by default** so you can watch it run. Flip `PLAYWRIGHT_HEADLESS=true` when comfortable.

Setup:

```bash
npm install
npx playwright install chromium
```

Customize categories (optional): create `data/bestseller-urls.json`:

```json
[
  {
    "category": "travel",
    "url": "https://www.amazon.fr/gp/bestsellers/luggage"
  },
  {
    "category": "fashion",
    "url": "https://www.amazon.fr/gp/bestsellers/fashion"
  },
  {
    "category": "beauty",
    "url": "https://www.amazon.fr/gp/bestsellers/beauty"
  },
  { "category": "baby", "url": "https://www.amazon.fr/gp/bestsellers/baby" }
]
```

Run:

```bash
# 1. Collect with Playwright (writes data/candidates.json)
npm run collect:amazon

# 2. Convert candidates to drafts using the file-backed provider
AMAZON_PROVIDER=playwright npm run generate:candidates

# 3. Approve, then 4. publish
npm run review:candidates
npm run publish:approved
```

When you receive PA-API keys, set `AMAZON_PROVIDER=paapi`, implement the call
in `src/providers/amazon/amazonClient.ts`, and **delete the Playwright fallback**:

- `src/providers/amazon/amazonPlaywrightProvider.ts`
- `src/providers/amazon/amazonBestSellerUrls.ts`
- `src/providers/amazon/fileBackedAmazonProvider.ts`
- `src/cli/collectAmazon.ts`
- The `collect:amazon` entries in `src/index.ts` and `package.json`
- `playwright` from `devDependencies`

## Visual review UI (Tinder-style)

The CLI and the UI share the same storage — approving in either makes the draft
appear as `approved` to the other. The UI is local-only and does **not** publish
to Pinterest.

```bash
npm install
npm run generate:candidates   # fill data/drafts.json
npm run dev                   # starts API bridge (5174) + Vite frontend (5173)
# open http://localhost:5173
```

Two views, switchable from the header:

- **Draft Queue** — Tinder-style review of `drafted` items. Approve / reject / edit.
- **Approved Selection** — copy-paste assistant for `approved` items. One card at a time with per-field Copy buttons (title, description, affiliate link, image URL) plus a "Copy all" block, for manual Pinterest posting while PA-API / Pinterest API access is pending. Read-only — does **not** mark items as published.

Shortcuts:

- Draft Queue: `→` approve · `←` reject · `E` edit · `Cmd/Ctrl+Enter` save edit · `Esc` cancel edit
- Approved Selection: `→` next · `←` previous

Architecture:

- `src/api/drafts.ts` is the single source of business logic (read/update/approve/skip).
- `src/server/localApiServer.ts` is a minimal Node `http` bridge — it exists only because the browser cannot touch the local filesystem. Routes: `GET /api/drafts`, `PATCH /api/drafts/:asin`, `POST /api/drafts/:asin/approve`, `POST /api/drafts/:asin/skip`.
- `src/client/lib/apiClient.ts` is the only thing the React app uses to talk to that bridge.
- Vite dev server proxies `/api` → `http://localhost:5174`.

## Typical first run (mock data, dry run)

```bash
npm install
cp .env.example .env
# Edit .env: set AMAZON_ASSOCIATE_TAG=your-tag-20
npm run generate:candidates
npm run review:candidates
npm run publish:approved
```

You'll see DRY_RUN log lines instead of real Pinterest API calls. Inspect `data/drafts.json`, `data/approved.json`, `data/published.json` to verify the flow.

## Going live

1. Confirm output looks correct in DRY_RUN.
2. Set `AMAZON_PROVIDER=paapi`, populate Amazon keys, and implement the PA-API call in `src/providers/amazon/amazonClient.ts` (currently a stub).
3. Populate `PINTEREST_ACCESS_TOKEN` and `PINTEREST_BOARD_ID`.
4. Flip `DRY_RUN=false`.
5. Run `npm run daily`.

## Project layout

```
src/
  index.ts                       CLI dispatcher
  config.ts                      Zod env validation
  types.ts                       ProductCandidate, PinDraft
  api/drafts.ts                  shared draft business logic (CLI + UI both call this)
  cli/generate.ts                generate:candidates command
  providers/
    amazon/                      Mock + PA-API stub
    pinterest/                   Pinterest v5 client
    ai/copyGeneratorClient.ts    Anthropic + OpenAI
  services/
    productFilter.ts             dedupe + banned-category filter
    productScoring.ts            0–100 score
    copyGenerator.ts             template fallback + AI wrapper
    affiliateLinkBuilder.ts      ASIN + tag → URL
    pinPublisher.ts              DRY_RUN-aware publisher
    reviewQueue.ts               interactive CLI approve/skip/edit
  storage/jsonStore.ts           atomic JSON file storage
  server/
    localApiServer.ts            minimal Node http bridge for the browser UI
    draftRoutes.ts               GET/PATCH/POST routes wrapping src/api/drafts.ts
  client/                        Vite + React review UI (browser-only)
    main.tsx, App.tsx
    components/                  DraftReviewCard, DraftProgress, DraftActions, EditDraftDialog, EmptyState, ui/*
    hooks/useDraftReview.ts
    lib/apiClient.ts, lib/utils.ts
    tsconfig.json                client-only TS config
  utils/
    logger.ts                    secret-masking logger
    maskSecret.ts                token masking
    sanitize.ts                  banned phrases + disclosure
index.html                       Vite entry
vite.config.ts                   /api proxied to localhost:5174
tailwind.config.ts, postcss.config.js
data/                            local-only; gitignored
```

## Roadmap

- Implement real PA-API SigV4 call in `amazonClient.ts`, then remove the Playwright fallback.
- Swap JSON storage for SQLite once history is large.
- Add unit tests around scoring + sanitization.
