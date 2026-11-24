#!/usr/bin/env node
/**
 * Keeps what an agent loads small, and keeps stories out of it.
 *
 * The contract (`AGENTS.md`) and the path rules are read in every session. Left alone, they
 * collect the dated account of each piece of work until nobody, agent or human, reads them
 * any more. A written rule against that does not hold; a check does. This one is called from
 * four places: the agent's write hook, the pre-push hook, `scripts/verify.mjs` and CI.
 *
 * It refuses:
 *   - a file over its size cap (the contract, a path rule, a plan state, a plan file, an ADR,
 *     a pitfall);
 *   - a "Current state" section that grew instead of being replaced;
 *   - the marks of a story in a loaded file: a dated journal line, a run identifier, a
 *     session link, a counter of occurrences;
 *   - a kickoff placeholder left in the contract;
 *   - a `CLAUDE.md` that holds anything but the import of the contract.
 *
 * What it does not prove: that a rule is right, or that a paragraph is not a story in
 * disguise. Review stays the authority on substance.
 *
 * Usage: node scripts/agent-memory-check.mjs          the whole repository
 *        node scripts/agent-memory-check.mjs --hook   as a write hook, reading the hook's JSON on stdin
 */
import { execFileSync } from 'node:child_process'
import { existsSync, readFileSync } from 'node:fs'
import { join, relative } from 'node:path'
import { fileURLToPath } from 'node:url'

export const DEFAULTS = {
  /** First match wins: list the specific pattern before the general one. */
  caps: [
    { files: 'AGENTS.md', maxBytes: 16_000 },
    { files: '**/AGENTS.md', maxBytes: 8_000 },
    { files: '.claude/rules/**/*.md', maxBytes: 8_000 },
    { files: 'docs/plans/active/*/STATE.md', maxBytes: 6_000 },
    { files: 'docs/plans/**/*.md', maxBytes: 24_000 },
    { files: 'docs/adr/*.md', maxBytes: 12_000 },
    { files: 'docs/pitfalls/*.md', maxBytes: 6_000 },
  ],
  state: { file: 'AGENTS.md', heading: '## 0. Current state', maxLines: 25 },
  /** Files loaded into an agent's context: they hold rules, never a story. */
  loaded: ['AGENTS.md', '**/AGENTS.md', '.claude/rules/**/*.md'],
  placeholder: 'TODO(kickoff)',
}

/** The only content a `CLAUDE.md` may hold: Claude Code expands it into the contract. */
export const IMPORT_LINE = '@AGENTS.md'

export const STORY_MARKS = [
  {
    name: 'a dated journal line',
    pattern: /^\s*(?:[-*]\s+)?(?:\*\*)?20\d{2}-\d{2}-\d{2}(?:\*\*)?\s*(?:\([^)\n]*\)\s*)?[:—–-]\s/m,
  },
  {
    name: 'a dated chronicle entry',
    pattern: /\(20\d{2}-\d{2}-\d{2}[^)\n]*\)\s*:/,
  },
  { name: 'a run identifier', pattern: /\b\d{11}\b/ },
  { name: 'a session link', pattern: /claude\.ai\/code\/session_[A-Za-z0-9]+/ },
  { name: 'a counter of occurrences', pattern: /\b\d+(?:st|nd|rd|th)\s+(?:occurrence|time|attempt)\b/i },
]

const WHERE =
  'Write it elsewhere: a story goes in the plan of its workstream (docs/plans/active/), a ' +
  'measured trap in docs/pitfalls/, and a state replaces the "Current state" section.'

export const globToRegExp = (glob) => {
  const source = glob
    .replace(/[.+^${}()|[\]\\]/g, '\\$&')
    .replace(/\*\*\//g, '\u0000')
    .replace(/\*\*/g, '\u0001')
    .replace(/\*/g, '[^/]*')
    .replace(/\u0000/g, '(?:.*/)?')
    .replace(/\u0001/g, '.*')
  return new RegExp(`^${source}$`)
}

const matches = (path, glob) => globToRegExp(glob).test(path)
const bytes = (text) => Buffer.byteLength(text, 'utf8')
const base = (path) => path.split('/').pop()
const dir = (path) => (path.includes('/') ? path.slice(0, path.lastIndexOf('/')) : '')

/** Every path the check has an opinion on. */
export const isCovered = (path, config = DEFAULTS) =>
  base(path) === 'CLAUDE.md' || base(path) === 'AGENTS.md' || config.caps.some((cap) => matches(path, cap.files))

/** Lines of the state section that are not blank, or `null` when the section is missing. */
export const stateLines = (text, heading) => {
  const lines = text.split('\n')
  const start = lines.findIndex((line) => line.startsWith(heading))
  if (start === -1) return null
  const end = lines.findIndex((line, index) => index > start && /^## /.test(line))
  return lines.slice(start + 1, end === -1 ? lines.length : end).filter((line) => line.trim() !== '').length
}

/** `files` is a list of { path, text }, paths relative to the repository root. */
export const memoryProblems = (files, config = DEFAULTS) => {
  const problems = []
  const paths = new Set(files.map((file) => file.path))

  for (const { path, text } of files) {
    if (base(path) === 'CLAUDE.md') {
      if (text.trim() !== IMPORT_LINE) {
        problems.push(
          `${path} must hold the single line "${IMPORT_LINE}": rules are written once, in AGENTS.md. Two copies end up disagreeing.`,
        )
      }
      const contract = dir(path) ? `${dir(path)}/AGENTS.md` : 'AGENTS.md'
      if (!paths.has(contract)) problems.push(`${path} imports ${contract}, which does not exist.`)
      continue
    }

    const cap = config.caps.find((candidate) => matches(path, candidate.files))
    if (cap && bytes(text) > cap.maxBytes) {
      problems.push(`${path} is ${bytes(text)} bytes, over its ${cap.maxBytes}-byte cap. ${WHERE}`)
    }

    if (config.loaded.some((glob) => matches(path, glob))) {
      for (const mark of STORY_MARKS) {
        const found = text.match(mark.pattern)
        if (found) {
          problems.push(`${path} holds ${mark.name} ("${found[0].trim().slice(0, 50)}"). ${WHERE}`)
        }
      }
    }
  }

  const contract = files.find((file) => file.path === config.state.file)
  if (!contract) {
    problems.push(`${config.state.file} is missing: it is the contract every session loads.`)
  } else {
    const count = stateLines(contract.text, config.state.heading)
    if (count === null) {
      problems.push(`${config.state.file} has no "${config.state.heading}" section.`)
    } else if (count > config.state.maxLines) {
      problems.push(
        `"${config.state.heading}" is ${count} lines; it is replaced, not extended (${config.state.maxLines} at most). What is finished leaves for the plan of its workstream.`,
      )
    }
    if (config.placeholder && contract.text.includes(config.placeholder)) {
      const left = contract.text.split(config.placeholder).length - 1
      problems.push(
        `${config.state.file} still holds ${left} "${config.placeholder}" placeholder(s): the kickoff is not finished.`,
      )
    }
  }

  return problems
}

/**
 * A project may set its own values in `agent-memory.config.json`, for example
 * `{ "state": { "heading": "## 0. État courant" } }` when its contract is not in English.
 * A list given there replaces ours. What it may not do is switch the check off.
 */
export const mergeConfig = (own = {}) => ({ ...DEFAULTS, ...own, state: { ...DEFAULTS.state, ...own.state } })

export const configProblems = (config) => {
  const problems = []
  if (!Array.isArray(config.loaded) || !config.loaded.includes('AGENTS.md')) {
    problems.push('agent-memory.config.json: "loaded" must keep AGENTS.md, or stories are no longer refused in the contract.')
  }
  if (!Array.isArray(config.caps) || !config.caps.some((cap) => cap.files === 'AGENTS.md')) {
    problems.push('agent-memory.config.json: "caps" must keep a cap on AGENTS.md.')
  }
  if (config.placeholder !== DEFAULTS.placeholder) {
    problems.push('agent-memory.config.json: "placeholder" may not be changed: it is how an unfinished kickoff is refused.')
  }
  if (config.state?.file !== DEFAULTS.state.file) {
    problems.push('agent-memory.config.json: "state.file" may not be changed: the state section lives in AGENTS.md.')
  }
  return problems
}

/** Every value that departs from the defaults, so that a loosened check is visible each time it runs. */
export const departures = (config) => {
  const lines = []
  for (const cap of config.caps ?? []) {
    const ours = DEFAULTS.caps.find((candidate) => candidate.files === cap.files)
    if (!ours) lines.push(`cap on ${cap.files}: ${cap.maxBytes} bytes (not in the defaults)`)
    else if (ours.maxBytes !== cap.maxBytes) lines.push(`cap on ${cap.files}: ${cap.maxBytes} bytes (default ${ours.maxBytes})`)
  }
  for (const ours of DEFAULTS.caps) {
    if (!(config.caps ?? []).some((cap) => cap.files === ours.files)) lines.push(`no cap on ${ours.files} (default ${ours.maxBytes} bytes)`)
  }
  if (config.state.maxLines !== DEFAULTS.state.maxLines) lines.push(`state section: ${config.state.maxLines} lines (default ${DEFAULTS.state.maxLines})`)
  if (config.state.heading !== DEFAULTS.state.heading) lines.push(`state heading: "${config.state.heading}"`)
  for (const glob of DEFAULTS.loaded) if (!config.loaded.includes(glob)) lines.push(`stories no longer refused in ${glob}`)
  return lines
}

export const loadConfig = (root) => {
  const file = join(root, 'agent-memory.config.json')
  if (!existsSync(file)) return DEFAULTS
  return mergeConfig(JSON.parse(readFileSync(file, 'utf8')))
}

export const repositoryRoot = (cwd = process.cwd()) =>
  execFileSync('git', ['rev-parse', '--show-toplevel'], { cwd, encoding: 'utf8' }).trim()

/** Tracked files and new files not ignored: a file about to be committed counts. */
export const coveredFiles = (root, config) =>
  execFileSync('git', ['ls-files', '-z', '--cached', '--others', '--exclude-standard'], { cwd: root, encoding: 'utf8' })
    .split('\0')
    .filter((path, index, all) => path && all.indexOf(path) === index)
    .filter((path) => isCovered(path, config) && existsSync(join(root, path)))
    .map((path) => ({ path, text: readFileSync(join(root, path), 'utf8') }))

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const root = repositoryRoot()
  const config = loadConfig(root)

  if (process.argv.includes('--hook')) {
    let input = {}
    try {
      input = JSON.parse(readFileSync(0, 'utf8') || '{}')
    } catch {
      process.exit(0)
    }
    const target = input?.tool_input?.file_path ?? ''
    const path = target ? relative(root, target).replaceAll('\\', '/') : ''
    if (!path || path.startsWith('..') || !isCovered(path, config)) process.exit(0)
    const problems = [...configProblems(config), ...memoryProblems(coveredFiles(root, config), config)]
    if (problems.length > 0) {
      process.stdout.write(
        JSON.stringify({
          decision: 'block',
          reason: `The agent-memory check refuses this write. Fix it before going on:\n- ${problems.join('\n- ')}`,
        }),
      )
    }
    process.exit(0)
  }

  const files = coveredFiles(root, config)
  const problems = [...configProblems(config), ...memoryProblems(files, config)]
  for (const line of departures(config)) process.stdout.write(`agent memory: this project changed a default: ${line}\n`)
  for (const problem of problems) process.stderr.write(`agent memory: ${problem}\n`)
  if (problems.length > 0) process.exit(1)
  process.stdout.write(`agent memory: ${files.length} file(s), nothing refused.\n`)
}
