# INKWELL — Literary Writing Studio

Inkwell is a candlelit literary atelier and writing studio for novelists, crafted from paper, iron-gall ink, burgundy velvet, antique brass, wax seals, and quiet library shelves.

Designed for longform novelists, poets, and storytellers, Inkwell combines the tactile warmth of a private 19th-century library with modern writing aids, autosaving manuscript folios, interactive worldbuilding maps, and bespoke copperplate engraving analytics.

---

## Quickstart & Local Setup

```bash
# Install dependencies
npm install

# Launch development server
npm run dev
```

Open `http://localhost:3000` in your browser. All manuscripts, chapters, character dossiers, worldbuilding atlas landmarks, historical timelines, and analytics sessions persist locally in `localStorage` under a versioned schema (`inkwell_studio_v1`).

---

## Literary Design System

Inkwell rejects generic SaaS dashboards and modern pill badges in favor of archival bookmaking traditions:

- **Daylight Study & Midnight Library Themes**: Soft ivory and aged vellum (`#F4EFE5` / `#FAF6ED`) transitioning into candlelit walnut leather and deep iron-gall ink (`#1A1916` / `#24231F`) via a radial ink-spread circular reveal (`View Transitions API`).
- **Paper Grain & Lamplight Atmosphere**: Subtle `feTurbulence` fractal noise paper grain with breathing candlelight radial gradients in Midnight mode.
- **Typographic Hierarchy**:
  - **Headings & Seals**: *Fraunces* (variable optical serif with warm wonk and softness).
  - **Manuscript Prose**: *EB Garamond* (classical French Renaissance serif, 18px baseline, 1.82 line-height, drop caps).
  - **Ledgers & Numerals**: *IBM Plex Mono* (tabular numbers, Roman numerals, word tallies).
- **Zero-Pill Discipline**: Statuses and metadata use typographic punctuation (`·`, `/`), small-caps letterspacing, intaglio stamps (`❦`, `✦`), and antique brass foil borders instead of rounded modern pill badges.
- **Stacked Paper Shadows**: Layered page-edge depth shadows mimicking folded parchment sheets (`--shadow-stacked`).

---

## Studio Folios & Architecture

### Folio I: The Library (`/`)
- **Archival Bookcase Shelf**: Tactile hardcover cloth bindings with foil stamping, 3D perspective tilt on hover, and draped silk ribbon bookmarks.
- **Featured Folio Reader**: "Continue Writing" open manuscript spread with drop-cap excerpt and quick desk access.
- **Daily Epigraph**: Rotating literary wisdom from Virginia Woolf, Victor Hugo, James Baldwin, and Jorge Luis Borges.
- **Accession Register**: Table of recent manuscripts, word counts, and revision dates.
- **Manuscript Vault**: Global JSON export and import modal with full schema validation and timestamped filenames (`inkwell-library-*.json`).

### Folio II: The Desk (`/desk`, `/desk/:projectId`)
- **Centered Manuscript Canvas**: Distraction-free typography with editorial drop caps, editable chapter titles, and optional paragraph focus dimming.
- **Floating Desk Toolbar**: Bold, italic, underline, heading 1/2, blockquote, and ornamental fleurons (`❦ ✦ ❦`), with responsive layout protection for compact viewports.
- **Ink Drying Indicator**: Physical autosave indicator cycling from *Fresh ink flowing...* to *Ink drying...* and settling into *Ink dried*.
- **Collapsible Chapter Drawer**: Folding accordion table of contents with word tallies, reading pace estimates, and quick folio commission.
- **AI Margin Notes**: Collapsible marginalia drawer with 6 specialized editorial prompts (Continue, Rewrite, Tighten, Describe, Brainstorm, Critique) clearly labeled with demo outputs and insert/replace actions.

### Folio III: Manuscripts & Chapters (`/projects`)
- **Volume Master Bindery**: Commission, edit, and organize novel volumes with custom cloth binding palettes, target word counts, and synopsis records.
- **Drag-and-Drop Reordering**: Intuitive reordering of chapters with draggable grips, automatic Roman numeral recalibration (`toRoman`), and accessible Move Up / Move Down buttons.
- **Unfolding Paper Decrees**: Confirmation dialogs styled as sealed folded letters for striking chapters and volumes.

### Folio IV: Character Studio (`/characters`)
- **Archival Dossier Cards**: Wax-sealed portrait badges, caste badges, core motivations, internal conflicts, and arc notes.
- **Interactive Constellation Graph**: Bespoke SVG network map with custom node placement, directed curved bezier arrows with relationship labels, dynamic node creation, severing arrows, and Gemini AI narrative story extraction.

### Folio V: World Builder (`/world`)
- **Cartographic Atlas**: Coordinate pin plotting over an antique nautical grid, sensory atmosphere quotes, and topographical records.
- **Lore Compendium**: Tabular classification across History, Magic, Religion, Culture, and Faction lore with editorial drop caps.
- **Illuminated Vertical Timeline**: Central brass spine linking chronological milestones, turning points, and eras with reordering steppers.

### Folio VI: Writing Analytics (`/analytics`)
- **Engraved Copperplate SVG Charts**:
  - *Faceted Crystal Inkwell*: Animated liquid meniscus filling with iron-gall ink toward your manuscript word goal.
  - *Woodcut Daily Words Bar Chart*: Cross-hatched ink bars with antique brass daily target line and hover inspection.
  - *Almanac Streak Matrix*: 14-week calendar grid using ink-drop stamps (vellum punch, sepia wash, walnut ink, burgundy seal).
  - *Chapter Cadence Ribbon*: Proportional chapter length visualization with estimated reading times and pacing cadence.
- **Session Ledger**: Inscribe offline writing sessions (words written, minutes at desk) directly into your study records.

---

## Accessibility & Polish

- **Keyboard Navigation**:
  - Skip-to-content link (`#main-content`) accessible via `Tab` on every folio.
  - `focus-visible` styling using antique brass rings (`outline: 2px solid var(--accent-brass)`).
  - Escape key modal dismissals and accessible drag fallbacks via stepper buttons.
- **`prefers-reduced-motion` Compliance**: CSS and Framer Motion configurations dampening all transitions, disabling infinite breathing animations, and bypassing View Transition transforms when requested by the operating system.
- **Illustrated Empty States**: Bespoke vector etchings (`EmptyShelfIllustration`, `EmptyCastIllustration`, `EmptyAtlasIllustration`, `EmptyChronicleIllustration`) greeting authors before new projects or dossiers are inscribed.
- **Paper Slip Despatch Toasts**: Archival desk notices with brass corner clips, deckled borders, intaglio fleuron seals, and small-caps despatch stamps.

