# PRD: Tailwind v4 + tailwind-merge migration

Migrate the `web/` frontend's styling from a hand-written semantic stylesheet to
Tailwind v4 utilities, while preserving the existing `--iw-*` design-token system that
drives theming. Adopt `tailwind-merge` for conflict-safe class composition.

## Problem Statement

As the maintainer, I write and grow intertangle's frontend, and I'm more fluent in
Tailwind than in a hand-maintained `styles.css`. Today every component composes classes
with template-literal ternaries (`` `iw-tree-row${isActive ? ' iw-tree-row--active' : ''}` ``)
against a 642-line BEM-style stylesheet. As the project grows with new features, I want
to author styling in the idiom I'm fastest in, without paper-cutting myself on a styling
system I reach for less naturally — and without losing the theme-token architecture that
already exists for the planned dark/light support.

## Solution

Introduce Tailwind v4 (CSS-first, via the `@tailwindcss/vite` plugin) into `web/` and
bridge it to the existing token system: an `@theme` block maps the `--iw-*` custom
properties to Tailwind color tokens, so utilities like `bg-canvas` / `text-accent`
resolve *through* the tokens. The existing `[data-theme="dark"]` block (and the planned
`[data-theme="light"]` override) stay exactly as they are — theme switching keeps working
with zero `dark:` variants because the tokens swap underneath the utilities.

All component markup migrates from `iw-*` semantic classes to utilities, with conditional
composition expressed through a small `cn()` helper wrapping `tailwind-merge` (string-only;
no `clsx`/`classnames`). A residual `styles.css` remains for the styling that cannot be
expressed as utilities on elements we render: third-party `.react-flow__*` overrides and
the Shiki-highlighted source HTML injected via `dangerouslySetInnerHTML`.

The end user sees no change — the migration is presentational and visually faithful,
verified against a screenshot baseline.

## User Stories

1. As the maintainer, I want to author new component styling with Tailwind utilities, so that I work in the idiom I'm fastest in as the project grows.
2. As the maintainer, I want Tailwind installed as a Vite plugin (v4, CSS-first), so that there's no separate `tailwind.config.js` or PostCSS chain to maintain.
3. As the maintainer, I want Tailwind utilities to resolve through the existing `--iw-*` tokens via an `@theme` bridge, so that there is a single source of truth for color and the design stays consistent.
4. As the maintainer, I want the existing `[data-theme="dark"]` token block left intact, so that the planned light theme still drops in as a single `[data-theme="light"]` override with no component changes.
5. As the maintainer, I want theme switching to work without `dark:` variants, so that adding light mode later never requires touching markup.
6. As the maintainer, I want a `cn()` helper that composes class strings and dedupes conflicting Tailwind utilities (last-wins), so that base-plus-override class composition is predictable.
7. As the maintainer, I want `cn()` to be string-only over `tailwind-merge`, so that the dependency surface stays minimal and no `clsx`/`classnames` enters the tree.
8. As the maintainer, I want every component's `iw-*` classes replaced by utilities, so that styling lives co-located with markup rather than in a distant stylesheet.
9. As the maintainer, I want the `SourceView` `className` passthrough migrated to `cn(base, className)`, so that callers can override base utilities safely.
10. As the maintainer, I want third-party `.react-flow__*` overrides kept as plain CSS, so that styling of DOM I don't render keeps working.
11. As the maintainer, I want the Shiki-injected source-HTML styling (`.iw-source-panel pre` and related) kept as plain CSS, so that highlighted code I inject via `dangerouslySetInnerHTML` stays styled.
12. As the maintainer, I want a screenshot baseline captured before migrating and diffed after, so that silent visual regressions across components are caught.
13. As the maintainer, I want the screenshot harness to be throwaway (deleted on landing), so that I don't take on a permanent visual-regression suite the project deliberately avoids in v1.
14. As the maintainer, I want the existing seam test suite and `biome` to stay green throughout, so that I have proof the markup changes introduced no behavioral or lint regression.
15. As the maintainer, I want an opacity utility (e.g. `bg-canvas/50`) verified early, so that I know the `var(--iw-*)` token format cooperates with v4's `color-mix` before relying on it.
16. As the maintainer, I want the migration sequenced component-by-component starting from a leaf, so that I validate the full pipeline before committing the larger surfaces.
17. As an end user of intertangle, I want the canvas, sidebar, palette, and source panel to look and behave exactly as before, so that the migration is invisible to me.
18. As the maintainer, I want the prebuilt-assets constraint preserved (no build step at install/run time), so that Tailwind only runs at `vite build` and ships compiled CSS in `dist/`.

## Implementation Decisions

- **Tailwind v4, CSS-first.** Installed via `@tailwindcss/vite` and added to the existing
  `web/vite.config.ts` plugin array (alongside React + react-compiler). No
  `tailwind.config.js`, no PostCSS step. Tailwind runs only at `vite build`, keeping the
  "prebuilt assets, no install/run-time build" constraint intact.
- **Token bridge via `@theme`.** `styles.css` gains `@import "tailwindcss"` plus an
  `@theme` block mapping the tokens used in markup to Tailwind color tokens, referencing
  the existing custom properties — e.g.

  ```css
  @theme {
    --color-canvas:  var(--iw-bg-canvas);
    --color-accent:  var(--iw-accent);
    --color-text:    var(--iw-text);
    /* ...only the tokens actually used as utilities... */
  }
  ```

  The existing `:root` / `[data-theme="dark"]` token definitions are **not** modified;
  the planned `[data-theme="light"]` override remains the mechanism for light mode.
- **No `dark:` variants.** Theming is achieved by swapping token values under the
  `[data-theme]` attribute, not by Tailwind's dark-mode variant.
- **`cn` helper, string-only.** A single small helper wraps `tailwind-merge`:

  ```ts
  import { twMerge } from 'tailwind-merge'
  export const cn = (...parts: (string | false | null | undefined)[]) =>
    twMerge(parts.filter(Boolean).join(' '))
  ```

  `clsx`/`classnames` are explicitly out — no object/array conditional syntax is used in
  the codebase, so `twMerge`'s string handling plus falsy-filtering covers every case.
- **Dependencies added:** `tailwindcss`, `@tailwindcss/vite` (build/dev), `tailwind-merge`
  (runtime). No others.
- **Full markup migration (all components).** Every `iw-*` class on elements we render is
  replaced by utilities; template-literal ternaries become `cn(...)` calls.
  `SourceView`'s `className` passthrough becomes `cn(base, className)` — the case
  `tailwind-merge` exists for.
- **Residual `styles.css` is expected, not a failure.** Two categories stay as CSS because
  they target DOM the app does not render: `.react-flow__*` third-party overrides, and the
  Shiki source-HTML styling (`.iw-source-panel pre` etc.). The token definitions and any
  global resets also remain.
- **Migration order:** a leaf component first (validate the pipeline end-to-end), then
  `SourceView` (proves the `cn`/override path), then the remaining surfaces
  (`App` → `FileTree` → `FileCardNode` → `FilePalette` → source panel).
- **Backend `src/` untouched.** This is a `web/`-only change.

## Testing Decisions

A good test here asserts external behavior at the highest existing seam and ignores
presentation. A styling migration has **no new behavioral seam** — it changes how class
strings are produced and which CSS exists, neither of which the logic seams assert.
Therefore:

- **No new automated seam is added.** The existing seams (`buildGraph`, HTTP API,
  `projectGraph`/`toReactFlow`, `layout`) must stay green, which is the proof that the
  markup changes introduced no behavioral regression. Prior art: the four seams documented
  in `prd-import-graph-explorer.md`.
- **`biome check` must stay clean**, as in every prior slice (issue 10's acceptance
  criteria set the precedent).
- **Visual correctness is verified by a throwaway screenshot baseline**, captured via a
  Playwright subagent before migration and diffed per screen/state after — then deleted
  when the slice lands. This is consistent with the product PRD's "chip expansion, palette,
  pan/zoom, and visual highlight correctness are manual in v1" stance; it is a temporary
  migration aid, not a maintained regression suite.
- **The `cn` helper is treated as trivial — no unit test.** Its only original logic is
  `filter(Boolean).join(' ')`; the dedupe behavior is `tailwind-merge`'s. It is exercised
  by every migrated component and the screenshot baseline.

## Out of Scope

- A light-theme toggle UI or `[data-theme="light"]` token values — the bridge *enables*
  light mode but shipping it is a separate feature.
- A permanent visual-regression test suite — deliberately avoided in v1.
- `clsx`/`classnames` and object/array conditional class syntax.
- Any backend (`src/`) change, the graph contract, or the `/graph` / `/file` routes.
- Restyling or redesigning components — the migration is visually faithful, not a visual
  refresh.
- Removing the residual `styles.css`; third-party and injected-HTML styling stay as CSS.

## Further Notes

- v4 opacity shorthands (`bg-canvas/50`) require the `@theme` color to be in a form v4 can
  `color-mix`; the `var(--iw-*)` bridge works, but one opacity utility should be smoke-tested
  early so the token format is known to cooperate.
- Because tokens are the single source of truth, both the migrated utilities and the
  residual CSS read the same `--iw-*` values, so they stay visually consistent and a future
  theme swap covers both at once.
- This slice assumes work proceeds on a dedicated branch per the project's "one slice per
  branch" convention; done-signal is `git mv docs/issues/open/13-*.md docs/issues/resolved/`.
