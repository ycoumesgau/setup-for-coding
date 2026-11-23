import assert from 'node:assert/strict'
import { test } from 'node:test'

import {
  DEFAULTS,
  configProblems,
  departures,
  globToRegExp,
  isCovered,
  memoryProblems,
  mergeConfig,
  stateLines,
} from '../skills/kickoff/template/scripts/agent-memory-check.mjs'

const contract = (extra = '') => `# AGENTS.md\n\n## 0. Current state\n\n- Live.\n\n## 1. Rules\n\n${extra}\n`
const repo = (...files) => [{ path: 'CLAUDE.md', text: '@AGENTS.md\n' }, ...files]
const problems = (...files) => memoryProblems(repo(...files))
const one = (found, fragment) => {
  assert.equal(found.length, 1, JSON.stringify(found))
  assert.ok(found[0].includes(fragment), found[0])
}

test('a small contract with its import raises nothing', () => {
  assert.deepEqual(problems({ path: 'AGENTS.md', text: contract() }), [])
})

test('a file over its cap is refused, and the refusal says where to write instead', () => {
  const found = problems({ path: 'AGENTS.md', text: contract('x'.repeat(16_000)) })
  one(found, 'over its 16000-byte cap')
  assert.ok(found[0].includes('docs/plans/active/'))
})

test('the specific cap wins over the general one', () => {
  const text = 'y'.repeat(7_000)
  const found = problems(
    { path: 'AGENTS.md', text: contract() },
    { path: 'docs/plans/active/billing/STATE.md', text },
    { path: 'docs/plans/active/billing/lot-1-invoices.md', text },
  )
  one(found, 'docs/plans/active/billing/STATE.md is 7000 bytes, over its 6000-byte cap')
})

test('a state section that grew is refused; a missing one too', () => {
  const grown = `# A\n\n## 0. Current state\n\n${'- line\n'.repeat(26)}\n## 1. Rules\n`
  one(problems({ path: 'AGENTS.md', text: grown }), 'is 26 lines; it is replaced, not extended')
  one(problems({ path: 'AGENTS.md', text: '# A\n\n## 1. Rules\n' }), 'has no "## 0. Current state" section')
  assert.equal(stateLines('## 0. Current state\n\n- a\n\n- b\n## 1. X\n- c\n', '## 0. Current state'), 2)
})

test('the marks of a story are refused in a loaded file', () => {
  const stories = [
    ['- 2026-03-04: the session rebuilt the importer.', 'a dated journal line'],
    ['- **2026-03-04** (night) — importer rebuilt.', 'a dated journal line'],
    ['Importer (2026-03-04, night): rebuilt from the prototype.', 'a dated chronicle entry'],
    ['The run 45200903757 was red.', 'a run identifier'],
    [['See https://claude.ai', '/code/session_', '01AbCdEf'].join(''), 'a session link'],
    ['This is the 3rd occurrence of the mute CLI.', 'a counter of occurrences'],
  ]
  for (const [line, name] of stories) {
    one(problems({ path: 'AGENTS.md', text: contract(line) }), name)
    one(
      problems({ path: 'AGENTS.md', text: contract() }, { path: '.claude/rules/api.md', text: `${line}\n` }),
      name,
    )
  }
})

test('a dated reference is not a story, and a plan may tell one', () => {
  const reference = 'One branch per request (decision of 2026-10-27). See docs/adr/2026-10-27-branches.md.'
  assert.deepEqual(problems({ path: 'AGENTS.md', text: contract(reference) }), [])
  const story = '- 2026-03-04: the session rebuilt the importer; run 45200903757 was red.\n'
  assert.deepEqual(
    problems({ path: 'AGENTS.md', text: contract() }, { path: 'docs/plans/active/import/lot-1-parser.md', text: story }),
    [],
  )
})

test('a kickoff placeholder left in the contract is refused', () => {
  one(problems({ path: 'AGENTS.md', text: contract('TODO(kickoff): the stack.\nTODO(kickoff): roles.') }), '2 "TODO(kickoff)"')
})

test('CLAUDE.md holds the import and nothing else', () => {
  const found = memoryProblems([
    { path: 'CLAUDE.md', text: '@AGENTS.md\n\nAlso: be careful.\n' },
    { path: 'AGENTS.md', text: contract() },
  ])
  one(found, 'must hold the single line "@AGENTS.md"')
  one(memoryProblems([{ path: 'AGENTS.md', text: contract() }, { path: 'apps/api/CLAUDE.md', text: '@AGENTS.md' }]), 'which does not exist')
})

test('a contract nested in an app is capped and kept free of stories, like the root one', () => {
  const nested = (text) => problems({ path: 'AGENTS.md', text: contract() }, { path: 'apps/api/AGENTS.md', text }, { path: 'apps/api/CLAUDE.md', text: '@AGENTS.md\n' })
  assert.deepEqual(nested('# API rules\n\n- Amounts are integer cents.\n'), [])
  one(nested('z'.repeat(9_000)), 'apps/api/AGENTS.md is 9000 bytes, over its 8000-byte cap')
  one(nested('- 2026-03-04: the session rebuilt the importer.\n'), 'apps/api/AGENTS.md holds a dated journal line')
  assert.equal(isCovered('apps/api/AGENTS.md'), true)
})

test('a configuration cannot switch the check off, and every loosened value is said aloud', () => {
  const loose = mergeConfig({ caps: [{ files: 'AGENTS.md', maxBytes: 1_000_000 }], loaded: [], placeholder: '', state: { maxLines: 100_000 } })
  const refused = configProblems(loose).join(' ')
  assert.match(refused, /"loaded" must keep AGENTS\.md/)
  assert.match(refused, /"placeholder" may not be emptied/)
  assert.match(configProblems(mergeConfig({ caps: [{ files: 'docs/**/*.md', maxBytes: 10 }] })).join(' '), /must keep a cap on AGENTS\.md/)

  assert.deepEqual(configProblems(DEFAULTS), [])
  assert.deepEqual(departures(DEFAULTS), [])
  const said = departures(mergeConfig({ caps: [{ files: 'AGENTS.md', maxBytes: 40_000 }], state: { heading: '## 0. État courant', maxLines: 40 } })).join(' | ')
  assert.match(said, /cap on AGENTS\.md: 40000 bytes \(default 16000\)/)
  assert.match(said, /no cap on docs\/adr\/\*\.md/)
  assert.match(said, /state section: 40 lines \(default 25\)/)
  assert.match(said, /state heading: "## 0\. État courant"/)
})

test('a repository without a contract is refused', () => {
  one(memoryProblems([]), 'AGENTS.md is missing')
})

test('globs: one star stays in its folder, two stars cross folders', () => {
  assert.equal(globToRegExp('docs/adr/*.md').test('docs/adr/2026-01-02-hosting.md'), true)
  assert.equal(globToRegExp('docs/adr/*.md').test('docs/adr/old/2026-01-02-hosting.md'), false)
  assert.equal(globToRegExp('.claude/rules/**/*.md').test('.claude/rules/api.md'), true)
  assert.equal(globToRegExp('.claude/rules/**/*.md').test('.claude/rules/web/forms.md'), true)
  assert.equal(globToRegExp('AGENTS.md').test('apps/api/AGENTS.md'), false)
})

test('the check has an opinion on memory files only', () => {
  assert.equal(isCovered('AGENTS.md'), true)
  assert.equal(isCovered('apps/api/CLAUDE.md'), true)
  assert.equal(isCovered('docs/pitfalls/2026-01-02-pooler.md'), true)
  assert.equal(isCovered('src/index.ts'), false)
  assert.equal(isCovered('README.md'), false)
})

test('a repository may set its own caps without losing the other defaults', () => {
  const config = { ...DEFAULTS, caps: [{ files: 'AGENTS.md', maxBytes: 100 }] }
  const found = memoryProblems(repo({ path: 'AGENTS.md', text: contract('x'.repeat(200)) }), config)
  one(found, 'over its 100-byte cap')
})
