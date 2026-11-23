/**
 * The overlap map on real git repositories: a bare "remote", and clones that each push a
 * branch, as sessions do.
 */
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { after, before, test } from 'node:test'
import { fileURLToPath } from 'node:url'

import { hotFiles, overlaps, render } from '../skills/kickoff/template/scripts/overlap.mjs'

const script = join(dirname(fileURLToPath(import.meta.url)), '..', 'skills/kickoff/template/scripts/overlap.mjs')

test('branches are ranked by the files they share with mine; the others are left out', () => {
  const found = overlaps(['a.ts', 'b.ts', 'c.ts'], [
    { name: 'one', files: ['a.ts', 'x.ts'] },
    { name: 'two', files: ['c.ts', 'b.ts', 'a.ts'] },
    { name: 'three', files: ['y.ts'] },
  ])
  assert.deepEqual(found.map((branch) => [branch.name, branch.shared]), [
    ['two', ['a.ts', 'b.ts', 'c.ts']],
    ['one', ['a.ts']],
  ])
})

test('a file changed by two live branches is hot, whoever asks', () => {
  const hot = hotFiles([
    { name: 'one', files: ['index.md', 'a.ts'] },
    { name: 'two', files: ['index.md'] },
    { name: 'three', files: ['index.md', 'a.ts'] },
  ])
  assert.deepEqual(hot, [
    { file: 'index.md', branches: ['one', 'three', 'two'] },
    { file: 'a.ts', branches: ['one', 'three'] },
  ])
})

test('the alert stays a few lines long, however many branches overlap', () => {
  const now = 1_000_000
  const found = Array.from({ length: 9 }, (_, index) => ({
    name: `branch-${index}`,
    time: now - 3600 * (index + 1),
    session: index === 0 ? 'https://example.com/session/abc' : '',
    shared: ['a.ts', 'b.ts', 'c.ts', 'd.ts', 'e.ts'],
  }))
  const lines = render({ mine: ['a.ts'], found, live: 12, now })
  assert.equal(lines.length, 9)
  assert.match(lines[0], /9 of 12 live branch\(es\)/)
  assert.match(lines[1], /branch-0, 1h ago \(https:\/\/example\.com\/session\/abc\): a\.ts, b\.ts, c\.ts, \+2/)
  assert.match(lines[7], /and 3 more/)
  assert.deepEqual(render({ mine: [], found: [], live: 3, now }), ['overlap: this branch has changed no file yet.'])
  assert.match(render({ mine: ['a.ts'], found: [], live: 3, now })[0], /none of the 3 other live branch/)
})

let sandbox
const git = (cwd, ...args) => {
  const result = spawnSync('git', args, { cwd, encoding: 'utf8' })
  assert.equal(result.status, 0, `git ${args.join(' ')}: ${result.stderr}`)
  return result.stdout.trim()
}
const commit = (clone, files, message) => {
  for (const [path, text] of Object.entries(files)) {
    mkdirSync(dirname(join(clone, path)), { recursive: true })
    writeFileSync(join(clone, path), text)
  }
  git(clone, 'add', '-A')
  git(clone, '-c', 'user.name=Test', '-c', 'user.email=test@example.com', '-c', 'commit.gpgsign=false', 'commit', '--quiet', '-m', message)
}
const clone = (name) => {
  const path = join(sandbox, name)
  git(sandbox, 'clone', '--quiet', join(sandbox, 'remote.git'), path)
  return path
}
const overlap = (cwd, ...args) => spawnSync(process.execPath, [script, ...args], { cwd, encoding: 'utf8' })

before(() => {
  sandbox = mkdtempSync(join(tmpdir(), 'overlap-'))
  git(sandbox, 'init', '--quiet', '--bare', '--initial-branch=main', 'remote.git')
  git(join(sandbox, 'remote.git'), 'config', 'uploadpack.allowFilter', 'true')

  const seed = clone('seed')
  git(seed, 'checkout', '--quiet', '-b', 'main')
  commit(seed, { 'src/billing.ts': '1', 'src/users.ts': '1', 'docs/index.md': '1' }, 'start')
  git(seed, 'push', '--quiet', 'origin', 'main')

  const billing = clone('billing')
  git(billing, 'checkout', '--quiet', '-b', 'feature/billing')
  commit(billing, { 'src/billing.ts': '2', 'docs/index.md': '2' }, 'feat: invoices\n\nClaude-Session: https://example.com/session/billing')
  git(billing, 'push', '--quiet', 'origin', 'feature/billing')

  const users = clone('users')
  git(users, 'checkout', '--quiet', '-b', 'feature/users')
  commit(users, { 'src/users.ts': '2' }, 'feat: roles')
  git(users, 'push', '--quiet', 'origin', 'feature/users')
})

after(() => rmSync(sandbox, { recursive: true, force: true }))

test('a session sees the branch that changed its files, and where to find that session', () => {
  const mine = clone('mine')
  git(mine, 'checkout', '--quiet', '-b', 'feature/dunning')
  commit(mine, { 'src/billing.ts': '3' }, 'feat: dunning')
  writeFileSync(join(mine, 'docs/index.md'), 'not committed yet')

  const result = overlap(mine)
  assert.equal(result.status, 0, result.stderr)
  assert.match(result.stdout, /1 of 2 live branch\(es\) touch files you changed/)
  assert.match(result.stdout, /feature\/billing, \d+h ago \(https:\/\/example\.com\/session\/billing\): docs\/index\.md, src\/billing\.ts/)
  assert.doesNotMatch(result.stdout, /feature\/users/)

  const json = JSON.parse(overlap(mine, '--json').stdout)
  assert.deepEqual(json.mine, ['docs/index.md', 'src/billing.ts'])
  assert.deepEqual(json.overlaps.map((branch) => branch.name), ['feature/billing'])
})

test('a session that touched nothing shared is told so in one line', () => {
  const quiet = clone('quiet')
  git(quiet, 'checkout', '--quiet', '-b', 'feature/emails')
  commit(quiet, { 'src/emails.ts': '1' }, 'feat: emails')
  const result = overlap(quiet)
  assert.equal(result.stdout.trim(), 'overlap: none of the 2 other live branch(es) touches your 1 file(s).')
})

test('a branch that stopped moving is not live: the window decides', () => {
  const mine = clone('window')
  git(mine, 'checkout', '--quiet', '-b', 'feature/late')
  commit(mine, { 'src/billing.ts': '9' }, 'feat: late')
  const result = overlap(mine, '--days', '0')
  assert.match(result.stdout, /none of the 0 other live branch/)
})

test('a branch merged by squash is no longer live, though nobody deleted it', () => {
  const merger = clone('merger')
  // What a squash merge leaves: the base holds the branch's content, in a commit of its own.
  commit(merger, { 'src/users.ts': '2' }, 'feat: roles (squashed)')
  git(merger, 'push', '--quiet', 'origin', 'main')

  const mine = clone('after-merge')
  git(mine, 'checkout', '--quiet', '-b', 'feature/profile')
  commit(mine, { 'src/users.ts': '5' }, 'feat: profile')
  const result = overlap(mine)
  assert.doesNotMatch(result.stdout, /feature\/users/)
  assert.match(result.stdout, /none of the 1 other live branch/)
})

test('without a remote there is nobody to overlap with, and it says so without failing', () => {
  const alone = join(sandbox, 'alone')
  git(sandbox, 'init', '--quiet', '--initial-branch=main', alone)
  const result = overlap(alone)
  assert.equal(result.status, 0)
  assert.match(result.stdout, /no "origin" remote/)
})

test('the working clone is left as it was: the map lives in its own cache', () => {
  const mine = clone('untouched')
  const before = git(mine, 'for-each-ref')
  overlap(mine)
  assert.equal(git(mine, 'for-each-ref'), before)
  assert.equal(git(mine, 'status', '--porcelain'), '')
})
