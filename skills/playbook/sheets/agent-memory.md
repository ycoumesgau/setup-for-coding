---
title: Agent memory
group: method
reviewed: 2026-11-23
---

# Agent memory

Whatever an agent loads at the start of every session is the project's real rulebook. Left
alone it grows: each session adds the story of what it did, nothing is ever removed, and past
a certain size the file is skimmed instead of read. The rules are still written; they have
stopped being applied.

## When it matters

- At kickoff, before the first rule is written.
- When a contract file nears its cap, or a plan becomes the place where everything goes.
- When a session obeys a line that is no longer true.

## Decide

1. **What is always loaded, and what is loaded on demand.** The contract is always loaded:
   it holds only what every task needs. Rules of one area are loaded when its files are
   touched. Everything else is found by path when needed.
2. **Where each kind of writing goes.** A rule, a state, a story, a decision and a measured
   trap are five different things. Give each one place, and say it in the contract.
3. **What is replaced and what is appended.** A state is replaced. A story is written once.
   Nothing that is loaded is appended to.
4. **The caps, and what happens at the cap.** A cap exists to force a choice: at the cap,
   something leaves. Rewording to fit is not allowed.
5. **Who enforces it.** A script, at write time and in CI. A written rule does not hold.

## Options

| Option | Gives | Costs | Choose it when |
| --- | --- | --- | --- |
| One instruction file | Nothing to design | Grows without bound; every task pays for every rule | A prototype that will be thrown away |
| A short contract, path rules, plans and pitfalls as files, all capped | Every session has it, with no login; a rule and its code change in one reviewed commit | Needs the check, and the habit of moving things out | The default |
| A wiki or notes tool read through a connector | Easy editing for people who do not use git | A login per session; no shared commit with the code; no review of changes | People outside engineering must edit: then sync one way into the repository, and let agents read the copy |
| The agent's automatic memory | No effort | Stays on one machine: a cloud session or another account does not see it | Personal preferences only, never project rules |

## Default

A contract (`AGENTS.md`, imported by a one-line `CLAUDE.md`) under 16 KB, whose rules each
name the check that enforces them. A "Current state" section of 25 lines at most, replaced
each time. Path rules under `.claude/rules/`, 8 KB each. One folder per workstream under
`docs/plans/active/`, holding a short `STATE.md` that is replaced and one file per lot that is
written once; the folder moves to `completed/` at the end. One file per decision and per
measured trap, named by date and subject, so that two sessions never pick the same name.

The reason is cost and reach: the repository is the only place every session can read without
credentials, and the only one where the rule and the code it governs are reviewed together.
It stops being enough when non-engineers must edit product or brand documents.

## Traps

- **The contract became a journal.** On one production project the instruction file reached
  355 KB, about 145,000 tokens loaded by every session and every sub-agent, before it was cut
  to under 40 KB. The rule against narrative was already written in it.
- **The story moved next door.** After that cut, plans had no cap: within two months single
  plan files reached 845 KB and the plans folder 20 MB. Capping one file moves the growth to
  the nearest uncapped one. Cap every kind of file an agent is told to read.
- **Compression instead of triage.** Four area files sat between 19,971 and 19,999 bytes of a
  20,000-byte cap: sessions shortened sentences to fit rather than move anything out, and the
  text became harder to read at the same size.
- **A shared file is a merge conflict.** With seven live branches, the documentation index was
  touched by five of them and a shared plan by several. One file per lot, and no committed
  index, removes the conflict.
- **A stale line is obeyed as faithfully as a true one.** A sentence saying containers could
  not run in a session stayed in a contract after it stopped being true; sessions that obeyed
  it left to CI what they could have run themselves. A limit of the instrument is dated, kept
  with the pitfalls, and deleted when it stops being true.
- **A rule without a check drifts in days.** A "no hard-coded text" rule with nothing behind
  it was broken within the first week.
- **Two copies disagree.** A state kept both in the contract and in a plan said "in progress"
  in one and "shipped" in the other within a week.

## Hold it with a check

`scripts/agent-memory-check.mjs`, run by the agent's write hook, the pre-push hook, `verify`
and CI. It refuses a file over its cap, a state section that grew, the marks of a story in a
loaded file (a dated journal line, a run identifier, a session link), a `CLAUDE.md` holding
anything but the import, and a kickoff placeholder left behind. It does not judge whether a
rule is right: review does.

## Sources

- Experience: three codebases built by agents, one of them in production (2026).
- Claude Code documentation, "Memory": a target of under 200 lines per instruction file;
  path-scoped rules; automatic memory is local to a machine.
  <https://code.claude.com/docs/en/memory>
- OpenAI, "Harness engineering" (2026-02-11): one large instruction file failed; a short one
  used as a map to documents in the repository replaced it.
  <https://openai.com/index/harness-engineering/>
- Thoughtworks Technology Radar, "Agent instruction bloat" (2026), rated Caution.
- Treude and Baltes, arXiv 2606.09090 (2026-06-08): 23% of 356 sampled repositories had at
  least one stale code reference in their agent instruction file.
