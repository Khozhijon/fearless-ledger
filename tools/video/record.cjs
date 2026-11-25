// Step 2 of the demo video: drive the live public demo in Chromium and record it,
// holding each scene as long as its narration (from narrate.cjs). Captions are
// drawn by this script on top of the page; the app itself is unchanged.
//
//   node tools/video/record.cjs   ->  submission/video-tmp/screen.webm + timeline.json
process.env.PLAYWRIGHT_BROWSERS_PATH ??= '0'
const path = require('node:path')
const fs = require('node:fs')
const {createRequire} = require('node:module')
const {chromium} = createRequire(path.join(__dirname, '..', '..', '..', 'package.json'))('playwright')

const root = path.join(__dirname, '..', '..')
const tmp = path.join(root, 'submission', 'video-tmp')
const base = process.env.BASE ?? 'https://khozhijon.github.io/fearless-ledger/'
const slides = `file://${path.join(__dirname, 'slides.html')}`
const scenes = JSON.parse(fs.readFileSync(path.join(__dirname, 'script.json'), 'utf8'))
const durations = JSON.parse(fs.readFileSync(path.join(tmp, 'durations.json'), 'utf8'))
const size = {width: 1280, height: 720}
const pause = ms => new Promise(done => setTimeout(done, ms))
const FLYQUEST = '340'

async function caption(page, text) {
  await page.evaluate(t => {
    let el = document.getElementById('demo-caption')
    if (!el) {
      el = document.createElement('div')
      el.id = 'demo-caption'
      el.style.cssText = 'position:fixed;left:0;right:0;bottom:0;z-index:99999;padding:14px 48px;background:rgba(6,12,22,.92);color:#fff;font:600 21px/1.35 system-ui,sans-serif;text-align:center;border-top:2px solid #67c6ff;'
      document.body.append(el)
    }
    el.textContent = t
  }, text)
}

async function scrollTo(page, selector, offset = 90) {
  await page.evaluate(([sel, off]) => {
    const el = document.querySelector(sel)
    if (el) window.scrollTo({top: el.getBoundingClientRect().top + window.scrollY - off, behavior: 'smooth'})
  }, [selector, offset])
  await pause(900)
}

async function panel(page, heading) {
  await page.evaluate(h => {
    const el = [...document.querySelectorAll('section.panel h3, section.panel h2')].find(x => x.textContent.startsWith(h))
    el?.closest('section')?.setAttribute('data-demo', h)
  }, heading)
  await scrollTo(page, `[data-demo="${heading}"]`)
}

async function setInput(page, selector, value) {
  await page.evaluate(([sel, v]) => {
    const el = document.querySelector(sel)
    el.value = v
    el.dispatchEvent(new Event('change', {bubbles: true}))
  }, [selector, value])
  await pause(260)
}

async function openApp(page, hash) {
  await page.goto(`${base}#${hash}`)
  await page.waitForSelector('.view section.panel', {timeout: 20000})
}

const actions = {
  title: async page => page.goto(`${slides}?s=title`),
  problem: async page => page.goto(`${slides}?s=problem`),
  whiteboard: async (page, ms) => {
    await openApp(page, `tab=scout&team=${FLYQUEST}&period=all&side=any`)
    await caption(page, scenes.find(s => s.id === 'whiteboard').caption)
    await pause(ms * 0.3)
    await panel(page, 'What to put on the whiteboard')
  },
  draft: async (page, ms) => {
    await panel(page, 'Draft: who gets each pick')
    await pause(ms * 0.45)
    await panel(page, 'Draft: bans')
  },
  priority: async (page, ms) => {
    await panel(page, 'Draft: champion priority')
    await pause(ms * 0.4)
    await page.click('[data-role-filter="jungle"]')
    await panel(page, 'Draft: champion priority')
  },
  fearless: async (page, ms) => {
    await page.click('[data-role-filter="all"]')
    await panel(page, 'Fearless')
    await pause(ms * 0.4)
    await panel(page, 'Player pools')
  },
  macro: async () => {},
  prep: async page => {
    await page.click('[data-tab="prep"]')
    await page.evaluate(() => window.scrollTo(0, 0))
  },
  board: async (page, ms) => {
    await page.click('[data-tab="board"]')
    await page.evaluate(() => window.scrollTo(0, 0))
    const us = {top: 'Rumble', jungle: 'Vi', mid: 'Azir', bot: 'Varus', support: 'Rell'}
    const them = {top: 'Gnar', jungle: 'Xin Zhao', mid: 'Taliyah', bot: 'Ezreal', support: 'Bard'}
    await pause(800)
    for (const [i, c] of ['Yone', 'Pantheon', 'Karma'].entries()) await setInput(page, `[data-ban="us"][data-slot="${i}"]`, c)
    for (const role of Object.keys(us)) {
      await setInput(page, `[data-pick="us"][data-role="${role}"]`, us[role])
      await setInput(page, `[data-pick="them"][data-role="${role}"]`, them[role])
    }
    await page.click('[data-result="win"]')
    await pause(Math.max(400, ms * 0.12))
    await page.click('[data-game-tab="1"]')
    await pause(600)
    await setInput(page, '[data-pick="us"][data-role="mid"]', 'Azir') // locked: the board refuses it
    await pause(1600)
    await panel(page, 'What each player has left')
  },
  plan: async page => {
    await panel(page, 'Our game-by-game plan')
    await setInput(page, '[data-plan="mid"][data-game="1"]', 'Orianna')
    await setInput(page, '[data-plan="mid"][data-game="2"]', 'Taliyah')
    await setInput(page, '[data-plan="bot"][data-game="2"]', 'Orianna')
  },
  sheet: async (page, ms) => {
    await page.click('[data-tab="sheet"]')
    await page.evaluate(() => window.scrollTo(0, 0))
    await pause(ms * 0.5)
    await page.evaluate(() => window.scrollTo({top: 420, behavior: 'smooth'}))
  },
  built: async page => page.goto(`${slides}?s=built`),
  air: async page => page.goto(`${slides}?s=air`),
  close: async page => page.goto(`${slides}?s=close`),
}

;(async () => {
  const browser = await chromium.launch({headless: true})
  const context = await browser.newContext({viewport: size, deviceScaleFactor: 1, recordVideo: {dir: tmp, size}})
  const page = await context.newPage()
  page.on('pageerror', err => console.log('page error:', err.message))
  const started = Date.now()
  const timeline = []
  try {
    // The macro scene follows the pools on the same page: scroll there first.
    for (const scene of scenes) {
      const ms = (durations[scene.id] ?? 5) * 1000 + 900
      const t0 = Date.now()
      timeline.push({id: scene.id, start: (t0 - started) / 1000})
      if (scene.id === 'macro') {
        await caption(page, scene.caption)
        await panel(page, 'Early macro')
      } else {
        if (!page.url().startsWith('about:')) await caption(page, scene.caption).catch(() => {})
        await actions[scene.id](page, ms)
        await caption(page, scene.caption)
      }
      const left = ms - (Date.now() - t0)
      if (left > 0) await pause(left)
      console.log(scene.id.padEnd(11), `${((Date.now() - t0) / 1000).toFixed(1)}s`)
    }
  } finally {
    fs.writeFileSync(path.join(tmp, 'timeline.json'), JSON.stringify(timeline, null, 2))
    const video = page.video()
    await context.close() // finishes writing the video file
    const file = path.join(tmp, 'screen.webm')
    fs.rmSync(file, {force: true})
    fs.renameSync(await video.path(), file)
    await browser.close()
    console.log('saved', file)
  }
})()
