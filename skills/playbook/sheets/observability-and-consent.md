---
title: Observability, analytics and consent
group: ai-ops
reviewed: 2026-11-23
---

# Observability, analytics and consent

Errors, product analytics and audit answer three different questions: what broke, what people
do, and who did what to which record. Put in one tool, each is served badly: the audit lives in
a vendor's retention window, analytics records sensitive screens, and nobody is woken when a
background job stops. Consent decided page by page drifts within a release.

## When it matters

- At kickoff, before the first SDK is installed.
- When a screen starts to show sensitive or personal data.
- When a worker, a cron or a self-hosted service is added: each one needs a signal.

## Decide

1. **Three stores.** Errors in an error tracker; product analytics in an analytics tool; audit
   in an `events` table in the product's own database, append-only.
2. **The audit schema, once.** Settle the generic link (`subject_type`, `subject_id`) before
   the first write: changing it after rows exist cannot be repaired.
3. **The consent policy, per surface.** What is measured without consent, what after consent
   or login, where marketing tags may run.
4. **What never leaves.** A filter shared by every SDK, server and worker alike.
5. **Who is woken, by what, with what content.** And what stays a dashboard.
6. **How the product shows progress.** "Working" and "stuck" must look different to the user.

## Options

| Option | Gives | Costs | Choose it when |
| --- | --- | --- | --- |
| Logs only | Nothing to set up | No alert, no aggregation; nobody reads them | Never past a prototype |
| One tool for everything | One bill, one SDK | Audit held by a vendor; analytics sees what errors see | A throwaway internal tool |
| Error tracker + analytics + own `events` table | Each need served; audit stays with the data | Three integrations, one filter to maintain | The default |

## Default

Sentry in its EU region for errors, traces sampled (10% on one project). PostHog Cloud EU for
analytics. An `events` table whose append-only rule is enforced by a database trigger, not by
convention.

Consent, decided once and written in one file: cookieless measurement always (memory
persistence, a first-party relay that forwards neither IP nor cookies, Global Privacy Control
and Do Not Track honoured); enriched measurement (persistent id, `identify`) only after
analytics consent on the public site, or after login in an app; marketing tags only on the
public site, only after marketing consent. Never call PostHog's `opt_out_capturing()` on a
refusal: it also stops the cookieless events. No autocapture and no session replay on any
screen that shows sensitive data; on one production project the app sends no automatic event
at all, whatever the project settings say, and usage is measured server-side by closed event
codes, never a URL or typed text.

Make progress a product requirement: every long task exposes its progress in real time, to the
user and to operations.

Alert on: an uptime probe per surface on a health route; a check-in per cron and per worker
machine; new or regressed errors in production. A health route separates what makes the
surface fail (its database, its storage) from what it sees of a neighbour, which never changes
its status code. An alert message carries kind, environment, surface and a link, never the
error text, which may hold personal data. No error-rate or latency threshold was set on
these projects: alerts fire on absence (a missed check-in) and on new errors. The limit: when no one reads analytics yet, skip it
and keep the `events` table.

## Traps

- **A worker stopped for 2.5 days, found by hand.** No probe, no cron monitor, no alert on a
  queue growing old; the only reader of the jobs table was a session. Give every worker a
  check-in.
- **Three green instruments, a dead service.** A self-hosted CRM showed "Running" in the cloud
  console, "Up" in Docker and healthy in its app, while nothing listened on 80 or 443: four
  days, zero signal. Probe the service from outside, as a user reaches it.
- **The probe that was never scheduled.** A 30-minute probe was refused for its cost (about
  1,440 CI minutes a month) and left on demand: continuous monitoring of that service is wired
  nowhere. Use an uptime service, not CI minutes.
- **The privacy filter broke the error stream.** It wrote to a property that had only a getter:
  5,703 error events in six days, from the filter itself. Filter a copy, and send a skeleton
  event when the filter throws, never the raw one.
- **Rules that do not reach logs.** A log drain to the error tracker was switched off because
  the scrubbing rules apply to events, not to logs.
- **The alert needs the database it reports on.** A saturated pool would have silenced alerts:
  send the message without touching the database, and acknowledge the webhook at once.
- **A scheduled job that never starts has no alert**, its own failure alert included.
- **A monitoring rule written and never wired.** On a consumer project, "always add
  monitoring" was in the always-loaded rules; an audit found 0 error captures in 25 video
  routes.
- **Consent not finished.** A cookieless setup still owed user information, a processing
  agreement and a retention period before it could claim the consent exemption.

## Hold it with a check

- A test that every scheduled workflow carries a failure-alert job, or a written exemption.
- Shared test vectors run against the filter in each language (TypeScript and Python here).
- A database test that an update or delete on `events` fails.
- A test that the app's analytics init has autocapture and session replay off.
- A closed list for alert fields, tested: a value outside it becomes a fallback, never a copy.

## Sources

- Experience: a production multi-tenant SaaS with sensitive data in the EU, and a consumer
  platform with a written consent policy (2026).
- Global Privacy Control; Do Not Track; the CNIL guidance on audience measurement exempt
  from consent.
