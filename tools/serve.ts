// A plain static server for site/. When the local pack exists
// (packs/local-pack.json, built from your own copy of the GRID data) it is
// served too, and the app switches to it: every team, with game lists.
// It is never copied into site/, so it can never be published by accident.
//
//   npm run dev        then open http://localhost:5180
import fs from 'node:fs'
import http from 'node:http'
import path from 'node:path'

const root = path.join(import.meta.dirname, '..')
const site = path.join(root, 'site')
const localPack = path.join(root, 'packs', 'local-pack.json')
const port = Number(process.env.PORT ?? 5180)
const types: Record<string, string> = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png', '.map': 'application/json', '.ico': 'image/x-icon',
}

http
  .createServer((req, res) => {
    const url = new URL(req.url ?? '/', 'http://localhost')
    let file = url.pathname === '/local-pack.json' ? localPack : path.normalize(path.join(site, decodeURIComponent(url.pathname)))
    if (file !== localPack && !file.startsWith(site)) return void res.writeHead(403).end()
    if (fs.existsSync(file) && fs.statSync(file).isDirectory()) file = path.join(file, 'index.html')
    if (!fs.existsSync(file)) return void res.writeHead(404, {'content-type': 'text/plain'}).end('Not found')
    res.writeHead(200, {'content-type': types[path.extname(file)] ?? 'application/octet-stream', 'cache-control': 'no-cache'})
    fs.createReadStream(file).pipe(res)
  })
  .listen(port, () => console.log(`Fearless Ledger on http://localhost:${port}${fs.existsSync(localPack) ? ' (local pack: every team, with game lists)' : ''}`))
