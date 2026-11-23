---
title: Product and repository shape
group: foundations
reviewed: 2026-11-23
---

# Product and repository shape

The kind of product decides how many things get deployed, and the number of deployables decides
the shape of the repository. Chosen by habit, the shape is wrong both ways: a single app whose
modules import each other in circles, or a monorepo of packages with one consumer each. The
boundary that matters most, who holds the database credentials, is then a convention instead of
a fact.

## When it matters

- At kickoff, before the first app is scaffolded.
- When a second deployable appears: a worker in another language, a public site, a mobile shell.
- When code is about to be copied from one app into another.

## Decide

1. **What kind of product.** A multi-tenant B2B SaaS on sensitive data, an internal tool, or a
   consumer app. Tenancy, the number of audiences and the regulatory weight follow from it.
2. **Which surfaces exist on day one, and which come later.** A customer app, a public site
   (marketing, docs, changelog, trial), an internal back-office, a background worker, a mobile
   shell. Each audience with its own login rules is a candidate surface.
3. **Who holds the database.** One app holds the credentials and owns every write to the domain.
   The others call its API with the caller's session.
4. **One app or several.** Count the deployables, not the features.
5. **When a shared package is born.** When a second consumer exists, not before.
6. **How a release reaches each environment.** Local, staging, production; who triggers each.

## Options

| Option | Gives | Costs | Choose it when |
| --- | --- | --- | --- |
| One app with domain modules (`modules/<domain>/` with types, repositories, services, use cases, UI) | One build, one deploy, no workspace tooling | Boundaries hold only if a lint rule holds them | One deployable: an internal tool, a site with its admin |
| One app plus a thin sub-package with its own lockfile | A separate worker without a monorepo | Two dependency trees to keep current | One heavy job (rendering, media) must run elsewhere |
| A monorepo: apps that talk over HTTP, packages born of a second consumer | Physical security boundaries; each app deploys alone | Workspace tooling, a CI that grows with it | Two or more deployables, or a boundary that must be physical |
| Apps outside the workspace (another language, a tool that imposes its package manager) | Each keeps its own toolchain | Its checks must be wired separately | A Python worker; a mobile shell whose framework pins its own React |

## Default

For a multi-tenant SaaS: a monorepo with one app that holds the database credentials and serves
the back-office and the API, a customer app, a public site, and a worker. Customer and public
apps reach the domain over HTTP only. Customers never enter the back-office. The client never
talks to the database: its data API is closed, and the client library is limited to auth,
storage and realtime. A worker in another language and a mobile shell sit beside the workspace
with their own lockfiles.

For an internal tool or a small site: one app with domain modules and a boundary lint rule from
the first commit. Switch to apps and packages on one of three triggers: a second deployable, a
security boundary that must become physical, or code with a real second consumer. One public
site whose contract was adapted from a six-app product kept a single app and wrote why: the
product "splits apps because it has six; this site has one".

Three environments: local, a staging that a person deploys on purpose, and production released
from the main branch. The worker and any self-hosted service deploy by their own workflow; say
so in the contract, because a merge will not do it.

## Traps

- **A boundary written but not held.** In one single-app project, modules imported each other in
  circles (costs and generation, generation and feedback, and three more pairs), shared folders
  held only a `.gitkeep`, and the rule "no other module imports the agent SDK" was broken by a
  background function. Nothing failed.
- **The import compiles because the root has it.** In a monorepo, `import 'payload'` inside the
  public site compiled: module resolution climbed to the devDependencies of the workspace root.
  A `no-restricted-imports` rule on the CMS, its plugins and the database driver closed it, with a
  test that feeds the rule a violation.
- **A service token on a user path.** The shared API client takes the caller's session in its
  signature; the service token has a separate entry point. Otherwise one convenience call skips
  every access rule.
- **The second-consumer rule had no check.** On the production project it is held by
  convention only. Review it when a package appears.
- **Packages for versioning nobody publishes.** A changeset tool on a workspace where 23 of 24
  packages were private held a single changeset.
- **Shared staging.** With one staging and several branches, the last deploy wins in silence.
  Read what is served before concluding a test passed.
- **A worker nobody redeploys.** A merge does not redeploy the worker; only a written rule says
  to. Its deploy workflow turns green only after reading a ready line from the host's logs,
  because an earlier machine ran in production with warnings nobody read.

## Hold it with a check

- An import-boundary lint rule per app (no CMS, no database driver outside the app that holds
  them), with a test that proves it fails on a violation.
- A structure test that pins the layout: which apps exist, the closed data API in the database
  config, the deploy settings of each app.
- The second-consumer rule and the worker redeploy are not enforced by a check. Say so in the
  contract.

## Sources

- Experience: a multi-tenant SaaS in production (six JavaScript apps, two of them outside the
  pnpm workspace, and a Python worker), a multilingual
  consumer monorepo of nine apps, a single-app internal tool, and a single-app public site (2026).
