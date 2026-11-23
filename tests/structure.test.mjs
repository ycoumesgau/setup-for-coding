import assert from 'node:assert/strict'
import { existsSync, readFileSync, readdirSync } from 'node:fs'
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

const skills = readdirSync(join(root, 'skills'), { withFileTypes: true })
  .filter((entry) => entry.isDirectory())
  .map((entry) => entry.name)

test('every skill declares its name and a description the listing will not cut', () => {
  assert.deepEqual(skills.sort(), ['kickoff', 'playbook', 'sync'])
  for (const name of skills) {
    const front = text(`skills/${name}/SKILL.md`).match(/^---\n([\s\S]*?)\n---\n/)?.[1] ?? ''
    assert.match(front, new RegExp(`^name: ${name}$`, 'm'), `${name}: the name must be the folder's`)
    const description = front.match(/^description: (.+)$/m)?.[1] ?? ''
    assert.ok(description.length > 80, `${name}: the description does not say when to use it`)
    assert.ok(description.length <= 1_536, `${name}: the description is ${description.length} characters`)
  }
})

test('a skill that writes into a repository is run by a person, never picked by the model', () => {
  for (const name of ['kickoff', 'sync']) {
    assert.match(text(`skills/${name}/SKILL.md`), /^disable-model-invocation: true$/m, name)
  }
  assert.doesNotMatch(text('skills/playbook/SKILL.md'), /^disable-model-invocation:/m)
})

test('the scripts a skill tells the session to run are in the skill', () => {
  for (const name of skills) {
    const called = [...text(`skills/${name}/SKILL.md`).matchAll(/\$\{CLAUDE_SKILL_DIR\}\/([\w.-]+)/g)].map((match) => match[1])
    for (const file of called) assert.ok(existsSync(join(root, 'skills', name, file)), `${name} calls ${file}, which it does not ship`)
  }
})

test('the plugin imposes no hook and no server on the projects that install it', () => {
  // Hooks and reviewers reach a project through its own files, where it can read and change them.
  for (const path of ['hooks/hooks.json', '.mcp.json', 'agents']) assert.equal(existsSync(join(root, path)), false, path)
})

const workflows = [
  '.github/workflows/ci.yml',
  'skills/kickoff/template/dot-github/workflows/ci.yml',
  'skills/kickoff/modules/merge-queue/files/dot-github/workflows/ci.yml',
  'skills/kickoff/modules/weekly-digest/files/dot-github/workflows/weekly-digest.yml',
  'skills/kickoff/modules/auto-merge/files/dot-github/workflows/auto-merge.yml',
]

test('no workflow runs on a moving image label', () => {
  for (const path of workflows) {
    const runners = [...text(path).matchAll(/^\s+runs-on: (.+)$/gm)].map((match) => match[1])
    assert.ok(runners.length > 0, path)
    for (const runner of runners) assert.doesNotMatch(runner, /latest/, `${path} runs on ${runner}`)
  }
})

test('a run on the default branch or in a merge queue is never cancelled by the next one', () => {
  for (const path of workflows.slice(0, 3)) {
    assert.match(text(path), /cancel-in-progress: \$\{\{ github\.event_name == 'pull_request' \}\}/, path)
    assert.doesNotMatch(text(path), /cancel-in-progress: true/, path)
  }
})

test('every workflow states the permissions it needs, and CI needs only to read', () => {
  for (const path of workflows) assert.match(text(path), /^permissions:\n/m, `${path} inherits the default permissions`)
  for (const path of workflows.slice(0, 3)) assert.match(text(path), /^permissions:\n  contents: read\n\n/m, path)
})
