// Step 3 of the demo video: lay each narration clip at its scene's start time and
// combine it with the screen recording into an H.264 MP4 for YouTube.
//
//   node tools/video/mux.cjs   ->  submission/fearless-ledger-demo.mp4
const {execFileSync} = require('node:child_process')
const fs = require('node:fs')
const path = require('node:path')

const root = path.join(__dirname, '..', '..')
const tmp = path.join(root, 'submission', 'video-tmp')
const out = process.env.OUT ?? path.join(root, 'submission', 'fearless-ledger-demo.mp4')
const timeline = JSON.parse(fs.readFileSync(path.join(tmp, 'timeline.json'), 'utf8'))

const args = ['-y', '-i', path.join(tmp, 'screen.webm')]
for (const scene of timeline) args.push('-i', path.join(tmp, `${scene.id}.aiff`))
const delays = timeline.map((scene, i) => `[${i + 1}:a]adelay=${Math.round((scene.start + 0.35) * 1000)}:all=1[a${i}]`)
const mix = `${timeline.map((_, i) => `[a${i}]`).join('')}amix=inputs=${timeline.length}:normalize=0,volume=1.6[aout]`
args.push(
  '-filter_complex', `${delays.join(';')};${mix}`,
  '-map', '0:v', '-map', '[aout]',
  '-c:v', 'libx264', '-preset', 'medium', '-crf', '20', '-pix_fmt', 'yuv420p', '-r', '30',
  '-c:a', 'aac', '-b:a', '160k', '-shortest', '-movflags', '+faststart', out,
)
execFileSync('ffmpeg', args, {stdio: ['ignore', 'ignore', 'inherit']})
const seconds = Number(execFileSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', out]).toString())
console.log(`${out}: ${seconds.toFixed(1)} s, ${(fs.statSync(out).size / 1e6).toFixed(1)} MB`)
