#!/usr/bin/env node
/**
 * An exception to a rule carries an expiry date. Past it, this check fails.
 *
 * Without a date, an exception is not an exception: it is the new rule, and nobody decided
 * it. Each entry of `exceptions.json` names the rule it breaks, why, who owns it, when it
 * ends, and which test or code must change when it does.
 *
 * Usage: node scripts/exceptions-check.mjs
 */
import { spawnSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

const FIELDS = ['rule', 'reason', 'owner', 'expires', 'removal']
const SOON_DAYS = 14

/** `today` is an ISO date. Returns { problems, warnings }. */
export const exceptionProblems = (exceptions, today) => {
  const problems = []
  const warnings = []
  if (!Array.isArray(exceptions)) return { problems: ['exceptions.json must hold a list.'], warnings }
  exceptions.forEach((entry, index) => {
    const label = entry?.rule ? `"${entry.rule}"` : `entry ${index}`
    for (const field of FIELDS) {
      if (typeof entry?.[field] !== 'string' || entry[field].trim() === '') problems.push(`${label}: "${field}" is missing.`)
    }
    const expires = entry?.expires ?? ''
    if (!/^\d{4}-\d{2}-\d{2}$/.test(expires) || Number.isNaN(Date.parse(expires))) {
      if (expires) problems.push(`${label}: "expires" is not a date (YYYY-MM-DD).`)
      return
    }
    const days = Math.round((Date.parse(expires) - Date.parse(today)) / 86_400_000)
    if (days < 0) {
      problems.push(`${label} expired on ${expires} (owner: ${entry.owner}). Remove what it allowed, or renew it in a reviewed change that says why the date was missed.`)
    } else if (days <= SOON_DAYS) {
      warnings.push(`${label} expires in ${days} day(s), on ${expires} (owner: ${entry.owner}).`)
    }
  })
  return { problems, warnings }
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const root = spawnSync('git', ['rev-parse', '--show-toplevel'], { encoding: 'utf8' }).stdout.trim() || process.cwd()
  const exceptions = JSON.parse(readFileSync(join(root, 'exceptions.json'), 'utf8'))
  const { problems, warnings } = exceptionProblems(exceptions, new Date().toISOString().slice(0, 10))
  for (const warning of warnings) process.stdout.write(`exceptions: ${warning}\n`)
  for (const problem of problems) process.stderr.write(`exceptions: ${problem}\n`)
  if (problems.length > 0) process.exit(1)
  process.stdout.write(`exceptions: ${exceptions.length} in force, none expired.\n`)
}
