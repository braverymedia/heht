# CLAUDE.md — HEHT Redesign (neon / video-ready)

This file briefs Claude Code on the active redesign of the Higher Ed Hot Takes (HEHT) site. Read it before making any changes.

## Project context

HEHT is an Eleventy (11ty) + Sass + Rollup site. It started as an audio podcast site and is being redesigned to (a) support video episodes as a first-class format and (b) shift the visual language back toward the original blueviolet/yellow/green/pink neon identity.

**Note on direction history:** an earlier pass on this branch moved the palette to a darker, warmer "candle in the dark / tube glow" aesthetic (analog grain, dim-room vignette, muted amber/teal accents). As of 2026-08-20 that direction was reverted back to neon — the show has taken on a cohost, so the intimate solo-candlelight framing no longer fits. The structural rebuild from that pass (2-column content/video shell, rail nav, slide panels, media controller, video data model) was **kept** — only the color tokens, the flame-gradient backdrop, and the grain/vignette atmosphere effects were reverted or dropped. See `_config.scss` and `_effects.scss` for the current source of truth; the "Aesthetic direction" section below reflects the current (neon) state.

Current branch: `rebuild/media-shell-candle-glow` (off `main`). Despite the branch name (predates the reversal), the active direction is neon — see above.
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

Current: the exact blueviolet/yellow/green/pink neon identity live on **higheredhottakes.com** (production), re-expressed in OKLCH so it's tunable, but not reinterpreted — the values below are direct OKLCH conversions of production's literal hex (`#100346` / `#21078D` / `#FFFF00` / `#00FFB2` / `#FF2578`). Dark indigo/blueviolet room, electric yellow primary accent, neon green secondary (this is production's exact `#00FFB2` — don't drift toward a softer teal/turquoise), hot pink for rare emphasis and the ambient flame-gradient backdrop. No analog grain, no dim-room vignette — those were candle-glow-specific and were dropped in the reversal.

**If a color looks off, check the live production site first** (view-source or computed styles), not this file or git history on `main` — `main` may be stale relative to what's actually deployed.

### Design tokens (`_config.scss`)

```
--ink:        oklch(19.7% 0.113 278.4); /* the room — matches prod #100346 */
--ink-raised: oklch(31.1% 0.189 274.6); /* cards, drawers — matches prod #21078D */
--bone:       oklch(100%  0     90);    /* body text — pure white, matches prod */
--bone-dim:   oklch(82%   0     90);    /* secondary text, meta, captions */
--ember:      oklch(96.8% 0.211 109.8); /* primary accent — matches prod #FFFF00 */
--ember-deep: oklch(82%   0.19  90);    /* hover/active — deeper gold (no direct prod ref) */
--tube:       oklch(88.4% 0.193 162.4); /* secondary accent — matches prod #00FFB2 */
--bloodwash:  oklch(65.3% 0.246 6.3);   /* rare emphasis, large text / non-text only — matches prod #FF2578 */
```

Token *names* are unchanged from the candle-glow pass (only values changed) so every component partial that references them kept working without edits. If you're touching color, change values here and in `_effects.scss` (`--glow-warm-*`, `--glow-cool-*`, `--flame-glow`) — don't hardcode hex/oklch literals in component files.

### Glow mechanics

- `hue-rotate()`/`brightness()` filter hacks and heavy `backdrop-filter: blur(60px)` stay dead — not reintroduced by the neon reversal. The rail/detail panels use a light `backdrop-filter: blur(6px)` "gritty glass" scrim (`--ink-glass-82`) instead, which is fine to keep.
- Glow is still **wide, dim, low-chroma multi-layer shadows** (`@mixin candle-glow` / `@mixin tube-glow` in `_effects.scss`) — mechanism unchanged from the candle-glow pass, just recolored via the tokens above.
- The flame-gradient backdrop (`.content-column` in `_structure.scss`) is back: indigo dome + warm glow over a hot-pink base, same geometry as the original pre-redesign neon gradient. Body copy sits on a solid `--ink-glass-82` scrim (`.rail`, `.detail__content`), never directly on the raw gradient — needed to hold WCAG AA against a much more vivid backdrop than the candle-glow version.
- No grain overlay. It was removed along with the "dim room" atmosphere it was built to sell.
- Heading-only `@include heading-glow` (text-shadow via `--glow-warm-heading`). Never on body copy.

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
