---
title: Model inference
group: ai-ops
reviewed: 2026-11-23
---

# Model inference

A model call is a paid, variable, third-party dependency that sees customer data. Scattered
through the code it becomes a cost nobody can attribute, a model nobody chose on evidence, and
a residency claim nobody can prove.

## When it matters

- Before the first call to a model, and before each new provider.
- When someone wants to "just try" another model or a newer alias.
- When a customer, a contract or a regulator asks where data is processed.
- When a bill arrives that nobody can split by customer or feature.

## Decide

1. **Where calls may run.** A closed list of hosts, or "anywhere"; who may change it.
2. **Which provider and model per step.** A step is a named unit of work (OCR, extraction,
   classification), and each has its own choice.
3. **What each call records.** Step, model, endpoint actually called, job, prompt and rule
   versions, tokens, duration, cost; never the content.
4. **What stops spending.** A cap per tenant and per feature, read before the call.
5. **How a model change is proven.** A bench, its ground truth and its threshold.
6. **What code guarantees around the output.** Schema, totals, deduced fields, anomalies.

## Options

| Option | Gives | Costs | Choose it when |
| --- | --- | --- | --- |
| First-party provider APIs, direct | Newest models, simplest contracts | The Anthropic API offers `us` or `global` processing, no EU zone | No residency duty, or an exception with an end date |
| Same models through a cloud in an EU region (Bedrock, Vertex) | Processing region set by endpoint | Cloud account, IAM, per-region model availability; a cross-region EU profile fixes a geography, not a region | Residency is a contractual duty |
| EU providers of open models (Mistral, OVHcloud, Scaleway) | EU processing at low price per token | Catalogues change fast; quality to measure per step | The step is bounded and the bench says it is good enough |
| Self-hosted open models | No provider | 4 to 8 high-end GPUs for a top open model, weeks of tuning, on-call, licence and weight-integrity tracking; on dedicated hardware, one published total-cost measurement found it about 44% dearer than a cached API | Third-party estimates put the threshold at a few hundred engineers; or a small model for a bounded task on data that cannot leave |
| A gateway in front of all of it | One endpoint | One more processor and supply chain: a popular gateway package was compromised twice on PyPI in 2026 | Only when routing is the need |

## Default

One module owns inference. One file maps each step to provider, model, limits and price, and
nothing else in the code names a model. Models are pinned by dated identifier, never a
`-latest` alias, and only identifiers seen in the account's own catalogue. Hosts come from a
closed list compared byte for byte: a host outside it cannot be constructed, and the worker
refuses to start. Use several providers, chosen per step on measurement: two readers of
different families caught errors that two models of one family confirmed together.

The closed host list is for when a location duty exists; without one, a reviewed constant is
enough. A solo founder should not self-host a top model.

## Traps

- **An alias makes drift invisible.** The API echoes the identifier sent, so under an alias a
  model change cannot be observed. A pin copied from public docs did not exist in the account;
  another vanished from a regional catalogue. Check pins against the catalogue on a schedule.
- **Cost computed after the call.** A model with no recorded price paid, then failed. Record
  the price (with source and date) before moving the pin, store cost as integer micro-units
  rounded up, and refuse a call with no price. A guessed price was off by a factor of 3.5.
- **A journal row inside the job's transaction.** A rollback would erase a call that was
  paid. Write the call journal in its own transaction.
- **One global cap.** Forgotten, it blocks every customer at once. Cap per tenant and per
  feature, on a month, day or lifetime window, raisable without a deploy; a global cap only
  for tooling that belongs to no tenant.
- **Provider error text shown or logged.** It is free text from a third party. Keep the status
  and a code from a closed character set; cut the cause chain.
- **The exception became the regime.** A dated "demo" exception for non-EU processing ended up
  carrying every high-value step, through five widening amendments, and one amendment let calls
  skip the journal. An exception expires by date in code (a test turns red the day after, the
  hosts become unconstructible) and suspends residency only, never the journal or the cap.
- **Asking the model what code can deduce.** A model read one party of a document right 3 times
  of 3 and the other not; the second is now deduced in code. Totals are computed, never
  checked against a model's figure. Checks emit anomalies as data: they block the final
  approval, not the review.
- **A noisy bench decides.** A bench on a mixed set of test images inverted the verdict
  between two models (36.7 false OKs against 1.0). Run three draws and accept a change only
  beyond the noise measured between two runs of the same bench (3 points). Publish each score
  beside a trivial baseline. Keep "false OK = 0" as the one absolute threshold. Cache paid
  answers: rerunning a bench without them cost 18.46 USD. Publish the full command: `VAR=0`
  enabled a variant because "0" is truthy.
- **A judge from the same family as the judged** shares its bias. Use another family, blind,
  asked in both orders.
- **What the bench does not prove.** A bench that measured only missed matches let 101 false
  matches through a screening step on the first real batch. Give each bench a "what this does
  not prove" section.
- **Narrative in the mapping file.** It grew to 1,619 lines, mostly dated history, read by
  every agent. The file holds rules and a link; history goes elsewhere.

## Hold it with a check

- A test fails if any module outside inference names a model or a provider host.
- A load-time check refuses a step whose declared setting is not sent, a model without a
  price, an alias, or a pin not in the catalogue snapshot.
- A test turns red the day after each dated exception expires.
- A test pins the journal's keys and that it has no content field.
- Benches are pure, byte-stable reports, and refuse real data when `CI` or a cloud-session
  variable is set: they run where the data lives, never in CI.

## Sources

- Experience: a multi-tenant SaaS in production calling several providers from a worker, and
  a consumer platform translating content with models (2026).
- Anthropic, "Data residency": `inference_geo` accepts `global` and `us` only (read
  2026-11-22). <https://platform.claude.com/docs/en/manage-claude/data-residency>
- Anthropic, "Regional compliance": Europe listed for Bedrock and Vertex.
  <https://claude.com/regional-compliance>
- Pegatron, arXiv 2607.13080 (2026-07-13): self-hosted open model against an API model over
  28 days each; in total cost, a dedicated reservation came out 43.8% above the cached API.
  <https://arxiv.org/html/2607.13080v1>
- LiteLLM compromises on PyPI (March and October 2026), as reported by BleepingComputer and
  StepSecurity.
