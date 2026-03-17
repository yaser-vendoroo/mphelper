# MPHelper – Agent context

## What this project is

- **MPHelper** is a Tampermonkey userscript for the **Vendoroo Marketplace** (testing env).
- It runs only on `https://testing-marketplace.vendoroo.ai/*`.
- Main use: **Work Order (WO) number helper** – copy WO number from the API using the current page’s work order ID and a stored JWT.

## Layout

- **`vtools.user.js`** – Single userscript file (script name in UI and metadata: **MPHelper**).
- **`.gitignore`** – Ignores `.idea/`, OS cruft, logs.
- No build step; edit the `.user.js` and install/update in Tampermonkey.

## Tech / APIs

- **Greasemonkey/Tampermonkey**: `GM_setValue`, `GM_getValue`, `GM_xmlhttpRequest`.
- **API**: `https://api-testing-marketplace.vendoroo.ai/api/WorkOrder/{workOrderId}` – GET, `Authorization: Bearer <jwt>`; response has `woNumber`.
- **URL**: Work order ID is the UUID in the page URL (regex in script).
- JWT is stored via `GM_setValue` under key `vendoroo_wo_helper_jwt`. The script **auto-captures** the JWT by intercepting `fetch` and `XMLHttpRequest`: any request to `api-testing-marketplace.vendoroo.ai` with an `Authorization: Bearer` header updates the stored token (runs at `document-start`).

## Conventions for edits

- **Versioning**: Always care about versioning. Bump the `@version` in the userscript header when making user-facing or behavioral changes (e.g. new features, fixes, UI or API changes). Use rational increments (e.g. 1.0 → 1.1 for minor, 1.0 → 2.0 for major).
- **Git commits**: Use [Conventional Commits](https://www.conventionalcommits.org/). Format: `type(scope): short subject` (e.g. `feat(mphelper): add X`, `fix(mphelper): correct Y`). Subject: imperative, present tense, ~50 chars; no period at end. Optional body: wrap at 72 chars; use bullets for multiple changes. Types: `feat`, `fix`, `docs`, `chore`, `refactor`, `style`.
- Keep the script **self-contained** in one file; no external deps.
- Preserve the **IIFE** and `'use strict'`.
- When changing **@match**, **@connect**, or API URLs, keep testing vs production clearly separated (this repo is for **testing** marketplace).
- UI: floating button (bottom-right) opens a dialog for JWT and “Copy WO Number”; keep IDs/selectors like `vendoroo-wo-helper-overlay` so they stay unique.

## Quick reference for future changes

- **Script display name**: “MPHelper” (in `@name`, button label, dialog title).
- **Storage key**: `vendoroo_wo_helper_jwt`.
- **WO from URL**: UUID pattern; see `getWorkOrderIdFromUrl()`.
- **Copy WO**: `fetchWoNumber(workOrderId, jwt)` → `data.woNumber` → clipboard.
