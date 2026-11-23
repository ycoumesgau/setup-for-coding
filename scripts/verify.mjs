#!/usr/bin/env node
/**
 * The one command that decides whether a change may be pushed. A session runs it before a
 * push and CI runs it on the pull request: the same steps, in the same order, so CI confirms
 * what the session already saw.
 *
 * Usage: node scripts/verify.mjs
 */
import { spawnSync } from 'node:child_process'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')

const steps = [
  ['tests', ['--test']],
  ['public hygiene', ['scripts/public-hygiene.mjs']],
]

for (const [label, args] of steps) {
  process.stdout.write(`verify: ${label}\n`)
  const { status } = spawnSync(process.execPath, args, { cwd: root, stdio: 'inherit' })
  if (status !== 0) {
    process.stderr.write(`verify: ${label} failed. Fix it; do not bypass it.\n`)
    process.exit(1)
  }
}

process.stdout.write(
  'verify: green. Not covered: whether the plugin loads in a session, and private names when HYGIENE_DENYLIST is not set.\n',
)
