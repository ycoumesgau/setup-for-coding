---
title: Design system and prototype to code
group: surfaces
reviewed: 2026-11-23
---

# Design system and prototype to code

An agent asked for a screen will code one. Without a drawing to match and a written
specification of its states, it invents layout, wording and edge cases, and each invention
costs a review round. The fix is a fixed chain, a kit that refuses inventions, and captures
that show the result.

## When it matters

- At kickoff, before the first styled screen: mechanical constraints cost an hour on an empty
  repository and a rewrite after fifteen screens.
- Before any screen is coded, and when a screen and its drawing disagree.

## Decide

1. **The chain**: prototype, screen specification, code, captures. The specification (one
   file per screen) gives route, roles, data, regions top to bottom with kit components by
   name, states (empty, loading, recoverable and blocking error, read-only, offline),
   interactions and the text keys. Rewrite it when it changes; do not stack amendments.
2. **The order of authority**: the prototype wins over the specification, the specification
   over the code. The kit wins over a page; the prototype wins over the kit, through a named
   variant added to the kit, never a one-off style in the page.
3. **The design tool**: Claude Design by default; a design file such as Figma when a client
   imposes it (then its variables and code mapping replace the sync bridge). The tool reads
   the code; the code never imports the tool's output.
4. **The kit**: tokens in one CSS file, few levels (tokens, generated primitives,
   compositions, screens), a gallery where every composition renders, contrast computed.
5. **Captures**: which widths, which states, where the images live.

## Options

| Option | Gives | Costs | Choose it when |
| --- | --- | --- | --- |
| Prototype, specification, code, captures | One reference per screen; review on images | A design pass per screen; a person who decides on captures | The default for a product with customers |
| Specification only | Cheap; states written down | Layout invented by the agent | Internal tools, admin screens |
| Code first, design later | Fast first week | Paid back in review rounds | A throw-away prototype |
| Gallery route in the app | No dependency, works with server components | Previews for the design tool written by hand | The default |
| Storybook | Ecosystem, visual services | A build to keep alive; memory limits in CI | A human designer works from stories |

## Default

Claude Design, the four-step chain, a short specification per screen, and a kit of four
levels whose labels arrive as props and which imports no framework module (routing and image
components are injected). Captures at desktop width and at 390 px, plus every state the
nominal one hides (empty, error, read-only, open dialog), placed next to the prototype frame in
a route-to-frame table so a reviewer compares like with like. A fresh-context reviewer reads
that table, two rounds at most; a gap still open after two rounds goes to the person who
decides.

User-facing text never sits in the code: keys are born in the code that reads them, values
live in a store (a CMS, or a catalogue file while there is no CMS). Keep review captures as
CI artifacts (one project kept them 14 days). For published images, we recommend object
storage with only the recipe that produces them versioned; neither source project did this,
and both paid for images in git (see Traps).

This stops fitting when there is no prototype at all (internal tools): keep the
specification and the captures, drop the route-to-frame table.

## Traps

- **Coded "while waiting".** On one production project the first kit was refused at its gate
  and three rounds of visual review followed, because screens were coded before their
  drawing. A second screen missed its prototype because the session could not render it:
  give sessions a way to render the prototype locally.
- **Specifications that grow by amendment.** Median specification 21 KB, the largest 183 KB,
  one with six stacked amendments: reading the current state meant reading everything.
- **Images in git.** 2,559 images, 377 MB under `docs/`, a 396 MB pack, no LFS; on a small
  site, 57 images and 5.5 MB in three days, 12 of them already showing outdated states.
- **Captures are expensive.** About 11,350 CI minutes a week for the capture job alone before
  it was skipped on unchanged input. Pull requests capture 390 px only; desktop on the main
  branch; all widths once a week.
- **Pixel comparison lies.** Fonts are not loaded the same way in CI, so diffs are noise.
  Three pixel-free checks found real defects instead: status 200, no horizontal overflow, no
  raw text key on screen. A human pass had found six cross-cutting defects (no gutter, a
  panel without padding, two `<main>`) that no source check saw.
- **A heavy taxonomy.** On an older project, seven UI levels, about 160 components each with
  mandatory stories, a four-step token codegen whose skill said to comment out an import and
  restore it: the atom, molecule, organism boundary stayed a matter of taste.
- **Text seeded by migrations.** 96 of 195 migrations only seeded text, with snapshot
  conflicts in series and 3,048 unusable keys in the admin.
- **Accessibility reported, not blocking.** Axe blocked only the marketing pages; the rest was
  reported. Computing contrast early showed the brand accent at 2.97:1 against its background,
  which forced dedicated text tokens; a later pass took 132 contrast failures to zero.
- **Prototypes carry real data.** Prototype bundles held real customer documents and were
  shared through a public link. Prototypes use invented data only.

## Hold it with a check

- Lint: no hard-coded colours, no arbitrary values, no absolute asset paths, no framework
  import in the kit, no hard-coded user-facing strings, `jsx-a11y`; each fed a faulty fixture.
- A test that every composition renders in the gallery; axe on the gallery, blocking.
- A test that every page file is declared in the capture route list; the capture run fails
  on a non-200, a horizontal overflow at 390 px, or a raw key.
- A test that traces each deviation from generated primitives.
- No check holds "specification before code": review asks for the specification link.

## Sources

- Experience: one multi-tenant SaaS in production with a prototype-led front, an older
  consumer monorepo with a seven-level kit, and a small public site (2026).
