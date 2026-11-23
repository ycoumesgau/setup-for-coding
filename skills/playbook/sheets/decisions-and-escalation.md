---
title: Decisions and escalation
group: method
reviewed: 2026-11-23
---

# Decisions and escalation

An agent makes dozens of small decisions per task. If it asks about all of them, the owner
approves without reading; if it asks about none, the irreversible ones are taken by default.
The work is to decide which few are asked, before the code, and where the rest are written so
that they can be found without being pushed at anyone.

## When it matters

- At kickoff, when writing the contract's Method section and choosing a tracker.
- When the owner's inbox fills with approvals, or a decision surfaces after the code that
  depended on it.
- When a session is tempted to ship a simpler version of what the specification says.

## Decide

1. **What a session decides alone.** Everything not on the closed list. It writes each one in
   the pull request: one line, the decision and its reason.
2. **The closed list, asked before the code.** A data schema or an API contract;
   authentication, payment, tenant isolation; a new provider or vendor; a price; a screen or
   flow with no design; an expense. Each question carries options, a recommendation, and what
   the session does meanwhile.
3. **What reaches the owner.** Two kinds of issue only: *to decide* (a closed-list question)
   and *owed* (an action only a person can take: a payment, a signature, a secret, a setting
   in a third-party account). An unknown that code can test becomes a check, not an issue.
4. **How much care a change gets.** Computed from the paths it touches, never chosen by the
   session that wrote it.
5. **How the rest is read.** A weekly digest of the decisions in merged pull requests, read
   when the owner chooses; it blocks nothing.
6. **Where structural decisions live.** One ADR per decision, current text only, with a status
   whose authority is written: accepted binds, proposed is context, superseded is history.

## Options

| Option | Gives | Costs | Choose it when |
| --- | --- | --- | --- |
| Ask about everything | The owner sees all | Approval without reading; sessions wait | Never past the first days |
| Journal every decision into the tracker, read daily | Everything traceable | About 30 entries a day; reading time with no effect | Never as a daily read |
| Decide and write in the pull request; closed list asked; weekly digest | Attention spent where a mistake is irreversible | A closed list to keep short and true | The default |
| The tracker drives the agents (one orchestrator per ticket) | Automatic dispatch | A permanent host; one tracker only | One tracker, one host, many small tickets |

## Default

The closed list above, in the contract. Decisions in a fixed section of each pull request,
gathered by a weekly digest. Repository issues with two labels, `decide` and `owed`, from two
issue templates; on Linear, the same two labels on one team; on Jira, two issue types or two
labels. Keep the fields identical whatever the tool, and reach it through its official MCP
server, so changing tracker changes nothing in the method. Risk tiers from paths: tier 0
(content) merges on green CI and one fresh-context review, tier 1 (code) on review, tier 2
(the project's checks, CI and contract, and authentication, tenancy, billing, migrations) is
merged by the owner; the last four also get a second review pass. A
specification is implemented as written; a simpler version "for now" is a decision on the
closed list, asked like any other. The list stops fitting when the product adds a regulated
duty or an external design process: add the item, and keep the list closed.

## Traps

- **The journal nobody needed.** On one production project, every session decision went to
  the tracker as an entry: about 30 a day. The owner read them daily and judged it
  inefficient; almost none changed anything.
- **Approval for everything is approval for nothing.** Users accept 93% of permission prompts;
  an approval asked for every change was given without reading there as well. Compute which
  changes need one.
- **Self-classified risk.** One team auto-approving low-risk pull requests found that
  engineers could not classify their own changes reliably: its criteria are objective (no
  migration, no auth, no CI, no audit logging) and evaluated by automation.
- **A gate that is only an instruction.** In a 2026 study of a human-gated workflow, the
  orchestrating agent took an ambiguous answer for agreement and tried to rewrite a logged
  stop as a success. A question is answered in writing, on the issue.
- **The answer after the code.** A screen coded "in the meantime", before its specification,
  cost three rounds of review; a pull request on the same project named two sequence defects:
  a screen specification written after the component, an API contract coded before the
  owner's answer. Code already written weighs on the answer.
- **A simpler version for now.** On that project the owner's rule was "right the first time
  rather than in two goes": the second go is rarely planned, and the first one becomes the
  product.
- **A list that copies one product.** The first closed list carried items proper to one
  product (a compliance screening, a design tool's frames). A generic list names categories;
  each project adds its own.
- **Old decisions obeyed rigidly.** Agents apply an accepted ADR more strictly than people do,
  even when it is out of date. Supersede it in a reviewed change; do not leave two texts.

## Hold it with a check

- `scripts/risk-tier.mjs` computes the tier from `risk-tiers.json`, refuses a default tier of
  0 (a file no rule names is never content), and exits red with `--max` when a change is above
  the allowed tier.
- The auto-merge module merges tier 0 by itself, computing the tier with the base branch's
  rules so that a pull request cannot lower its own tier.
- The pull request template carries Decisions, Risk tier and "What this does not prove". The
  weekly-digest module lists merged pull requests that have no Decisions section.
- The issue templates `decide` and `owed` hold the fields.
- `reviewer-conformity` reports a closed-list point decided without being asked, and a
  question sent that the session should have decided. This is review, not a test: nothing
  proves a question came before the code.

## Sources

- Experience: one multi-tenant production project run by one owner and many sessions (2026).
- Anthropic, "Claude Code auto mode" (2026-03-25): 93% of permission prompts accepted.
  <https://www.anthropic.com/engineering/claude-code-auto-mode>
- Ona, "Auto-approving low-risk PRs" (2026-04-09, vendor figures).
  <https://ona.com/stories/auto-approving-low-risk-prs>
- Abdo and Brom, arXiv 2611.05094 (2026-11-03): a human-gated workflow on Claude Code.
  <https://arxiv.org/html/2611.05094>
- O'Reilly Radar, "Coding agents love decision records" (2026-10-02).
  <https://oreilly.com/radar/coding-agents-love-decision-records/>
