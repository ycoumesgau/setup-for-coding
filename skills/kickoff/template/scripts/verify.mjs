#!/usr/bin/env node
/**
 * The one command that says whether a change may go on. A session runs it before a push, CI
 * runs it on the pull request: the same steps in the same order, so CI confirms what the
 * session already saw and does not discover it.
 *
 * Two levels, declared in `verify.config.json`:
 *   - fast: what every push needs, in minutes (format, lint, types, the tests of what moved);
 *   - full: fast, then everything else (database, isolation, browser, build).
 *
 * A fast level that takes too long stops being run: its duration is printed against a budget.
 * Each level ends by naming what it does not cover.
 *
 * Usage: node scripts/verify.mjs          fast
 *        node scripts/verify.mjs --full   fast, then full
 */
import { spawnSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

/** The steps of a level, in order. `full` always starts with `fast`. */
export const stepsFor = (config, level) => {
  const fast = config.fast ?? []
  if (level === 'fast') return fast
  if (level === 'full') return [...fast, ...(config.full ?? [])]
  throw new Error(`unknown level "${level}"`)
}

/** Every step has a name and a command; a config that lacks either is refused, not skipped. */
export const configProblems = (config) => {
  const problems = []
  for (const level of ['fast', 'full']) {
    const steps = config[level] ?? []
    if (!Array.isArray(steps)) {
      problems.push(`"${level}" must be a list of steps.`)
      continue
    }
    steps.forEach((step, index) => {
      if (!step?.name || !step?.run) problems.push(`${level}[${index}] needs a "name" and a "run" command.`)
    })
  }
  if ((config.fast ?? []).length === 0) problems.push('"fast" is empty: a push would be checked by nothing.')
  return problems
}

/** Runs the steps; stops at the first failure. `run(command)` returns an exit status. */
export const execute = (steps, run, now = Date.now) => {
  const results = []
  for (const step of steps) {
    const start = now()
    const status = run(step.run)
    results.push({ name: step.name, seconds: Math.round((now() - start) / 1000), ok: status === 0 })
    if (status !== 0) break
  }
  return results
}

export const report = (results, { level, config }) => {
  const lines = results.map((result) => `  ${result.ok ? 'ok  ' : 'FAIL'} ${result.name} (${result.seconds}s)`)
  const total = results.reduce((sum, result) => sum + result.seconds, 0)
  const failed = results.find((result) => !result.ok)
  if (failed) {
    lines.push(`verify: "${failed.name}" failed. Fix it; do not bypass it.`)
    return { ok: false, lines }
  }
  lines.push(`verify: ${level} is green in ${total}s.`)
  const budget = config.fastBudgetSeconds
  if (level === 'fast' && budget && total > budget) {
    lines.push(`verify: fast took ${total}s, over its ${budget}s budget. Move a step to "full" or make it quicker.`)
  }
  const notCovered = config.notCovered?.[level] ?? []
  lines.push(notCovered.length > 0 ? `Not covered at this level: ${notCovered.join('; ')}.` : 'Not covered at this level: nothing declared.')
  return { ok: true, lines }
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const root = spawnSync('git', ['rev-parse', '--show-toplevel'], { encoding: 'utf8' }).stdout.trim() || process.cwd()
  const config = JSON.parse(readFileSync(join(root, 'verify.config.json'), 'utf8'))
  const problems = configProblems(config)
  if (problems.length > 0) {
    for (const problem of problems) process.stderr.write(`verify.config.json: ${problem}\n`)
    process.exit(1)
  }
  const level = process.argv.includes('--full') ? 'full' : 'fast'
  const run = (command) => {
    process.stdout.write(`verify: ${command}\n`)
    return spawnSync(command, { cwd: root, shell: true, stdio: 'inherit' }).status ?? 1
  }
  const { ok, lines } = report(execute(stepsFor(config, level), run), { level, config })
  process.stdout.write(`${lines.join('\n')}\n`)
  process.exit(ok ? 0 : 1)
}
