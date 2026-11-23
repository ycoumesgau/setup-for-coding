import assert from 'node:assert/strict'
import { test } from 'node:test'

import { configProblems, execute, report, stepsFor } from '../skills/kickoff/template/scripts/verify.mjs'

const config = {
  fast: [
    { name: 'memory', run: 'a' },
    { name: 'lint', run: 'b' },
  ],
  full: [{ name: 'database', run: 'c' }],
  notCovered: { fast: ['database tests', 'the build'], full: ['production data'] },
  fastBudgetSeconds: 300,
}

test('full is fast followed by the rest, never something else', () => {
  assert.deepEqual(stepsFor(config, 'fast').map((step) => step.name), ['memory', 'lint'])
  assert.deepEqual(stepsFor(config, 'full').map((step) => step.name), ['memory', 'lint', 'database'])
  assert.throws(() => stepsFor(config, 'nightly'), /unknown level/)
})

test('a config that would check nothing is refused', () => {
  assert.deepEqual(configProblems(config), [])
  assert.match(configProblems({ fast: [] })[0], /"fast" is empty/)
  assert.match(configProblems({ fast: [{ name: 'lint' }] })[0], /fast\[0\] needs a "name" and a "run"/)
  assert.match(configProblems({ fast: 'lint' })[0], /must be a list/)
})

test('the run stops at the first failure and says which step', () => {
  const ran = []
  const results = execute(stepsFor(config, 'full'), (command) => {
    ran.push(command)
    return command === 'b' ? 1 : 0
  })
  assert.deepEqual(ran, ['a', 'b'])
  const { ok, lines } = report(results, { level: 'full', config })
  assert.equal(ok, false)
  assert.match(lines.at(-1), /"lint" failed\. Fix it; do not bypass it\./)
})

test('a green run names what the level does not cover', () => {
  const results = execute(stepsFor(config, 'fast'), () => 0)
  const { ok, lines } = report(results, { level: 'fast', config })
  assert.equal(ok, true)
  assert.match(lines.at(-1), /Not covered at this level: database tests; the build\./)
  const bare = report(results, { level: 'fast', config: { fast: config.fast } })
  assert.match(bare.lines.at(-1), /nothing declared/)
})

test('a fast level over its budget says so; the full level has no budget', () => {
  let clock = 0
  const slow = () => {
    clock += 200_000
    return 0
  }
  const now = () => clock
  const fast = report(execute(stepsFor(config, 'fast'), slow, now), { level: 'fast', config })
  assert.ok(fast.lines.some((line) => /over its 300s budget/.test(line)))
  const full = report(execute(stepsFor(config, 'full'), slow, now), { level: 'full', config })
  assert.ok(!full.lines.some((line) => /budget/.test(line)))
})
