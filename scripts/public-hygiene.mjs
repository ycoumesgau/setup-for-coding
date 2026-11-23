#!/usr/bin/env node
/**
 * Keeps this public repository free of private material and written in English.
 *
 * It reads every tracked text file and reports, line by line:
 *   - paths that point outside a repository (a home directory, a mounted drive);
 *   - links to private agent sessions;
 *   - e-mail addresses, except the documented placeholders;
 *   - strings shaped like credentials;
 *   - hostnames of real deployments on common platforms;
 *   - terms of a private deny-list, supplied through HYGIENE_DENYLIST and never committed;
 *   - lines written in French.
 *
 * What it does not cover: a private name the deny-list does not hold, an image, the git
 * history. A finding prints the rule and where, never the matched text in full: this output
 * ends up in CI logs.
 *
 * Usage: node scripts/public-hygiene.mjs
 */
import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const EMAIL_ALLOWED = [
  /^noreply@anthropic\.com$/i,
  /@example\.(com|org|net)$/i,
  /@users\.noreply\.github\.com$/i,
]

const HOST_PLACEHOLDERS = /^(example|your-[a-z-]+|my-[a-z-]+|project-ref|app|www)$/i

/** Each rule returns the matched strings found in one line. */
export const rules = [
  {
    name: 'private-path',
    why: 'a path outside the repository',
    find: (line) =>
      line.match(
        /(?:\/mnt\/|\/root\/|\/home\/[A-Za-z0-9._-]+\/|\/Users\/[A-Za-z0-9._-]+\/|[A-Z]:\\Users\\|\/tmp\/claude-[A-Za-z0-9._-]*\/|(?<![\w.\/-])~\/[A-Za-z0-9._-]+\/)\S*/g,
      ) ?? [],
  },
  {
    name: 'session-link',
    why: 'a link to a private agent session',
    find: (line) => line.match(/claude\.ai\/(?:code\/session_|code\/artifact\/|artifact\/|chat\/|share\/)[A-Za-z0-9_-]+/g) ?? [],
  },
  {
    name: 'email',
    why: 'an e-mail address',
    find: (line) =>
      (line.match(/[A-Za-z0-9._%+-]+@[A-Za-z0-9-]+(?:\.[A-Za-z0-9-]+)+/g) ?? []).filter(
        (address) => !EMAIL_ALLOWED.some((allowed) => allowed.test(address)),
      ),
  },
  {
    name: 'credential',
    why: 'a string shaped like a credential',
    find: (line) =>
      line.match(
        /sk-ant-[A-Za-z0-9_-]{8,}|sk-proj-[A-Za-z0-9_-]{8,}|[sr]k_(?:live|test)_[A-Za-z0-9]{10,}|AIza[0-9A-Za-z_-]{20,}|gh[pousr]_[A-Za-z0-9]{20,}|github_pat_[A-Za-z0-9_]{20,}|AKIA[0-9A-Z]{16}|xox[baprs]-[A-Za-z0-9-]{10,}|-----BEGIN [A-Z ]*PRIVATE KEY-----|eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}/g,
      ) ?? [],
  },
  {
    name: 'deployment-host',
    why: 'the hostname of a real deployment',
    find: (line) =>
      [
        ...line.matchAll(
          /\b([a-z0-9][a-z0-9-]*)\.(?:supabase\.co|vercel\.app|fly\.dev|onrender\.com|up\.railway\.app|herokuapp\.com|netlify\.app)\b/gi,
        ),
      ]
        .filter((match) => !HOST_PLACEHOLDERS.test(match[1]))
        .map((match) => match[0]),
  },
]

/**
 * French function words. Three different ones on a line mark it as French: an English line
 * can hold one by accident ("pour", "sur"), rarely three.
 */
// Two words a line: written on one line, the list would be the only French line of the repository.
const FRENCH_WORDS = new Set([
  ...['le', 'la'],
  ...['les', 'des'],
  ...['une', 'est'],
  ...['sont', 'avec'],
  ...['dans', 'pour'],
  ...['que', 'qui'],
  ...['sur', 'pas'],
  ...['cette', 'ces'],
  ...['nous', 'vous'],
  ...['aux', 'du'],
  ...['et', 'ou'],
  ...['ne', 'se'],
  ...['au'],
])

export const isFrench = (line) => {
  const words = line.toLowerCase().match(/[a-zà-öø-ÿ]+/g) ?? []
  const hits = new Set(words.filter((word) => FRENCH_WORDS.has(word)))
  return hits.size >= 3
}

/** Terms come from the environment, one per line or comma: the list itself is private. */
export const parseDenylist = (raw) =>
  (raw ?? '')
    .split(/[\n,]/)
    .map((term) => term.trim().toLowerCase())
    .filter((term) => term.length >= 3)

/**
 * A term counts only where a word starts: "ace-" must not match inside "place-holder". The end
 * is left open, so a prefix such as a ticket key matches every ticket.
 */
export const holdsTerm = (line, term) => {
  const escaped = term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  return new RegExp(`(?<![a-z0-9])${escaped}`, 'i').test(line)
}

/** Never print a match in full: the first three characters are enough to find it. */
export const mask = (text) => `${text.slice(0, 3)}…(${text.length} chars)`

/**
 * `files` is a list of { path, text }. `exempt` maps a path to the rule names it may break:
 * the tests of this check must hold violations to prove it sees them.
 */
export const findings = (files, { denylist = [], exempt = {} } = {}) => {
  const found = []
  for (const { path, text } of files) {
    const skipped = new Set(exempt[path] ?? [])
    text.split('\n').forEach((line, index) => {
      const at = `${path}:${index + 1}`
      for (const rule of rules) {
        if (skipped.has(rule.name)) continue
        for (const match of rule.find(line)) {
          found.push({ at, rule: rule.name, why: rule.why, shown: mask(match) })
        }
      }
      if (!skipped.has('denylist')) {
        for (const term of denylist) {
          if (holdsTerm(line, term)) {
            found.push({ at, rule: 'denylist', why: 'a term of the private deny-list', shown: mask(term) })
          }
        }
      }
      if (!skipped.has('language') && isFrench(line)) {
        found.push({ at, rule: 'language', why: 'a line written in French', shown: mask(line.trim()) })
      }
    })
  }
  return found
}

/** The only files allowed to hold violations: the fixtures that prove each rule. */
export const EXEMPT = {
  'tests/public-hygiene.test.mjs': ['private-path', 'session-link', 'email', 'credential', 'deployment-host', 'language'],
}

const BINARY = /\.(png|jpe?g|gif|webp|avif|ico|pdf|woff2?|ttf|otf|zip|gz|mp4|mov|riv)$/i

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const root = join(dirname(fileURLToPath(import.meta.url)), '..')
  const tracked = execFileSync('git', ['ls-files', '-z'], { cwd: root, encoding: 'utf8' })
    .split('\0')
    .filter((path) => path && !BINARY.test(path))
  const files = tracked.map((path) => ({ path, text: readFileSync(join(root, path), 'utf8') }))
  const denylist = parseDenylist(process.env.HYGIENE_DENYLIST)
  const found = findings(files, { denylist, exempt: EXEMPT })

  for (const { at, rule, why, shown } of found) {
    process.stderr.write(`${at}: ${rule}: ${why} (${shown})\n`)
  }
  process.stdout.write(
    denylist.length > 0
      ? `public hygiene: ${files.length} files, ${denylist.length} private terms checked.\n`
      : `public hygiene: ${files.length} files. HYGIENE_DENYLIST is not set: private names were not checked.\n`,
  )
  if (found.length > 0) {
    process.stderr.write(`public hygiene: ${found.length} finding(s). Remove them; this repository is public.\n`)
    process.exit(1)
  }
}
