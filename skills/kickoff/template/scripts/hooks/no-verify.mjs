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
 * What it does not prove: it reads one command line. A command built elsewhere (a script
 * written first and run next, a variable, an alias) passes. It stops the accident and the
 * shortcut, not a determined evasion; CI, which nothing here can skip, stays the authority.
 */
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

/** Git accepts any unambiguous prefix of a long option: `--no-verif` skips the hooks as well. */
const SKIP = String.raw`--no-ver[a-z]*`
const COMMIT = new RegExp(String.raw`\bgit\b[^\n;&|]*\bcommit\b[^\n;&|]*(?:\s${SKIP}\b|\s-[a-zA-Z]*n[a-zA-Z]*\b)`)
const OTHERS = new RegExp(String.raw`\bgit\b[^\n;&|]*\b(?:push|merge|rebase|am|cherry-pick)\b[^\n;&|]*\s${SKIP}\b`)

/** Ways to make git ignore the repository's hooks without naming the option. */
const AROUND = [
  // Configuration passed through the environment.
  /\bGIT_CONFIG_(?:COUNT|KEY_\d+|VALUE_\d+|PARAMETERS|GLOBAL|SYSTEM)\b/,
  /\bHUSKY=0\b/,
  // The hooks folder itself removed, moved, emptied or overwritten from a shell. Editing a
  // hook as a file, in a visible change, is the way; reading one is allowed.
  /(?:>|\b(?:rm|mv|cp|chmod|truncate|unlink|tee|ln|install|dd)\b|\bsed\s+-i)[^\n;&|]*\.githooks\b/,
]

/** Pointing git at another hooks folder, or at none, skips them just as well. */
const movesHooks = (bare) => {
  for (const [, value] of bare.matchAll(/\bgit\b[^\n;&|]*\s-c\s+core\.hookspath=(\S*)/gi)) {
    if (value !== '.githooks') return true
  }
  for (const [, rest] of bare.matchAll(/\bgit\b[^\n;&|]*\bconfig\b([^\n;&|]*\bcore\.hookspath\b[^\n;&|]*)/gi)) {
    if (/--get\b|--get-all\b|--list\b|\s-l\b/.test(rest)) continue
    if (/\bcore\.hookspath\s+\.githooks\s*$/i.test(rest)) continue
    return true
  }
  return false
}

/**
 * The command without what it quotes: text between quotes and the body of a heredoc. A commit
 * message that describes this hook must not be refused as if it used the option. A quoted
 * string that is nothing but an option (`"--no-verify"`) is kept: quoting it changes nothing
 * for git.
 */
const unquoted = (command) =>
  command
    .replace(/<<-?\s*['"]?(\w+)['"]?[\s\S]*?\n\s*\1\b/g, ' ')
    .replace(/'([^']*)'/g, (whole, inner) => (/^-{1,2}[\w.=-]+$/.test(inner) ? inner : "''"))
    .replace(/"((?:[^"\\]|\\.)*)"/g, (whole, inner) => (/^-{1,2}[\w.=-]+$/.test(inner) ? inner : '""'))

/** A shell or an interpreter given its code as text, or fed one: what it runs is inside the quotes. */
const RUNS_A_SHELL = /\b(?:bash|sh|zsh|dash|ksh|eval|xargs)\b|\b(?:node|deno|bun|python3?|perl|ruby|php)\b[^\n;&|]*\s-(?:e|c|p|-eval|-print)\b/

const refuses = (text) => COMMIT.test(text) || OTHERS.test(text) || movesHooks(text) || AROUND.some((pattern) => pattern.test(text))

/** The reason for the refusal, or `null` when the command is allowed. */
export const noVerifyRefusal = (command) => {
  if (typeof command !== 'string') return null
  // A backslash at the end of a line continues the command on the next one.
  const joined = command.replace(/\\\r?\n/g, ' ')
  const hidden = RUNS_A_SHELL.test(joined) && refuses(joined.replace(/['"]/g, ' '))
  if (refuses(unquoted(joined)) || hidden) {
    return (
      'Skipping the git hooks is refused, and so is rewriting `.githooks/` from the shell. The hook that failed ' +
      'says what to fix, and `node scripts/verify.mjs` replays it on demand. If the hook itself is wrong, edit it as a file, in a visible change.'
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
