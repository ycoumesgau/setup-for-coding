---
title: Billing and pricing
group: surfaces
reviewed: 2026-11-23
---

# Billing and pricing

Billing touches money, law and trust at once, and an agent will happily invent a price, a
rounding rule or a grace period to finish a task. Left to chance, prices live in three places,
totals are stored and then disagree, a billing error rolls back the work it bills, and the
tests go red one night a year.

## When it matters

- Before any price is written anywhere, including the public site.
- When the unit of billing is chosen, and when a feature changes what that unit counts.
- When the payment provider is chosen, and when a mobile app is planned.
- When a billing test fails on a branch that does not touch billing.

## Decide

1. **Who sets prices.** The owner, always. A price, a minimum, a free tier or a discount is a
   decision a session asks for and never makes; a session that writes a price through a tool
   quotes the owner's sentence approving it.
2. **The unit.** Outcome-based pricing (a price per finished task, in the trade's own unit,
   plus a monthly minimum) or seats or usage. Settle what is free: on one project, a result
   rejected in review is not billed.
3. **Where the computation lives.** In a subscription engine at the provider, or in your
   domain with the provider only issuing invoices and collecting.
4. **The ledger.** Amounts as integer minor units (cents). Invoices, credit notes, allocations
   and credit grants as append-only records: a correction adds a row, it never edits one.
5. **The calendar.** Which time zone defines a day and a month, when the month closes, and how
   daylight saving is handled.
6. **Cost caps.** Per tenant and per feature on inference spend, read before each call.

## Options

| Option | Gives | Costs | Choose it when |
| --- | --- | --- | --- |
| Seats | Simple, predictable | Unrelated to value; invites account sharing | Value grows with users |
| Usage (calls, tokens) | Tracks your cost | Customers bear your inefficiency; hard to budget | Developer products |
| Outcome in the trade's unit, plus a monthly minimum | Sells the finished task; a rejected result is free | You must define "done" and count it yourself | The product delivers a whole task |
| Subscription engine at the provider (Stripe Billing) | Metering, proration, dunning built in | A second source of prices; cannot express "max(usage, prorated minimum)" or "rejected is free" | The price fits its model |
| Own computation, provider issues invoices (Stripe Invoicing) | One source of truth: invoices are projections of outcomes | You build closing, thresholds, reconciliation | The price is atypical |

The seat and usage rows are common practice, given for comparison; the source project lived
only the outcome model.

## Default

Price per outcome, in the trade's unit, with a monthly minimum that starts at the first billed
outcome and is due every month after, even without usage. Compute in your domain; let the
provider number, issue and collect invoices and credit notes, and carry the payment mandate.
The transaction that records an outcome never calls the provider: billing runs after the
commit, from an outbox drained in resumable steps, with an idempotency key per step (one
provider invoice took six requests). Close the month as a pure function of the instant, at 06:00
on the 1st in the business time zone, so that transactions still open at midnight land. Webhooks
go to an inbox: unique event id, re-read at the source, state that only moves forward, tenant
resolved from your own table and never from provider metadata. Reconcile daily on a different
scheduler from the one that bills; it reports gaps and never corrects amounts.

The reason: one source of prices and one source of totals, and a billing failure that delays
an invoice instead of undoing the customer's work. It is too much for a plain monthly
subscription: there, use the provider's subscription engine and keep only the ledger rules.

## Traps

- **The specification outgrows the revenue.** On one production project, the owner chose
  to specify billing in full before launch: in about a month, some sixty dated pricing
  decisions, a 103 KB plan and a 42 KB scheduling record, with three credit modes and early
  termination to the minute, before the first euro was billed. The cost is volume: every
  session that touches billing must read all of it, and the scheduling record itself notes
  that no invoice cadence had yet been measured. If you want less to read, settle the unit,
  the minimum and what is free, and defer the rest to a real case.
- **A test that is red one hour a night.** A test aged an unpaid invoice by subtracting 14 days
  in UTC, then read the day in Paris. Between 22:00 and 23:00 UTC in the two weeks after the
  switch to winter time, the result fell on the next day: the invoice was 13 days old and five
  tests (day 7, day 14, the automatic reminder) failed twice, unrelated to the diff. Count
  days in the business time zone, in tests as in code, and handle daylight saving in code,
  never in the cron expression.
- **The page count is billed, and fonts decide it.** On a project billing per rendered page,
  three conversions of the same document gave three different PDF hashes but the same text and
  page count; missing fonts shift pagination. The renderer image is pinned by digest, and that
  pin is a billing guard: upgrading it is a change that re-measures page counts. Seal the
  source document's hash, not the PDF's.
- **A global inference cap blocks everyone.** Caps are per tenant and per feature, with day,
  month or lifetime windows, adjustable without a deploy; tooling with no tenant gets its own
  key-scoped cap. Cost is stored in integer micro-dollars, rounded up, and no model is called
  without a recorded price.
- **Mobile stores.** Store rules govern any way to pay from inside a native app. The project
  first cited a clause that did not apply, then chose to keep statements and paid invoices
  readable in the native app and to hide everything that makes the customer pay, with a
  sentence and no link. That reading of the Apple and Google rules is its own, still waiting
  for the first store review; see the mobile sheet.
- **Provider choice by measurement.** Two providers were played through six flows in test mode:
  one had zero redirects with 3-D Secure and carried the SEPA mandate and numbering; the other
  redirected at every card and left mandate and invoices to the project.

## Hold it with a check

- Pure-function tests for every price rule, with the spec's worked examples as cases, and a
  mutation of each rule seen red.
- Database constraints: append-only triggers on ledgers, unique idempotency keys, a CHECK
  equal to the enum of the pure code, tested for drift.
- A test that runs the calendar functions under another time zone, across a month end and a
  daylight-saving switch.
- A test that totals are computed from lines and compared before an invoice is finalised.
- The webhook secret missing fails at boot (it would open a door); the provider key missing
  makes billing inert with a 503 that turns the scheduled job red.

## Sources

- Experience: one multi-tenant B2B SaaS with outcome-based pricing, billing wired to Stripe in
  test mode before its first invoice (2026).
- Apple App Review Guidelines, section 3.1.3; Google Play Payments policy (cited by name).
