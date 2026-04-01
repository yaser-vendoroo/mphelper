# MPHelper – Agent context

## What this project is

- **MPHelper** is a Tampermonkey userscript for the **Vendoroo Marketplace** (testing and production).
- It runs on `https://testing-marketplace.vendoroo.ai/*` and `https://marketplace.vendoroo.ai/*`.
- Main use: **Work Order (WO) number helper** – copy WO number from the API using the current page’s work order ID and a stored JWT.

## Layout

- **`vtools.user.js`** – Single userscript file (script name in UI and metadata: **MPHelper**).
- **`.gitignore`** – Ignores `.idea/`, OS cruft, logs.
- No build step; edit the `.user.js` and install/update in Tampermonkey.

## Tech / APIs

- **Greasemonkey/Tampermonkey**: `GM_setValue`, `GM_getValue`, `GM_xmlhttpRequest`.
- **API**: Testing `https://api-testing-marketplace.vendoroo.ai/api/WorkOrder/{id}`; production `https://api-marketplace.vendoroo.ai/api/WorkOrder/{id}` – GET, `Authorization: Bearer <jwt>`; response has `woNumber`.
- **URL**: Work order ID is the UUID in the page URL (regex in script).
- JWT is stored per env: testing `vendoroo_wo_helper_jwt`, production `vendoroo_wo_helper_jwt_prod`. The script **auto-captures** JWT from requests to the matching API host (`api-testing-marketplace` vs `api-marketplace`) (runs at `document-start`).

## Conventions for edits

- **Versioning**: **[Semantic versioning](https://semver.org/)** — `@version` must be `MAJOR.MINOR.PATCH` (three numeric parts). **PATCH** ↑ for bug fixes; **MINOR** ↑ for backward-compatible features or UX; **MAJOR** ↑ for incompatible behavior changes. **Always** bump `@version` in `vtools.user.js` when the change is substantive, using the rules above.
- **Side effects / regressions**: Keep changes scoped; avoid breaking existing features (JWT auto-capture, MPHelper dialog and shortcut, work order API copy rows, image-analysis copy buttons, etc.). When touching shared helpers or globals, consider impact on all call sites.
- **Git commits**: **Do not commit** unless the user explicitly asks. When they ask, use conventional commit format:
  - **Format**: Short summary line, then optional bullet list (past tense). Reference related tickets if applicable.
  - **Subject**: `type: short summary` — imperative mood ("Add feature" not "Added feature"), first line max 72 characters, specific and descriptive. Types: `feat`, `fix`, `docs`, `chore`, `refactor`, `style`.
  - **Body**: Bullet points in **past tense** (e.g. "Implemented X", "Added Y"). Wrap at 72 chars.
  - **Example**:
    ```
    Add scoring algorithm for AI Router

    - Implemented base scoring function
    - Added weights for context matching
    - Included unit tests for edge cases
    ```
- Keep the script **self-contained** in one file; no external deps.
- Preserve the **IIFE** and `'use strict'`.
- When changing **@match**, **@connect**, or API URLs, keep testing vs production clearly separated (both hosts are supported).
- UI: floating button (bottom-right) opens a dialog for JWT and “Copy WO Number”; keep IDs/selectors like `vendoroo-wo-helper-overlay` so they stay unique.

## Quick reference for future changes

- **Script display name**: “MPHelper” (in `@name`, button label, dialog title).
- **Storage keys**: testing `vendoroo_wo_helper_jwt`; production `vendoroo_wo_helper_jwt_prod`.
- **WO from URL**: UUID pattern; see `getWorkOrderIdFromUrl()`.
- **Dialog fields**: WO title, **work order ID** (from API keys like `id`, `workOrderId`, `requestId`, nested `data.*`, else URL UUID), **work order number** (`woNumber` / variants) — all copyable.
