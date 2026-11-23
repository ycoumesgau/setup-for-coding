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

test('when git refuses the setting, the session is told to run the check itself', () => {
  const lines = sessionStart({ hasHooks: true, git: git({ 'config core.hooksPath .githooks': { status: 1, stdout: '' } }) })
  assert.match(lines[0], /could not point git/)
})
