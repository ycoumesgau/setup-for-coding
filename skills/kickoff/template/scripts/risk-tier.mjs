#!/usr/bin/env node
/**
 * How much care a change needs, computed from the files it touches.
 *
 * Asking a person to approve everything teaches them to approve without reading. The tier is
 * decided by code instead, from paths, so that attention goes where a mistake costs:
 *   0  content only: merges once CI is green and one fresh-context review found nothing blocking;
 *   1  ordinary code: reviewed with fresh context, merged by whoever holds the merge;
 *   2  checks, CI, access, money, schema: a second review pass by someone who did not write
 *      it, and the owner merges.
 *
 * The rules live in `risk-tiers.json`. The first rule that matches a file gives its tier; a
 * change takes the highest tier among its files.
 *
 * What it does not see: a risky change in a file whose path looks harmless. Reviewers read
 * the diff; this only decides how many of them, and who merges.
 *
 * Usage: node scripts/risk-tier.mjs [--base origin/main] [--max 0] [--json]
 *        git diff --name-only ... | node scripts/risk-tier.mjs --stdin
 */
import { spawnSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

import { globToRegExp } from './agent-memory-check.mjs'

export const tierOfFile = (file, config) => {
  for (const rule of config.rules) {
    if (rule.paths.some((glob) => globToRegExp(glob).test(file))) return rule.tier
  }
  return config.default
}

/** The tier of a change and the files that set it; `null` when nothing changed. */
export const tierOf = (files, config) => {
  if (files.length === 0) return { tier: null, setBy: [] }
  const tiers = files.map((file) => ({ file, tier: tierOfFile(file, config) }))
  const tier = Math.max(...tiers.map((entry) => entry.tier))
  return { tier, setBy: tiers.filter((entry) => entry.tier === tier).map((entry) => entry.file).sort() }
}

export const configProblems = (config) => {
  const problems = []
  if (!Array.isArray(config.rules) || config.rules.length === 0) problems.push('"rules" must be a non-empty list.')
  for (const [index, rule] of (config.rules ?? []).entries()) {
    if (![0, 1, 2].includes(rule.tier)) problems.push(`rules[${index}]: "tier" must be 0, 1 or 2.`)
    if (!Array.isArray(rule.paths) || rule.paths.length === 0) problems.push(`rules[${index}]: "paths" must be a non-empty list.`)
  }
  if (![0, 1, 2].includes(config.default)) problems.push('"default" must be 0, 1 or 2.')
  // An unknown file must never be the cheapest kind: silence would become permission.
  if (config.default === 0) problems.push('"default" may not be 0: a file no rule names is not content by default.')
  return problems
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const git = (args) => spawnSync('git', args, { encoding: 'utf8' })
  const root = git(['rev-parse', '--show-toplevel']).stdout.trim() || process.cwd()
  const config = JSON.parse(readFileSync(join(root, 'risk-tiers.json'), 'utf8'))
  const problems = configProblems(config)
  if (problems.length > 0) {
    for (const problem of problems) process.stderr.write(`risk-tiers.json: ${problem}\n`)
    process.exit(2)
  }
  const option = (name) => {
    const index = process.argv.indexOf(`--${name}`)
    return index === -1 ? undefined : process.argv[index + 1]
  }
  let files
  if (process.argv.includes('--stdin')) {
    files = readFileSync(0, 'utf8').split('\n').map((line) => line.trim()).filter(Boolean)
  } else {
    const base = option('base') ?? 'origin/main'
    const diff = git(['diff', '--no-renames', '--name-only', `${base}...HEAD`])
    if (diff.status !== 0) {
      process.stderr.write(`risk tier: cannot compare with ${base} (${diff.stderr.trim().split('\n')[0]}). Fetch it, or pass --base.\n`)
      process.exit(2)
    }
    files = diff.stdout.split('\n').filter(Boolean)
  }
  const result = tierOf(files, config)
  if (process.argv.includes('--json')) {
    process.stdout.write(`${JSON.stringify({ ...result, files: files.length })}\n`)
  } else if (result.tier === null) {
    process.stdout.write('risk tier: no file changed.\n')
  } else {
    const shown = result.setBy.slice(0, 5).join(', ') + (result.setBy.length > 5 ? `, +${result.setBy.length - 5}` : '')
    process.stdout.write(`risk tier ${result.tier}: ${config.tiers?.[result.tier] ?? ''}\n  set by: ${shown}\n`)
  }
  const max = option('max')
  if (max !== undefined && result.tier !== null && result.tier > Number(max)) process.exit(1)
}
