import assert from 'node:assert/strict'
import { test } from 'node:test'

import { findings, isFrench, mask, parseDenylist } from '../scripts/public-hygiene.mjs'

const check = (text, options) => findings([{ path: 'notes.md', text }], options)
const rulesOf = (found) => found.map((finding) => finding.rule)

// Violations are assembled from parts, so that no scanner reads this file as holding one.
const join = (...parts) => parts.join('')

test('a clean English line raises nothing', () => {
  assert.deepEqual(check('The check reads every tracked file and reports each finding.'), [])
})

test('a path outside the repository is reported', () => {
  assert.deepEqual(rulesOf(check(join('See ', '/mnt', '/project-files/brief.md'))), ['private-path'])
  assert.deepEqual(rulesOf(check(join('cd ', '/home', '/someone/work'))), ['private-path'])
  assert.deepEqual(rulesOf(check(join('open ', '/Users', '/someone/Desktop/a.txt'))), ['private-path'])
})

test('a repository-relative path is not a private path', () => {
  assert.deepEqual(check('Edit `scripts/verify.mjs` and `docs/method.md`.'), [])
})

test('a session link is reported', () => {
  const link = join('https://claude.ai', '/code/session_', '01AbCdEfGhIjKlMn')
  assert.deepEqual(rulesOf(check(`Claude-Session: ${link}`)), ['session-link'])
})

test('an e-mail address is reported, a placeholder is not', () => {
  assert.deepEqual(rulesOf(check(join('Write to jane.doe', '@', 'acme-corp.io'))), ['email'])
  assert.deepEqual(check('Write to someone@example.com or noreply@anthropic.com.'), [])
})

test('strings shaped like credentials are reported', () => {
  const samples = [
    join('sk-ant-', 'api03-abcdefgh'),
    join('gh', 'p_', 'a'.repeat(36)),
    join('github', '_pat_', 'b'.repeat(30)),
    join('AK', 'IA', 'ABCDEFGHIJKLMNOP'),
    join('-----BEGIN RSA ', 'PRIVATE KEY-----'),
    join('ey', 'J', 'a'.repeat(12), '.', 'b'.repeat(12), '.', 'c'.repeat(12)),
  ]
  for (const sample of samples) {
    assert.deepEqual(rulesOf(check(`token = ${sample}`)), ['credential'], sample.slice(0, 6))
  }
})

test('the hostname of a real deployment is reported, a placeholder is not', () => {
  assert.deepEqual(rulesOf(check(join('https://abcdefghijklmnopqrst', '.supabase', '.co'))), ['deployment-host'])
  assert.deepEqual(rulesOf(check(join('https://acme-shop', '.vercel', '.app/admin'))), ['deployment-host'])
  assert.deepEqual(check('S3_ENDPOINT=https://project-ref.supabase.co and https://example.vercel.app'), [])
})

test('a term of the private deny-list is reported, whatever its case, and never printed', () => {
  const found = check('Measured on the Zephyrine project.', { denylist: parseDenylist('zephyrine\nother-name') })
  assert.deepEqual(rulesOf(found), ['denylist'])
  assert.ok(!JSON.stringify(found).toLowerCase().includes('zephyrine'))
})

test('the deny-list accepts lines or commas and drops terms too short to mean anything', () => {
  assert.deepEqual(parseDenylist(' Alpha ,beta\n\nab\ngamma-delta '), ['alpha', 'beta', 'gamma-delta'])
  assert.deepEqual(parseDenylist(undefined), [])
})

test('a French line is reported, an English line holding one French word is not', () => {
  assert.equal(isFrench('Le relecteur vérifie que les gardes sont vues rouges.'), true)
  assert.equal(isFrench('Nous ne poussons pas avant la relecture.'), true)
  assert.equal(isFrench('Run the suite pour the fun of it, then push.'), false)
  assert.equal(isFrench('The reviewer checks that every guard was seen red.'), false)
  assert.deepEqual(rulesOf(check('Une garde se voit rouge avant que la session ne la croie.')), ['language'])
})

test('a finding shows three characters of the match, never the whole of it', () => {
  assert.equal(mask('supersecretvalue'), 'sup…(16 chars)')
  const [finding] = check(join('key ', 'gh', 'p_', 'z'.repeat(36)))
  assert.ok(!finding.shown.includes('z'.repeat(10)))
  assert.match(finding.at, /^notes\.md:1$/)
})

test('an exemption covers the named rules of the named file only', () => {
  const text = join('See ', '/mnt', '/x/y and write to a.b', '@', 'corp.io')
  const exempt = { 'notes.md': ['private-path'] }
  assert.deepEqual(rulesOf(check(text, { exempt })), ['email'])
  assert.deepEqual(rulesOf(findings([{ path: 'other.md', text }], { exempt })), ['private-path', 'email'])
})
