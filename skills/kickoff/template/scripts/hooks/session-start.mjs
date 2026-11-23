#!/usr/bin/env node
/**
 * Agent hook (SessionStart): makes a fresh clone behave like the repository expects.
 *
 * A cloud session starts from a new clone, where nothing has pointed git at the repository's
 * hooks yet. Without this, the pre-push check silently does not run.
 *
 * Whatever this prints is added to the session's context: it stays to a few lines.
 */
import { spawnSync } from 'node:child_process'
import { existsSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

/** The lines shown to the session. `git(args)` returns { status, stdout }. */
export const sessionStart = ({ git, hasHooks }) => {
  const lines = []
  if (hasHooks) {
    const current = git(['config', '--get', 'core.hooksPath']).stdout.trim()
    if (current !== '.githooks') {
      const set = git(['config', 'core.hooksPath', '.githooks'])
      lines.push(
        set.status === 0
          ? 'Git hooks: now read from .githooks (the pre-push check runs `node scripts/verify.mjs`).'
          : 'Git hooks: could not point git at .githooks. Run `node scripts/verify.mjs` yourself before every push.',
      )
    }
  }
  lines.push('Before a push: `node scripts/verify.mjs`. Before opening a pull request: `node scripts/verify.mjs --full`.')
  return lines
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const root = spawnSync('git', ['rev-parse', '--show-toplevel'], { encoding: 'utf8' }).stdout.trim() || process.cwd()
  const git = (args) => {
    const result = spawnSync('git', args, { cwd: root, encoding: 'utf8' })
    return { status: result.status ?? 1, stdout: result.stdout ?? '' }
  }
  const lines = sessionStart({ git, hasHooks: existsSync(join(root, '.githooks', 'pre-push')) })
  process.stdout.write(`${lines.join('\n')}\n`)
}
