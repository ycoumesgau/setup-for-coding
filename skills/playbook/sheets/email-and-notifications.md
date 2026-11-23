---
title: E-mail and notifications
group: surfaces
reviewed: 2026-11-23
---

# E-mail and notifications

A message sent from inside a web request is lost when the function stops, sent twice when the
request is retried, and leaves no trace of either. Left to chance, each feature grows its own
sending path, links point at whatever host served the request, and a test run mails a real
customer.

## When it matters

- Before the first e-mail is sent, including the sign-up and password e-mails of the auth
  provider.
- When a second channel (push, in-app, SMS) or user preferences are added.
- When someone proposes to send "just this one" directly.
- When staging starts sending.

## Decide

1. **One path.** Every message goes through an outbox: a database table written in the same
   transaction as the business change, drained by a worker. No exception.
2. **Who decides delivery.** One pure function takes the message, the recipient's preferences
   and hours, and returns per channel: send now, not before an instant, or skip with a reason.
3. **Where templates live.** As content in a CMS (blocks, drafts, publish), or as code.
4. **The provider.** Judge it by the classes of traps it absorbs (suppression on bounce,
   delivery events, unsubscribe compliance) and by where it stores data, then by price.
5. **Domains.** A sending subdomain per flow and per environment.

## Options

| Option | Gives | Costs | Choose it when |
| --- | --- | --- | --- |
| Send from the request | Nothing to build | Lost on timeout, doubled on retry, no audit | Never, on serverless |
| Outbox in your database, drained by a cron and an after-commit hook | Nothing lost, idempotent, auditable | A table, a drain route, a schedule | The default |
| Queue or workflow engine (Inngest, pgmq) behind the outbox | Retries, fan-out, visibility | Another service and its quotas | Many steps per message |
| Bare transport (Amazon SES) | Cheapest per message | You build suppression, bounce handling, unsubscribe headers | High volume and a team to run it |
| Transactional provider with built-in blocklist and events | Absorbs the traps above | Price per message; check data residency | Low to medium volume |

## Default

An outbox table with a unique `idempotency_key` built from business facts, one write gate, and
IDs only: the message is composed when it leaves, so a template fix reaches queued messages.
Claim rows in one transaction, call the provider outside any lock, record the verdict in a
second transaction, with a lease between them. `attempts`, `max_attempts`, a backoff written as
an explicit list, and a terminal `failed` state with a cause from a closed list. Three
triggers: right after the producer commits, a host cron every minute as the safety sweep, and
a manual dispatch for environments where the host runs no cron. The drain runs on the server
that owns the data; a CI runner only calls it with a service key and turns red on a 503 or a
`failed` row.

Templates are content: editable without a deploy, held to the same vocabulary rules as the
product, with a generated plain-text part. An agent may edit and publish a template through the
CMS's MCP server; it may not create, delete or send. Push goes straight to APNs and FCM, with a
fixed text that names no one and no token in the queue. Preferences are stored as append-only
rows of differences from the coded default: the record of an objection is evidence.

The reason: nothing is lost, nothing is sent twice, every send has a row. A newsletter is a
different product: a marketing platform on its own domain, never rebuilt in your CMS.

## Traps

- **The only exception was the only unreliable send.** On an older consumer project, three
  of four sending paths had no idempotency, one trigger fired twice, unsubscribe links pointed
  at routes that did not exist, the suppression list was never read, transactional bounces
  were lost and DMARC was never set. The one fire-and-forget path left was the one that lost
  mail. The successor removed the exception instead of inheriting it.
- **A daily safety cron.** The same project's rule said the retry cron ran every 5 minutes; the
  code ran it once a day at 06:00, to fit a free-tier quota. A message whose first attempt
  failed could wait until the next morning. Check the schedule in the code, not in the rule.
- **A webhook that answers 200 and records nothing.** One provider publishes events to an
  SNS-style topic, not to a URL: the subscription stays pending until confirmed from a received
  message, and the event sits inside an envelope. The first route rejected the confirmation and
  would have read nothing. Deduplicate on the envelope's message id, never on (message, event):
  a `deferred` event legitimately repeats, and the event log is append-only.
- **Weeks-old notifications.** Without expiry, push rows held back by a missing key or an
  outage would all fire at once weeks later, about cases already closed. A push row older than
  24 hours never leaves; for a subject held by working hours, the 24 hours run from the next
  opening.
- **Links from the request's host.** A base URL derived from the incoming `Host` header is an
  open redirect steered by the caller. Build every link from configured base URLs; when the
  variable is missing, the code refuses to compose the link instead of guessing one.
- **Staging manufactures bounces.** Staging sends to test addresses by design. Give it its own
  sending subdomain, so its bounces never hurt the reputation of the domain that sends login
  links. With strict DMARC alignment, a production `From` on staging fails on every send.
- **A sending tool for agents.** No provider MCP is connected: a tool that sends breaks the
  rule that sending is triggered only by product code. A provider's MCP is an anti-criterion.

## Hold it with a check

- The source project holds "one path" with types and review, not a scan: the enqueue
  function accepts only a branded type that the delivery gate produces, so a forgotten gate
  does not compile. It prevents the omission, not a wrong decision: the drain
  re-reads preferences and hours at send time. We also recommend a lint or test that fails on
  any call to the provider's send function outside the drain; it was not built there.
- Server-side guards on template writes: refuse a malformed or unknown token, a token in a
  subject, a forbidden term, and a write that drops a template's link token.
- Every scheduled workflow has a job that opens or comments one deduplicated alert issue when
  it fails.
- Fixtures and test recipients are invented; a check fails on a real customer's name or domain.

Deliverability split: the project owns the subdomain, SPF, DKIM and DMARC, versioned in the
repository and verified before the first real send; the provider owns the blocklist, event
delivery and reputation monitoring. Transactional mail is exempt from one-click unsubscribe
(RFC 8058); add it to any family a user can turn off.

## Sources

- Experience: one multi-tenant B2B SaaS in production with an e-mail outbox and native push,
  and an older consumer platform whose e-mail chain is the counter-example (2026).
- RFC 8058, one-click unsubscribe (cited by name).
