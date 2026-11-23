---
title: An agent inside the product
group: ai-ops
reviewed: 2026-11-23
---

# An agent inside the product

An agent that acts for users inside the product is a probabilistic writer with access to the
domain. Without a contract it applies half-valid output, spends without a ceiling, does
irreversible things on a guess, and a demo path hides that none of it works.

## When it matters

- When a pipeline step needs judgement that heuristics keep getting wrong.
- Before an agent gets any tool that writes, sends, publishes or spends.
- Before a demo, a pilot customer, or switching a stubbed path to live.

## Decide

1. **Agent or pipeline.** A fixed sequence of model calls is a pipeline; use an agent only
   when the path depends on what it sees (reading layouts, iterating on a render).
2. **What the agent produces.** A closed, versioned document checked by code, never the
   final artefact.
3. **What it may touch.** A closed list of tools; for each, what code forces or refuses.
4. **Which acts need a person.** Everything irreversible or outward: send, publish, sign,
   delete, spend beyond a cap.
5. **How a run is bounded.** Rounds, input size, wall time, cost.
6. **How it is evaluated before release**, and what turns it off.

## Options

| Option | Gives | Costs | Choose it when |
| --- | --- | --- | --- |
| Pipeline of model calls with code between them | Predictable cost, simple tests | No adaptation | The steps are known in advance: the default |
| Agent writes a spec, code compiles and guards | Judgement from the model, guarantees from code | A schema and a compiler to maintain | The output has structure the code can check |
| Agent runtime with its own workspace (files, Git), app validates artefacts | Long creative work, swappable runtime | Two places to sync; the runtime may truncate output | Multi-step planning over many artefacts |
| Agent with direct write tools to the domain | Least code | Every guard must live in the tool layer | Only with a closed tool list and write guards |

## Default

The model composes, the code compiles and guards. The agent returns a JSON document under a
versioned schema (a closed set of block types, bounded lengths and depth); a deterministic
compiler turns it into the real artefact and refuses anything out of schema rather than fixing
it silently. A verification loop is bounded (two correction rounds on one production project),
each round a journaled model call under the tenant's cap. On any failure (provider down, cap
reached, spec refused) the product falls back to the previous path and says so.

The agent holds no credentials for paid or outward APIs: it proposes, the app validates and
executes. This stops being enough when the agent must browse or run code; then its sandbox
gets pre-signed URLs only, never a service key.

## Traps

- **Invalid output applied.** On an older internal tool the agent wrote artefacts that the
  app validated with Zod; every artefact, valid or not, was stored with its SHA-256 and its
  errors, and an invalid one was never applied, with its errors shown. Keep this: store,
  show, never partially apply.
- **Invented content (a risk, guarded before it was seen).** An agent that composes a document
  layout from sample documents may write fixed text that none of them contains, and it would
  read as plausible. On one production project a guard requires every fixed string to appear
  in the samples' text or OCR; any other is removed and counted, never kept "to see".
- **The runtime lost the output.** The agent SDK did not return full contents of large JSON
  files. Checkpoints moved to Git: a branch per item and conversation, one commit per
  finished checkpoint, a final machine-readable block naming branch and commit, and the app
  reading files at that exact SHA. Switching conversation flips an `is_active` flag (a
  partial unique index keeps one active) and destroys nothing; paid assets stay shared.
- **Write tools without guards.** On a CMS exposed to agents through MCP, writes to versioned
  pages are forced to draft whatever the client asks, a campaign's status can never advance
  (sending is human), and no delete tool exists. The guards are a separate plugin, so a kill
  switch on the MCP endpoint does not remove them.
- **The demo hid that nothing worked.** On the older tool the planning engine defaulted to a
  stub: ingestion and planning events were never emitted and nothing was persisted, while the
  runbook marked the matrix "Implemented" with "12 of 12 unit tests" passing; the QA had been
  written by the agent that wrote the code. Default to live; make a stub an explicit opt-in;
  have a reviewer without the author's context check the claim. A dated "demo" exception on
  another project ended up carrying every high-value step: give it an end date in code.
- **Retries that pay again.** A default retry relaunched a billed generation; see the
  asynchronous jobs sheet. Show the model before a paid call; never fall back silently.
- **Prompt changes nobody saw.** User feedback became a diff of the prompt, applied only after
  explicit approval, with before, after and diff stored.
- **A cost log that was rewritten.** Debit was logged at start and a refund as a negative row,
  but both "started" and "succeeded" rows carried the debit, and the fix patched existing rows
  against an append-only rule. Decide which operation carries the charge before the first
  row, and add a blocking cap: warnings and a manual pause were the only brakes there.

## Hold it with a check

- Tests feed the compiler and the artefact validator out-of-schema and invented content and
  expect a refusal, never a repaired output.
- A test lists the agent's tools and fails on a new one, a delete, or a write not forced to
  draft.
- An endpoint for an external agent compares its bearer token in constant time and answers
  503 when the token is not configured.
- A test fails if a stub or demo mode is the default outside tests.
- Release gate: measured on the production path against a reference a person validated; if
  it does not beat the baseline, the feature stays behind a switched-off setting.

## Sources

- Experience: a multi-tenant SaaS in production with a layout-composing agent, an internal
  tool driven by a planning agent, and a CMS exposed to agents through MCP (2026).
