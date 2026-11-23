# AGENTS.md — setup-for-coding

The working contract of this repository, loaded in every agent session (`CLAUDE.md` imports
it). It holds rules, and each rule names the check that enforces it. A rule that no check
enforces says so.

## 0. Current state

Replaced, never extended.

- In place: the plugin manifest, this contract, the public-hygiene check, the project
  template with its checks, reviewers and CI (`skills/kickoff/template/`), the overlap map,
  the risk tiers and four optional modules (`skills/kickoff/modules/`).
- Skills: `kickoff` (start a project), `sync` (bring a project level with the template) and
  `playbook` (24 decision sheets in four groups, each under 8 KB, in one format).
- Next: an eval suite that runs a kickoff with a real agent, then the README and the method
  notes.

## 1. What this is

A Claude Code plugin, and the files a new project receives from it. The plugin carries the
knowledge and the tooling; a project keeps only its own contract and guards, so an improvement
made here reaches every project without a copy to maintain.

The repository is public and meant to be read: what it says about agents, it applies to itself.

## 2. Structure

- `.claude-plugin/`: the plugin manifest, and the marketplace entry that lists it. The plugin
  root is the repository root.
- `skills/`: what the plugin ships. `skills/kickoff/template/` holds the files a project
  receives, under neutral names (`dot-claude/`, `AGENTS.md.tmpl`) so that nothing here takes
  them for this repository's own configuration; `skills/kickoff/init.mjs` lays them.
- `scripts/`: this repository's own checks. `tests/`: the tests of every check, the
  template's included. This repository runs the template's scripts on itself.
- `docs/`: the method behind the choices.

## 3. Rules

1. **English only.** Check: `scripts/public-hygiene.mjs`, rule `language`.
2. **Nothing private.** No path outside the repository, no session link, no e-mail address, no
   credential, no hostname of a real deployment, no name of a private project or client.
   Check: `scripts/public-hygiene.mjs`. Private names are checked against a deny-list supplied
   through `HYGIENE_DENYLIST`; the list is never committed, and the check says when it is absent.
3. **Figures from real projects stay anonymous**: "on one production project", never its name.
   Check: the deny-list of rule 2.
4. **No dependency.** Scripts and tests run on Node 22 alone. Check: `tests/structure.test.mjs`.
5. **A check is believed only after it was seen red.** Every rule of a check has a test that
   feeds it a violation. Check: review; the tests of each check are its proof.
6. **No story in this file.** A dated account of what a session did belongs in a pull request.
   Check: the template's `agent-memory-check.mjs`, run here by `verify` and by the write hook.
7. **Never bypass a check**: no `--no-verify`, no skipped test, no exemption added to make a
   push pass. An exemption is a line of code, reviewed like one. Check: the template's
   `hooks/no-verify.mjs`, wired in `.claude/settings.json`; CI is the authority.
8. **A template file is proved where it lands.** A change to `skills/kickoff/template/` comes
   with a test that lays the template in a throwaway repository and sees the change work
   there. Check: `tests/template-e2e.test.mjs`.

## 4. Method

- One branch per request, one pull request at the end. Run `node scripts/verify.mjs` before
  every push; CI runs the same command and nothing else.
- A pull request says what it does not prove, and names the mutation that turned each new
  check red.
- A decision that shapes the plugin for its users (a name, a file layout, a default) is asked
  before the code that depends on it.

## 5. Commands

| Command                           | Purpose                                 |
| --------------------------------- | --------------------------------------- |
| `node scripts/verify.mjs`         | Everything CI runs: tests, then hygiene |
| `node --test`                     | Tests only                              |
| `node scripts/public-hygiene.mjs` | The public-hygiene check alone          |
| `claude plugin validate .`        | The manifests, by the official CLI      |
