# The method

Why this repository is shaped the way it is: three ways of failing with coding agents, each
lived on a real codebase, and the principles kept from them. The sheets of the playbook hold
the detail; this page holds the reasoning.

## Three ways to fail

**No checks.** An older single-app product was built fast and had no CI at all. Every
background job was declared with no retry, and five recovery scripts were written to repair
what failed, one of them rebuilding state from the cost log. A stubbed step was the default
while the runbook said twelve tests out of twelve passed: the quality report had been
written by the agent that wrote the code. Nothing was false on purpose. Nothing could
contradict the agent either.

**Rules without checks.** An older consumer platform had dozens of carefully written rule
files, and a CI that ran neither a linter nor a type checker. Its rule that no user-facing
text may be hard-coded was followed by none of its apps. An update bot was set to merge by
itself into a repository where nothing verified the result. The rules were good. They were
advice.

**Checks everywhere, and nothing ever removed.** The most mature project, in production,
has a check for nearly everything, and paid for it differently. Its instruction file reached
355 KB before it was cut to under 40; the story then moved into plans, which reached 845 KB
for a single file two months later. Its CI cost 314 billed minutes per merged pull request,
57,000 minutes in nine working days, because a sentence in the contract said containers
could not run in a session, so CI was where failures were found. That sentence had stopped
being true and nobody had measured it again. Every addition had a good reason. Nothing had a
way out.

A fourth codebase, a small public site rebuilt in three days, showed the other half: the
same method fits in about fifteen kilobytes of files, and the one rule it wrote without a
check was broken within the week.

## What was kept

1. **A rule names its check, or says it has none.** A reader, human or agent, must be able to
   tell an enforced rule from a wish.
2. **A check is believed only after it was seen red.** Every check here has a test that
   feeds it the violation; a pull request names the mutation that turned its new check red.
   The strongest findings of review on the production project were checks that stayed green
   when the code they guarded was broken.
3. **What agents load is small, capped, and holds no story.** A state is replaced. A story
   is written once, in a file of its own. A cap exists to force something out, not to be
   squeezed under.
4. **Verification happens in the session; CI confirms.** One command, two levels, the same
   in both places. When a merge is a release, the heavy level runs before the merge, never
   after it.
5. **Coordination is derived, not declared.** Sessions already push branches; who touches
   what can be read from that in four seconds. A registry that sessions must keep is a
   registry that is wrong.
6. **Decide in the pull request; ask only what is the owner's, before the code.** An approval
   asked for everything is given without reading. The care a change needs is computed from
   the paths it touches.
7. **Review with fresh context.** A reviewer given the session's story inherits its blind
   spots. One reviewer reads, one executes; two rounds, then the form of the check changes.
8. **Everything added has a way out.** A module has a written trigger. An exception has an
   expiry date. A warning that stopped being true is deleted, because it is obeyed as
   faithfully as a true one.
9. **Say what was not proved.** Every level of verification, every pull request and every
   module here ends by naming what it does not cover.

## What this is not

It is not a framework, and it does not choose a stack. It does not orchestrate agents or
carry messages between them: sessions meet in the repository and its pull requests, which
is the one channel every account can read. It does not replace judgement about the product;
it tries to make sure that judgement is asked for where it matters and nowhere else.

## Sources

The figures above come from the author's own projects, quoted without their names. The
external sources behind each choice are cited in the sheet that makes it:
[agent memory](../skills/playbook/sheets/agent-memory.md),
[verification and CI](../skills/playbook/sheets/verification-and-ci.md),
[coordination between sessions](../skills/playbook/sheets/coordination-between-sessions.md),
[decisions and escalation](../skills/playbook/sheets/decisions-and-escalation.md),
[review](../skills/playbook/sheets/review.md).
