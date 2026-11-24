---
title: Documentation, in-app help, changelog and support
group: surfaces
reviewed: 2026-11-23
---

# Documentation, in-app help, changelog and support

A product owes its customers four editorial surfaces: documentation, help inside the app, a
changelog, and a way to ask (suggestions and support). Left to chance, an agent writes
documentation that reads like the marketing site, the help drifts from the documentation, the
changelog is written after the fact by nobody, and tickets arrive through three doors into
three stores.

## When it matters

- Before the first documentation page is written, by a person or an agent.
- When the first change ships that a customer will notice.
- When a second support channel is proposed.
- When text starts to arrive in the database through migrations.

## Decide

1. **The page format.** Two shapes on one skeleton: a *task* page (numbered steps) and a
   *reference* page ("what is accepted", then "what is refused, and why", listed
   exhaustively from a closed list in the code). Both end with "what you see on screen",
   "known limits" and "if it does not work".
2. **The line between documentation and marketing.** The site promises; the documentation
   states. Test each sentence: if it would stay true without the product in front of you
   (no bound, no screen label, no measure), cut it. A price never appears in prose: it is read
   from its one source.
3. **One source for help.** The short form (a sentence under a title, the label of a "?")
   lives with the interface texts; the long form lives only in the documentation. The short
   form never paraphrases a page, so the two cannot diverge. A closed table maps each screen
   to its page.
4. **Where the changelog line is written.** In the pull request, by its author, at the moment
   the change is decided, and published after a green production release.
5. **One store for requests.** Suggestions in one collection, support tickets in another; a
   new door is a new value of a `channel` field, never a second store.
6. **Where text lives.** In a CMS, edited through a narrow MCP (Model Context Protocol)
   server or the admin, or as Markdown in the repository.

## Options

| Option | Gives | Costs | Choose it when |
| --- | --- | --- | --- |
| Markdown documentation in the repository | Reviewed with the code; no CMS | Every wording fix is a deploy | No CMS yet, or a developer audience |
| Documentation in a CMS, repository as source, synced after release | Non-developers can edit; history | A sync job that must never overwrite an edit made in the admin | A CMS already serves the site |
| Third-party helpdesk | Ready inbox, macros | One more processor for customer text; no allowlist on what it stores | Data is not sensitive |
| Tickets in your own store, replies from a shared mailbox | One store, your access rules | You build triage and the reply screen | Customer text is sensitive |

## Default

Documentation pages in two shapes, 250 to 900 words, rewritten in place (no dated addendum), a
stable slug with a 301 from the old one. Help in the app opens the same page in a side panel.
Every pull request that ships bytes says whether a customer sees a difference: if yes, a
`public` label and exactly one customer line; if no, `public: n/a — <reason>`. A workflow
triggered by the green production release composes one changelog entry per day from those
lines, and a person can freeze or amend it. One support store, and no automatic sending: a
person reads and sends every reply. A model that classifies and drafts from published pages
is the design on one production project, measured on a trial of four tickets (about USD
0.003 in all); its use in daily service was not verified, so treat it as an option. Suggestions are moderated
before anything is visible, and the public view is an allowlisted projection.

Interface texts: the birth of a key is code (a catalogue file per screen, synced without ever
overwriting a value); its value is data, edited through the MCP or the admin.

The reason: each surface reads one source, and every rule above has a check. It stops being
right below a few customers; before that, a Markdown changelog and a mailbox are enough.

## Traps

- **Agent-written docs were marketing.** On one production project, the first eight pages
  seeded by an agent read as sales copy. The spec said nothing about the genre. The written
  format fixed it, and writing the docs exposed product defects: a "validate the batch" step
  with no button, wrong labels, raw codes on screen. Rule kept: what is not built has no page.
- **A line written as the continuation of its prefix.** The composer strips "For customers:"
  and never rewrites the text. One day, 5 of 10 published lines started in lower case and
  read as fragments ("screening a person now happens in a drawer…"). Normalising at
  composition would make the platform an editor; the check now refuses, at the author, a line
  that does not open and close like a sentence, and only warns on continuation words.
- **An enum key leaked into published text.** A changelog label copied the raw value
  `feature`; the vocabulary check refused it and blocked the whole day's entry. Every enum
  value that ends in a published text field passes the same vocabulary check.
- **Text through migrations.** 96 of 195 migrations only seeded text, 89 of 121 pull requests
  added a migration, with snapshot conflicts in series, and 3,048 keys were unusable in the
  admin. Text left migrations for the catalogue-plus-MCP model.
- **Find-or-create seeding froze content.** A seed script left seven of twelve staging pages
  stuck on old text. Seeds only fill an empty database.
- **A stale image is worse than none.** Images show invented data from a fictional seeded
  tenant, are produced by a versioned recipe (route, width, state), and annotate by selector:
  when the selector disappears, the capture fails instead of pointing beside the target.
  Sequences of images, not video: a video cannot be linked by anchor and is redone at the
  first changed label.

## Hold it with a check

- A co-change table maps engine paths to their documentation page. CI refuses a listed path
  changed without its page, and a path under a watched root that belongs to no entry, so the
  table cannot rot. The escape is a named line, `docs: n/a — <reason>`, printed and counted.
- The same pull-request check refuses a `public` label without exactly one customer line, a
  line that fails sentence form, a line that breaks the vocabulary, and a title without a
  `feat`, `fix`, `perf` or `refactor` type.
- A capture check fails on a real tenant's name or domain in any image or fixture.
- The MCP server has no delete tool, writes drafts unless `publish` is explicit, and logs old
  and new values in the same transaction; a test pins each.
- Limit: the co-change check watches the repository copy, not the published page.

## Sources

- Experience: one multi-tenant B2B SaaS in production, with fifty-odd documentation pages and
  a changelog fed by pull requests (2026).
