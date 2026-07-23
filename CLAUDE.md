# Hartford Technology Rentals — Prototype

## ⛔ HubSpot / HubDB: READ ONLY — ABSOLUTE RULE

**NEVER edit, write, update, or delete anything in HubSpot or HubDB. ONLY READ. No exceptions without Paolo's explicit sign-off in the current session.**

- This is the client's **production** HubSpot portal. The Service Key in `.env` (`HUBSPOT_TOKEN`) has full HubDB scope — it CAN write. Scope-level read-only was not available, so discipline is the guardrail.
- Access HubSpot **only** via `scripts/hubdb.sh` (GET-only curl wrapper, HubDB paths only) or `scripts/fetch-hubdb.mjs` (GET-only mirror). Never call the HubSpot API with raw curl/fetch.
- Never use `-X POST/PUT/PATCH/DELETE`, `--data*`, `--form`, `-d`, `-F`, `--json`, `--upload-file`, or any write verb against `hubapi.com`/`hubspot.com`. A PreToolUse hook in `.claude/settings.local.json` blocks these — do not attempt to bypass or weaken it.
- Work from the local mirror `.hubdb-cache/` for all analysis. Re-fetch only via the GET-only scripts.
- `.hubdb-cache/` is client data: gitignored, **never commit**. Same for `.env`.
- Phase 3 CRM writes (deals, contacts, timeline events) happen against a **sandbox portal only**, never production, and only after explicit sign-off.

## Project notes

- Astro 5 + Tailwind v4 static site, deployed to GitHub Pages via `.github/workflows/deploy.yml`. Base-aware URL helper `u()` in `src/data/catalog.js` (GITHUB_PAGES=true); canonicals point at hartfordrents.com.
- SEO long-form keyword copy blocks are a hard client requirement — never trim them.
- Design system in `PRODUCT.md` / `DESIGN.md`.
