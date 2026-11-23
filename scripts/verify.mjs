#!/usr/bin/env node
/**
 * This repository checks itself with the script it ships to projects: the steps are in
 * `verify.config.json`, the runner is the template's.
 *
 * Usage: node scripts/verify.mjs [--full]
 */
import { spawnSync } from 'node:child_process'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const runner = join(root, 'skills/kickoff/template/scripts/verify.mjs')
const { status } = spawnSync(process.execPath, [runner, ...process.argv.slice(2)], { cwd: root, stdio: 'inherit' })
process.exit(status ?? 1)
