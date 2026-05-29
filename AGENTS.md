# MPHelper – Agent context

## What this project is

- **MPHelper** is a Chrome extension helper for the **Vendoroo Marketplace** (testing and production).
- It runs on `https://testing-marketplace.vendoroo.ai/*` and `https://marketplace.vendoroo.ai/*`.
- Main use: **Work Order (WO) number helper** – copy WO number from the API using the current page’s work order ID and a stored JWT.
- Ships as a **Chrome extension** (Manifest V3, unpacked side-load or team zip), built from `src/`.

## Layout

```
mphelper/
  package.json              # version source (semver); npm run build
  src/
    shared/                 # UI, API, clipboard, image analysis, JWT page interceptor
    adapters/               # chrome.storage.local and fetch wrappers
    entries/
      extension-content.js  # Chrome content script entry
      extension-popup.js    # Chrome action popup entry
  extension-static/
    manifest.json           # MV3 template (__VERSION__ replaced at build)
    popup.html              # Settings popup shell
  scripts/build.mjs         # esbuild → dist/extension/
  dist/                     # generated (gitignored)
    extension/
  INSTALL.md                # team install guide
  AGENTS.md
  .gitignore
```

**Edit `src/`, then run `npm run build`.** Do not hand-edit `dist/` — it is generated.

Before making changes, check `./.cursor/rules/` for Cursor project rules. Follow any relevant rules there alongside this file.

## Build & install

```bash
make setup    # first time: install deps + build
make build    # rebuild after editing src/
make help     # list all commands
```

Or with npm directly: `npm install` then `npm run build`.

- **Chrome extension** (internal): open `chrome://extensions` → Developer mode → **Load unpacked** → select `dist/extension/`. After rebuild, click **Reload** on the extension card.
- **Team sharing**: `make package` → `dist/mphelper-extension-v*.zip` (see `INSTALL.md`).

Version is defined in `package.json` and synced to `manifest.json` and build output.

## Tech / APIs

- **Chrome extension**: `chrome.storage.local`, `fetch` (via `host_permissions`), action popup, page-world JWT interceptor injected as `page-interceptor.js`.
- **API**: Testing `https://api-testing-marketplace.vendoroo.ai/api/WorkOrder/{id}`; production `https://api-marketplace.vendoroo.ai/api/WorkOrder/{id}` – GET, `Authorization: Bearer <jwt>`; response has `woNumber`.
- **URL**: Work order ID is the UUID in the page URL (regex in script).
- JWT is stored per env: testing `vendoroo_wo_helper_jwt`, production `vendoroo_wo_helper_jwt_prod`. The extension **auto-captures** JWT from requests to the matching API host (`api-testing-marketplace` vs `api-marketplace`) via the page interceptor (injected at document start).

## Terms

- **App**: the in-page UI injected into a marketplace tab (overlay dialog at `#vendoroo-wo-helper-overlay`, opened via the configured hotkey). Implemented in `src/shared/ui.js`. Shows WO chips and Copy API Response — no in-dialog settings.
- **Settings**: the extension popup shown when the user clicks the MPHelper toolbar icon (`extension-static/popup.html` + `popup.js`, MV3 `action.default_popup`). Owns shortcut configuration and the image-analysis copy toggle; writes to `chrome.storage.local` and notifies the App via `chrome.runtime.sendMessage`.

## Conventions for edits

- **Versioning**: **[Semantic versioning](https://semver.org/)** — bump `package.json` `version` as `MAJOR.MINOR.PATCH`. **PATCH** ↑ for bug fixes; **MINOR** ↑ for backward-compatible features or UX; **MAJOR** ↑ for incompatible behavior changes. Run `npm run build` after bumping.
- **Side effects / regressions**: Keep changes scoped; avoid breaking existing features (JWT auto-capture, App dialog, hotkey, WO fetch, image-analysis DOM injection driven by Settings toggle, Settings ↔ App messaging). When touching shared helpers or globals, consider impact on all call sites.
- **Git commits**: **Do not commit** unless the user explicitly asks. When they ask, use conventional commit format:
  - **Format**: Short summary line, then optional bullet list (past tense). Reference related tickets if applicable.
  - **Subject**: `type: short summary` — imperative mood ("Add feature" not "Added feature"), first line max 72 characters, specific and descriptive. Types: `feat`, `fix`, `docs`, `chore`, `refactor`, `style`.
  - **Body**: Bullet points in **past tense** (e.g. "Implemented X", "Added Y"). Wrap at 72 chars.
- **Source**: Shared logic lives in `src/shared/`; Chrome wiring in `src/adapters/` and `src/entries/`. Preserve **IIFE** + `'use strict'` in bundled output.
- When changing `manifest.json` host permissions or API URLs, keep testing vs production clearly separated (both hosts are supported).
- UI: hotkey opens the **App** dialog (FAB exists but hidden); extension toolbar icon opens **Settings** (`popup.html`); keep IDs/selectors like `vendoroo-wo-helper-overlay` unique across both surfaces.

## Quick reference for future changes

- **Display name**: “MPHelper” (button label, dialog title, manifest name).
- **Storage keys**: testing `vendoroo_wo_helper_jwt`; production `vendoroo_wo_helper_jwt_prod`.
- **WO from URL**: UUID pattern; see `getWorkOrderIdFromUrl()` in `src/shared/constants.js`.
- **App dialog fields**: WO title, **work order ID** (from API keys like `id`, `workOrderId`, `requestId`, nested `data.*`, else URL UUID), **work order number** (`woNumber` / variants), **resident user ID** — all copyable.

## Manual test checklist

After `npm run build`, verify on **testing** and **production**:

1. JWT auto-captured after normal site navigation/API calls
2. Hotkey opens the **App** dialog; fields load (title, WO ID, WO number, resident user ID)
3. Click-to-copy on all chips; “Copy API Response”
4. **Settings** (extension popup) opens via toolbar icon; shortcut editor and reset work; new shortcut persists across reload and is honored by the App
5. **Settings** image-analysis toggle On → buttons appear on `img[data-id="request-files-image"]` in the active tab; copy combined/text fallback; toggle Off removes the buttons
