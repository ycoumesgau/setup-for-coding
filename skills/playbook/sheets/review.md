---
title: Review by fresh-context agents
group: method
reviewed: 2026-11-23
---

# Review by fresh-context agents

A session that wrote a change believes its own account of it. A reviewer handed that account
believes it too, and finds what the author already found. Review by agents works when the
reviewer starts from the request and the diff, assumes the change is wrong, and can run what
it suspects.

## When it matters

- Before every pull request opens.
- When a change touches authentication, tenancy, billing or a migration.
- When a third round of review is being considered.

## Decide

1. **What the reviewer is given.** The request word for word, the pull request body as claims
   to prove, the diff with plans excluded, the decisions it cites. Never the session's story,
   never another reviewer's findings.
2. **Which roles.** Conformity, read-only: the request, the decisions, the contract, the claims
   of the body, public text. Risk, with execution: tenancy, access, migrations, secrets,
   tooling, computations, and one mutation it chooses and replays in a throwaway copy.
   Prototype, on designed screens: block by block against the design's renders.
3. **How many passes.** One by the writing session. A second, by someone who did not write the
   lot, when it touches authentication, tenancy, billing or a migration.
4. **How many rounds.** Two at most. After that, a closed-list point is asked; the rest the
   session decides and writes down. A new defect of the same kind in round two means the check
   should change form.
5. **What happens to a finding.** Checked before it is acted on. A rejected one is recorded
   with its reason in a comment of the pull request.

## Options

| Option | Gives | Costs | Choose it when |
| --- | --- | --- | --- |
| No agent review, owner reads | Nothing to run | The owner becomes the bottleneck | Never at agent volume |
| One read-only reviewer for everything | One run per pass | Cannot prove a check is dead; no screen comparison; no second opinion | A prototype with no sensitive data |
| Conformity and risk roles, prototype when designs exist | Independent findings; dead checks proved by execution | 4 to 5 runs on an ordinary pull request | The default |
| The same reviewer on another model | A different bias, maybe | Quota spent fast; nothing measured it pays | Only when the owner decides the expense |

## Default

Two reviewers from day one: `reviewer-conformity` on every lot, `reviewer-risk` on every lot
that touches code, schema, scripts or CI. A third, `reviewer-prototype`, joins with the first
screen that has a design to compare against. One pass by the writing session; a second pass at
fresh context, run by whoever merges, only for a lot that touches authentication, tenancy,
billing or a migration. Two rounds at most. The reason: the strongest finds of review are checks that stay
green when the code they guard is broken, and only execution proves that. The default stops
fitting when lots are very large (one of about 15,000 lines needed three risk reviewers in
parallel): split the lot rather than add reviewers.

## Traps

- **The reviewer believes the story.** On a two-file documentation change, a fresh-context
  reviewer found that a job reported green had a red log as its only evidence, and that a
  limit written as "impossible" had a documented recipe nobody had replayed. Both claims had
  already been passed on to the owner by the writing session.
- **The second pass finds what two rounds missed.** On one production project, after the
  writing session had done its two rounds, a second pass at fresh context found 4 blocking
  defects and 19 others, in states the session's tests never produced.
- **Dead checks pass reading.** The risk reviewer's strongest finds were checks that stayed
  green when broken: an export never compared with its source, access-cache guards, a session
  role test. A read-only reviewer can suspect them; replaying the mutation proves them.
- **Findings are mostly right.** Five counted reviews gave 17, 14, 19, 9 and 7 findings; 5 to
  10% were rejected after checking. Most rejections came from the prototype role (states the
  local stack could not produce) and from a conformity finding repeated every time (tracker
  identifiers the session had no way to create).
- **Rounds stop paying.** Returns fell sharply past two rounds. One billing lot went to four
  rounds and four different overcharges; the fix was to turn the check into a measured
  post-condition, not a fifth round. In a 2026 study, re-reviews took 75% of a reviewer's
  tokens.
- **Copies nobody calls.** That project kept an alias of one reviewer and an identical copy on
  another model; no log showed the copy ever ran. Every agent file is maintained: delete the
  unused ones.
- **A network closed by instruction only.** The risk reviewer runs commands; its tools deny
  web access, but a shell command could still reach out. State it; do not claim more.
- **Cost.** 4 to 5 reviewer runs on an ordinary pull request, 12 or more on a large
  workstream. No token cost was measured; measure it before adding a role.

## Hold it with a check

- `.claude/agents/reviewer-conformity.md` and `reviewer-prototype.md` hold only Read, Grep and
  Glob. `reviewer-risk.md` adds Bash with web tools disallowed, must replay one mutation in a
  `git worktree` and report an unexpected green as blocking. All three refuse the session's
  story and stop at two rounds.
- `scripts/risk-tier.mjs` names the files that call for the second pass: the rules marked
  `secondPass` in `risk-tiers.json`.
- The pull request template asks for the mutations seen red and the reviewers that ran.
- Not enforced: that a review actually ran. The body says so; the auto-merge module states
  that it does not know, and the owner samples.

## Sources

- Experience: one multi-tenant production project with three reviewer roles, counted over
  five reviews and several workstreams (2026).
- Abdo and Brom, arXiv 2611.05094 (2026-11-03): 5 of 111 review reports clean; re-reviews
  75% of reviewer tokens. <https://arxiv.org/html/2611.05094>
- OpenAI, "Harness engineering" (2026-02-11): human QA became the bottleneck; agents review
  each other. <https://openai.com/index/harness-engineering/>
