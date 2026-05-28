# MPHelper extension icons

Source-of-truth SVGs for the Chrome extension icon. PNG renders at 16/32/48/128
are produced by `scripts/build.mjs` (using `sharp`) into `dist/extension/icons/`
on every `npm run build`. PNGs are **not** committed.

- `icon.svg` — master, used to render `icon-48.png` and `icon-128.png`.
- `icon-small.svg` — optical-size variant for `icon-16.png` and `icon-32.png`
  (slightly heavier stems and a more open P-counter so the mark survives
  downsampling and ClearType anti-aliasing at small sizes).

Edit the SVGs and rebuild — do not edit generated PNGs.
