import assert from 'node:assert/strict'
import { test } from 'node:test'

import { noVerifyRefusal } from '../skills/kickoff/template/scripts/hooks/no-verify.mjs'
import { sessionStart } from '../skills/kickoff/template/scripts/hooks/session-start.mjs'

const refused = (command) => assert.ok(noVerifyRefusal(command), `should be refused: ${command}`)
const allowed = (command) => assert.equal(noVerifyRefusal(command), null, `should be allowed: ${command}`)

test('skipping the hooks is refused, whatever the spelling', () => {
  refused('git commit --no-verify -m "x"')
  refused('git commit -n -m "x"')
  refused('git commit -anm "x"')
  refused('git push --no-verify origin main')
  refused('cd app && git push origin main --no-verify')
  refused('git merge --no-verify feature')
  refused('HUSKY=0 git push')
  refused('git -c core.hooksPath=/dev/null push')
  refused('git config core.hooksPath /tmp/none')
  refused('git config --unset core.hooksPath')
})

test('the same bypass under another spelling is refused too', () => {
  refused('git push --no-verif origin main')
  refused('git push --no-ver origin main')
  refused('git push "--no-verify" origin main')
  refused("git commit '--no-verify' -m x")
  refused('git -c core.hookspath=/dev/null push')
  refused('git -c CORE.HOOKSPATH=/dev/null push')
  refused('git config Core.HooksPath /tmp/none')
  refused('GIT_CONFIG_COUNT=1 GIT_CONFIG_KEY_0=core.hooksPath GIT_CONFIG_VALUE_0=/dev/null git push')
  refused('GIT_CONFIG_PARAMETERS="\'core.hooksPath=/dev/null\'" git push')
  refused('bash -c "git push --no-verify"')
  refused("sh -c 'git commit -n -m x'")
  refused('bash <<EOF\ngit push --no-verify\nEOF')
  refused('git push \\\n  --no-verify origin main')
  refused('rm .githooks/pre-push && git push')
  refused('chmod -x .githooks/pre-push; git push')
  refused('mv .githooks .githooks.off && git push')
  refused('truncate -s 0 .githooks/pre-push')
  refused('echo "exit 0" > .githooks/pre-push && git push')
  refused('cp /dev/null .githooks/pre-push')
  refused('sed -i d .githooks/pre-push')
  refused(`node -e "require('child_process').execSync('git push --no-verify')"`)
  refused(`python3 -c "import subprocess; subprocess.run(['git', 'push', '--no-verify'])"`)
})

test('reading a hook, or naming the option in a message, is not skipping it', () => {
  allowed('cat .githooks/pre-push')
  allowed('sed -n 1,5p .githooks/pre-push')
  allowed('ls -la .githooks')
  allowed('git diff > /tmp/out.txt; cat .githooks/pre-push')
  allowed('node --test && git commit -m "the hook refuses --no-verify"')
  allowed('node scripts/verify.mjs && git push origin main')
})

test('ordinary git commands pass', () => {
  allowed('git commit -m "fix: the importer"')
  allowed('git push -u origin feature')
  allowed('git push -n origin feature')
  allowed('git commit --amend --no-edit')
  allowed('git config --get core.hooksPath')
  allowed('git config core.hooksPath .githooks')
  allowed('git -c core.hooksPath=.githooks push')
  allowed('npm run lint -- --no-verify')
})

test('describing the option is not using it', () => {
  allowed('git commit -m "docs: say that --no-verify is refused"')
  allowed("git commit -m 'never run git push --no-verify'")
  allowed('git commit -F - <<EOF\nfix: refuse git commit --no-verify\nEOF')
  allowed('git commit -m "the hook now refuses GIT_CONFIG_COUNT and a removed .githooks folder"')
  allowed('cat .githooks/pre-push')
  allowed('ls -la .githooks && git status')
  allowed('bash scripts/dev.sh && git push origin feature')
})

test('anything that is not a command is ignored', () => {
  allowed(undefined)
  allowed(42)
})

const git = (answers) => (args) => answers[args.join(' ')] ?? { status: 0, stdout: '' }

test('a fresh clone gets its hooks path, and is told so', () => {
  const calls = []
  const lines = sessionStart({
    hasHooks: true,
    git: (args) => {
      calls.push(args.join(' '))
      return { status: 0, stdout: '' }
    },
  })
  assert.deepEqual(calls, ['config --get core.hooksPath', 'config core.hooksPath .githooks'])
  assert.match(lines[0], /now read from \.githooks/)
  assert.match(lines.at(-1), /verify\.mjs --full/)
})

test('a clone already set up is left alone, and the session still gets its reminder', () => {
  const lines = sessionStart({ hasHooks: true, git: git({ 'config --get core.hooksPath': { status: 0, stdout: '.githooks\n' } }) })
  assert.equal(lines.length, 1)
})

test('a clone pointed at another hooks folder is brought back to the repository\'s', () => {
  const calls = []
  const lines = sessionStart({
    hasHooks: true,
    git: (args) => {
      calls.push(args.join(' '))
      return { status: 0, stdout: args[1] === '--get' ? '/tmp/elsewhere\n' : '' }
    },
  })
  assert.ok(calls.includes('config core.hooksPath .githooks'))
  assert.match(lines[0], /now read from \.githooks/)
})

test('a repository without hooks is not given a hooks path', () => {
  const calls = []
  sessionStart({ hasHooks: false, git: (args) => (calls.push(args.join(' ')), { status: 0, stdout: '' }) })
  assert.deepEqual(calls, [])
})

test('when git refuses the setting, the session is told to run the check itself', () => {
  const lines = sessionStart({ hasHooks: true, git: git({ 'config core.hooksPath .githooks': { status: 1, stdout: '' } }) })
  assert.match(lines[0], /could not point git/)
})
