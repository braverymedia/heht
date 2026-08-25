# CLAUDE.md — HEHT Redesign (candle-glow / video-ready)

This file briefs Claude Code on the active redesign of the Higher Ed Hot Takes (HEHT) site. Read it before making any changes.

## Project context

HEHT is an Eleventy (11ty) + Sass + Rollup site. It started as an audio podcast site and is being redesigned to (a) support video episodes as a first-class format and (b) shift the visual language away from a neon/UV-poster look to a darker, warmer, analog "candle in the dark / tube glow" aesthetic inspired by emo / post-hardcore design.

Current branch: `redesign/candle-glow-video` (off `main`).
Pre-redesign work is stashed as `wip: pre-redesign snapshot` — do not pop it without asking.

## Non-negotiables

- **No Tailwind.** Ever. Styles are Sass partials under `src/assets/styles/partials/`.
- **WCAG 2.2 AA** for all new UI. Check contrast before shipping a color.
- **Modular, composable, lightweight.** Prefer small partials, small JS modules, no new runtime dependencies unless justified.
- **Progressive enhancement.** Core content (episodes, transcripts, audio, video) must work without JS.
- **Respect `prefers-reduced-motion`, `prefers-reduced-transparency`, and `prefers-contrast: more`** — disable grain, vignette, and multi-layer glows under these.
- **Performance budget stays tight.** No heavyweight libraries. Subset any new webfont hard. Don't animate `box-shadow` on scroll-heavy containers.
- **Do not introduce frameworks.** Vanilla JS only. Keep the Rollup bundle lean.

## Aesthetic direction

Moving from: `#21078D` blueviolet + `#FFFF00` / `#00FFB2` / `#FF2578` neon palette with `hue-rotate`/`brightness` filter tricks and heavy backdrop blur.

Moving to: dim room, warm filament/tube glow, analog grain, xerox/halftone texture, stencil display type. Think basement show flyer, not rave poster.

### New design tokens (replace `_config.scss`)

```
--ink:        #0B0C10;   /* the room */
--ink-raised: #14151B;   /* cards, drawers */
--bone:       #EDE6D6;   /* body text — never pure white */
--ember:      #F5A25D;   /* primary accent, warm candle */
--ember-deep: #E8833A;   /* hover/active */
--tube:       #7FD9C4;   /* secondary accent, dim CRT */
--bloodwash:  #B23A48;   /* rare emphasis, large text / non-text only (contrast ~4.0:1) */
```

Keep old token names aliased to new values for one commit so nothing breaks mid-sweep, then rename in a follow-up.

### Glow mechanics

- **Kill** the `filter: hue-rotate() brightness()` hack in `_components.scss` (around line 31).
- **Kill** the `backdrop-filter: blur(60px)` in `_structure.scss` (around line 198). Replace with solid `--ink-raised` + 1px `--ember` hairline.
- Warm glow is **wide, dim, low-chroma** — multi-layer shadows like:
  `0 0 1px var(--ember), 0 0 24px -4px rgba(245,162,93,.35), 0 0 60px -20px rgba(245,162,93,.15)`
- Add a body-level radial vignette so edges fall into `--ink`.
- Add an inline SVG noise/grain overlay at ~4% opacity on a single fixed pseudo-element (never repeated per card).
- Heading-only `text-shadow: 0 0 .4em rgba(245,162,93,.25)`. Never on body copy.

### Type

- Body: keep `NameSansVF`.
- Accent: swap to **Big Shoulders Stencil Display** (or similar condensed stencil). Subset aggressively. Uppercase, tight tracking for episode numbers, section labels.
- Oversized episode numbers, stencil, half-clipped off the page edge, is a signature move — use it on the episodes index and episode detail.

### Texture

- Halftone treatment on episode cover art — **pre-bake into the JPGs**, don't do SVG filters at runtime (mobile Safari tax).
- Ragged/torn SVG dividers instead of straight `<hr>`s.

## Video support (new)

The site must now handle video episodes alongside audio. Requirements:

- Episode data model in `src/_data/podcast.json` (and/or episode front matter) grows a `video` object: `{ src, poster, captions, duration, aspectRatio, width, height }`. `width`/`height` (actual pixel dimensions of the encode) feed `og:video:width`/`og:video:height` — `aspectRatio` alone isn't enough for those, and the meta partial silently omits both tags without them.
- Episode detail template renders a `<video>` element with `preload="metadata"`, `playsinline`, poster, and a `<track kind="captions">` pointing to a **WebVTT** file — `<track>` doesn't support SRT. Transcripts ship as `.srt` (correct for the RSS `podcast:transcript` tag, which does support it) with a `.vtt` companion for the caption track; see `transcript.vtt` in episode front matter.
- Audio-only episodes keep the existing audio player; mixed episodes should prefer video but expose an "audio only" toggle.
- The `audio-manager.js` / `audio-player.js` modules need a sibling `video-player.js` or a generalized `media-manager.js`. Prefer generalization if the diff stays small; otherwise keep them parallel and share a tiny playback-state module.
- OG/Twitter meta must include video tags (`og:video`, `og:video:type`, `og:video:width`, `og:video:height`) when a video exists.
- Feeds: the RSS podcast feed stays audio-only for Apple/Spotify. Add a separate video feed or a YouTube-friendly export path — don't cram video enclosures into the podcast feed without checking the validator first.
- Transcripts remain the source of truth for accessibility and SEO — render them on the episode page, not hidden behind a drawer-only toggle.

## Repo map (what matters)

```
eleventy.config.js           # 11ty config, collections, filters
rollup.config.*.mjs          # JS + styles bundling
src/
  _data/podcast.json         # show + episode metadata
  _components/               # njk partials (episode-list, site-nav, etc.)
  _includes/layouts/base.njk # base layout
  episodes/                  # episode markdown w/ front matter
  assets/
    styles/
      main.scss
      partials/
        _config.scss         # tokens — START HERE
        _reset.scss
        _type.scss
        _structure.scss
        _components.scss
        _drawers.scss
        _a11y.scss
    js/
      index.js               # bundle entry
      audio-manager.js
      audio-player.js
      drawers.js
      site-nav.js
      newsletter-form.js
    img/                     # episode covers
    svg/                     # icons
    audio/                   # mp3 + srt
```

## Work order (small, reviewable commits)

1. **Tokens.** Rewrite `_config.scss` with new palette + alias old names. Commit.
2. **Effects partial.** New `_effects.scss` with grain overlay, vignette, `@mixin candle-glow`, `@mixin tube-glow`, reduced-motion/contrast guards. Import from `main.scss`. Commit.
3. **Sweep components.** Replace raw color refs, remove `hue-rotate/brightness` hack, remove 60px backdrop-blur. Apply mixins. Commit per partial if the diffs are large.
4. **Type.** Add stencil display font (subset), update `_type.scss`, hero/episode-number treatments. Commit.
5. **Episode art.** Pre-bake halftone into `src/assets/img/heht-0*-cover.jpg`. Commit assets separately from code.
6. **Video data model.** Extend `podcast.json` + episode front matter schema. Commit.
7. **Video player module.** Add `video-player.js` (or generalize to `media-manager.js`). Wire into `index.js`. Commit.
8. **Episode detail template.** Render video when present, transcript inline, OG video meta. Commit.
9. **QA pass.** Axe, Lighthouse, contrast, reduced-motion, keyboard nav, mobile Safari paint perf. Commit any fixes.
10. **Rename aliased tokens.** Drop the old `--color-*` names. Final cleanup commit.

Each step should leave the site building and deployable. If a step gets big, split it.

## How to work with me on this

- Read before you write. Don't guess at file contents — open them.
- Ask before installing a new dependency.
- Run the build (`npm run build` or equivalent — check `package.json`) and fix any warnings you introduce.
- Prefer editing existing partials over adding new ones, unless the new concept is genuinely orthogonal (`_effects.scss` qualifies; a new `_buttons.scss` probably doesn't — it belongs in `_components.scss`).
- When in doubt on contrast, compute it, don't eyeball it.
- Keep commits small, messages specific. No "update styles." Say what and why.
- Don't pop the `wip: pre-redesign snapshot` stash without explicit confirmation.

## Out of scope (for now)

- Swapping CMS / static generator. Stay on 11ty.
- Replacing Rollup with Vite. Not this branch.
- Server-rendered video transcoding. Assume pre-encoded MP4/HLS from a CDN.
- A full component library. We're not building a design system, we're redesigning a site.
