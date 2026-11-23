import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { test } from 'node:test'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const json = (path) => JSON.parse(readFileSync(join(root, path), 'utf8'))
const text = (path) => readFileSync(join(root, path), 'utf8')

test('the repository has no dependency', () => {
  const pkg = json('package.json')
  for (const field of ['dependencies', 'devDependencies', 'peerDependencies', 'optionalDependencies']) {
    assert.equal(pkg[field], undefined, `package.json declares ${field}`)
  }
})

test('the marketplace lists the plugin under the name of its manifest, at the repository root', () => {
  const plugin = json('.claude-plugin/plugin.json')
  const marketplace = json('.claude-plugin/marketplace.json')
  assert.equal(marketplace.plugins.length, 1)
  const [entry] = marketplace.plugins
  // Installing by manifest name fails when the two names differ.
  assert.equal(entry.name, plugin.name)
  assert.equal(entry.source, './')
  assert.match(plugin.name, /^[a-z][a-z0-9-]*$/)
})

test('CLAUDE.md imports the contract and holds nothing else', () => {
  assert.equal(text('CLAUDE.md').trim(), '@AGENTS.md')
})

test('CI runs the command a session runs, and only that', () => {
  const runs = text('.github/workflows/ci.yml')
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.startsWith('run:') || line.startsWith('- run:'))
  assert.deepEqual(runs, ['- run: node scripts/verify.mjs'])
})
