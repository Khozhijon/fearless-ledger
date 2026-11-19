// Builds the static site into site/: bundles the app and copies the page, the
// styles and the public aggregate pack. The pack itself comes from the Python
// pipeline (pipeline/ledger/pack.py); see README.
//
//   npm run build          minified, for GitHub Pages
//   npm run build -- --dev with source maps
import fs from 'node:fs'
import path from 'node:path'
import {build} from 'esbuild'

const root = path.join(import.meta.dirname, '..')
const web = path.join(root, 'web')
const out = path.join(root, 'site')
const dev = process.argv.includes('--dev')

fs.rmSync(out, {recursive: true, force: true})
fs.mkdirSync(out, {recursive: true})
await build({
  entryPoints: {app: path.join(web, 'src/main.ts')},
  bundle: true,
  format: 'esm',
  platform: 'browser',
  target: 'es2022',
  outdir: out,
  minify: !dev,
  sourcemap: dev ? 'linked' : false,
  logLevel: 'warning',
  legalComments: 'none',
})
for (const file of ['index.html', 'styles.css']) fs.copyFileSync(path.join(web, file), path.join(out, file))
fs.cpSync(path.join(web, 'public'), out, {recursive: true})

const pack = path.join(out, 'demo-pack.json')
if (!fs.existsSync(pack)) throw new Error('web/public/demo-pack.json is missing: run "npm run pipeline" (needs the GRID data clone, see README)')
const text = fs.readFileSync(pack, 'utf8')
if (text.includes('"evidence":[')) throw new Error('the public pack contains game lists; rebuild it with "python -m ledger.pack" (no --evidence)')
const size = (f: string) => `${(fs.statSync(path.join(out, f)).size / 1024).toFixed(0)} KB`
console.log(`built site/: app.js ${size('app.js')}, demo-pack.json ${size('demo-pack.json')}`)
