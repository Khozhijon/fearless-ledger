// Prints the "Scouting sheet" tab to PDF with Chromium's print engine and reports the page count,
// to check that the sheet fits on one Letter page and one A4 page.
//
//   npm run dev   (in another terminal)
//   node tools/print-sheet.cjs [team id]   ->  submission/video-tmp/sheet-*.pdf (git-ignored)
process.env.PLAYWRIGHT_BROWSERS_PATH ??= '0'
const path = require('node:path')
const fs = require('node:fs')
const {createRequire} = require('node:module')
const {chromium} = createRequire(path.join(__dirname, '..', '..', 'package.json'))('playwright')

const root = path.join(__dirname, '..')
const out = path.join(root, 'submission', 'video-tmp')
const base = process.env.BASE ?? 'http://localhost:5180/'
const teams = process.argv.slice(2)

;(async () => {
  fs.mkdirSync(out, {recursive: true})
  const browser = await chromium.launch()
  const page = await browser.newPage()
  for (const team of teams.length ? teams : ['']) {
    await page.goto(`${base}#tab=sheet${team ? `&team=${team}` : ''}`)
    await page.waitForSelector('.sheet')
    const name = await page.$eval('.sheet h2', h => h.textContent.replace('Scouting sheet: ', ''))
    for (const format of ['Letter', 'A4']) {
      const file = path.join(out, `sheet-${name.replace(/\W+/g, '-')}-${format}.pdf`)
      await page.pdf({path: file, format, printBackground: true})
      const pages = (fs.readFileSync(file, 'latin1').match(/\/Type\s*\/Page[^s]/g) || []).length
      console.log(`${name} ${format}: ${pages} page(s)`)
    }
  }
  await browser.close()
})()
