#!/usr/bin/env node
/**
 * Compares a project's copy of the template's tooling with the template as it is today.
 *
 * A project receives two kinds of files at kickoff. Some it owns from then on: its contract,
 * its verification steps, its tiers, its CI. Others are tooling it should not have to
 * maintain: the checks, the hooks, the reviewers. Those are improved here, in the plugin, and
 * this script tells a project which of its copies fell behind.
 *
 * A project that changed one of them on purpose lists it under "own" in `setup-sync.json`;
 * it is then left alone, and reported as such.
 *
 * Usage: node sync.mjs --target <repository>            report; exit 1 if anything differs
 *        node sync.mjs --target <repository> --apply    write the template's version
 */
import { chmodSync, copyFileSync, existsSync, mkdirSync, readFileSync, statSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

import { MODULES, TEMPLATE, modules, templateFiles } from '../kickoff/init.mjs'

/** What a project owns once it has it: never compared, only reported when missing. */
export const PROJECT_OWNED = [
  'AGENTS.md',
  'CLAUDE.md',
  '.claude/settings.json',
  '.github/workflows/ci.yml',
  '.github/pull_request_template.md',
  'verify.config.json',
  'risk-tiers.json',
  'exceptions.json',
  // Guidance a project is expected to adapt to its own words.
  'docs/adr/README.md',
  'docs/plans/README.md',
  'docs/pitfalls/README.md',
]

/**
 * The modules a project adopted: those with a file of their own already in the project. A
 * module whose only file replaces one of the template's cannot be told apart, and what it
 * replaces is the project's anyway.
 */
export const adoptedModules = (readProject, all = modules(), base = templateFiles()) =>
  all.filter((module) =>
    templateFiles(join(MODULES, module.name, 'files')).some(
      ({ to }) => !base.some((file) => file.to === to) && isManaged(to) && readProject(to) !== null,
    ),
  )

export const isManaged = (path) => !PROJECT_OWNED.includes(path)

/** Each template file with its state in the project. `read(path)` returns text or `null`. */
export const compare = ({ files, readTemplate, readProject, own = [] }) =>
  files.map(({ from, to }) => {
    const mine = readProject(to)
    if (mine === null) return { path: to, state: 'missing' }
    if (!isManaged(to)) return { path: to, state: 'project-owned' }
    if (own.includes(to)) return { path: to, state: 'kept by the project' }
    return { path: to, state: mine === readTemplate(from) ? 'same' : 'differs' }
  })

export const needsAction = (rows) => rows.filter((row) => row.state === 'missing' || row.state === 'differs')

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const index = process.argv.indexOf('--target')
  const target = index === -1 ? undefined : process.argv[index + 1]
  if (!target || !existsSync(join(target, 'AGENTS.md'))) {
    process.stderr.write('Usage: node sync.mjs --target <repository> [--apply]\nThe target must be a project started with the kickoff (it has an AGENTS.md).\n')
    process.exit(2)
  }
  const read = (root) => (path) => (existsSync(join(root, path)) ? readFileSync(join(root, path), 'utf8') : null)
  const config = read(target)('setup-sync.json')
  const own = config ? (JSON.parse(config).own ?? []) : []
  // The template's files, then those of each adopted module, each read from where it lives.
  const sources = [{ root: TEMPLATE, files: templateFiles() }]
  for (const module of adoptedModules(read(target))) {
    const root = join(MODULES, module.name, 'files')
    sources.push({ root, files: templateFiles(root).filter((file) => !sources[0].files.some((known) => known.to === file.to)) })
  }
  const files = sources.flatMap((source) => source.files.map((file) => ({ ...file, root: source.root })))
  const rows = files.flatMap((file) => compare({ files: [file], readTemplate: read(file.root), readProject: read(target), own }))
  const todo = needsAction(rows)

  for (const row of rows) if (row.state !== 'same' && row.state !== 'project-owned') process.stdout.write(`${row.state}: ${row.path}\n`)

  if (process.argv.includes('--apply')) {
    for (const row of todo) {
      // A file the project owns is created when missing, as at kickoff, but with its placeholders: fill them.
      const { from, root } = files.find((file) => file.to === row.path)
      const destination = join(target, row.path)
      mkdirSync(dirname(destination), { recursive: true })
      copyFileSync(join(root, from), destination)
      chmodSync(destination, statSync(join(root, from)).mode)
    }
    process.stdout.write(`${todo.length} file(s) written. Read \`git diff\`, run \`node scripts/verify.mjs --full\`, and open a pull request: tooling is tier 2.\n`)
    process.exit(0)
  }
  process.stdout.write(todo.length === 0 ? 'The project is level with the template.\n' : `${todo.length} file(s) behind the template. Run again with --apply on a branch.\n`)
  process.exit(todo.length === 0 ? 0 : 1)
}
