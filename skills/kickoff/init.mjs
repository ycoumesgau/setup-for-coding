#!/usr/bin/env node
/**
 * Lays the project template into a repository. The deterministic half of the kickoff: which
 * files a project receives, under which names. The other half, deciding what goes in them,
 * belongs to the session that runs the kickoff skill.
 *
 * Template names are neutral so that nothing in this repository mistakes them for its own
 * configuration: `dot-claude/` becomes `.claude/`, `AGENTS.md.tmpl` becomes `AGENTS.md`.
 *
 * It never overwrites: a file that already exists is reported and left alone. Optional
 * modules (`modules/<name>/`) are laid first, so that a module's version of a file wins over
 * the template's; the steps a module declares are added to `verify.config.json`.
 *
 * Usage: node init.mjs --target <repository> --name "<project name>" [--modules a,b] [--dry-run]
 *        node init.mjs --list-modules
 */
import { chmodSync, copyFileSync, existsSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const HERE = dirname(fileURLToPath(import.meta.url))
export const TEMPLATE = join(HERE, 'template')
export const MODULES = join(HERE, 'modules')

/** `dot-claude/agents/x.md` to `.claude/agents/x.md`; `AGENTS.md.tmpl` to `AGENTS.md`. */
export const targetPath = (templatePath) =>
  templatePath
    .split('/')
    .map((part) => (part.startsWith('dot-') ? `.${part.slice(4)}` : part))
    .join('/')
    .replace(/\.tmpl$/, '')

const walk = (folder, prefix = '') =>
  readdirSync(folder, { withFileTypes: true })
    .sort((a, b) => a.name.localeCompare(b.name))
    .flatMap((entry) => {
      const path = prefix ? `${prefix}/${entry.name}` : entry.name
      return entry.isDirectory() ? walk(join(folder, entry.name), path) : [path]
    })

/** Every file of the template, as { from, to }, paths relative to their roots. */
export const templateFiles = (template = TEMPLATE) => walk(template).map((from) => ({ from, to: targetPath(from) }))

export const fill = (text, values) =>
  text.replace(/\{\{([A-Z_]+)\}\}/g, (whole, key) => {
    if (!(key in values)) throw new Error(`the template asks for {{${key}}}, which the kickoff did not provide`)
    return values[key]
  })

/** Writes what is missing; returns what it wrote and what it left alone. */
export const lay = ({ target, values, template = TEMPLATE, dryRun = false }) => {
  const written = []
  const kept = []
  for (const { from, to } of templateFiles(template)) {
    const destination = join(target, to)
    if (existsSync(destination)) {
      kept.push(to)
      continue
    }
    written.push(to)
    if (dryRun) continue
    mkdirSync(dirname(destination), { recursive: true })
    const source = join(template, from)
    if (from.endsWith('.tmpl')) {
      writeFileSync(destination, fill(readFileSync(source, 'utf8'), values))
    } else {
      copyFileSync(source, destination)
    }
    chmodSync(destination, statSync(source).mode)
  }
  return { written, kept }
}

/** Every optional module: its name, when to adopt it, what it adds, what it does not prove. */
export const modules = (folder = MODULES) =>
  readdirSync(folder, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => JSON.parse(readFileSync(join(folder, entry.name, 'module.json'), 'utf8')))
    .sort((a, b) => a.name.localeCompare(b.name))

/** The steps a module declares, appended to the project's levels; a step already there is kept once. */
export const mergeVerify = (config, addition = {}) => {
  const merged = { ...config }
  for (const level of ['fast', 'full']) {
    const present = new Set((config[level] ?? []).map((step) => step.name))
    merged[level] = [...(config[level] ?? []), ...(addition[level] ?? []).filter((step) => !present.has(step.name))]
  }
  return merged
}

/** A whole kickoff: the chosen modules first, then the template, then the modules' verify steps. */
export const kickoff = ({ target, values, chosen = [], dryRun = false }) => {
  const known = modules()
  const unknown = chosen.filter((name) => !known.some((module) => module.name === name))
  if (unknown.length > 0) throw new Error(`unknown module(s): ${unknown.join(', ')}. Known: ${known.map((module) => module.name).join(', ')}`)

  const written = []
  const kept = []
  for (const name of chosen) {
    const result = lay({ target, values, template: join(MODULES, name, 'files'), dryRun })
    written.push(...result.written)
    kept.push(...result.kept)
  }
  const base = lay({ target, values, dryRun })
  written.push(...base.written)
  kept.push(...base.kept.filter((path) => !written.includes(path)))

  if (!dryRun) {
    const file = join(target, 'verify.config.json')
    let config = JSON.parse(readFileSync(file, 'utf8'))
    for (const name of chosen) config = mergeVerify(config, known.find((module) => module.name === name).verify)
    writeFileSync(file, `${JSON.stringify(config, null, 2)}\n`)
  }
  return { written, kept }
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  if (process.argv.includes('--list-modules')) {
    for (const module of modules()) {
      process.stdout.write(`${module.name}\n  adopt it when: ${module.trigger}\n  it adds: ${module.adds}\n`)
      for (const limit of module.limits ?? []) process.stdout.write(`  limit: ${limit}\n`)
    }
    process.exit(0)
  }
  const option = (name) => {
    const index = process.argv.indexOf(`--${name}`)
    return index === -1 ? undefined : process.argv[index + 1]
  }
  const target = option('target')
  const name = option('name')
  if (!target || !name) {
    process.stderr.write('Usage: node init.mjs --target <repository> --name "<project name>" [--modules a,b] [--dry-run]\n')
    process.exit(2)
  }
  if (!existsSync(join(target, '.git'))) {
    process.stderr.write(`${target} is not a git repository. Run \`git init\` there first.\n`)
    process.exit(2)
  }
  const dryRun = process.argv.includes('--dry-run')
  const chosen = (option('modules') ?? '').split(',').map((entry) => entry.trim()).filter(Boolean)
  const { written, kept } = kickoff({ target, values: { PROJECT_NAME: name }, chosen, dryRun })
  for (const path of written) process.stdout.write(`${dryRun ? 'would write' : 'wrote'} ${path}\n`)
  for (const path of kept) process.stdout.write(`kept ${path} (already there; compare it with the template by hand)\n`)
  process.stdout.write(
    `${written.length} file(s) ${dryRun ? 'to write' : 'written'}, ${kept.length} kept. ` +
      'Next: fill every TODO(kickoff) in AGENTS.md; the agent-memory check refuses to pass until none is left.\n',
  )
}
