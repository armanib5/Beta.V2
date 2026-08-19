# CityPinned brand assets

Drop the **final** CityPinned brand files here. The Home Screen looks for
them at build time (`src/lib/brand-assets.ts`) and uses them automatically —
no code change is needed. Until a file exists, the Home Screen renders a
plainly-marked geometric placeholder in its place rather than an invented
logo.

| Slot | Expected filename (first match wins) | Used for |
| --- | --- | --- |
| Ultimate Pin | `ultimate-pin.svg`, `ultimate-pin.png`, `ultimate-pin.webp` | Header lockup, large hero pin, map-card markers, vendor CTA, footer close |
| App logo | `app-logo.svg`, `app-logo.png`, `app-logo.webp` | The "CityPinned App — Coming Soon" tile |
| Wordmark | `wordmark.svg`, `wordmark.png`, `wordmark.webp` | The "CityPinned" script lockup in the header, menu and footer |

## Specs

- **Ultimate Pin** — transparent background, portrait aspect (roughly 3:5),
  ≥ 1200 px tall if raster. Rendered from ~40 px (map markers) up to ~290 px
  (hero), so SVG is strongly preferred.
- **App logo** — transparent or square-tile artwork, 1:1, ≥ 512 px if raster.
- **Wordmark** — transparent background, wide aspect (roughly 5:1), ≥ 1600 px
  wide if raster. Rendered up to ~380 px wide.

Raster art should be exported at 2× for retina. SVG should have text
converted to outlines so it renders identically everywhere.

## Where the placeholders live

`src/components/brand/brand-mark.tsx`. Each placeholder is marked in its
`alt`/`title` text and carries a `data-cp-placeholder` attribute, so it is
easy to confirm at a glance which slots are still unfilled.
