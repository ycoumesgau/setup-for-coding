---
title: Coordination between sessions
group: method
reviewed: 2026-11-23
---

# Coordination between sessions

A project built by agents has many sessions running at once, sometimes on several accounts
that cannot message each other. Left alone, two sessions edit the same file, each believes it
is alone, and the second to merge pays for both. The instinct is to add a lock or a registry;
both fail in ways that have been measured.

## When it matters

- At kickoff, when deciding how a request becomes work.
- When more than a few sessions run at once, or a second account starts working.
- When merge conflicts start landing on the same few files.

## Decide

1. **The unit of work.** One task, one session, one branch, one pull request. The lots of one
   request are commits on that branch, not pull requests of their own.
2. **Isolation or reservation.** Each session works in its own clone and conflicts are
   resolved at merge, or sessions reserve files or tasks before writing.
3. **How a session learns what others touch.** Ask them, read a registry, or derive it from
   what they already push.
4. **Announce before or after.** Reserve before writing, or describe a finished change to
   whoever it affects.
5. **Which files every branch appends to.** Indexes, registries, shared plans: they are where
   conflicts come from, and the cure is structural.

## Options

| Option | Gives | Costs | Choose it when |
| --- | --- | --- | --- |
| Isolation, conflicts at merge, a map derived from pushed branches | No state to keep; works across accounts; a few seconds per check | Sees only pushed work, not meaning | The default |
| A lock or claim file committed to the repository | Visible reservations | Locks held too long or never released; the file itself conflicts | A handful of agents on one machine |
| Locks through custom git refs (compare-and-swap on push) | Atomic claims with no server | Refused by some session proxies; leases to expire and recover | Every session can push arbitrary refs |
| A coordination server (mailboxes, file leases) | Negotiation mid-task | A server, tokens per account, outbound network, a young project to depend on | Sessions must negotiate during a task, which research has not shown |
| The tracker as control plane, one orchestrator launching agents | Automatic dispatch | A permanently running host; ticket assignment is not atomic | One tracker, one host, and dispatch is the bottleneck |

## Default

Isolation. Each session has its own clone and branch, pushes its branch often (a push without a
pull request costs nothing and starts no CI), and opens the pull request when the work is
done. Before a push, `node scripts/overlap.mjs` lists the live branches that changed the same
files; read their diff before editing a shared file, or split the work. After merging a change
to an interface others use, describe it in the pull request and comment on the branches the
map shows. No file that every branch appends to: one file per lot, indexes generated rather
than committed. Delete branches at merge. The repository and its pull requests are the only
channel every account already shares, so nothing else is needed. This stops being enough when
sessions sit idle waiting for ready tasks: then the splitting of work is the bottleneck, and a
planner earns its cost.

## Traps

- **The conflicts are registries.** On one production project, among 7 live branches, 13 of
  the 21 pairs shared at least one file, through 16 files out of 676. The most shared were
  all registries: a documentation index, a migrations index, a gallery list, a shared plan, a
  lint configuration. Remove the shared file; a lock on it only queues the sessions.
- **Locks slow everyone.** Peer agents coordinated by a shared file and locks held them too
  long, crashed while holding them or skipped them: twenty agents ran at the throughput of two
  or three. In a 2026 study, reserving files before writing raised integration success but
  serialized 96.7% of runs.
- **Announcing after works.** In a 2026 study on constructed tasks, a message describing the
  finished concurrent change recovered 82% of runs; on 417 real pairs of pull requests, only one
  run of 834 showed any interference.
- **Ref locks are not available everywhere.** From a cloud session, pushing a custom git ref
  was refused by the session's proxy with HTTP 403.
- **Messaging stops at the account.** Claude Code's cross-session messaging is documented for
  a user's own sessions; sessions on two accounts could not reach each other.
- **Forgotten branches look alive.** Branches merged by squash and never deleted made about
  100 "live" branches in 14 days. Ignoring files that no longer differ from the base cut the
  files shared by several branches from 503 to 260.
- **One cache, seventy seconds.** Reading a remote of more than 500 branches takes about four
  seconds in two caches (branch tips, then history without file contents). Kept in one, the
  tip commits fetched without trees made the server believe the trees were present, and each
  diff downloaded them one by one: 70 s.
- **Splitting beats locking.** A team of 16 agents claiming tasks by lock files broke down
  when every agent chased the same failing case; the fix was a new split of the work against
  a reference oracle, not more locks.

## Hold it with a check

- `scripts/overlap.mjs` derives the map from the remote's branches: it prints the branches
  that touch your files, `--all` lists the files changed by several branches, and the
  pre-push hook runs it. It informs; it never blocks a push.
- The contract's Method section holds the unit of work and the rule against appending to a
  shared file. No check refuses an edit to a registry: remove the registry instead.
- `scripts/agent-memory-check.mjs` caps plan files, so a shared plan cannot become the place
  every session writes.
- The merge-queue module serializes CI runs on the default branch, so no session has to watch
  for another's run.

## Sources

- Experience: one production project and its cloud sessions on several accounts, with the
  overlap map measured on its remote (2026).
- Cursor, "Scaling agents" (2026-01-14): a shared file with locks failed; locks were held too
  long or never released.
  <https://cursor.com/blog/scaling-agents>
- Anthropic, "Building a C compiler" (2026-02-05): lock files in git, and their limit.
  <https://www.anthropic.com/engineering/building-c-compiler>
- arXiv 2608.00947 (2026-08-02, preprint): admission before writing serializes runs.
  <https://arxiv.org/abs/2608.00947>
- arXiv 2609.25396 (2026-09-21, preprint): interference between concurrent agent changes.
  <https://arxiv.org/abs/2609.25396>
- Claude Code, "Cross-session messaging" (read 2026-11-22): messages between a user's own
  sessions.
  <https://code.claude.com/docs/en/cross-session-messaging>
