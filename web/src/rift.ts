// A schematic Summoner's Rift drawn from the same zone boundaries the pipeline
// uses (pipeline/ledger/geo.py), shaded by how often something happens in each
// zone. It is our own diagram, not Riot artwork.
import {html, type Raw} from './html.ts'

const S = 300 / 15_000 // game units -> SVG units
const p = (x: number, y: number) => `${(x * S).toFixed(1)},${(300 - y * S).toFixed(1)}`
const poly = (...points: [number, number][]) => points.map(([x, y]) => p(x, y)).join(' ')

const ZONES: Record<string, string[]> = {
  top: [poly([0, 4700], [2400, 4700], [2400, 12_600], [10_300, 12_600], [10_300, 15_000], [0, 15_000])],
  bot: [poly([4700, 0], [4700, 2400], [12_600, 2400], [12_600, 10_300], [15_000, 10_300], [15_000, 0])],
  mid: [poly([3300, 4600], [4600, 3300], [11_700, 10_400], [10_400, 11_700])],
  river: [poly([2400, 10_800], [4000, 12_600], [12_600, 4000], [10_800, 2400])],
}

export function rift(shares: Record<string, number>, caption: string): Raw {
  const total = Object.values(shares).reduce((a, b) => a + b, 0) || 1
  const alpha = (zone: string) => (0.08 + 0.82 * ((shares[zone] ?? 0) / total)).toFixed(2)
  const label = (zone: string, x: number, y: number) => {
    const n = shares[zone] ?? 0
    const [sx, sy] = p(x, y).split(',')
    const name = zone[0]!.toUpperCase() + zone.slice(1)
    return html`<text x="${sx}" y="${sy}" class="zone-label"><tspan x="${sx}" class="zone-name">${name}</tspan><tspan x="${sx}" dy="14">${Math.round((100 * n) / total)}%</tspan></text>`
  }
  const description = Object.entries(shares).map(([z, n]) => `${z} ${Math.round((100 * n) / total)}%`).join(', ')
  return html`<figure class="rift">
    <svg viewBox="0 0 300 300" role="img" aria-label="${caption}: ${description}">
      <rect x="0" y="0" width="300" height="300" rx="10" class="rift-ground" style="--a:${alpha('jungle')}"></rect>
      ${Object.entries(ZONES).map(([zone, shapes]) => shapes.map(points => html`<polygon points="${points}" class="rift-zone z-${zone}" style="--a:${alpha(zone)}"></polygon>`))}
      <path d="M0,300 L0,206 A94,94 0 0 1 94,300 Z" class="rift-base blue"></path>
      <path d="M300,0 L300,94 A94,94 0 0 1 206,0 Z" class="rift-base red"></path>
      ${label('top', 1600, 13_300)} ${label('mid', 7500, 7500)} ${label('bot', 13_400, 1500)}
      ${label('river', 9600, 5200)} ${label('jungle', 4300, 8300)}
      <text x="22" y="292" class="base-label">BLUE</text><text x="252" y="16" class="base-label">RED</text>
    </svg>
    <figcaption>${caption}</figcaption>
  </figure>`
}
