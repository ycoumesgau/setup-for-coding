---
title: CRM and connectors
group: ai-ops
reviewed: 2026-11-23
---

# CRM and connectors

Around the product sit the tools that sell it: a CRM, mailboxes, prospecting automations,
meeting notes. Agents drive them through connectors (MCP servers that an assistant session
calls). Each connector lets an agent write where no code review looks, and each one copies
personal data to a new processor. Left to chance, the CRM fills with duplicates, a scheduled
agent runs without its connector, and a third-party account gets restricted.

## When it matters

- When the first prospect list is imported, or a CRM is chosen.
- Before connecting a mailbox, a meeting-notes tool or a social-network automation.
- Before a scheduled agent is given write access to the CRM.

## Decide

1. **Where the truth lives.** The product's database holds the facts; the CRM draws the
   commercial consequences. Data flows one way, through an outbox.
2. **Who owns each field.** Fields the sync writes, and fields people or agents own and the
   sync never touches. Write the second list down.
3. **What an agent may write alone.** Facts with a source, notes and tasks: yes. Merges of
   records that carry history, deletions and anything sent to a third party: a person decides.
4. **What leaves the product.** A closed list of fields per outgoing projection, and a written
   list of channels the product does not compose.
5. **Hosted or self-hosted.** Decided on data residence, with the operating cost counted.

## Options

| Option | Gives | Costs | Choose it when |
| --- | --- | --- | --- |
| SaaS CRM in the EU | Nothing to operate | Its connector, its data model, its pricing | No residence rule excludes it |
| Self-hosted CRM with its own MCP | Residence, schema and API under your control | A machine to patch, back up and probe; about 30 EUR a month at list price, before your time | Residence rules exclude the hosted offers |
| A spreadsheet | Zero setup | No deduplication, no history, no agent access | Fewer than a few dozen accounts |

## Default

A CRM fed one way from the product by an outbox, so an outage of the CRM delays rather than
loses. The sync builds each outgoing record from an allow list in code; a "never touched"
list (pipeline stage, grouping, agent decisions) is tied to that allow list by tests. The
pipeline stage is not mirrored: a mirror freezes the board, and a fact is not a judgment.

Public registry imports run weekly. A registry row is never deleted: a disappearance is dated.
Deduplicate in three stages: deterministic rules first (shared e-mail domain outside shared
providers, the same normalised name in two registries); then a scheduled agent for the grey
zone, reading public data only, writing its decision and a note with its evidence on the
survivor; then a "probable duplicate" task for a person. The agent never merges a record that
carries an opportunity, a note or a task, and never deletes: it marks the absorbed record, and
a separate job removes only a record that is both marked and empty (two keys).

Connectors may read and draft. Refuse a connector that sends: a support reply or an e-mail is
drafted by a model and sent by a person who read it. The limit: with one person and a few
dozen accounts, skip the agents and the registry sync.

## Traps

- **The agent ran without its connector.** A weekly merge agent was created as a scheduled run
  without the CRM connector, because the organisation refused connectors at creation by tool.
  Its instruction told it to say "connector absent" in one line rather than improvise: the
  right fallback. Check the connectors of a scheduled run after creating it.
- **Scheduled runs are not interactive sessions.** On its first real pass the agent read 80
  cases and merged 5, but 4 of 5 deletions were refused by the permission classifier, while
  the same calls passed interactively. A scheduled run has no permission mode and ignores the
  repository's settings. Design its writes so none needs a deletion.
- **A merge broke the sync.** The sync found a company by its product id; after a native CRM
  merge it no longer found the absorbed record and recreated it on the next pass. Give the CRM
  ownership of grouping, and make the sync follow it.
- **Uniqueness counts soft-deleted records.** A key deleted in the CRM interface blocked its
  recreation. Restore it; do not change the key.
- **A pin is not a guard.** Pinning the allow list in a test caught one mutation in four;
  building the output from the list caught them all.
- **Accounts can get restricted (the vendor's warning, not a measured incident).** A
  prospecting automation acts with the owner's own session cookie on the social network, and
  the vendor warns that bursts can get that account restricted. Small batches, one launch a
  day, never a burst.
- **The channel nobody composes.** A mailbox synced into the CRM in full content is outside
  every allow list: a confidential document sent by e-mail would enter the CRM unseen. Write it
  as a usage rule, and say that no test covers it.
- **Every connector is a new processor of personal data.** Meeting notes from a US-hosted tool
  waited on a decision before any were filed; only the title, date, participants, summary and
  a link go, never the transcript. Record each connector's residence and processing agreement
  before the first write.
- **The runbook in the product repository.** One self-hosted CRM runbook reached 117 KB inside
  the product repository and drifted: it said no CRM workflow existed when a later survey
  counted twelve. Keep operating notes for a third-party tool with that tool, short, and its
  version in one file the deploy reads.

## Hold it with a check

- A test per outgoing projection that enumerates its fields and refuses any other; a new tool
  adds its projection and test in the same change.
- A test that the "never touched" list and the allow list do not overlap.
- An outside uptime probe on the self-hosted CRM, not on its container status.
- The agent's instruction file versioned in the repository; the scheduled run reads it there.
- No check holds a synced mailbox or an automation's volume: a usage rule, said as such.

## Sources

- Experience: a production multi-tenant SaaS with a self-hosted CRM fed from public
  registries, driven by scheduled agents and connectors (2026).
- Twenty documentation, "Uniqueness constraints": soft-deleted records count toward
  uniqueness.
- Phantombuster help pages on its LinkedIn inbox and message thread scrapers.
