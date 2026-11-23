import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { appendFileSync, mkdtempSync, readFileSync, rmSync, statSync, unlinkSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { after, before, test } from 'node:test'
import { fileURLToPath } from 'node:url'

import { kickoff, lay } from '../skills/kickoff/init.mjs'
import { adoptedModules, compare, isManaged, needsAction } from '../skills/sync/sync.mjs'

const script = join(dirname(fileURLToPath(import.meta.url)), '..', 'skills/sync/sync.mjs')
let project
const sync = (...args) => spawnSync(process.execPath, [script, '--target', project, ...args], { encoding: 'utf8' })

before(() => {
  project = mkdtempSync(join(tmpdir(), 'sync-'))
  spawnSync('git', ['init', '--quiet'], { cwd: project })
  lay({ target: project, values: { PROJECT_NAME: 'Orchard' } })
})
after(() => rmSync(project, { recursive: true, force: true }))

test('the contract and the verification steps belong to the project; the checks do not', () => {
  for (const path of ['AGENTS.md', 'verify.config.json', 'risk-tiers.json', '.github/workflows/ci.yml', 'docs/adr/README.md', 'exceptions.json']) assert.equal(isManaged(path), false, path)
  for (const path of ['scripts/verify.mjs', 'scripts/agent-memory-check.mjs', '.claude/agents/reviewer-risk.md', '.githooks/pre-push']) assert.equal(isManaged(path), true, path)
})

test('each file is same, differs, missing, kept by the project, or simply the project\'s own', () => {
  const template = { 'a.mjs': 'v2', 'b.mjs': 'v2', 'c.mjs': 'v2', 'AGENTS.md.tmpl': 'skeleton', 'd.mjs': 'v2' }
  const project = { 'a.mjs': 'v2', 'b.mjs': 'v1', 'AGENTS.md': 'the real contract', 'd.mjs': 'ours' }
  const rows = compare({
    files: [
      { from: 'a.mjs', to: 'a.mjs' },
      { from: 'b.mjs', to: 'b.mjs' },
      { from: 'c.mjs', to: 'c.mjs' },
      { from: 'AGENTS.md.tmpl', to: 'AGENTS.md' },
      { from: 'd.mjs', to: 'd.mjs' },
    ],
    readTemplate: (path) => template[path] ?? null,
    readProject: (path) => project[path] ?? null,
    own: ['d.mjs'],
  })
  assert.deepEqual(rows.map((row) => row.state), ['same', 'differs', 'missing', 'project-owned', 'kept by the project'])
  assert.deepEqual(needsAction(rows).map((row) => row.path), ['b.mjs', 'c.mjs'])
})

test('a project fresh from the kickoff is level with the template', () => {
  const result = sync()
  assert.equal(result.status, 0, result.stdout + result.stderr)
  assert.match(result.stdout, /level with the template/)
})

test('editing the contract or the verification steps is the project living, not drift', () => {
  appendFileSync(join(project, 'AGENTS.md'), '\nA rule of ours.\n')
  writeFileSync(join(project, 'verify.config.json'), JSON.stringify({ fast: [{ name: 'lint', run: 'true' }] }))
  assert.equal(sync().status, 0)
})

test('a check edited by hand or deleted is reported, and --apply restores it with its mode', () => {
  appendFileSync(join(project, 'scripts/verify.mjs'), '\n// local hack\n')
  unlinkSync(join(project, '.githooks/pre-push'))
  const report = sync()
  assert.equal(report.status, 1)
  assert.match(report.stdout, /differs: scripts\/verify\.mjs/)
  assert.match(report.stdout, /missing: \.githooks\/pre-push/)
  assert.match(report.stdout, /2 file\(s\) behind the template/)

  assert.equal(sync('--apply').status, 0)
  assert.doesNotMatch(readFileSync(join(project, 'scripts/verify.mjs'), 'utf8'), /local hack/)
  assert.ok(statSync(join(project, '.githooks/pre-push')).mode & 0o100)
  assert.equal(sync().status, 0)
})

test('a file the project decided to keep is left alone, and said to be', () => {
  appendFileSync(join(project, '.claude/agents/reviewer-conformity.md'), '\nAlso check our glossary.\n')
  writeFileSync(join(project, 'setup-sync.json'), JSON.stringify({ own: ['.claude/agents/reviewer-conformity.md'] }))
  const report = sync()
  assert.equal(report.status, 0)
  assert.match(report.stdout, /kept by the project: \.claude\/agents\/reviewer-conformity\.md/)
  sync('--apply')
  assert.match(readFileSync(join(project, '.claude/agents/reviewer-conformity.md'), 'utf8'), /our glossary/)
})

test('a directory that is not a project started with the kickoff is refused', () => {
  const empty = mkdtempSync(join(tmpdir(), 'sync-empty-'))
  const result = spawnSync(process.execPath, [script, '--target', empty], { encoding: 'utf8' })
  assert.equal(result.status, 2)
  rmSync(empty, { recursive: true, force: true })
})

test('the files of an adopted module are compared too; a module the project never took is not', () => {
  const withModules = mkdtempSync(join(tmpdir(), 'sync-modules-'))
  try {
    spawnSync('git', ['init', '--quiet'], { cwd: withModules })
    kickoff({ target: withModules, values: { PROJECT_NAME: 'Orchard' }, chosen: ['dated-exceptions', 'prototype-review'] })
    const read = (path) => { try { return readFileSync(join(withModules, path), 'utf8') } catch { return null } }
    assert.deepEqual(adoptedModules(read).map((module) => module.name), ['dated-exceptions', 'prototype-review'])

    const run = (...args) => spawnSync(process.execPath, [script, '--target', withModules, ...args], { encoding: 'utf8' })
    assert.equal(run().status, 0, run().stdout)
    appendFileSync(join(withModules, 'scripts/exceptions-check.mjs'), '\n// loosened\n')
    unlinkSync(join(withModules, '.claude/agents/reviewer-prototype.md'))
    writeFileSync(join(withModules, 'exceptions.json'), '[{"rule":"x","reason":"y","owner":"z","expires":"2099-01-01","removal":"w"}]')
    const report = run()
    assert.equal(report.status, 1)
    assert.match(report.stdout, /differs: scripts\/exceptions-check\.mjs/)
    assert.doesNotMatch(report.stdout, /exceptions\.json/, 'the list of exceptions is the project\'s')
    assert.doesNotMatch(report.stdout, /weekly-digest|auto-merge/)
    run('--apply')
    assert.doesNotMatch(readFileSync(join(withModules, 'scripts/exceptions-check.mjs'), 'utf8'), /loosened/)
  } finally {
    rmSync(withModules, { recursive: true, force: true })
  }
})
