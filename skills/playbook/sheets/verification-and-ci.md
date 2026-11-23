---
title: Verification and CI
group: method
reviewed: 2026-11-23
---

# Verification and CI

Agents open pull requests faster than people do, and each push can start the whole pipeline.
When CI is where failures are discovered, every red costs a full run, a fix and another full
run, and the bill grows with the number of pushes rather than the number of changes. CI should
confirm what the session already saw.

## When it matters

- At kickoff, before the first job is written: weight is cheap to avoid and costly to remove.
- When the clock time of a green run passes its target, or the minutes per merged pull
  request rise without a reason anyone wrote down.
- When a merge to the default branch starts deploying to production.

## Decide

1. **One command, two levels.** `fast` is what every push needs (format, lint, types, the
   tests of what moved) and fits a budget of minutes. `full` is everything (database,
   isolation, browser, build). The session and CI run the same command; CI holds no logic a
   session cannot replay.
2. **What runs where.** `fast` before every push. `full` in the session before the pull
   request opens. CI runs it again to confirm, on one required check.
3. **When the heavy suite runs, if a merge is a release.** Before the default branch, never
   after it. If pull requests arrive faster than `full` runs, use a merge queue: `fast` on the
   pull request, `full` once in the queue, on the change combined with everything before it.
   Nightly runs only hold what does not block.
4. **Budgets.** A duration for `fast`, a timeout per CI job, a clock target for a green run,
   and minutes per merged pull request read every week.
5. **Blocking or for the eye.** Each job says whether it guards the merge or produces
   something a person looks at. Only the first kind blocks.

## Options

| Option | Gives | Costs | Choose it when |
| --- | --- | --- | --- |
| CI discovers, sessions push and wait | Nothing to set up | Every red is a full run; reruns multiply | Never as a policy |
| Same command in session and CI, `full` before the pull request | CI confirms; reds are found where they are cheap | A session environment that runs the stack | The default |
| Heavy suite after merge or at night | Fast pull requests | The bug is found in production when a merge deploys | A merge does not deploy, and a revert is quick and automatic |
| Merge queue holding `full` | One heavy run per change, on the combined tree | Needs the hosting plan for it; a flaky test blocks everyone | Merges deploy and pull requests outrun `full` |
| Cheaper runners | Two to five times less per minute | Vendor review, security of self-hosting | The volume is already under control |

## Default

`node scripts/verify.mjs` (fast) in the pre-push hook, `--full` before the pull request opens,
CI running `--full` on one required check named Verify. Add the merge queue when a merge
deploys and pull requests wait on CI. On day one: seed tests from one shared fixture or a
template database cloned per test file (Postgres `CREATE DATABASE ... TEMPLATE`), never a
whole world per file; wait on a condition, never on a duration; build CI jobs on a pinned
image that already holds the toolchain; write down which jobs block and which only produce
images. The reason is that the volume of pushes, not the price per minute, sets the bill. It
stops being enough when `full` no longer fits a session (about 4 vCPU and 16 GB in a cloud
session): then split `full` by area, or run sessions on larger self-hosted machines.

## Traps

- **CI as the discovery tool.** On one production project: about 57,000 billed minutes in 9
  active days for 182 merged pull requests, 314 minutes each, for a green run of about 140.
  The heavy suite ran 2.8, later 1.9 times per merged pull request; 100 pull request runs were
  cancelled in one week; a green run took about 35 minutes against a written target of 20.
- **A false limit kept the habit alive.** The contract said containers and a real database
  could not run in a session. Measured false: all 12 test jobs started in a cloud session, and
  the database tests passed on the real stack (51 files, 938 tests) where a bare local
  database left 8 files red. A full serial replay took an estimated 2 to 2.5 hours on 4 cores,
  which is why two levels exist. Test such a limit before writing it.
- **A world per test file.** An isolation suite in four shards, each mounting its own
  database, each file seeding two tenants: the database stack was mounted 8 times per run,
  about 5,000 minutes in 14 days.
- **Fixed waits.** The browser capture job was the critical path, and 49% of its pass (355 s
  of 721) was fixed waits.
- **Images nobody looks at.** That job blocked on three checks of the rendered page (status
  200, no horizontal overflow, no raw text key); its images were never compared and were
  thrown away. Keep the checks, and stop paying to produce the images on every run.
- **Silent growth.** One job went from 9 to 18 minutes before anyone noticed. A timeout set
  far above the median hides it.
- **Trading clock for minutes.** Building once for all jobs saved 2.4 billed minutes and
  added 4 of clock time; it was withdrawn. Measure both before keeping a saving.
- **Queue and concurrency.** `cancel-in-progress` keyed on the workflow alone cancels queue
  builds; key the group on the ref. A flaky test in a queue blocked one queue for at least 9 hours.

## Hold it with a check

- `scripts/verify.mjs` refuses an empty fast level or a step without a command, prints each
  step's duration against `fastBudgetSeconds`, and ends by naming what the level does not
  cover. The budget is a warning, not a failure.
- The pre-push hook runs it; the session-start hook points git at the repository's hooks in a
  fresh clone; `scripts/hooks/no-verify.mjs` refuses `--no-verify`, `commit -n`, a moved hooks
  path and `HUSKY=0`.
- The CI workflow runs `node scripts/verify.mjs --full` in one job, with a 30-minute timeout;
  the merge-queue module switches pull requests to `fast` and the queue to `full`.
- Not shipped: a test that fails when a job's timeout exceeds three times its median or uses
  a floating runner label, and a lint against fixed waits in browser tests
  (eslint-plugin-playwright has one). Add them with the second CI job.

## Sources

- Experience: one multi-tenant production project at agent volume, measured in its CI and
  replayed in a cloud session (2026).
- Stripe, "Minions" part 2 (2026-02-19): linters run before the push, at most two CI rounds,
  then back to a person.
  <https://stripe.dev/blog/minions-stripes-one-shot-end-to-end-coding-agents-part-2>
- Slack Engineering (2022-02-18): most end-to-end tests moved after merge; it holds where a
  merge is not a release.
  <https://slack.engineering/balancing-safety-and-velocity-in-ci-cd-at-slack/>
- Mergify, "State of Merge Queues 2026" (2026-07-27): about 6% of private merges batched.
  <https://mergify.com/reports/state-of-merge-queues-2026>
- GitHub community discussion 15254: a queue blocked by a flaky test.
  <https://github.com/orgs/community/discussions/15254>
- Claude Code, "Configure cloud environments" (read 2026-11-22): Docker available, about 4
  vCPU and 16 GB. <https://code.claude.com/docs/en/cloud-environments>
