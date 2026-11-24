---
name: kickoff
description: Start a new project in an empty repository - interview the owner, lay the working contract with its checks, reviewers and CI, then make and record the first decisions (shape, stack, hosting, security) with the playbook. Run it once, at the very beginning, as /setup:kickoff.
disable-model-invocation: true
argument-hint: '[project name]'
---

# Kickoff

You are starting a project. At the end of this procedure the repository holds a contract
every agent session loads, checks that hold it, two reviewers, a CI that confirms what a
session already ran, and the first decisions written down with their reasons. Nothing of the
product is built yet: the point is that whatever is built next is built under rules.

Work in the order below. Do not skip a step because the project "is small": small projects
are where rules written later never get written.

## 1. Look before you write

- The current directory must be a git repository. If it is not, run `git init`.
- If `AGENTS.md` already exists, this project was started before: stop, and offer
  `/setup:sync` instead.
- Read what is already there (a README, a product brief, a design export): the owner should
  not have to repeat what they wrote down.

## 2. Interview the owner

Ask everything in one message, each question with your recommendation, and skip what the
owner has already answered. Then act on the answers; do not ask again.

1. **The product**: its name; in one sentence, what it does and for whom; whether it is a
   multi-tenant product for businesses, an internal tool, a consumer app or a site.
2. **Data**: what is sensitive in it, and where it must be hosted. Whether model inference
   must stay in the same region as the data.
3. **Surfaces at the start**: customer app, public site, back-office, background worker,
   mobile app. Recommend what the first release needs, and give the structure a place for the
   others: a product of this kind usually ends with all five.
4. **Stack**: imposed, or to choose together (step 4).
5. **Design**: where screens are designed (a prototype tool, a design file, nothing yet).
   When a design exists or is coming, adopt the `prototype-review` module at the first
   designed screen.
6. **Languages**: the language the repository is written in (contract, decisions, plans) and
   the language of the product's interface. Whether a second interface language is planned.
7. **Tracker** for questions and owed actions: the repository's issues by default; Linear
   or Jira when the project already lives in one.
8. **Merging**: who merges; whether a merge deploys to production; whether content-only
   changes may merge by themselves once CI is green.

## 3. Lay the files

List the optional modules and their triggers, and choose from the answers:

```bash
node "${CLAUDE_SKILL_DIR}/init.mjs" --list-modules
```

Then lay the template. It never overwrites a file that exists.

```bash
node "${CLAUDE_SKILL_DIR}/init.mjs" --target "$(git rev-parse --show-toplevel)" --name "<project name>" --modules <a,b>
```

Then point git at the project's hooks. The session-start hook does it from the next
session on; this one started before the files existed:

```bash
node scripts/hooks/session-start.mjs
```

From here the project's own checks apply to you: `node scripts/verify.mjs` stays red until
every `TODO(kickoff)` in `AGENTS.md` is replaced by a decision. The reviewers you just laid
are registered from the next session too: to run one now, give its file to a fresh agent as
its instructions.

## 4. Decide, and write each decision down

For each choice below, open the matching sheet of the playbook skill
(`${CLAUDE_PLUGIN_ROOT}/skills/playbook/sheets/<slug>.md`), settle the questions under its
"Decide" heading with what the owner told you, and write one file in `docs/adr/` named by
date and subject. A sheet gives a default; when you depart from it, the ADR says why.

- Repository shape and surfaces: `product-and-repo-shape`.
- Stack and hosting region: `stack-and-hosting`, `dependencies-and-upgrades`.
- Data model discipline: `data-and-migrations`.
- Access: `auth-and-tenancy`, when the product has accounts.
- Security: answer every question of `security-day-one`. Each answer becomes a rule with its
  check in `AGENTS.md`, or an issue when it must wait.
- A tracker other than the repository's issues: `decisions-and-escalation` says how the two
  kinds of issue map onto it; record the mapping in an ADR.
- Whatever else the first release needs: open its sheet when you reach it, not before.

A new provider, a price, a data schema, an expense: these are the owner's. The owner is here:
ask now, with your recommendation. Do not write the decision for them.

Then fill `AGENTS.md`: the product in five to ten lines, where authority lives, the stack
with its ADRs, the structure, the rules with their checks, the commands. Keep it under its
cap, and keep the story of this kickoff out of it.

If the repository's language is not English, translate the contract and create
`agent-memory.config.json` holding the translated heading of section 0, for example
`{ "state": { "heading": "## 0. État courant" } }`. If you also translate the reviewers or
the issue forms, list them under `own` in `setup-sync.json`: `/setup:sync` would otherwise
report every translated file as fallen behind.

## 5. Make verification real

- Put the project's real commands in `verify.config.json`: format, lint, types and the tests
  the project runs on every push in `fast`; database, browser and build in `full`. Say in
  `notCovered` what each level leaves out. Keep `fast` under its budget: a level that takes
  too long stops being run.
- Give each step of `full` a `group` as soon as there is more than one app or one heavy
  suite. A session runs the groups in a row; CI runs each in its own job, side by side.
- Add the toolchain and dependency install to the `run` job of `.github/workflows/ci.yml`,
  pinned. Leave the rest as it is: CI runs `node scripts/verify.mjs` and nothing else.
- Run `node scripts/verify.mjs --full` until it is green.
- For each check you added, break what it guards once and see it turn red. A check never
  seen red proves nothing.

## 6. Hand over

- Create a path rule in `.claude/rules/` (with a `paths:` list) only for an area that
  already has rules of its own. Do not create empty ones.
- Write `docs/plans/active/<first-workstream>/STATE.md`: where the work stands, what comes
  next, what is open.
- Commit on a branch and open the first pull request with the project's template. Run
  `reviewer-conformity` on it first: the request is the owner's answers from step 2.
- Tell the owner what only they can do, as one short list: create the labels `decide` and
  `owed`, or their equivalents in the chosen tracker; require the check named `Verify` on the
  default branch; turn on automatic deletion of merged branches; whatever the chosen modules
  need (their `limits` say so).
- Say what this kickoff did not do or could not check.
