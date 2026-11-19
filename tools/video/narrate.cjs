// Step 1 of the demo video: speak each scene's narration with macOS `say` and
// measure it, so the recorder can hold each scene exactly as long as its voice.
//
//   node tools/video/narrate.cjs   ->  submission/video-tmp/<id>.aiff + durations.json
const {execFileSync} = require('node:child_process')
const fs = require('node:fs')
const path = require('node:path')

const root = path.join(__dirname, '..', '..')
const out = path.join(root, 'submission', 'video-tmp')
const voice = process.env.VOICE ?? 'Samantha'
fs.mkdirSync(out, {recursive: true})
const scenes = JSON.parse(fs.readFileSync(path.join(__dirname, 'script.json'), 'utf8'))
const durations = {}
for (const scene of scenes) {
  const file = path.join(out, `${scene.id}.aiff`)
  execFileSync('say', ['-v', voice, '-r', '178', '-o', file, scene.say])
  const seconds = Number(execFileSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', file]).toString().trim())
  durations[scene.id] = seconds
  console.log(scene.id.padEnd(12), seconds.toFixed(1), 's')
}
fs.writeFileSync(path.join(out, 'durations.json'), JSON.stringify(durations, null, 2))
console.log('total', Object.values(durations).reduce((a, b) => a + b, 0).toFixed(1), 's of narration')
