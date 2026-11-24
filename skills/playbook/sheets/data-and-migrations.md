---
title: Data and migrations
group: foundations
reviewed: 2026-11-23
---

# Data and migrations

A schema that several writers change, through two tools, on branches that merge in any order,
breaks in production in ways CI never sees. Migrations green on an empty database fail on the
first table with rows; two branches each add a migration and the generated snapshots disagree;
a framework offers to drop a table it was never told about. Each of these has a check that
catches it.

## When it matters

- At kickoff, before the first table: who owns the schema and who may write the domain.
- When a second tool (raw SQL, a queue, an extension) starts to own tables next to the framework.
- When the first real rows exist: from then on, an empty-database replay proves less.

## Decide

1. **One write path to the domain.** Every write goes through the application layer, where
   access rules and hooks run. A background worker writes through it too, with a service
   account; it writes SQL only to tables the framework does not own.
2. **Who owns each table.** If a framework (Payload, Prisma, Drizzle) owns some tables and raw
   SQL owns others (an event log, a job queue), keep two pipelines, each with its own
   migrations, and say in one document which table belongs to which.
3. **How the framework learns about foreign tables.** Generate a bridge or types from the SQL,
   never write it by hand, and fail when the generated file differs from the committed one.
4. **Migrations only, outside a developer's machine.** Schema push is a local convenience; CI
   and production run committed migrations, nothing else.
5. **How money and time are stored.** Amounts as integers in minor units (cents), with the
   currency beside them; costs that are fractions of a cent in an integer micro-unit, rounded
   up.
6. **Which records are append-only.** Where the product promises a trail (an audit log, a
   signed record, a ledger), say so now and enforce it in the database.

## Options

| Option | Gives | Costs | Choose it when |
| --- | --- | --- | --- |
| Framework owns every table | One pipeline, one tool | Queues, event logs and extensions fit badly | No raw-SQL table is needed |
| Two pipelines, a generated bridge | Each tool does what it is good at | A ritual per change, a drift check | A framework and SQL both own tables: the default for a SaaS with a job queue |
| SQL only, no ORM migrations | Full control | Access rules and hooks must be rebuilt by hand | A service with no admin back-office |
| Replay on an empty database | Catches a chain that no longer builds | Says nothing about rows | Always, from day one |
| Replay on a populated database | Catches migrations that reject existing rows | A synthetic data generator, a second job | As soon as staging or production has rows |

## Default

Two pipelines when two tools own tables, each declared in one schema document. The bridge
generated, compared in CI. Committed migrations only in CI and production, replayed from an
empty database on every change that touches the schema; a populated replay once real rows
exist. A migration is never edited after it ran anywhere. Integer minor units for every
amount. Append-only records held by a database trigger, with the access rule refusing first.

The reason: a migration is code that runs once against data nobody can recreate. The limit:
the populated replay costs a generator and a CI job; on a prototype with no rows, skip it.

## Traps

- **Green on empty, red on rows.** On one production project two migrations passed CI on the
  same day with `ADD COLUMN ... NOT NULL` and no default, legal on an empty table. The first
  failed on staging's seven rows; the second, written hours later by someone who knew, was
  caught only by review. The generator diffs config against a snapshot; it knows nothing of
  rows, and every replay started from an empty database. Remedy: a job
  that migrates the last released schema, seeds one synthetic row per table (generated from the
  catalog, not hand-written), then applies the branch's migrations. It proves itself by
  replaying a known-bad migration that must fail.
- **Seed migrations written with today's model.** On a consumer project, seed migrations built
  their SQL from the current config, not the schema of their time: on an empty database the
  chain stopped at the first seed, and two others, wrapped in `try/catch`, exited green having
  seeded nothing. Never seed through the ORM inside a migration.
- **Snapshots do not merge.** When two branches each add a migration, the ORM's snapshots
  conflict silently. The rule that held: the branch that lands second deletes its migration and
  its registry entry, merges `main`, and regenerates. Generate a migration on the last push, not
  the first.
- **The framework drops what it does not know.** Without the generated bridge, Payload proposes
  to drop the SQL-owned tables at the next migration.
- **A check that evaluates to NULL passes.** A polymorphic `CHECK (a OR b)` is satisfied by
  NULL; write `CASE ... ELSE FALSE`.
- **Deletion protections by accident.** An audit on one production project found that every
  barrier against deleting a record was a side effect of a `NOT NULL` or `CHECK` added for
  another reason. Declare append-only on purpose.
- **A refusal that surfaces as a 500.** A worker retries 5xx as an outage, so a write refused
  by a database trigger alone comes back again and again. Refuse first in the access rule or a
  hook with a 4xx; the trigger stays the authority for direct SQL.
- **An exemption to the check.** A pre-commit migration check on a consumer project could be
  skipped by an environment variable, and its own documentation said how.

## Hold it with a check

- CI replays the whole chain from an empty database, with the current config.
- A drift check: config matches the last snapshot, the snapshot exists, no framework DDL
  targets a SQL-owned table.
- The generated bridge and types regenerated in CI and compared byte for byte.
- A populated-replay job that must see a known-bad migration fail.
- An import lint, with a test that feeds it a violation, refusing the ORM or a database driver
  in every app that must go through the API, and query calls from the browser client.
- A test that each migration has its committed snapshot and that no framework migration
  carries DDL for a SQL-owned table.
- A database test that an update or delete on each append-only table raises.
- "Never edit an applied migration" had no check on the source projects; review held it. A
  candidate: record a hash of each migration once released, and fail CI when one changes.

## Sources

- Experience: a multi-tenant SaaS in production with two schema pipelines and a few hundred
  migrations in three months, and a consumer platform whose seed migrations broke an empty
  replay (2026).
