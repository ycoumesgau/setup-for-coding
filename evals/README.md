# Evals

Cases for `claude plugin eval`: each one gives a real agent a prompt and scores what it did.

| Case | What it checks | Seen passing |
| --- | --- | --- |
| `playbook-hosting` | A structural question is answered from the matching sheet | Yes, under the harness |
| `kickoff-saas` | A kickoff for a multi-tenant product with sensitive data | Not under the harness; see below |
| `kickoff-internal-tool` | A kickoff for a small tool takes no module it has no trigger for | Never run |

## Run them

```bash
claude plugin eval . --case 'playbook-*'
```

```bash
claude plugin eval . --case 'kickoff-*' --allow-tools Bash Write Edit
```

A kickoff writes files and runs commands, so its cases need the operator grant above. One
kickoff run took about six minutes and cost about 1.2 dollars.

## What was and was not seen

- `playbook-hosting` passed its three graders.
- The kickoff cases were not seen passing under the harness: in the container where they
  were tried, the harness ran as root and its sandbox mounted the workspace read-only, so
  the agent could not write the project. That is a limit of that container, not a result.
- The prompt of `kickoff-saas` was instead given directly to a mid-tier model in a throwaway
  repository (384 seconds, about 1.2 dollars). It laid the template, filled the contract,
  wrote ten decision records (seven accepted, three left proposed for the owner) and left
  `verify --full` green. The graders that read a file or the final message were then checked
  by hand against that repository; the two that read the tool calls were not. This is
  weaker than a harness run.
- `kickoff-internal-tool` exists because one product is not a proof; nobody has run it.

Results land in `evals/results/`, which is not committed.
