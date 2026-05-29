# MPHelper — Chrome (team install)

Internal Chrome extension for **Vendoroo Marketplace** (testing + prod). Install via **Load unpacked** — not from the Chrome Web Store.

Get **`mphelper-extension-v*.zip`** from the team (e.g. `mphelper-extension-v2.13.0.zip`). Unzip and **keep the folder** — Chrome loads from disk.

**Hosts:** `testing-marketplace.vendoroo.ai`, `marketplace.vendoroo.ai`

---

## Install

1. `chrome://extensions` → **Developer mode** → **Load unpacked**
2. Select the unzipped folder (must contain `manifest.json`)

Pin MPHelper from the toolbar puzzle menu if you use Settings often.

---

## App vs Settings

| | **App** (in-page) | **Settings** (toolbar popup) |
|---|-------------------|------------------------------|
| Open | **`Ctrl+Shift+M`** (default) or popup **Open** | MPHelper icon |
| Does | WO chips (click to copy), **Copy API Response** | Shortcut editor, **Image analysis copy** toggle |

JWT is captured automatically from marketplace API traffic (per-env in `chrome.storage.local`). **No token yet** → refresh after the page loads WO data.

**Image analysis copy (Settings):** injects **Copy for AI review** on `img[data-id="request-files-image"]`.

---

## Update

`chrome://extensions` → **Reload** on MPHelper after replacing the folder (or remove + Load unpacked). Version in popup header / App title.

---

## Troubleshooting

| Issue | Fix |
|-------|-----|
| Empty WO / no token | Logged in? Page finished loading? Refresh |
| Hotkey dead | On marketplace tab? Check shortcut in Settings |
| No image copy buttons | Toggle on in Settings; reload WO page |
| Load unpacked fails | Point at folder with `manifest.json`, not the zip |

Report bugs with version + testing vs prod.
