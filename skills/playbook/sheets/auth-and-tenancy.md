---
title: Authentication and multi-tenancy
group: foundations
reviewed: 2026-11-23
---

# Authentication and multi-tenancy

In a multi-tenant product every bug in authorization is a data leak to another customer. The
leaks that happen are rarely a missing login: they are a rule left open "for now", a framework
default that skips access, a relation that crosses tenants, a field nobody protected. Decide the
model before the first table, and hold it with tests that run real queries against two tenants.

## When it matters

- At kickoff, before the first collection or table.
- Each time a table, a machine account, a role or an anonymous route is added.
- When a security fix is tempting to write as "skip the check when there is no user".

## Decide

1. **What the token carries.** An identity (`sub`) and nothing else. Roles and tenant are read
   from a membership row in the database at each request, so revoking is one row.
2. **One tenant per user, or several.** One is simpler and safer: resolve the scope by equality,
   refuse when two memberships come back or when they disagree with the user row ("choosing one
   would be guessing"). Plan several only if the product needs it.
3. **What the host name is.** Display only. A subdomain never resolves a tenant; the page
   compares it with the membership. Refusals are identical (same 404 for "another tenant's" and
   "does not exist"), so nobody can list the customers with curl.
4. **How machines authenticate.** One service account per consumer, with an enumerated `kind`;
   its scope is a table keyed by kind, and every use is logged.
5. **Who sees every tenant.** Platform accounts have no tenant; each access writes a log line.
6. **Roles and capabilities.** Few exclusive roles, plus capabilities (administer) that combine
   with a role. Every "may they administer?" goes through one function.
7. **How accounts are born.** Invitation first, sign-up disabled at the identity provider too.
8. **MFA now or later.** See the traps for what postponing cost.

## Options

| Option | Gives | Costs | Choose it when |
| --- | --- | --- | --- |
| Rights in token claims | No lookup | Escalation by forged or stale claims; revoking waits for expiry | Never for tenant data |
| Membership read per request | Revocation is one row; one source of truth | One query per request | The default |
| Row-level security as the only layer | Enforced in the database | Business rules in SQL policies; hard to test | Clients query the database directly, which this sheet advises against |
| App-layer access, RLS deny-all underneath | Rules testable in code; the database refuses everything else | Two layers to keep | The default |
| Cookies on the parent domain | One login across subdomains | Every subdomain reads the session | Subdomains are equally trusted and the host is never trusted for rights |
| Host-only cookies | A session stays on its origin | A login per origin | The default |

## Default

Token as identity, membership read per request, one tenant per user. Every access function is
built by a factory that starts from a refusal; anonymous reads are one named exception,
recognised by reference identity, not by shape. A user client whose signature requires the
caller's session, and a service client behind a separate entry point that a lint keeps off user
paths. "System" is tested positively (is this caller a service account?), never by "there is no
user": the worker, authenticated by key, has a user. Relations checked same-tenant by hook and by composite
foreign keys. RLS deny-all on every table. Host-only cookies.

The limit: a single-tenant product reduces the matrix to owner, other user, anonymous; the host
neutrality matters only when the customer list is confidential.

## Traps

- **The framework bypasses access by default.** Payload's Local API runs with
  `overrideAccess: true` unless told otherwise. A lint requiring a literal `false` and a user
  held it, but its allowlist grew to about 206 entries, one of them a glob over migrations: a
  list nobody rereads. Cap the allowlist or require review per entry.
- **A `Where` is truthy.** A Payload `create` access that returns a query object authorises
  everything while looking scoped. `create` returns a boolean.
- **Denied fields vanish silently.** A field access refusal drops the field without an error, so
  an escalation test that expects an exception is a false green. Assert the resulting state.
- **The matrix tested tables, not fields.** A field linking an account to its identity had no
  field access: a tenant admin could get resolved as another user with two PATCH requests. The
  invariant was written from day one; the test never looked at sensitive fields.
- **The matrix skipped a verb.** An audit found the runner never checked delete within a tenant,
  and six declarations were wrong without anything turning red; months later one collection
  still had delete open after its closing was "decided".
- **Leak through the graph.** Access on each collection can be correct while a populated
  relation (`depth`) returns another tenant's document. On one project this was recorded as a
  debt of an early step, not seen as a leak, and closed with a same-tenant hook, composite
  foreign keys and a test file of about 3,100 lines.
- **Scope by name.** Rights keyed by a service account's name pass to the next account that
  reuses it. Key by enumerated kind; keep the name for idempotent provisioning only.
- **The platform image grants too much.** Supabase's image grants `TRUNCATE` to `anon`, and a
  `REVOKE` on a platform-owned schema is silently ignored: `net.http_*` stayed callable. Only an
  enumeration test sees it; a closed Data API is what makes it harmless.
- **What MFA postponed cost.** With password-only sessions, a tenant admin could reset any
  member's password and sign in as them, signature included; ten weeks later the fix was a
  reset link sent to the person, never a password chosen by the admin. A self-serve "download
  everything" export was refused until MFA exists. An SMS second factor was priced at about $75
  a month for a need no customer had voiced. Postponing is a decision with a list of features
  it blocks.
- **A platform log that is not an audit.** Platform and service access were application log
  lines, so their retention depends on the host's log retention. Write them to an append-only
  table.

## Hold it with a check

- An isolation matrix run against a real database with two seeded tenants and access enforced:
  each entry declares a role's rights on its own tenant; the runner adds cross-tenant,
  anonymous, no-membership and platform cases with no opt-out, for all four verbs and for
  sensitive fields.
- Completeness held twice: a typecheck (`satisfies Record<Slug, Entry>` over generated types)
  and a runtime comparison with the collection index; each excluded category must equal the
  coverage of a dedicated suite.
- A service-scope test that enumerates every kind on every collection.
- An RLS test that enumerates tables, grants and policies, run in CI and after each release.
- Lints for the access-bypass default and for service-client imports, each with a test that
  sees it red.

## Sources

- Experience: a multi-tenant SaaS in production with sensitive data, about 290 isolation test
  files; a single-admin site on Payload; a consumer platform (2026).
