import assert from 'node:assert/strict'
import { readFileSync, readdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { test } from 'node:test'
import { fileURLToPath } from 'node:url'

const playbook = join(dirname(fileURLToPath(import.meta.url)), '..', 'skills', 'playbook')
const sheetsDir = join(playbook, 'sheets')

export const SECTIONS = ['When it matters', 'Decide', 'Options', 'Default', 'Traps', 'Hold it with a check', 'Sources']
export const GROUPS = ['method', 'foundations', 'surfaces', 'ai-ops']
export const MAX_BYTES = 8_000

/** The problems of one sheet; empty when it follows the format. */
export const sheetProblems = (name, text) => {
  const problems = []
  const front = text.match(/^---\n([\s\S]*?)\n---\n/)
  if (!front) return [`${name}: no front matter`]
  const meta = Object.fromEntries(front[1].split('\n').map((line) => line.split(/:\s*/, 2)))
  if (!meta.title) problems.push(`${name}: no title`)
  if (!GROUPS.includes(meta.group)) problems.push(`${name}: group "${meta.group}" is not one of ${GROUPS.join(', ')}`)
  if (!/^20\d{2}-\d{2}-\d{2}$/.test(meta.reviewed ?? '')) problems.push(`${name}: "reviewed" is not a date`)
  if (!/^[a-z][a-z0-9-]*\.md$/.test(name)) problems.push(`${name}: the file name is not a slug`)

  const body = text.slice(front[0].length)
  const headings = [...body.matchAll(/^(#{1,2}) (.+)$/gm)].map((match) => `${match[1]} ${match[2]}`)
  const expected = [`# ${meta.title}`, ...SECTIONS.map((section) => `## ${section}`)]
  if (JSON.stringify(headings) !== JSON.stringify(expected)) {
    problems.push(`${name}: headings are [${headings.join(' | ')}], expected [${expected.join(' | ')}]`)
  }
  for (const section of SECTIONS) {
    const content = body.split(`## ${section}\n`)[1]?.split(/^## /m)[0] ?? ''
    if (content.trim() === '') problems.push(`${name}: "${section}" is empty`)
  }
  const size = Buffer.byteLength(text)
  if (size > MAX_BYTES) problems.push(`${name}: ${size} bytes, over ${MAX_BYTES}. A sheet that needs more is two sheets.`)
  return problems
}

const sheets = readdirSync(sheetsDir)
  .filter((name) => name.endsWith('.md'))
  .sort()
  .map((name) => ({ name, text: readFileSync(join(sheetsDir, name), 'utf8') }))

test('every sheet follows the format', () => {
  assert.ok(sheets.length > 0)
  assert.deepEqual(sheets.flatMap(({ name, text }) => sheetProblems(name, text)), [])
})

test('the skill lists every sheet once, and nothing that does not exist', () => {
  const skill = readFileSync(join(playbook, 'SKILL.md'), 'utf8')
  const listed = [...skill.matchAll(/\]\(sheets\/([a-z0-9-]+\.md)\)/g)].map((match) => match[1]).sort()
  assert.deepEqual(listed, sheets.map((sheet) => sheet.name))
})

test('the skill declares itself the way a plugin skill must', () => {
  const skill = readFileSync(join(playbook, 'SKILL.md'), 'utf8')
  const front = skill.match(/^---\n([\s\S]*?)\n---\n/)[1]
  assert.match(front, /^name: playbook$/m)
  const description = front.match(/^description: (.+)$/m)[1]
  // Past this length the listing shown to the model is cut.
  assert.ok(description.length <= 1_536, `the description is ${description.length} characters`)
})

const good = sheets[0]?.text ?? ''

test('the format check sees what it exists to refuse', () => {
  const broken = [
    [good.replace('## Traps\n', '## Pitfalls\n'), /headings are/],
    [good.replace(/^group: .+$/m, 'group: misc'), /group "misc"/],
    [good.replace(/^reviewed: .+$/m, 'reviewed: last week'), /"reviewed" is not a date/],
    [good.replace(/(## Default\n)[\s\S]*?(## Traps\n)/, '$1\n$2'), /"Default" is empty/],
    [`${good}\n${'x'.repeat(MAX_BYTES)}`, /over 8000/],
    [good.replace(/^---\n[\s\S]*?\n---\n/, ''), /no front matter/],
  ]
  for (const [text, expected] of broken) {
    const problems = sheetProblems('agent-memory.md', text)
    assert.ok(problems.some((problem) => expected.test(problem)), `not seen: ${expected}`)
  }
  assert.ok(sheetProblems('Agent Memory.md', good).some((problem) => /not a slug/.test(problem)))
})
