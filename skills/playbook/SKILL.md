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
