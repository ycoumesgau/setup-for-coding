---
title: Privacy and GDPR
group: foundations
reviewed: 2026-11-23
---

# Privacy and GDPR

Privacy promises are made on the public site in week one and kept, or not, by code written
months later. On the projects behind this sheet the code was strict and the paperwork lagged:
a register with one entry while the core product was missing, a reversibility promise with no
decision behind it, a residency exception that became the normal regime. Decide what the
product promises, then make each promise something a test can fail.

## When it matters

- At kickoff: where data lives, and what the public site will claim.
- When a vendor, an analytics tool, a model provider or a notification channel is added.
- When the first screenshot, demo or test fixture is made.
- When a customer leaves, or asks what is kept.

## Decide

1. **Where data lives.** Residency (EU, a country) is a product decision with a cost: it narrows
   hosts, regions and model providers. Write it as a rule the deploy config is tested against.
2. **What never leaves a tenant.** No customer data to internal tools (CRM, issue tracker, chat).
   What generalises across tenants is an abstract rule a person validated, in a format that
   cannot hold a name or a value.
3. **Which processors, and what each receives.** One register entry per processing, written by
   the change that creates it: data kept, data sent, data never sent, recipients, transfers,
   durations with their known gaps and an owner.
4. **Consent or cookieless.** Measure without consent only what the regulator's conditions
   allow; anything richer waits for consent or login.
5. **Recording screens.** Session replay and autocapture off wherever customer data is shown.
6. **What demos, captures and fixtures show.** Only invented people and organisations.
7. **Retention, export, deletion.** How long each record lives, what a leaving customer gets,
   in which open format, within which delay, and what is kept after (invoices, by law).
8. **Exceptions.** Any exception to a residency or data rule carries an expiry date.

## Options

| Option | Gives | Costs | Choose it when |
| --- | --- | --- | --- |
| Analytics with consent banner, cookies | Full attribution | A banner; data lost on refusal | Marketing site with paid acquisition |
| Cookieless analytics through a first-party relay | No banner if the conditions hold | Less detail; the conditions to prove | Product and docs pages: the default |
| Cookieless always, enriched after consent or login | Both, by state | A consent bridge to maintain | A consumer app with marketing |
| Export on request, by an operator | Small attack surface | A manual step, a promised delay | The default while sessions are password-only |
| Self-serve "download everything" | Convenience | The largest exfiltration surface of the product | Only once MFA exists |

## Default

EU hosting, with regions pinned in deploy config and tested. A closed list of outbound hosts
for model inference, compared byte for byte, entered only by a reviewed diff, never by an
environment variable; the endpoint actually called is logged so residency can be proved after
the fact. Cookieless analytics through a first-party relay that does not forward the IP, with
Global Privacy Control and Do Not Track honoured; richer tracking after consent; replay off.
Synthetic data in development, tests, captures and demos, generated from the schema; never a
dump. A register seeded with the generic processings of a SaaS (accounts, logs, analytics,
email, hosting) on day one, then one entry per feature. Purge built before export: "an export
without purge is a copy".

The limit: a site with no accounts and no customer data needs the analytics and capture rules
only.

## Traps

- **The register follows the code, late.** On one production project the register started
  about ten weeks after the first production deploy, with one processing (mobile
  notifications). The core product was absent from it, the privacy page had still read "to be
  written" a month earlier, and the analytics processor agreement was unsigned.
- **A promise without a decision.** Reversibility was promised publicly while its decision stayed
  "proposed" for two and a half months. Write the public sentence only once the export and the
  purge run, proved by test.
- **The exception became the regime.** A dated residency exception for model inference was
  amended five times to widen it, until every high-value step ran outside the EU. Its machinery
  was sound: without a date the exception is closed; the day after expiry the demo hosts become
  unconstructible, the worker dies at boot and a test turns red; demo and EU host sets are
  disjoint, so closing is enough; the exception suspends residency and nothing else (call log,
  price, per-tenant cap and processor agreement still apply).
- **A real e-mail reached the changelog.** A screenshot carried a real customer's address to a
  public page. A script now refuses the customer's name patterns in the sources that produce
  images and in the visible text of photographed pages; a real person's name is refused in test
  fixtures. On another project, films said "invented names" in comments, with no check behind.
- **Opt-out that kills everything.** On a consumer project, calling the analytics opt-out on a
  refusal would also stop the cookieless mode. Refusal downgrades; it does not switch off.
- **Protections by accident.** Barriers against deletion turned out to be side effects of
  constraints added for other reasons; retention "without limit to this day" sat in the register
  for devices never logged out. Say it, date it, give it an owner.
- **Channels the product does not compose.** A synced mailbox, a social import and meeting notes
  hosted in the United States were governed by a usage note only: the likeliest leak.
- **Real data on a cloud runner.** A benchmark refuses to load a real corpus when it detects CI
  or a cloud agent session; an "anonymised" corpus needs a signed human record.

## Hold it with a check

- A structure test on deploy regions and on the host list; a boot failure on an unknown host.
- A dated-exception test that turns red the day after expiry.
- A whitelist test on each projection sent to a third-party tool.
- A capture guard over image sources and rendered text; a fixture lint for real names.
- A config test that asserts the analytics client's whole config object on the app, the
  back-office and the public site: autocapture off, session recording disabled, and the
  features a vendor could re-enable from its dashboard (heatmaps, dead clicks) off in code.
- A database test that the tenant purge reaches every table carrying the tenant id (one
  project has it for its trial tenant only).
- The register has no automated check on the source projects; review holds it.

## Sources

- Experience: a multi-tenant SaaS in production in the EU handling sensitive personal data, a
  consumer platform with a consent model, and a public site (2026).
