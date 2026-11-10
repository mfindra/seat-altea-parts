# SEAT Altea, Altea XL & Toledo — Interactive Parts Diagrams

Offline, English-language viewer for the official ETKA-style parts diagrams of the
**SEAT Altea, Altea XL and Toledo (Europe), all model years 2004–2015, main group
9 — Electrical equipment**.

The viewer reproduces the catalog experience: every diagram is rendered with
clickable hotspots over the illustration, linked to the full parts table with part
numbers, descriptions, quantities and engine applicability. Diagrams are grouped
by model year in the sidebar, with a year filter and global search.

## Features

- Interactive diagrams — pan, zoom, clickable part hotspots
- Parts table per diagram: position, part number, description, note, quantity, engine codes
- Click a part number to copy it, with a confirmation box
- All model years (2004–2015), grouped in the sidebar with a year filter
- Russian catalog terms translated to English (curated and generated glossaries)
- Global search across part numbers, part names and diagram titles, with matching rows highlighted
- Resizable sidebar and parts panel (widths saved between visits)
- Deep links (`index.html#2011-90300-090300631`), keyboard navigation (`←` / `→`)
- Fully offline: static HTML/JS/CSS, no server, no build step, no dependencies

## Quick start

All catalog data and illustrations are included. No build or server needed.

```bash
open index.html      # macOS
```

Or just double-click `index.html`.

## How it works

- `index.html` + `assets/` — the viewer (vanilla JS/CSS).
  `assets/glossary.js`, `assets/glossary-auto.js` and
  `assets/glossary-words-auto.js` translate Russian catalog terms to English.
- `data/data.js` — catalog snapshot loaded by the viewer.
- `data/manifest.json` — the same catalog in readable JSON form.
- `data/images/*.png` — diagram illustrations.

## Repository layout

```
├── index.html            # viewer entry point
├── assets/
│   ├── app.js            # viewer logic
│   ├── style.css         # viewer styles
│   ├── glossary.js       # curated Russian → English glossary
│   ├── glossary-auto.js  # generated full-string translations
│   └── glossary-words-auto.js  # generated word-level translations
└── data/
    ├── manifest.json     # catalog metadata and parts tables
    ├── data.js           # catalog data loaded by the viewer
    └── images/*.png      # diagram illustrations
```

## Publishing to GitHub

The repository is ready to push:

```bash
git remote add origin git@github.com:<you>/seat-altea-parts.git
git push -u origin main
```

To serve it as a website, enable GitHub Pages for the repository (no build needed —
the site works from the repo root).

## Data

`data/` is included in the repository, so the viewer works as-is. It contains
1,163 diagrams with 33,624 parts and their illustrations.

Diagram images and parts data originate from the ETKA catalog and remain the
property of their respective owners (Volkswagen AG). They are provided for
personal reference only; always verify part fitment with a dealer before ordering.

## Disclaimer

This project is not affiliated with or endorsed by SEAT or Volkswagen AG.
