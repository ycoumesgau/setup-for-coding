---
title: A content MCP for every product
group: ai-ops
reviewed: 2026-11-23
---

# A content MCP for every product

Pages, interface texts, e-mail templates, documentation and media change far more often than
code. If the only way to change them is a commit, every wording fix costs a branch, a review and
a deploy, and texts end up seeded by migrations. An MCP server (Model Context Protocol, the
standard through which an assistant calls a product's tools) lets the owner edit content from
an assistant. Left open by default, the same server can publish, overwrite or delete anything.

## When it matters

- At kickoff, when choosing where content lives.
- When a text change starts to need a migration or a pull request.
- Before any MCP tool can write to production.

## Decide

1. **What is exposed.** A closed list, declared next to each entity (its purpose, `none`,
   `read` or `write`, and which write operations). Users, keys and grants are never exposed.
2. **What a write does.** Reads everywhere. Writes land as drafts; publishing is a separate,
   explicit act.
3. **How deletion works.** The tool can move a document to the trash, or file a deletion
   request. A person confirms it outside the MCP, in the admin, within a time limit. There is
   never a direct delete tool.
4. **How keys are scoped.** One role per key, `read` or `write`; an unknown role reads. No
   per-entity checkboxes: the closed list already says what each entity allows.
5. **How clients authenticate.** API keys suffice for local tools such as Claude Code. Hosted
   assistant apps need OAuth 2.1.
6. **What is recorded, and how it is switched off.** An append-only journal of every call; a
   kill switch for the endpoint.

## Options

| Option | Gives | Costs | Choose it when |
| --- | --- | --- | --- |
| No MCP; content in the repository | Nothing to secure | Every edit is a commit; texts creep into migrations | A product with no editable content |
| Framework plugin, API key | Little code; works from local tools | No hosted apps; the plugin's defaults must be overridden | Content is edited only from a terminal |
| Framework plugin + own OAuth 2.1 server | Every assistant surface, with consent and revocation | Of the order of 1,500 lines of security code and tests (a review's estimate, not a count) | The owner edits from hosted assistant apps |
| Fully custom server | Narrow tools that carry domain guards | Every tool written and tested by hand | The plugin cannot express a needed guard |

## Default

When the product runs on Payload, reuse the MCP plugin and OAuth setup proven on the reference
site (a public single-app site, see Sources) rather than writing another: the plugin for the
tools, an authorization callback that checks the token and
filters tools by the closed list, and a pure OAuth module. That module holds clients registered
in code (no dynamic registration), PKCE S256 only (PKCE: the client proves it started the
flow), a 60-second code stored hashed and single-use by a unique constraint, signed one-hour
access tokens, refresh tokens rotated so that reusing one revokes its whole lineage, a consent
screen that checks the session itself, and a grant re-read on every call so that deleting a
connection in the admin cuts it at once. The issuer comes from configuration, never from the
`Host` header. On another stack, start with API keys; the OAuth server is an option to add when
hosted assistant apps need it. On any stack, deletion is possible only as a request that a
person confirms outside the MCP; there is never a direct delete tool.

Behind the closed list, put a second lock in the access rules: the user and grant collections
refuse any MCP caller, so an exposure mistake does not open account takeover. Write guards live
on the collections and act only on MCP requests, so they survive the kill switch. Journal
refused and failed calls too, with input cut to 2 KB and no secret. Ask a quoted confirmation
from the owner for writes that change a price.

The limit: the reference setup is single-tenant and leans on internal imports of a beta
plugin. A multi-tenant product adds tenant checks to every tool and re-tests the plugin at
each upgrade.

## Traps

- **The plugin exposes everything.** Payload's MCP plugin builds tools for every collection,
  its own included, unless each is turned off; its `draft` flag defaults to `false`, so an edit
  went straight to the published row. Filter by the closed list and force drafts.
- **A partial write erased content.** The page tool treats the block list it receives as the
  whole list: an update that sent one block erased the other seven in production until a
  restore. Give blocks their own tool that changes one block and writes the rest back.
- **The journal missed failures.** The plugin's after-call hook runs only for a handler that
  returns, so thrown and refused calls escaped the journal until a hostile review found it.
  Wrap each tool so every outcome is written.
- **Content arrived through migrations.** On one production project 96 of 195 migrations only
  seeded text, 89 of 121 pull requests carried a migration, with snapshot conflicts in series,
  and 3,048 keys could not be edited in the admin. A key is born in code, in a catalogue synced
  idempotently; its value is data, edited through the MCP or the admin.
- **A missing tool becomes a workaround.** When the work needs a tool the server lacks, add it
  to the server in its own change, with its test, instead of writing around it.
- **A held request and a saturated pooler: two mechanisms, not one.** A server advertising
  `tools.listChanged: true` (the SDK's default) never closed `subscriptions/listen` requests:
  each ran to the 300-second function limit and the client reopened it, about once a minute,
  5,524 timeouts in seven days. Announcing `false` closes the stream in the same response;
  that stream held no database connection. In the same weeks the database pooler hit its
  200-client limit: a crawler loaded every public page at once, each serverless instance kept
  its own default `pg` pool, and the public pages were not cached. Bound the pool, release
  idle clients and cache public reads before blaming the MCP.
- **Production writes allowed without a prompt are a decision, not a default.** One project
  let sessions fix wording in production through the MCP without asking each time, a choice
  of its owner. No test read that list, so it could grow unnoticed. Pin it.

## Hold it with a check

- At config build: every entity declares its MCP intent, or the build fails with a block to
  copy and fill. One project made this break `pnpm install`, so no collection lands
  undocumented.
- A test that lists the exposed tools and compares them with the declared intents.
- Database tests: an MCP write stays a draft; a deletion request cannot be confirmed through
  the MCP; confirmation deletes only a document still in the trash; a refused call is
  journaled; the endpoint answers 503 when switched off and 401 without a token.
- OAuth tests: code replay, refresh reuse, revocation in flight, invalid request shown without
  a redirect.
- A test that pins the list of MCP tools an agent may call without a prompt: adding one is a
  reviewed change.

## Sources

- Experience: a production multi-tenant SaaS with its own MCP and OAuth server, a consumer
  platform with plugin write guards and API keys, and a public single-app site on the Payload
  plugin with OAuth (2026).
- The reference site is public; its `src/mcp/`, `src/domain/mcp-oauth/` and `docs/adr/` hold
  the setup described above. <https://github.com/ycoumesgau/yoann-coumes-gauchet>
- OAuth 2.1 with PKCE; RFC 8414 (authorization server metadata); RFC 9728 (protected resource
  metadata and the `WWW-Authenticate` challenge); RFC 9700 (refresh token rotation).
