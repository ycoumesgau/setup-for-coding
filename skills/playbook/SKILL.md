---
name: playbook
description: Decision sheets for starting and running a software product built by coding agents. Use it before a structural choice (repository shape, stack, hosting region, data model and migrations, authentication, multi-tenancy, async jobs, model inference, billing, i18n, design system, mobile, documentation, observability, CRM), when setting up how agents work (agent memory, verification and CI, coordination between sessions, decisions and escalation, review), and when a project meets one of these for the first time. Each sheet gives the questions to settle, the options, a default with its reason, the traps already paid for, and the check that keeps the decision true.
---

# Playbook

Open the one sheet the task needs; do not read them all. Each is under 8 KB and has the same
eight sections (`FORMAT.md`). A sheet gives a default, not an order: the project's own
constraints win, and a choice that departs from the default is written as a decision with its
reason.

When a sheet's `reviewed` date is more than six months old, check its claims about tools and
platforms against their current documentation before relying on them.

## Method: how agents work

| Sheet | Open it when |
| --- | --- |
| [Agent memory](sheets/agent-memory.md) | writing or trimming what agents load: the contract, path rules, plans, pitfalls |
| [Verification and CI](sheets/verification-and-ci.md) | setting up checks and CI, or when CI has become where failures are found |
| [Coordination between sessions](sheets/coordination-between-sessions.md) | several sessions or accounts work on one repository |
| [Decisions and escalation](sheets/decisions-and-escalation.md) | deciding what a session settles alone and what it asks; choosing a tracker |
| [Review by fresh-context agents](sheets/review.md) | setting up reviewers, or when review rounds multiply |

## Foundations

| Sheet | Open it when |
| --- | --- |
| [Product and repository shape](sheets/product-and-repo-shape.md) | choosing one app or several, a monorepo, what talks to what |
| [Stack and hosting](sheets/stack-and-hosting.md) | choosing and pinning the stack, the hosting region, where model calls run |
| [Dependencies and upgrades](sheets/dependencies-and-upgrades.md) | pinning versions, planning an upgrade, living with a patch |
| [Data and migrations](sheets/data-and-migrations.md) | the first schema, the first migration, a migration that passed in CI and failed on real rows |
| [Authentication and multi-tenancy](sheets/auth-and-tenancy.md) | the product has accounts, roles or more than one customer |
| [Security on day one](sheets/security-day-one.md) | before the first feature: the questions every project answers |
| [Privacy and GDPR](sheets/privacy-and-gdpr.md) | personal data, a new vendor, residency, captures and fixtures |

## Surfaces

| Sheet | Open it when |
| --- | --- |
| [Design system and prototype to code](sheets/design-system-and-prototype.md) | the first screen, a component kit, comparing a screen with its design |
| [Mobile](sheets/mobile.md) | deciding whether and how to ship a mobile app |
| [Internationalisation](sheets/i18n.md) | day one of any interface, and the day a second language arrives |
| [Documentation, in-app help, changelog and support](sheets/docs-help-changelog-support.md) | customers need to learn, be told what changed, and ask |
| [Billing and pricing](sheets/billing.md) | the first price, the first invoice, anything that computes money |
| [E-mail and notifications](sheets/email-and-notifications.md) | the product sends its first message |

## AI and operations

| Sheet | Open it when |
| --- | --- |
| [Asynchronous jobs](sheets/async-jobs.md) | work leaves the request: queues, workers, retries |
| [Model inference](sheets/inference.md) | the product calls a model: providers, cost, residency, measurement |
| [An agent inside the product](sheets/in-product-agent.md) | the product itself needs an agent, not only a pipeline |
| [A content MCP for every product](sheets/content-mcp.md) | content should be editable from an assistant without a code change |
| [Observability, analytics and consent](sheets/observability-and-consent.md) | errors, product analytics, audit, and what may be measured |
| [CRM and connectors](sheets/crm-and-connectors.md) | the tools around the product, driven by agents |
