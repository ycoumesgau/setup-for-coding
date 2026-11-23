# AGENTS.md — setup-for-coding

The working contract of this repository, loaded in every agent session (`CLAUDE.md` imports
it). It holds rules, and each rule names the check that enforces it. A rule that no check
enforces says so.

## 0. Current state

Replaced, never extended.

- In place: the plugin manifest, this contract, the public-hygiene check, its tests and CI.
- The plugin ships nothing yet. Next: the project template with its guards, then the kickoff
  skill, then the playbook.

## 1. What this is

A Claude Code plugin, and the files a new project receives from it. The plugin carries the
knowledge and the tooling; a project keeps only its own contract and guards, so an improvement
made here reaches every project without a copy to maintain.

The repository is public and meant to be read: what it says about agents, it applies to itself.

## 2. Structure

- `.claude-plugin/`: the plugin manifest, and the marketplace entry that lists it. The plugin
  root is the repository root.
- `skills/`, `agents/`: what the plugin ships.
- `scripts/`: this repository's own checks. `tests/`: their tests.
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
   Not enforced yet.
7. **Never bypass a check**: no `--no-verify`, no skipped test, no exemption added to make a
   push pass. An exemption is a line of code, reviewed like one. Not enforced yet.

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
