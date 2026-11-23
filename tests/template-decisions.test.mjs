import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { test } from 'node:test'
import { fileURLToPath } from 'node:url'

import { mergeVerify, modules } from '../skills/kickoff/init.mjs'
import { exceptionProblems } from '../skills/kickoff/modules/dated-exceptions/files/scripts/exceptions-check.mjs'
import { decisionsOf, digest } from '../skills/kickoff/modules/weekly-digest/files/scripts/weekly-digest.mjs'
import { configProblems, tierOf, tierOfFile } from '../skills/kickoff/template/scripts/risk-tier.mjs'

const here = dirname(fileURLToPath(import.meta.url))
const tiers = JSON.parse(readFileSync(join(here, '..', 'skills/kickoff/template/risk-tiers.json'), 'utf8'))

test('content is tier 0, ordinary code tier 1, and what guards the project tier 2', () => {
  const expected = {
    'docs/plans/active/billing/STATE.md': 0,
    'README.md': 0,
    'apps/api/src/invoices/total.ts': 1,
    'apps/api/src/invoices/total.test.ts': 1,
    'AGENTS.md': 2,
    '.claude/rules/api.md': 2,
    '.github/workflows/ci.yml': 2,
    'scripts/verify.mjs': 2,
    'verify.config.json': 2,
    'risk-tiers.json': 2,
    'apps/api/src/migrations/2026_01_02_invoices.ts': 2,
    'apps/api/src/auth/session.ts': 2,
    'packages/billing/src/ledger.ts': 2,
  }
  for (const [file, tier] of Object.entries(expected)) assert.equal(tierOfFile(file, tiers), tier, file)
})

test('a change takes the highest tier among its files, and names the files that set it', () => {
  assert.deepEqual(tierOf(['docs/a.md', 'README.md'], tiers), { tier: 0, setBy: ['README.md', 'docs/a.md'], secondPass: [] })
  assert.deepEqual(tierOf(['docs/a.md', 'src/a.ts'], tiers), { tier: 1, setBy: ['src/a.ts'], secondPass: [] })
  assert.deepEqual(tierOf(['docs/a.md', 'src/a.ts', 'AGENTS.md'], tiers), { tier: 2, setBy: ['AGENTS.md'], secondPass: [] })
  assert.deepEqual(tierOf([], tiers), { tier: null, setBy: [], secondPass: [] })
})

test('instructions for agents are never content, wherever they sit and however the path is written', () => {
  for (const file of ['apps/api/AGENTS.md', 'apps/api/CLAUDE.md', './AGENTS.md', './.claude/rules/api.md', './scripts/verify.mjs']) {
    assert.equal(tierOfFile(file, tiers), 2, file)
  }
  assert.equal(tierOfFile('./docs/plans/active/billing/STATE.md', tiers), 0)
})

test('a second pass is asked for authentication, tenancy, billing and migrations, and for nothing else', () => {
  const sensitive = ['apps/api/src/auth/session.ts', 'apps/api/src/tenancy/scope.ts', 'packages/billing/src/ledger.ts', 'apps/api/src/migrations/2026_01_02_invoices.ts']
  assert.deepEqual(tierOf(sensitive, tiers).secondPass, [...sensitive].sort())
  // The owner merges a change to the checks, but it does not take a second reviewer by rule.
  const tooling = tierOf(['scripts/verify.mjs', '.github/workflows/ci.yml', 'AGENTS.md'], tiers)
  assert.equal(tooling.tier, 2)
  assert.deepEqual(tooling.secondPass, [])
})

test('a test file is not content: changing only tests can weaken them', () => {
  assert.equal(tierOf(['tests/isolation/invoices.test.ts'], tiers).tier, 1)
})

test('a tier configuration that would make silence mean permission is refused', () => {
  assert.deepEqual(configProblems(tiers), [])
  assert.match(configProblems({ ...tiers, default: 0 }).join(' '), /may not be 0/)
  assert.match(configProblems({ rules: [], default: 1 }).join(' '), /non-empty list/)
  assert.match(configProblems({ rules: [{ tier: 3, paths: ['a'] }], default: 1 }).join(' '), /must be 0, 1 or 2/)
})

const entry = (over = {}) => ({
  rule: 'inference stays in the EU',
  reason: 'the EU account opens after incorporation',
  owner: 'the owner',
  expires: '2026-06-30',
  removal: 'the hosts list and its test',
  ...over,
})

test('an exception in force passes; an expired one fails and says who owns it', () => {
  assert.deepEqual(exceptionProblems([entry()], '2026-03-01'), { problems: [], warnings: [] })
  const expired = exceptionProblems([entry()], '2026-07-01')
  assert.equal(expired.problems.length, 1)
  assert.match(expired.problems[0], /expired on 2026-06-30 \(owner: the owner\)/)
  assert.deepEqual(exceptionProblems([entry()], '2026-06-30').problems, [], 'the last day is still in force')
})

test('an exception about to expire warns two weeks ahead, without failing', () => {
  const soon = exceptionProblems([entry()], '2026-06-20')
  assert.deepEqual(soon.problems, [])
  assert.match(soon.warnings[0], /expires in 10 day\(s\)/)
})

test('an exception without a date, an owner or a way out is not an exception', () => {
  const found = exceptionProblems([entry({ expires: '' }), entry({ owner: undefined }), entry({ removal: ' ' }), entry({ expires: 'soon' })], '2026-03-01').problems
  assert.ok(found.some((problem) => /"expires" is missing/.test(problem)))
  assert.ok(found.some((problem) => /"owner" is missing/.test(problem)))
  assert.ok(found.some((problem) => /"removal" is missing/.test(problem)))
  assert.ok(found.some((problem) => /"expires" is not a date/.test(problem)))
  assert.match(exceptionProblems({}, '2026-03-01').problems[0], /must hold a list/)
})

const body = (decisions) => `## What it does\n\nAdds invoices.\n\n## Decisions\n\n<!-- one line each -->\n${decisions}\n\n## Proof\n\n- Verify: green\n`

test('the digest keeps the decisions of each pull request and nothing else', () => {
  assert.deepEqual(decisionsOf(body('- Round half up, because the ledger does.\n- No retry on 4xx, because it cannot succeed.')), [
    'Round half up, because the ledger does.',
    'No retry on 4xx, because it cannot succeed.',
  ])
  assert.deepEqual(decisionsOf(body('none')), [])
  assert.deepEqual(decisionsOf(body('None.')), [])
  assert.equal(decisionsOf('## What it does\n\nNo such section.'), null)
  assert.equal(decisionsOf(null), null)
})

test('the digest counts, lists the pull requests that skipped the section, and links each one', () => {
  const text = digest([
    { number: 12, title: 'feat: invoices', url: 'https://example.com/pull/12', body: body('- Round half up, because the ledger does.') },
    { number: 13, title: 'docs: readme', url: 'https://example.com/pull/13', body: body('none') },
    { number: 14, title: 'fix: typo', url: 'https://example.com/pull/14', body: 'Just a fix.' },
  ])
  assert.match(text, /^3 pull request\(s\) merged; 1 carried a decision\./)
  assert.match(text, /### #12 feat: invoices\n\n- Round half up, because the ledger does\.\n\nhttps:\/\/example\.com\/pull\/12/)
  assert.match(text, /### No Decisions section\n\n- #14 fix: typo/)
  assert.match(text, /1 pull request\(s\) declared no decision\./)
  assert.doesNotMatch(text, /#13/)
})

test('every module says when to adopt it, what it adds and what it does not prove', () => {
  const all = modules()
  assert.deepEqual(all.map((module) => module.name), ['auto-merge', 'dated-exceptions', 'merge-queue', 'prototype-review', 'weekly-digest'])
  for (const module of all) {
    assert.ok(module.trigger?.length > 40, `${module.name}: no trigger`)
    assert.ok(module.adds?.length > 40, `${module.name}: does not say what it adds`)
    assert.ok(module.limits?.length > 0, `${module.name}: does not say what it does not prove`)
  }
})

test("a module's steps join the project's levels once, whatever the order of adoption", () => {
  const config = { fast: [{ name: 'memory', run: 'a' }], full: [] }
  const addition = { fast: [{ name: 'dated exceptions', run: 'b' }] }
  const once = mergeVerify(config, addition)
  assert.deepEqual(once.fast.map((step) => step.name), ['memory', 'dated exceptions'])
  assert.deepEqual(mergeVerify(once, addition).fast.map((step) => step.name), ['memory', 'dated exceptions'])
  assert.deepEqual(mergeVerify(config, undefined), config)
})
