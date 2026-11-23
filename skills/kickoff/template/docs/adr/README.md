# Decisions

One technical decision per file, named by its date and subject: `2026-01-15-data-hosting.md`.
No sequence number: two sessions working at the same time cannot pick the same file name by
accident, and nothing has to be renumbered.

A file holds the decision as it stands today. Git is the log of how it changed: an amendment
edits the text, it does not pile up underneath it.

```markdown
# Data hosting

Status: accepted (2026-01-15) | proposed | superseded by 2026-03-02-other-decision.md

## Context

What forces a choice, and the constraints that weigh on it.

## Decision

What we do, in sentences an agent can obey.

## Reasons

Why this and not the alternatives, with the measure or the source when there is one.

## How it is held

The test, the lint or the check that fails when the decision is broken. "Nothing yet" is an
answer; silence is not.
```

- **Accepted** binds. **Proposed** is context. **Superseded** is history, kept for its reasons.
- An **open** decision says when and by what rule it will be decided. It is not decided early.
- A decision that belongs to the owner (the closed list of `AGENTS.md`, section 6) stays
  proposed until the owner answers.
