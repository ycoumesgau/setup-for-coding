---
title: Security on day one
group: foundations
reviewed: 2026-11-23
---

# Security on day one

The security of a product is mostly settled by defaults chosen in its first week: who can reach
the database, what is readable without a login, what happens when a secret is missing. Agents
copy whatever pattern is already there, so an open default spreads faster than it would by hand.
Answer these questions before the first feature, and turn each answer into a check.

## When it matters

- At kickoff, before the first route, table or bucket.
- When a vendor, an upload type, a webhook, an MCP server or an agent tool is added.

## Decide

Each answer fixes what depends on it.

1. **Where do secrets live?** One store per reader (the hosting platform for apps, the CI
   environment for jobs), deduced from who reads the value. Decides the env-pull script and CI.
2. **Who can reach the database?** One server app holds the connection string; clients never
   query it. Decides whether the provider's auto-generated API stays off.
3. **What is public by default?** Nothing: every access rule starts from a refusal, anonymous
   reads are a named list. Decides the shape of every access function.
4. **What fails closed at boot?** A missing secret whose absence *opens* something (a webhook
   signature) stops the build and the instance; one whose absence only closes leaves the
   feature inert. Decides the boot code.
5. **How are files read and written?** Storage deny-all for clients; short signed URLs issued by
   the server, on a key the server derives. Decides upload flows.
6. **Which inputs are untrusted?** Every upload and every customer template, validated by our
   code before any parser sees it.
7. **Can the server be made to fetch a URL?** List what can issue outbound requests (database
   extensions, renderers, model providers) and close it or fence it.
8. **What may a log line contain?** Identifiers, codes and sizes; never content, never a token.
9. **What reaches the user from a provider error?** A status and a code from a closed set.
10. **What leaves for third-party tools?** A whitelisted projection per tool, tested.
11. **How is login abuse limited?** A cap per hashed email and per IP, counting successes too.
12. **What may an agent run and reach?** An explicit tool list per agent; no network for an agent
    that touches domain code; no hook bypass.
13. **What may an agent not read?** Strategy or customer documents, denied in the agent's
    permissions, and in the ignore file of every other AI editor the team uses.
14. **What can CI touch?** `contents: read` by default, more only per job; actions pinned.
15. **What is written as not done?** A rules file lists the protections not yet implemented.

## Options

| Option | Gives | Costs | Choose it when |
| --- | --- | --- | --- |
| Provider auto-API open, RLS policies | Fast client queries | Business rules in SQL; one missed grant is a leak | Never for sensitive data |
| Server-only database, RLS deny-all as a net | One layer to test | An API route per need | The default |
| Public bucket or long URLs | Simple embeds | Links leak and never expire | Public marketing assets only |
| Short signed URLs, logged | Each read authorised and traced | Renewal from the screen | The default for customer files |

## Default

Everything in the Decide list, each with its check. Signed read URLs of 300 seconds, 900 at
most; an upload through a signed token, so no insert policy and no bytes through serverless
functions (a body limit of 4.5 MB on one host would have refused them anyway). A boot check run
at module evaluation and again at instance start. The limit: a public site with no accounts
needs only questions 1, 3, 8, 13 and 14.

## Traps

- **"Skipped, with a warning."** On a consumer project, an auth webhook with no secret set
  logged a warning and returned "valid": it looked protected and accepted anything. The same
  function printed the expected secret to the logs on every call. Fail at boot when absence
  opens; never log a secret, even to compare it.
- **Silent empty secrets.** In GitHub Actions, a missing `secrets`/`vars` expression is an
  empty string, not an error; `vercel deploy --yes` without a project id creates a new project.
- **A parser that says yes.** A document renderer (Gotenberg) answers 200 to bytes that are not
  a document; a plausible file full of gibberish passes. Bound the input ourselves.
- **SSRF through the database.** A `REVOKE` on a provider-owned schema was ignored and
  `net.http_*` stayed executable by the anonymous role. A test pins that state; the closed
  database API is what makes it unreachable.
- **A provider fetch is an unlogged read.** Images go to model providers inline, never as a
  signed URL the provider would fetch outside the access log.
- **Plugins publish by default.** A CMS's MCP plugin writes with `draft` false unless told
  otherwise, so an agent's edit goes live. One site answered with a closed list of exposed
  collections, a second lock in access, writes forced to draft, and deletion only on a request
  that a person confirms in the admin.
- **Inherited reads.** Versions and trash inherited `read`, so a query flag made a trashed page
  public on one site.
- **An audit that cannot fail.** A dependency audit ran with `continue-on-error` over about 90
  known high or critical CVEs, its baseline a TODO. Commit a baseline and fail on new ones.
- **Automerge on frameworks.** An update bot was configured to automerge framework minors
  while CI ran no lint or typecheck. Pin exact versions; an upgrade is a tested change.
- **A hook is not a guard.** A command matcher does not see a command written to a script
  first. CI stays the authority.
- **Residue in permissions.** A committed agent settings file allowed a script at a path on one
  machine, a one-off benchmark script, and MCP writes to the production CMS without asking. No
  test read the list. Pin it with one: no absolute path, no production write auto-allowed.

## Hold it with a check

- A structure test pinning the database API off, deployment regions, exact framework versions,
  and the agent's deny rule on private folders.
- An enumeration test of tables, grants and policies; a test that each access factory refuses
  first and that anonymous reads match the named list.
- A boot test: the build fails without each "opening" secret.
- Storage tests: no client policy, signed URL TTL bounded, each issue logged.
- A whitelist test per outbound projection; a closed-charset test on error codes.
- A hook refusing `--no-verify`, with tests on its variants; CI with read-only default
  permissions.

## Sources

- Experience: a multi-tenant SaaS in production handling sensitive data, a public site with a
  content MCP server, and a consumer platform (2026).
