# Plans

The memory of a piece of work between sessions. It is read at the start of a session and
updated at its end.

```
docs/plans/
  active/
    billing/
      STATE.md                    where the work stands; short, replaced each time
      2026-03-04-invoices.md      what one lot did; written once, never reopened
      2026-03-19-dunning.md
  completed/
    onboarding/             a finished workstream, moved here whole
```

- **`STATE.md`** answers three questions: where are we, what comes next, what is open. It is
  replaced, not extended; what is finished leaves for a lot file.
- **A lot file** is named by its date and its subject, never by a number: two sessions
  cannot then pick the same name. It is written by the session that did the lot: what was
  asked, what was done, the decisions taken with their reasons, what it does not prove. Once the lot is merged, the
  file is not edited again. A correction is a new lot.
- **No shared journal.** One file that every session appends to grows without bound and
  conflicts at every merge. One file per lot does neither.
- **A plan never changes a rule.** It proposes the change to `AGENTS.md` or to an ADR.
- When a workstream is finished, its folder moves to `completed/`, and its line leaves
  section 0 of `AGENTS.md`.

Sizes are capped by `scripts/agent-memory-check.mjs`.
