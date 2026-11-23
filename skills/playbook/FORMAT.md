# The format of a sheet

A sheet carries what is needed to make one decision well at the start of a project, and to
keep it true afterwards. It is read by an agent in the middle of a task and by a person
deciding: both want the answer first and the reasons second.

```markdown
---
title: Agent memory
group: method
reviewed: 2026-11-23
---

# Agent memory

Two or three sentences: what goes wrong when this is left to chance.

## When it matters

The moments that should open this sheet.

## Decide

The questions to settle, in the order they depend on each other.

## Options

A table: the option, what it gives, what it costs, when to choose it.

## Default

The choice to make when nothing argues against it, and its reason.

## Traps

What was measured or lived: the mechanism, the figure or the symptom, the remedy.

## Hold it with a check

The test, lint or script that fails when the decision is broken.

## Sources

Where the claims come from.
```

Rules, held by `tests/playbook.test.mjs`:

- The eight sections, under these headings, in this order. A section with nothing to say
  says so in one line; it is not padded.
- 8,000 bytes at most. A sheet that needs more is two sheets.
- `group` is one of `method`, `foundations`, `surfaces`, `ai-ops`. `reviewed` is the date a
  person or a session last checked the sheet against practice; an old date is a warning to
  the reader, not a failure.
- The file name is the sheet's slug, and `SKILL.md` lists every sheet once.

Rules a test cannot hold, held by review:

- **Specific or absent.** A trap names its mechanism and a figure or an exact symptom. Advice
  that would fit any project ("write tests", "document decisions") is cut.
- **Experience is anonymous**: "on one production project", never its name, its customers or
  its people. Vendors and tools are named.
- **A default has a reason and a limit**: when it stops being the right choice.
- **A link is one that was read.** Cite by name when the page was not opened.
- **No version numbers** unless the trap depends on one: they go stale first.
