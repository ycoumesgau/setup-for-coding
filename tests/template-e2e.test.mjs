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

import { fill, kickoff, lay, targetPath, templateFiles } from '../skills/kickoff/init.mjs'

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
    'scripts/overlap.mjs',
    'scripts/risk-tier.mjs',
    'risk-tiers.json',
    '.github/ISSUE_TEMPLATE/decide.md',
    '.github/ISSUE_TEMPLATE/owed.md',
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
  assert.match(read('.githooks/pre-push'), /^node scripts\/verify\.mjs \|\| exit 1$/m)
  // The overlap map informs; it must never be what stops a push.
  assert.match(read('.githooks/pre-push'), /^node scripts\/overlap\.mjs 2>\/dev\/null \|\| true$/m)
})

test('each reviewer declares its tools, and only the risk reviewer may execute', () => {
  const tools = (name) => read(`.claude/agents/${name}.md`).match(/^tools: (.+)$/m)[1]
  assert.equal(tools('reviewer-conformity'), 'Read, Grep, Glob')
  assert.equal(tools('reviewer-prototype'), 'Read, Grep, Glob')
  assert.equal(tools('reviewer-risk'), 'Read, Grep, Glob, Bash')
  assert.match(read('.claude/agents/reviewer-risk.md'), /^disallowedTools: WebFetch, WebSearch$/m)
})

test('the tier of a change is computed in the project, from what its branch touched', () => {
  finishKickoff()
  const commit = (message) => {
    sh('git', ['add', '-A'])
    const done = sh('git', ['-c', 'user.name=Test', '-c', 'user.email=test@example.com', '-c', 'commit.gpgsign=false', 'commit', '--quiet', '-m', message])
    assert.equal(done.status, 0, done.stderr)
  }
  commit('kickoff')
  sh('git', ['checkout', '--quiet', '-b', 'feature'])

  sh('mkdir', ['-p', 'docs/plans/active/billing', 'src'])
  write('docs/plans/active/billing/STATE.md', 'Where we are.\n')
  commit('docs: plan')
  const content = node(['scripts/risk-tier.mjs', '--base', 'main', '--max', '0'])
  assert.equal(content.status, 0, content.stderr)
  assert.match(content.stdout, /^risk tier 0: content only/)

  write('src/total.ts', 'export const total = 1\n')
  commit('feat: total')
  const code = node(['scripts/risk-tier.mjs', '--base', 'main', '--max', '0'])
  assert.equal(code.status, 1, 'ordinary code must not pass as tier 0')
  assert.match(code.stdout, /^risk tier 1: [\s\S]*set by: src\/total\.ts/)

  write('verify.config.json', read('verify.config.json'))
  write('scripts/verify.mjs', `${read('scripts/verify.mjs')}\n`)
  commit('chore: touch the check')
  assert.match(node(['scripts/risk-tier.mjs', '--base', 'main']).stdout, /^risk tier 2: [\s\S]*set by: scripts\/verify\.mjs/)

  const piped = node(['scripts/risk-tier.mjs', '--stdin', '--json'], { input: 'docs/a.md\nAGENTS.md\n' })
  assert.deepEqual(JSON.parse(piped.stdout), { tier: 2, setBy: ['AGENTS.md'], files: 2 })
  sh('git', ['checkout', '--quiet', 'main'])
})

test('a kickoff with modules lays their files first and wires their checks', () => {
  const other = mkdtempSync(join(tmpdir(), 'kickoff-modules-'))
  try {
    spawnSync('git', ['init', '--quiet', '--initial-branch=main'], { cwd: other })
    const { written } = kickoff({ target: other, values: { PROJECT_NAME: 'Orchard' }, chosen: ['merge-queue', 'dated-exceptions'] })
    const at = (path) => readFileSync(join(other, path), 'utf8')

    assert.equal(written.filter((path) => path === '.github/workflows/ci.yml').length, 1, 'ci.yml laid twice')
    assert.match(at('.github/workflows/ci.yml'), /^\s+merge_group:$/m)
    assert.match(at('.github/workflows/ci.yml'), /github\.event_name != 'pull_request' && '--full' \|\| ''/)
    assert.deepEqual(JSON.parse(at('verify.config.json')).fast.map((step) => step.name), ['agent memory', 'dated exceptions'])

    writeFileSync(join(other, 'AGENTS.md'), at('AGENTS.md').replaceAll('TODO(kickoff)', 'Decided at kickoff'))
    const run = (args) => spawnSync(process.execPath, args, { cwd: other, encoding: 'utf8' })
    assert.equal(run(['scripts/verify.mjs']).status, 0)

    const expired = [{ rule: 'no real data in a bench', reason: 'one measurement', owner: 'the owner', expires: '2020-01-01', removal: 'the bench flag' }]
    writeFileSync(join(other, 'exceptions.json'), JSON.stringify(expired))
    const red = run(['scripts/verify.mjs'])
    assert.equal(red.status, 1, 'an expired exception must stop the push')
    assert.match(red.stderr, /expired on 2020-01-01/)
  } finally {
    rmSync(other, { recursive: true, force: true })
  }
  assert.throws(() => kickoff({ target: project, values: { PROJECT_NAME: 'x' }, chosen: ['time-travel'] }), /unknown module\(s\): time-travel/)
})

test('a module workflow that writes to the repository says why, and reads pull request text as data', () => {
  const workflow = (name, file) => readFileSync(new URL(`../skills/kickoff/modules/${name}/files/dot-github/workflows/${file}`, import.meta.url), 'utf8')
  const auto = workflow('auto-merge', 'auto-merge.yml')
  assert.match(auto, /ref: \$\{\{ github\.event\.pull_request\.base\.sha \}\}/, 'the tier must be computed with the base branch rules')
  assert.doesNotMatch(auto, /pull_request_target/)
  const digest = workflow('weekly-digest', 'weekly-digest.yml')
  assert.match(digest, /--body-file digest\.md/)
  for (const text of [auto, digest]) {
    // Titles and bodies never reach a shell line: only through files or environment variables.
    assert.doesNotMatch(text, /run:[^\n]*\$\{\{ *github\.event\.pull_request\.(title|body)/)
    assert.doesNotMatch(text, /\$\{\{ *github\.event\.pull_request\.(title|body) *\}\}/)
  }
})
