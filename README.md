# setup-for-coding

A starting point for building software with coding agents: the working contract an agent
loads in every session, the checks that keep that contract honest, three reviewers, and the
knowledge needed to make the first decisions of a new product.

It is a [Claude Code](https://code.claude.com/docs) plugin. A project is started with one
command in an empty repository; it receives its own contract and checks, and keeps reading
the knowledge from the plugin, so that what improves here reaches every project without a
copy to maintain.

It is distilled from codebases built almost entirely by agents, one of them in production,
including what went wrong in them.

## Why it exists

Agents write code faster than a person can read it. What fails is not the code; it is
everything around it, in one of three ways:

- **No checks.** The agent says it is done, and nothing can contradict it.
- **Rules without checks.** Everything is written down and nothing is enforced; the rules
  are broken within days and nobody notices.
- **Checks everywhere, and nothing ever removed.** The contract grows until it is skimmed,
  CI becomes the place where failures are discovered, and every pull request costs hours of
  machine time.

[docs/method.md](docs/method.md) tells the three stories with their figures, and the
principles drawn from them.

## What a project receives

| Piece | What it does |
| --- | --- |
| `AGENTS.md` | The contract: state, product, stack, rules that each name their check, method, commands. Capped at 16 KB. |
| `scripts/agent-memory-check.mjs` | Refuses a contract or a plan that outgrew its cap, a state that was extended instead of replaced, and a story where rules live. |
| `scripts/verify.mjs` | One command with a fast and a full level, the same in a session and in CI. Each level says what it does not cover. |
| `scripts/overlap.mjs` | Who else is touching the files you changed, derived from pushed branches. No registry, no lock. |
| `scripts/risk-tier.mjs` | The care a change needs, computed from the paths it touches: who reviews, who merges. |
| `.claude/agents/` | Three fresh-context reviewers: conformity (read-only), risk (replays a mutation), prototype (compares a screen with its design). |
| `.claude/settings.json`, `.githooks/` | The hooks that run the checks at write time and before a push, and refuse to skip them. |
| `.github/` | CI that runs the same command and nothing else, a pull request template that asks what was not proved, two issue forms. |
| `docs/` | Decisions, plans and pitfalls as small files named by date, so that sessions never edit the same one. |

Optional modules join a project when their written trigger is met: a merge queue, dated
exceptions, a weekly digest of decisions, auto-merge of content-only changes.

## Start a project

1. Add this repository as a plugin marketplace in Claude Code and install the `setup` plugin
   on your account (an account-level plugin is the one that loads in cloud sessions).
2. In an empty git repository, run:

   ```
   /setup:kickoff
   ```

   It asks about the product, its data, its surfaces and who merges; lays the files; then
   decides the repository shape, the stack, the hosting region and the security rules with
   you, and writes each decision down with its reason.
3. Later, `/setup:sync` tells a project which of its checks, hooks and reviewers fell behind
   the plugin, and leaves alone what the project owns.

Without the plugin, the same files can be laid by hand:
`node skills/kickoff/init.mjs --target <repository> --name "<project name>"`.

## The playbook

Twenty-four decision sheets, each under 8 KB and in one format: when it matters, what to
decide, the options, a default with its reason and its limit, the traps already paid for,
the check that holds the decision, the sources. An agent opens the one sheet its task needs.

- **Method**: agent memory, verification and CI, coordination between sessions, decisions
  and escalation, review.
- **Foundations**: product and repository shape, stack and hosting, dependencies, data and
  migrations, authentication and multi-tenancy, security on day one, privacy.
- **Surfaces**: design system and prototype to code, mobile, internationalisation,
  documentation and support, billing, e-mail and notifications.
- **AI and operations**: asynchronous jobs, model inference, an agent inside the product, a
  content MCP for every product, observability and consent, CRM and connectors.

The index is [skills/playbook/SKILL.md](skills/playbook/SKILL.md).

## How it keeps itself honest

This repository applies its own method:

- Its contract is [AGENTS.md](AGENTS.md). Each rule names the check that enforces it.
- `node scripts/verify.mjs` runs everything, in two seconds; CI runs that command and
  nothing else. The checks it runs are the template's own scripts.
- Every check has a test that feeds it the violation it exists to refuse, and the template
  is proved where it lands: a test lays it in a throwaway repository and breaks each rule
  there.
- Nothing private is published: a check reads every file for paths, addresses, credentials,
  hostnames and a private list of names. Figures from real projects are quoted without the
  project's name.
- It has no dependency: Node 22 and git.

## What it leaves out

Knowledge that is specific to one product, one vendor's bug or one team's ritual is not
here: patches kept against an upstream defect, dozens of operational workflows, a path-by-path
CI gate, store submission step-by-steps, a generator that converts one tool's rules into
another's. The sheets say when a project should build such a thing for itself.

## What is not proved

- Loading through an account-level installation was not exercised for this plugin. Its
  manifests pass the official validator, and its skills load from a directory.
- The workflows of the optional modules were checked for their shape, not run on a real
  repository.
- The sheets carry lived experience from a handful of projects by one person. They are a
  starting point, dated, and meant to be corrected.

## License

[MIT](LICENSE)
