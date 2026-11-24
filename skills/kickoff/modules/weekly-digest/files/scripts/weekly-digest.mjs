#!/usr/bin/env node
/**
 * Gathers the decisions of a week of merged pull requests into one text.
 *
 * Reading every pull request teaches approval without reading; reading none loses the
 * decisions. Once a week, this collects the "Decisions" section each pull request carries.
 *
 * Usage: gh pr list --state merged --search "merged:>=2026-01-05" \
 *          --json number,title,url,body --limit 200 | node scripts/weekly-digest.mjs
 */
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

/** The lines of the "Decisions" section of a pull request body, comments and blanks removed. */
export const decisionsOf = (body) => {
  const section = (body ?? '').replace(/<!--[\s\S]*?-->/g, '').split(/^## Decisions\s*$/m)[1]
  if (section === undefined) return null
  return section
    .split(/^## /m)[0]
    .split('\n')
    .map((line) => line.replace(/^\s*[-*]\s+/, '').trim())
    .filter((line) => line !== '' && !/^none\.?$/i.test(line))
}

export const digest = (pulls) => {
  const withDecisions = []
  const without = []
  const missing = []
  for (const pull of pulls) {
    const decisions = decisionsOf(pull.body)
    if (decisions === null) missing.push(pull)
    else if (decisions.length === 0) without.push(pull)
    else withDecisions.push({ pull, decisions })
  }
  const lines = [`${pulls.length} pull request(s) merged; ${withDecisions.length} carried a decision.`, '']
  for (const { pull, decisions } of withDecisions) {
    lines.push(`### #${pull.number} ${pull.title}`, '', ...decisions.map((decision) => `- ${decision}`), '', pull.url, '')
  }
  if (missing.length > 0) {
    lines.push('### No Decisions section', '', ...missing.map((pull) => `- #${pull.number} ${pull.title}`), '')
  }
  if (without.length > 0) lines.push(`${without.length} pull request(s) declared no decision.`, '')
  return lines.join('\n')
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  process.stdout.write(digest(JSON.parse(readFileSync(0, 'utf8') || '[]')))
}
