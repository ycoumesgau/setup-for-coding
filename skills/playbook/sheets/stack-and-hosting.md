---
title: Stack and hosting
group: foundations
reviewed: 2026-11-23
---

# Stack and hosting

An agent writes the framework it was trained on, not the one installed. An EU region chosen on
the database says nothing about where the model inference runs, which is usually somewhere else.
And a hosting default left on, such as a deploy on every push, can put code in production before
its schema exists. Each of these is decided once at kickoff, or rediscovered in an incident.

## When it matters

- At kickoff, before the first dependency is installed and the first project is created at a host.
- When a new provider is added: an inference API, an e-mail sender, a push service, a CRM.
- When an agent writes code against a framework released after its training.

## Decide

1. **The stack, frozen.** Framework, CMS or back-end, database, worker runtime, document renderer.
   Write it as a table in the contract with the reason for each line.
2. **Where data lives.** If the product handles sensitive data for EU customers, every store
   (database, files, logs, analytics, e-mail metadata, push tokens) goes to an EU region, named.
3. **Where inference runs.** A separate question, answered per provider and per endpoint, with
   its exceptions dated.
4. **Managed or self-hosted, per service.** Count who watches it at night.
5. **How code reaches a host.** Automatic deploys and previews on or off.

## Options

| Option | Gives | Costs | Choose it when |
| --- | --- | --- | --- |
| Managed hosting with automatic deploys and previews | A URL per branch, nothing to run | Code deploys before migrations; one build per push | No schema, or a schema the build applies itself |
| Managed hosting, Git deploys off, a release workflow that orders schema, deploy, smoke | Production never runs code ahead of its schema | One shared staging; the release workflow is yours | The default for a product with a database |
| Self-hosting a service (a CRM, a renderer, a worker host) | Residency and control | A runbook, a deploy workflow and a probe to keep | No managed offer meets residency, or the service must never be public |
| Inference from the provider's global endpoint | Every feature, list price | No commitment on location | No residency obligation |
| Inference from a regional EU endpoint, or a cloud's EU region | Execution in the EU | A price premium, fewer features, control plane may stay outside | Residency is a contractual or legal duty |

## Default

Pin the framework and CMS to exact versions, and say in the contract that an upgrade is a tested
change (see the dependencies sheet). Put the database, storage and functions in one named EU
region and pin the function region in the host's config. Turn Git deploys and previews off for
any app with a database: release from the main branch through a workflow that applies schema
first, then deploys, then runs a smoke test; test branches on staging. Prefer managed services;
self-host only what residency or exposure forces.

Keep the inference hosts in a closed list in code: a client cannot be built for a host outside
it, and adding one is a one-line diff seen in review. A temporary exception (demos before the
company exists, say) carries an expiry date in code: after it, the hosts become unbuildable and
a test fails.

The reason: a frozen stack protects the agents, the bill and the data. It stops being right for
a throwaway prototype, where speed beats any of the three.

## Traps

- **The framework newer than the model.** Next.js ships its own docs inside the package; read
  `node_modules/next/dist/docs/` before writing. On one project the rename of `middleware.ts` to
  `proxy.ts` was found in the installed package, not in the model's memory. Next's dev server also
  writes an agent-rules block into each app; turn it off if you write `AGENTS.md` by hand.
- **A stray `NODE_ENV`.** An inherited value broke `next build` with an unrelated `useContext`
  error. Force it in the script with `cross-env`; never assume it.
- **"EU" provider, no EU commitment.** The global endpoint of a French inference provider,
  pinned for its nationality, committed to no location at all; its own docs said so. Its regional
  endpoint cost 1.1x list price, served no batch, files or agents API, left the control plane
  outside the region, and its "EU" included EFTA countries, so Switzerland. The residency rule
  was amended to a closed list of jurisdictions.
- **No EU option at all.** The Anthropic API documents only `us` and `global` for inference
  geography, and on one project a request with `eu` was refused with a 400 naming those two
  values. The EU path runs through Bedrock or Vertex in an EU region, and even there a regional
  endpoint alone does not guarantee residency: it is a project setting. A London region is
  outside the EU.
- **Metadata leaves even when data stays.** One e-mail provider stored metadata in the US
  whatever region was chosen; one mobile push service stored device tokens in the US. Both were
  dropped for an EU sender and direct APNs and FCM.
- **Born public.** A managed database at one EU cloud host was created reachable from the
  internet; close it in the provisioning script.
- **Deploy on push.** With Git deploys on, a merge to main puts code online before the release
  workflow has applied its schema. Deploys were turned off and pinned by a test; previews went
  with them, and branches are tested on staging.
- **Self-hosting is a second product.** A self-hosted CRM needed a 117 KB runbook and went four
  days unreachable without a signal. Self-host with a probe, or do not.
- **A renderer is a billing input.** A document renderer is pinned by image digest because its
  fonts decide the page count, and the page count is billed.

## Hold it with a check

- A structure test: exact versions on the frozen packages, the EU region and `deploymentEnabled:
  false` in every host config, the database data API closed.
- The closed list of inference hosts, with a test that a dated exception past its expiry fails.
- A smoke test after each release that cannot pass without its target.
- A provider's residency claim is read from its docs and dated in the decision; no check sees a
  provider change its page.

## Sources

- Experience: a multi-tenant SaaS on sensitive data in production in the EU, with a Python
  worker calling several inference providers (2026).
- Anthropic, "Data residency" (read 2026-11-22):
  <https://platform.claude.com/docs/en/manage-claude/data-residency>
- Anthropic, "Regional compliance": <https://claude.com/regional-compliance>
- Claude Code, "LLM gateway" (read 2026-11-22): Claude Code is not supported on non-Claude
  models. <https://code.claude.com/docs/en/llm-gateway>
