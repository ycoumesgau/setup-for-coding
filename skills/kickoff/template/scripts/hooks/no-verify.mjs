#!/usr/bin/env node
/**
 * Agent hook (PreToolUse, Bash): refuses a git command that skips the repository's hooks.
 *
 * The pre-push hook runs what CI would run on the change. Skipping it moves the discovery of
 * a failure to CI, where it costs more and blocks others. A hook that fails is fixed, not
 * skipped; a hook that is itself wrong is corrected in a visible change.
 *
 * `git commit -n` means `--no-verify`; `git push -n` means `--dry-run`. Hence two patterns.
 *
 * What it does not prove: a matcher on the command line does not see a command built
 * otherwise (a script, a variable). It closes the door agents actually use; CI stays the
 * authority.
 */
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

const COMMIT = /\bgit\b[^\n;&|]*\bcommit\b[^\n;&|]*(?:\s--no-verify\b|\s-[a-zA-Z]*n[a-zA-Z]*\b)/
const PUSH_OR_MERGE = /\bgit\b[^\n;&|]*\b(?:push|merge|rebase|am|cherry-pick)\b[^\n;&|]*\s--no-verify\b/

/** Pointing git at another hooks folder, or at none, skips them just as well. */
const movesHooks = (bare) => {
  for (const [, value] of bare.matchAll(/\bgit\b[^\n;&|]*\s-c\s+core\.hooksPath=(\S*)/g)) {
    if (value !== '.githooks') return true
  }
  for (const [, rest] of bare.matchAll(/\bgit\b[^\n;&|]*\bconfig\b([^\n;&|]*\bcore\.hooksPath\b[^\n;&|]*)/g)) {
    if (/--get\b|--get-all\b|--list\b|\s-l\b/.test(rest)) continue
    if (/\bcore\.hooksPath\s+\.githooks\s*$/.test(rest)) continue
    return true
  }
  return false
}
const HUSKY_OFF = /\bHUSKY=0\b/

/**
 * The command without what it quotes: text between quotes and the body of a heredoc. A commit
 * message that describes this hook must not be refused as if it used the option.
 */
const unquoted = (command) =>
  command
    .replace(/<<-?\s*['"]?(\w+)['"]?[\s\S]*?\n\s*\1\b/g, ' ')
    .replace(/'[^']*'/g, "''")
    .replace(/"(?:[^"\\]|\\.)*"/g, '""')

/** The reason for the refusal, or `null` when the command is allowed. */
export const noVerifyRefusal = (command) => {
  if (typeof command !== 'string') return null
  const bare = unquoted(command)
  if (COMMIT.test(bare) || PUSH_OR_MERGE.test(bare) || movesHooks(bare) || HUSKY_OFF.test(bare)) {
    return (
      'Skipping the git hooks is refused. The hook that failed says what to fix, and ' +
      '`node scripts/verify.mjs` replays it on demand. If the hook itself is wrong, correct it in a visible change.'
    )
  }
  return null
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  let input = {}
  try {
    input = JSON.parse(readFileSync(0, 'utf8') || '{}')
  } catch {
    process.exit(0)
  }
  const reason = noVerifyRefusal(input?.tool_input?.command)
  if (reason) {
    process.stdout.write(
      JSON.stringify({
        hookSpecificOutput: {
          hookEventName: 'PreToolUse',
          permissionDecision: 'deny',
          permissionDecisionReason: reason,
        },
      }),
    )
  }
  process.exit(0)
}
