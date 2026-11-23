#!/usr/bin/env node
/**
 * Who else is touching the files you are touching.
 *
 * Many sessions work on one repository at once, sometimes from several accounts that cannot
 * message each other. Nothing here asks them to announce themselves: the map is derived from
 * what they already do, which is push branches. No registry to keep, no lock to forget.
 *
 * It reads the remote's branches, keeps the ones that moved lately, and compares the files
 * each changed since it left the base branch with the files this branch changed. It prints
 * the branches that share files with yours, and where the session behind each can be found
 * when its commits say so.
 *
 * It needs two habits to be useful: sessions push their branch often (a push without a pull
 * request costs nothing), and merged branches are deleted (the hosting platform can do it at
 * merge). A file that a merged branch changed and that no longer differs from the base drops
 * out by itself, which thins the noise of forgotten branches without removing it.
 *
 * It works in caches of its own inside `.git/`, fetched without file contents: a few seconds
 * and a few megabytes on a repository with hundreds of branches, and the working clone is
 * never disturbed.
 *
 * What it does not see: work that was never pushed, and a conflict of meaning between two
 * files that do not overlap.
 *
 * Usage: node scripts/overlap.mjs [--days 14] [--base main] [--all] [--json]
 */
import { spawnSync } from 'node:child_process'
import { existsSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

/** Branches sharing at least one file with `mine`, the most entangled first. */
export const overlaps = (mine, branches) => {
  const own = new Set(mine)
  return branches
    .map((branch) => ({ ...branch, shared: branch.files.filter((file) => own.has(file)).sort() }))
    .filter((branch) => branch.shared.length > 0)
    .sort((a, b) => b.shared.length - a.shared.length || a.name.localeCompare(b.name))
}

/** Files changed by two live branches or more: where the next conflict will be. */
export const hotFiles = (branches) => {
  const count = new Map()
  for (const branch of branches) for (const file of branch.files) count.set(file, [...(count.get(file) ?? []), branch.name])
  return [...count.entries()]
    .filter(([, names]) => names.length > 1)
    .map(([file, names]) => ({ file, branches: names.sort() }))
    .sort((a, b) => b.branches.length - a.branches.length || a.file.localeCompare(b.file))
}

const age = (seconds, now) => {
  const hours = Math.max(0, Math.round((now - seconds) / 3600))
  return hours < 48 ? `${hours}h ago` : `${Math.round(hours / 24)}d ago`
}

/** A few lines at most: this is read at the start of a session, where every line is paid for. */
export const render = ({ mine, found, live, now, limit = 6 }) => {
  if (mine.length === 0) return ['overlap: this branch has changed no file yet.']
  if (found.length === 0) return [`overlap: none of the ${live} other live branch(es) touches your ${mine.length} file(s).`]
  const lines = [`overlap: ${found.length} of ${live} live branch(es) touch files you changed.`]
  for (const branch of found.slice(0, limit)) {
    const files = branch.shared.slice(0, 3).join(', ') + (branch.shared.length > 3 ? `, +${branch.shared.length - 3}` : '')
    const where = branch.session ? ` (${branch.session})` : ''
    lines.push(`  ${branch.name}, ${age(branch.time, now)}${where}: ${files}`)
  }
  if (found.length > limit) lines.push(`  and ${found.length - limit} more: run with --json for the whole list.`)
  lines.push('Read their diff before you edit those files, or split the work.')
  return lines
}

const run = (cwd, args) => {
  const result = spawnSync('git', args, { cwd, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 })
  return { ok: result.status === 0, out: (result.stdout ?? '').trim(), err: (result.stderr ?? '').trim() }
}

/** A bare repository under `.git/`, pointed at the same remote, fetched with a filter. */
const cacheRepo = (root, gitDir, name, url, filter) => {
  const path = join(gitDir, name)
  if (!existsSync(path)) {
    run(root, ['init', '--quiet', '--bare', path])
    run(path, ['remote', 'add', 'origin', url])
  }
  run(path, ['remote', 'set-url', 'origin', url])
  run(path, ['config', 'remote.origin.promisor', 'true'])
  run(path, ['config', 'remote.origin.partialclonefilter', filter])
  return path
}

/**
 * The remote's live branches with the files each changed.
 *
 * Two caches, on purpose. The first holds only the tip commit of every branch, to read its
 * date. The second holds the history of the live ones, without file contents. Kept in one
 * repository, the tips of the first fetch make the server believe their trees are already
 * there; each diff then downloads them one by one (measured: 70 s instead of 0.6 s for a
 * hundred branches).
 */
export const liveBranches = ({ root, base, days, now, skip = [] }) => {
  const gitDir = run(root, ['rev-parse', '--absolute-git-dir']).out
  const url = run(root, ['remote', 'get-url', 'origin']).out
  if (!url) return { error: 'no "origin" remote: there is nobody to overlap with.' }

  const tipsRepo = cacheRepo(root, gitDir, 'overlap-tips.git', url, 'tree:0')
  const tips = run(tipsRepo, ['fetch', '--quiet', '--prune', '--depth=1', '--filter=tree:0', 'origin', '+refs/heads/*:refs/tips/*'])
  if (!tips.ok) return { error: `could not read the remote's branches: ${tips.err.split('\n')[0]}` }

  const since = now - days * 86_400
  const refs = run(tipsRepo, ['for-each-ref', '--format=%(refname)%09%(committerdate:unix)%09%(trailers:key=Claude-Session,valueonly,separator=%x20)', 'refs/tips'])
    .out.split('\n')
    .filter(Boolean)
    .map((line) => {
      const [ref, time, session] = line.split('\t')
      return { name: ref.replace('refs/tips/', ''), time: Number(time), session: (session ?? '').trim().split(' ')[0] }
    })
  const recent = refs.filter((ref) => ref.time > since && ref.name !== base && !skip.includes(ref.name))
  if (recent.length === 0) return { branches: [] }

  // History without file contents, no deeper than the window needs.
  const histRepo = cacheRepo(root, gitDir, 'overlap-hist.git', url, 'blob:none')
  const specs = [base, ...recent.map((ref) => ref.name)].map((name) => `+refs/heads/${name}:refs/hist/${name}`)
  const shallow = `--shallow-since=${since - days * 86_400 * 2}`
  const history = run(histRepo, ['fetch', '--quiet', '--filter=blob:none', shallow, 'origin', ...specs])
  if (!history.ok) run(histRepo, ['fetch', '--quiet', '--filter=blob:none', '--depth=200', 'origin', ...specs])

  const branches = []
  for (const ref of recent) {
    // Three dots: since the branch left the base. No rename detection: it would need contents.
    const since = run(histRepo, ['diff', '--no-renames', '--name-only', `refs/hist/${base}...refs/hist/${ref.name}`])
    if (!since.ok) continue
    // Two dots: what still differs from the base today. A branch merged by squash keeps its
    // commits but no longer differs: it drops out without anyone having to delete it.
    const still = new Set(run(histRepo, ['diff', '--no-renames', '--name-only', `refs/hist/${base}`, `refs/hist/${ref.name}`]).out.split('\n'))
    const files = since.out.split('\n').filter((file) => file && still.has(file))
    if (files.length > 0) branches.push({ ...ref, files })
  }
  return { branches }
}

/** What this branch changed: its commits since the base, and what is not committed yet. */
export const ownFiles = ({ root, base }) => {
  const files = new Set()
  for (const range of [`origin/${base}...HEAD`, `${base}...HEAD`]) {
    const diff = run(root, ['diff', '--name-only', range])
    if (diff.ok) {
      diff.out.split('\n').filter(Boolean).forEach((file) => files.add(file))
      break
    }
  }
  // Read untrimmed: the first two columns of a status line are significant, blanks included.
  const status = spawnSync('git', ['status', '--porcelain', '--untracked-files=all'], { cwd: root, encoding: 'utf8' })
  for (const line of (status.stdout ?? '').split('\n').filter(Boolean)) files.add(line.slice(3).split(' -> ').pop())
  return [...files].sort()
}

export const defaultBase = (root) => {
  const head = run(root, ['symbolic-ref', '--short', 'refs/remotes/origin/HEAD'])
  return head.ok && head.out ? head.out.replace('origin/', '') : 'main'
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  // Piped into `head`, the reader may close first: that is not an error.
  process.stdout.on('error', () => process.exit(0))
  const option = (name, fallback) => {
    const index = process.argv.indexOf(`--${name}`)
    return index === -1 ? fallback : process.argv[index + 1]
  }
  const root = run(process.cwd(), ['rev-parse', '--show-toplevel']).out
  const base = option('base', defaultBase(root))
  const days = Number(option('days', '14'))
  const now = Math.floor(Date.now() / 1000)
  const current = run(root, ['branch', '--show-current']).out

  const { branches, error } = liveBranches({ root, base, days, now, skip: [current] })
  if (error) {
    process.stdout.write(`overlap: ${error}\n`)
    process.exit(0)
  }
  const mine = ownFiles({ root, base })
  const found = overlaps(mine, branches)

  if (process.argv.includes('--json')) {
    process.stdout.write(`${JSON.stringify({ base, days, mine, overlaps: found, hot: hotFiles(branches) }, null, 2)}\n`)
  } else if (process.argv.includes('--all')) {
    const hot = hotFiles(branches)
    process.stdout.write(`overlap: ${branches.length} live branch(es), ${hot.length} file(s) changed by more than one.\n`)
    for (const { file, branches: names } of hot.slice(0, 20)) process.stdout.write(`  ${names.length}x ${file}\n`)
  } else {
    process.stdout.write(`${render({ mine, found, live: branches.length, now }).join('\n')}\n`)
  }
}
