---
title: Asynchronous jobs
group: ai-ops
reviewed: 2026-11-23
---

# Asynchronous jobs

Anything slow, paid or fragile that runs inside a web request is lost when the request ends,
and a retry layered on top pays twice. Most failures here are not crashes: they are jobs that
silently never started, ran twice, or look busy while nothing moves.

## When it matters

- Before the first call to a model, a renderer or any paid API.
- When a hook or a route "fires and forgets" a background call.
- When someone turns retries on, or off.
- When the worker is deployed for the first time, or goes quiet.

## Decide

1. **What leaves the request.** Anything that can outlast the platform's time limit, costs
   money, or calls a third party. The request only records the intent and returns.
2. **What makes each step replayable.** An idempotency key per effect (a unique key on the
   billing row, the provider's task id, a per-record write), settled before retries exist.
3. **How intent becomes a job.** Persist, then deliver, in the same transaction as the
   business change.
4. **Where jobs run.** A queue in the database, a hosted workflow engine, or a separate
   worker process (table below).
5. **How "working" differs from "stuck".** A heartbeat in the database, a bound on every
   wait, a sweep that requeues, an alert when the worker is silent.
6. **What happens after the last attempt.** A failed state people can see, a classified
   cause, and a way to replay one job.

## Options

| Option | Gives | Costs | Choose it when |
| --- | --- | --- | --- |
| Queue in the database (pgmq, or a jobs table) and a worker | Enqueue in the same transaction as the domain write; state queryable in SQL; no new vendor | You write the sweep, heartbeat and alerting | Postgres is already there: the default |
| Hosted workflow engine (Inngest and the like) | Memoised steps, retries, cron, a run viewer | Plan limits shape the design; steps in the wrong place explode the run count | Fan-out and multi-step sagas in TypeScript, short steps |
| Separate long-running worker process (its own host) | Any runtime, native tools, private network to a renderer | A second deployable with its own release | Work needs Python, a browser or a private service; no serverless candidate fits |
| Serverless function with a long timeout | Nothing to operate | Hard ceiling, no supervision | Short, idempotent, free work only |

The worker process and the queue combine: the queue says what to do, the process does it.

## Default

A jobs table plus a queue in the same Postgres, written in one transaction with the business
change. Messages carry IDs only; the worker reads the rest from the database, so moving to a
hosted engine later changes the transport, not the contract. The worker writes the domain
through the same API as every other client, under a service identity with an enumerated
scope, so hooks, validation and audit run for it too; it writes SQL only to its own tables.

It stops being the right choice when the work is mostly short fan-out steps in TypeScript with
no special runtime: a hosted engine is then less to build, provided each paid step is
memoised and the plan's limits are read before the design.

## Traps

- **Retries off instead of idempotence.** On an older project every paid function had
  `retries: 0`, because a retry relaunched a billed video task. Result: five `recover-*`
  scripts for tasks that succeeded at the provider and were never saved, one named after a
  single video and rebuilt from the cost log, and a backfill for double-charged cost rows.
  A sibling project kept `retries: 3` safely by making every effect replayable first.
- **Fire-and-forget from a hook.** A save hook sent the event directly and swallowed the
  error; there was no event id and no per-document concurrency key. Separately, concurrent
  updates to one document returned 208 responses with HTTP 200 while about 42 of the writes
  persisted. Use an
  outbox, serialise writes per record, and read back after writing: a 200 is not a write.
- **A queued job with no message.** If the job row and the queue message are two commits,
  a crash between them leaves a job that no poll will ever see. One transaction.
- **A health check that proves the wrong thing.** A local `200 OK` proves the process is
  alive, not that a job advances. Health is a heartbeat column; a sweep requeues `running`
  jobs older than 90 s, up to 3 attempts. One production worker was down about 2.5 days with
  no alert; after that, a scheduled check reads the jobs table and mails once per episode.
- **Frozen, not dead.** A native call holding Python's global lock froze the whole process;
  `restart=always` only restarts a process that exited. A parent process now restarts the
  child when a pipe heartbeat is silent for 120 s. Add this at the first freeze, not on day one.
- **Unbounded waits.** A 429 meaning "no credits" was retried for hours: it shares its status
  with a rate limit, but it is permanent. Classify every failure as permanent or transient
  (as a rule a 4xx is permanent, a 5xx or a timeout transient) and retry only the transient
  ones. Set each unit's
  timeout above the provider timeout times (1 + retries): a 120 s limit killed the slowest
  locale every time.
- **Steps at the wrong grain.** Wrapping every model call as its own engine step produced about
  6,000 unreadable runs. Bound parallelism inside a step; keep steps for effects.
- **More machines, same queue.** The provider limit was per organisation and per model
  (0.25 requests/s measured): adding workers only moved the queue. A priority lane for
  interactive work (25 s wait for 3 s of model) needs an anti-starvation burst.
- **Plan limits rewrite the design.** A free plan capped concurrency at 5 and pushed a
  recovery cron from every 5 minutes to once a day, while the written rule still said 5.
- **The worker does not follow the release.** Merging worker code ships nothing; a dispatch
  deploy that refuses while a job is in flight, then reads back a readiness marker from the
  host, is what ships it.

## Hold it with a check

- An integration test against a real queue: kill the worker with `SIGKILL` mid-step, start a
  new one, and assert the job is visibly `running` with a stale heartbeat, then `succeeded`,
  with exactly one event per step (nothing replayed, nothing skipped).
- A test that enqueue writes the job and its message together, and one that a permanent error
  is not retried.
- A lint or test that no request handler calls a paid client or the queue's send outside the
  enqueue helper.
- The deploy workflow fails unless the readiness marker is read back.
- Not enough: one project's only workflow test was a 47-line import smoke test, while its
  merge and write-verification code had none.

## Sources

- Experience: a multi-tenant SaaS in production with a Postgres queue and a separate worker,
  a consumer platform on a hosted workflow engine, and an internal tool generating paid
  video (2026).
