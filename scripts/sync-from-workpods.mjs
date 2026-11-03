#!/usr/bin/env node
// Copies the files this project shares with the WorkPods platform into vendor/workpods/: the check
// registry and thresholds (so a check here has the same id, severity and wording as a WorkPods
// audit), and the theme, fonts and logo (so the extension looks like WorkPods). The flow is one way:
// nothing here is read by WorkPods, and nothing here reads WorkPods at build or run time.
//
//   node scripts/sync-from-workpods.mjs --from <workpods checkout>           copy and record
//   node scripts/sync-from-workpods.mjs --from <workpods checkout> --check   exit 1 if stale
import { createHash } from 'node:crypto'
import { execFileSync } from 'node:child_process'
import { copyFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const VENDOR = join(ROOT, 'vendor/workpods')

// Source path in the WorkPods checkout -> path under vendor/workpods. Only these files cross over.
const FILES = {
  'backend/contracts/check-registry.json': 'contracts/check-registry.json',
  'backend/contracts/thresholds.json': 'contracts/thresholds.json',
  'frontend/src/theme/tokens.css': 'theme/tokens.css',
  'frontend/src/theme/base.css': 'theme/base.css',
  'frontend/src/theme/font-fallback.css': 'theme/font-fallback.css',
  'frontend/src/public/fonts/plus-jakarta-sans-latin.woff2':
    'theme/fonts/plus-jakarta-sans-latin.woff2',
  'frontend/src/public/fonts/plus-jakarta-sans-latin-ext.woff2':
    'theme/fonts/plus-jakarta-sans-latin-ext.woff2',
  'frontend/src/public/fonts/plus-jakarta-sans-OFL.txt': 'theme/fonts/plus-jakarta-sans-OFL.txt',
  'frontend/src/ui/components/logo-mark.tsx': 'logo/logo-mark.tsx',
  'frontend/src/ui/components/logo-medallion.webp': 'logo/logo-medallion.webp',
  'frontend/public/favicon-64.png': 'logo/favicon-64.png',
  'frontend/public/favicon-512.png': 'logo/favicon-512.png',
}

const args = process.argv.slice(2)
const fromIndex = args.indexOf('--from')
if (fromIndex === -1 || !args[fromIndex + 1]) {
  console.error('usage: sync-from-workpods.mjs --from <workpods checkout> [--check]')
  process.exit(2)
}
const from = resolve(args[fromIndex + 1])
const check = args.includes('--check')

const sha256 = (path) => createHash('sha256').update(readFileSync(path)).digest('hex')

const stale = []
const hashes = {}
for (const [source, target] of Object.entries(FILES)) {
  const sourcePath = join(from, source)
  const targetPath = join(VENDOR, target)
  if (!existsSync(sourcePath)) {
    console.error(`missing in the WorkPods checkout: ${source}`)
    process.exit(1)
  }
  hashes[target] = sha256(sourcePath)
  const current = existsSync(targetPath) ? sha256(targetPath) : null
  if (current === hashes[target]) continue
  stale.push(target)
  if (!check) {
    mkdirSync(dirname(targetPath), { recursive: true })
    copyFileSync(sourcePath, targetPath)
  }
}

if (check) {
  if (stale.length > 0) {
    console.error(`vendor/workpods is stale: ${stale.join(', ')}`)
    process.exit(1)
  }
  console.log('vendor/workpods matches the WorkPods checkout')
} else {
  const commit = execFileSync('git', ['-C', from, 'rev-parse', 'HEAD'], { encoding: 'utf8' }).trim()
  const record = { commit, files: hashes }
  writeFileSync(join(VENDOR, 'SOURCE.json'), `${JSON.stringify(record, null, 2)}\n`)
  console.log(`copied ${stale.length} changed file(s) from WorkPods ${commit.slice(0, 9)}`)
}
