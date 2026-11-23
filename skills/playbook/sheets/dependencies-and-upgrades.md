---
title: Dependencies and upgrades
group: foundations
reviewed: 2026-11-23
---

# Dependencies and upgrades

A caret range lets a package change under a green build, and agents add carets by default. An
update bot that merges on its own needs a CI that would catch a break; without one, it merges
breakage. And a workaround kept against an upstream bug grows probes, retries and journals
until it costs more than the feature it protects.

## When it matters

- At kickoff, before the first `install`.
- Before upgrading a framework, a CMS, a browser-test tool or a CI runner image.
- When a workaround for an upstream bug is about to get its second script.

## Decide

1. **What is pinned exactly.** The framework, the CMS and every package of its family, the
   runtime, the container images (by digest), the CI runner images.
2. **Who proposes upgrades, and who merges them.** A bot may open pull requests; a person or the
   full CI decides.
3. **What a workaround may cost**, and the condition that removes it.
4. **Which files are generated**, from what, and how CI proves they are current.
5. **How many lockfiles**, one per toolchain, and which install is frozen.

## Options

| Option | Gives | Costs | Choose it when |
| --- | --- | --- | --- |
| Exact pins, upgrades by hand, one pull request each | Nothing moves unseen | Someone must look for updates | The default for the framework and its family |
| An update bot that opens grouped pull requests, no automerge | Upgrades are proposed on a schedule | Pull requests to review; CI minutes per run | Once CI runs lint, types, tests and build |
| Automerge for types and dev tools only | Less noise | A tool update can still break the build | Only behind a CI that blocks on that break |
| Caret ranges and global automerge | No effort | Breakage arrives without a decision | Never on a product |

## Default

Set `save-exact=true` in `.npmrc` so `pnpm add` writes exact versions, and
`auto-install-peers=false` so a missing dependency fails locally instead of at the host's build.
Keep every package of a framework family on one version. Pin container images by digest and CI
runners by name, never `latest`. Install with a frozen lockfile in CI.

An upgrade is its own pull request: one family at a time, with the tests that depend on it
replayed and its changelog read. Read the framework's `peerDependencies` before moving its
neighbours. An update bot may come later, without automerge on the framework, once CI blocks on
lint, types, tests and build.

This stops being worth it for a prototype that lives a week; then use the generator's defaults
and throw it away.

## Traps

- **Peer ranges decide the upgrade.** A CMS adapter declared its Next.js peer range as a list of
  patch windows, which excluded 15.5.x, 16.0 and 16.1 entirely. "Latest" is not "supported":
  read the field before every bump of either package.
- **Automerge without a gate.** On a consumer monorepo, an update bot was configured to
  automerge, minors of the CMS and the framework included, while CI ran neither lint nor
  typecheck. Its history suggests it barely ran; had it run, nothing would have stopped a
  breaking minor. "Every upgrade is a tested change" cannot coexist with that configuration.
- **A workaround that became a subsystem.** A CMS command-line tool exited 0 without running,
  53 times in 7 days (about 374 CI minutes a week). The answer grew into a silence probe, a guard
  that maps silence to exit codes, a bounded retry, a marker every script must print, a weekly
  survey workflow, a 103 KB journal and a hunting workflow labelled disposable, still present.
  Write the exit condition when the first workaround lands, and delete it when the upstream fix
  ships.
- **A patch kept in another repository.** A patch for a second repository lived as a `.patch`
  file in the first; no script or document referenced it.
- **A cache keyed on the wrong thing.** A build cache restored from a different lockfile made
  Turbopack load the old graph and compile the new one: peak memory went from about 6.3 GB to
  9.6 GB, and the host's 8 GB build machine died out of memory. Key build caches on the
  lockfile, or turn the build cache off.
- **An upgrade changes behaviour, not just versions.** An image-decoding library upgrade changed
  the error raised by a malformed HEIC file, and so where the file was filed; the two
  malicious-file tests now run at every bump. Playwright below 1.61 fails to install on the
  next Ubuntu runner image; it is upgraded on its own, Node and Python bindings together.
- **A generator that passes by doing nothing.** A config generator raced on module loading and
  produced nothing in 1 to 4 runs out of 10. CI reruns it, checks a marker it prints, then runs
  `git add -N . && git diff --exit-code`.
- **An audit that cannot fail.** A dependency audit was set to `continue-on-error` because of
  about 90 pre-existing high or critical CVEs; the baseline that would let it block stayed a
  TODO. Commit a baseline and block on anything new.
- **A tool with credentials is a target.** The LiteLLM gateway was published compromised on
  PyPI twice in 2026 (March and October), with a credential stealer, also found in its Docker
  images. Pin by version and hash anything that holds keys.

## Hold it with a check

- A structure test: no `^` or `~` on the frozen packages, one version per framework family,
  `save-exact` set, images pinned by digest, no `latest` runner.
- CI regenerates every generated file (types, the database bridge, plugins) and fails on a diff.
- A dependency audit with a committed baseline that blocks on a new finding; a version-consistency
  linter such as sherif on each pull request.
- Whether a workaround is still needed is not checked by anything: give it an owner and an exit
  condition in the pitfalls file.

## Sources

- Experience: a multi-tenant SaaS in production, a multilingual consumer monorepo, and a public
  site running a CMS beta behind an exact pin (2026).
- BleepingComputer, on the LiteLLM release pipeline compromise (2026):
  <https://bleepingcomputer.com/news/security/litellm-release-pipeline-hacked-to-distribute-info-stealer-malware>
- StepSecurity, on the October 2026 LiteLLM release:
  <https://www.stepsecurity.io/blog/litellm-1-107-0-compromised-pypi-backdoored-wheels-credential-stealer>
