/**
 * Lays the template in a throwaway repository, as a kickoff does, and proves each check there:
 * green on the project as delivered, red on the violation it exists to refuse.
 */
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { appendFileSync, mkdtempSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { after, before, test } from 'node:test'

import { fill, lay, targetPath, templateFiles } from '../skills/kickoff/init.mjs'

let project

const sh = (command, args, options = {}) =>
  spawnSync(command, args, { cwd: project, encoding: 'utf8', ...options })
const node = (args, options) => sh(process.execPath, args, options)
const read = (path) => readFileSync(join(project, path), 'utf8')
const write = (path, text) => writeFileSync(join(project, path), text)

/** What the session does after the files are laid: decide, and replace each placeholder. */
const finishKickoff = () =>
  write('AGENTS.md', read('AGENTS.md').replaceAll('TODO(kickoff)', 'Decided at kickoff'))

before(() => {
  project = mkdtempSync(join(tmpdir(), 'kickoff-'))
  sh('git', ['init', '--quiet', '--initial-branch=main'])
  lay({ target: project, values: { PROJECT_NAME: 'Orchard' } })
})

after(() => rmSync(project, { recursive: true, force: true }))

test('template names map to the names a project uses', () => {
  assert.equal(targetPath('dot-claude/agents/reviewer-risk.md'), '.claude/agents/reviewer-risk.md')
  assert.equal(targetPath('dot-github/workflows/ci.yml'), '.github/workflows/ci.yml')
  assert.equal(targetPath('AGENTS.md.tmpl'), 'AGENTS.md')
  assert.equal(targetPath('scripts/hooks/no-verify.mjs'), 'scripts/hooks/no-verify.mjs')
  assert.equal(targetPath('docs/dotted-name.md'), 'docs/dotted-name.md')
})

test('the project receives its contract, its checks, its reviewers and its CI', () => {
  const received = templateFiles().map((file) => file.to)
  for (const path of [
    'AGENTS.md',
    'CLAUDE.md',
    '.claude/settings.json',
    '.claude/agents/reviewer-conformity.md',
    '.claude/agents/reviewer-risk.md',
    '.claude/agents/reviewer-prototype.md',
    '.githooks/pre-push',
    '.github/workflows/ci.yml',
    '.github/pull_request_template.md',
    'scripts/verify.mjs',
    'scripts/agent-memory-check.mjs',
    'scripts/hooks/no-verify.mjs',
    'scripts/hooks/session-start.mjs',
    'verify.config.json',
    'docs/adr/README.md',
    'docs/plans/README.md',
    'docs/pitfalls/README.md',
  ]) {
    assert.ok(received.includes(path), `missing from the template: ${path}`)
    assert.ok(statSync(join(project, path)).isFile(), `not laid: ${path}`)
  }
  assert.match(read('AGENTS.md'), /^# AGENTS\.md — Orchard$/m)
  assert.equal(read('CLAUDE.md').trim(), '@AGENTS.md')
  assert.ok(statSync(join(project, '.githooks/pre-push')).mode & 0o100, 'the pre-push hook lost its execute bit')
})

test('a placeholder the kickoff did not provide stops the kickoff', () => {
  assert.throws(() => fill('# {{PROJECT_NAME}} by {{OWNER}}', { PROJECT_NAME: 'Orchard' }), /\{\{OWNER\}\}/)
})

test('laying the template twice overwrites nothing', () => {
  write('AGENTS.md', `${read('AGENTS.md')}\n<!-- edited by the project -->\n`)
  const { written, kept } = lay({ target: project, values: { PROJECT_NAME: 'Other' } })
  assert.deepEqual(written, [])
  assert.ok(kept.includes('AGENTS.md'))
  assert.match(read('AGENTS.md'), /edited by the project/)
  assert.match(read('AGENTS.md'), /Orchard/)
})

test('an unfinished kickoff is refused; a finished one is green', () => {
  const unfinished = node(['scripts/verify.mjs'])
  assert.equal(unfinished.status, 1)
  assert.match(unfinished.stderr, /"TODO\(kickoff\)" placeholder\(s\): the kickoff is not finished/)

  finishKickoff()
  const finished = node(['scripts/verify.mjs'])
  assert.equal(finished.status, 0, finished.stdout + finished.stderr)
  assert.match(finished.stdout, /verify: fast is green/)
  assert.match(finished.stdout, /Not covered at this level: /)
  assert.equal(node(['scripts/verify.mjs', '--full']).status, 0)
})

test('the memory check turns red on each thing it exists to refuse', () => {
  finishKickoff()
  const contract = read('AGENTS.md')
  const violations = [
    ['a contract over its cap', () => appendFileSync(join(project, 'AGENTS.md'), `\n${'x'.repeat(16_000)}\n`), /over its 16000-byte cap/],
    ['a story in the contract', () => appendFileSync(join(project, 'AGENTS.md'), '\n- 2026-03-04: the session rebuilt the importer.\n'), /a dated journal line/],
    ['a state that grew', () => write('AGENTS.md', contract.replace('## 0. Current state\n', `## 0. Current state\n\n${'- one more line\n'.repeat(30)}`)), /replaced, not extended/],
    ['a second copy of the rules', () => write('CLAUDE.md', '@AGENTS.md\n\nAlso, be careful.\n'), /must hold the single line/],
    ['a plan state that grew', () => { sh('mkdir', ['-p', 'docs/plans/active/billing']); write('docs/plans/active/billing/STATE.md', 'y'.repeat(7_000)) }, /STATE\.md is 7000 bytes/],
  ]
  for (const [name, violate, expected] of violations) {
    violate()
    const result = node(['scripts/agent-memory-check.mjs'])
    assert.equal(result.status, 1, `stayed green on ${name}`)
    assert.match(result.stderr, expected, name)
    write('AGENTS.md', contract)
    write('CLAUDE.md', '@AGENTS.md\n')
    rmSync(join(project, 'docs/plans/active/billing'), { recursive: true, force: true })
  }
  assert.equal(node(['scripts/agent-memory-check.mjs']).status, 0)
})

test('as a write hook, the memory check blocks the write that broke the contract', () => {
  finishKickoff()
  const contract = read('AGENTS.md')
  const hook = (file) =>
    node(['scripts/agent-memory-check.mjs', '--hook'], { input: JSON.stringify({ tool_input: { file_path: join(project, file) } }) })

  assert.equal(hook('AGENTS.md').stdout, '')
  appendFileSync(join(project, 'AGENTS.md'), '\nThe run 45200903757 was red.\n')
  const blocked = JSON.parse(hook('AGENTS.md').stdout)
  assert.equal(blocked.decision, 'block')
  assert.match(blocked.reason, /a run identifier/)
  assert.equal(hook('src/index.ts').stdout, '', 'a file outside the memory must not trigger the check')
  write('AGENTS.md', contract)
})

test('the agent hook refuses a push that skips the hooks, and lets an ordinary push through', () => {
  const hook = (command) => node(['scripts/hooks/no-verify.mjs'], { input: JSON.stringify({ tool_input: { command } }) })
  const refused = JSON.parse(hook('git push --no-verify origin main').stdout)
  assert.equal(refused.hookSpecificOutput.permissionDecision, 'deny')
  assert.equal(hook('git push origin main').stdout, '')
})

test('a fresh clone is pointed at its hooks when the session starts', () => {
  assert.notEqual(sh('git', ['config', '--get', 'core.hooksPath']).stdout.trim(), '.githooks')
  const started = node(['scripts/hooks/session-start.mjs'])
  assert.equal(started.status, 0)
  assert.match(started.stdout, /now read from \.githooks/)
  assert.equal(sh('git', ['config', '--get', 'core.hooksPath']).stdout.trim(), '.githooks')
  assert.doesNotMatch(node(['scripts/hooks/session-start.mjs']).stdout, /now read from/)
})

test('the settings wire each hook to a script the project received', () => {
  const settings = JSON.parse(read('.claude/settings.json'))
  const commands = Object.values(settings.hooks).flatMap((groups) => groups.flatMap((group) => group.hooks.map((hook) => hook.command)))
  assert.equal(commands.length, 3)
  for (const command of commands) {
    const script = command.split(' ')[1]
    assert.ok(statSync(join(project, script)).isFile(), `settings.json calls ${script}, which is not in the project`)
  }
})

test('the project CI runs the full level of the same command, and nothing else', () => {
  const runs = read('.github/workflows/ci.yml')
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.startsWith('- run:'))
  assert.deepEqual(runs, ['- run: node scripts/verify.mjs --full'])
  assert.match(read('.githooks/pre-push'), /exec node scripts\/verify\.mjs\n/)
})

test('each reviewer declares its tools, and only the risk reviewer may execute', () => {
  const tools = (name) => read(`.claude/agents/${name}.md`).match(/^tools: (.+)$/m)[1]
  assert.equal(tools('reviewer-conformity'), 'Read, Grep, Glob')
  assert.equal(tools('reviewer-prototype'), 'Read, Grep, Glob')
  assert.equal(tools('reviewer-risk'), 'Read, Grep, Glob, Bash')
  assert.match(read('.claude/agents/reviewer-risk.md'), /^disallowedTools: WebFetch, WebSearch$/m)
})
