---
name: sync
description: Bring a project that was started with /setup:kickoff level with the current template - its checks, hooks and reviewers - without touching what the project owns (its contract, verification steps, tiers and CI). Run it as /setup:sync when the plugin has improved, or when a project's tooling was edited by hand and you want to know where it stands.
disable-model-invocation: true
---

# Sync

A project receives two kinds of files at kickoff. It owns its contract (`AGENTS.md`), its
verification steps, its risk tiers, its CI and its pull request template: they are never
compared. The checks, the hooks and the reviewers are tooling: they improve in the plugin, and
a project's copy can fall behind.

1. Report where the project stands:

   ```bash
   node "${CLAUDE_SKILL_DIR}/sync.mjs" --target "$(git rev-parse --show-toplevel)"
   ```

   Each line is a file that is `missing`, `differs`, or is `kept by the project` (listed
   under `own` in `setup-sync.json`).

2. For each file that differs, read both versions before deciding. If the project changed it
   on purpose and the change should stay, add its path to `own` in `setup-sync.json`, with
   the reason in the pull request. If the change is an improvement every project should get,
   say so to the owner: it belongs in the plugin, not in one project.

3. On a branch, take the template's version of the rest:

   ```bash
   node "${CLAUDE_SKILL_DIR}/sync.mjs" --target "$(git rev-parse --show-toplevel)" --apply
   ```

4. Read `git diff`. Run `node scripts/verify.mjs --full`. A check that changed must be seen
   red once in this project before it is trusted here.

5. Open a pull request. Tooling is tier 2: it gets a second review pass, and the owner
   merges.

What this does not do: it does not rewrite the project's contract when the template's
skeleton changes, and it does not add optional modules. For a module, run the kickoff's
`init.mjs` with `--modules <name>`: it lays what is missing and overwrites nothing.
