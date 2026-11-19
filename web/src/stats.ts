// Pure scouting logic: plain-English insights with their evidence, ban and
// protect suggestions, and contested champions. No DOM here, so it is tested
// directly (tests/stats.test.ts).
import type {ChampRow, FullSlice, Pack, PlayerPool, Role} from './types.ts'
import {ROLES} from './types.ts'

export const pct = (part: number, whole: number) => (whole ? Math.round((100 * part) / whole) : 0)
export const clock = (seconds: number | null | undefined) =>
  seconds == null ? '–' : `${Math.floor(seconds / 60)}:${String(Math.round(seconds % 60)).padStart(2, '0')}`
const sum = (values: Iterable<number>) => [...values].reduce((a, b) => a + b, 0)
const sorted = (record: Record<string, number>) => Object.entries(record).sort((a, b) => b[1] - a[1])

export interface Insight {
  /** What the coach should know, in one sentence. */
  text: string
  /** The numbers behind it: "11 of 29 blue-side games". */
  evidence: string
  /** How much to trust it: small samples are flagged. */
  confidence: 'solid' | 'thin'
  topic: 'draft' | 'fearless' | 'jungle' | 'objectives' | 'players'
}

const confidence = (n: number): Insight['confidence'] => (n >= 15 ? 'solid' : 'thin')

/** The strongest habit in a role mix, if it stands out (at least 35% and 3 games). */
function dominant(mix: Record<string, number> | undefined): [string, number, number] | null {
  if (!mix) return null
  const total = sum(Object.values(mix))
  const [top] = sorted(mix)
  if (!top || total < 3 || top[1] / total < 0.35) return null
  return [top[0], top[1], total]
}

/** Turn a team slice into the handful of facts a coach would put on a whiteboard. */
export function insights(teamName: string, s: FullSlice): Insight[] {
  const out: Insight[] = []
  const [blueGames] = s.sides.blue

  // First pick on blue side, and what red does with R1-R2.
  const b1 = dominant(s.pick_roles.blue[0])
  if (b1) out.push({topic: 'draft', text: `On blue side ${teamName} spend their first pick on ${b1[0]} ${pct(b1[1], b1[2])}% of the time.`, evidence: `${b1[1]} of ${b1[2]} blue-side drafts`, confidence: confidence(b1[2])})
  const lastRed = dominant(s.pick_roles.red[4])
  if (lastRed) out.push({topic: 'draft', text: `They keep ${lastRed[0]} for the red-side last pick (counter-pick) ${pct(lastRed[1], lastRed[2])}% of the time.`, evidence: `${lastRed[1]} of ${lastRed[2]} red-side drafts`, confidence: confidence(lastRed[2])})
  const lastBlue = dominant(s.pick_roles.blue[4])
  if (lastBlue) out.push({topic: 'draft', text: `Their blue-side last pick (B5) is ${lastBlue[0]} ${pct(lastBlue[1], lastBlue[2])}% of the time.`, evidence: `${lastBlue[1]} of ${lastBlue[2]} blue-side drafts`, confidence: confidence(lastBlue[2])})

  // Bans: what they always take away, and what everyone takes away from them.
  const firstBan = s.bans.blue.phase1[0]
  if (firstBan && blueGames) out.push({topic: 'draft', text: `Their most common phase-one ban on blue side is ${firstBan[0]}.`, evidence: `${firstBan[1]} of ${blueGames} blue-side drafts`, confidence: confidence(blueGames)})
  const respected = [...s.champs].sort((a, b) => b.bans_vs - a.bans_vs)[0]
  if (respected && respected.bans_vs >= 3) out.push({topic: 'draft', text: `Opponents ban ${respected.champ} against them more than any other champion; they won ${pct(respected.wins, respected.picks)}% of the ${respected.picks} games they got it.`, evidence: `banned in ${respected.bans_vs} of ${s.games} games`, confidence: confidence(s.games)})
  const phase2 = dominant(s.ban_roles.phase2)
  if (phase2) out.push({topic: 'draft', text: `Their phase-two bans target ${phase2[0]} champions ${pct(phase2[1], phase2[2])}% of the time: expect your remaining ${phase2[0]} picks to be denied.`, evidence: `${phase2[1]} of ${phase2[2]} phase-two bans`, confidence: confidence(phase2[2] / 2)})

  // Fearless: how quickly they leave their comfort zone in a series.
  const g1 = s.fearless.find(f => f.game === 1)
  const late = s.fearless.filter(f => f.game >= 3)
  const lateN = sum(late.map(f => f.n))
  if (g1?.comfort_share != null && lateN >= 3) {
    const lateShare = sum(late.map(f => (f.comfort_share ?? 0) * f.n)) / lateN
    out.push({topic: 'fearless', text: `In game 1 ${Math.round(100 * g1.comfort_share)}% of their picks are a player's top-3 champion; in games 3-5 only ${Math.round(100 * lateShare)}%. Long series push them off their pools.`, evidence: `${g1.n} game 1s, ${lateN} games 3-5`, confidence: confidence(lateN)})
  }

  // Jungle first clear and early ganks.
  const j = s.jungle
  // When the slice spans a roster change, say so: the habit belongs to both junglers.
  const jungler = j.junglers.length > 1 ? `Their junglers (${j.junglers.map(([name, n]) => `${name} ${n}`).join(', ')})` : j.junglers[0]?.[0] ?? 'Their jungler'
  const start = dominant(j.start)
  if (start && start[0] !== 'other') out.push({topic: 'jungle', text: `${jungler} starts on ${start[0]} ${pct(start[1], start[2])}% of games.`, evidence: `${start[1]} of ${start[2]} games, position at 1:35`, confidence: confidence(start[2])})
  const end = dominant(j.end_half)
  if (end) out.push({topic: 'jungle', text: `The first clear ends on the ${end[0]} side of the map ${pct(end[1], end[2])}% of the time, so ward ${end[0]} side for the 3:15 gank or scuttle.`, evidence: `${end[1]} of ${end[2]} games, position at 3:20`, confidence: confidence(end[2])})
  const ganks = sorted(j.early_kills.zones)
  const gankTotal = sum(Object.values(j.early_kills.zones))
  if (ganks[0] && gankTotal >= 5) out.push({topic: 'jungle', text: `Before 8:00, ${pct(ganks[0][1], gankTotal)}% of the kills their jungler is part of happen in ${ganks[0][0] === 'river' ? 'the river' : ganks[0][0] === 'jungle' ? 'the jungle' : `${ganks[0][0]} lane`}.`, evidence: `${ganks[0][1]} of ${gankTotal} early jungler kills in ${j.early_kills.games} games`, confidence: confidence(gankTotal)})

  // Objectives.
  const drake = s.objectives.first_drake
  const grubs = s.objectives.first_grubs
  if (drake && grubs && drake.games >= 5) {
    const d = pct(drake.took, drake.games)
    const g = pct(grubs.took, grubs.games)
    const favourite = d >= g ? `first dragon (${d}%, around ${clock(drake.avg_t)})` : `first void grubs (${g}%, around ${clock(grubs.avg_t)})`
    out.push({topic: 'objectives', text: `Their early-objective priority is the ${favourite}.`, evidence: `first dragon ${drake.took}/${drake.games}, first grubs ${grubs.took}/${grubs.games}`, confidence: confidence(drake.games)})
  }
  const tower = sorted(s.first_tower_lanes)[0]
  const towersTaken = s.objectives.first_tower?.took ?? 0
  if (tower && towersTaken >= 5) out.push({topic: 'objectives', text: `When they take first tower, it is in ${tower[0]} lane ${pct(tower[1], towersTaken)}% of the time.`, evidence: `${tower[1]} of ${towersTaken} first towers`, confidence: confidence(towersTaken)})

  // Players: the one-trick risk.
  for (const player of currentPlayers(s.players, s.last_date).filter(p => p.games >= 8)) {
    const [best] = player.champs
    if (best && best.games / player.games >= 0.25) {
      out.push({topic: 'players', text: `${player.name} (${player.role}) plays ${best.champ} in ${pct(best.games, player.games)}% of games and wins ${pct(best.wins, best.games)}% on it.`, evidence: `${best.games} of ${player.games} games`, confidence: confidence(player.games)})
    }
  }
  return out
}

// ---------------------------------------------------------------- bans ----

export interface Suggestion {
  champ: string
  role: Role | null
  score: number
  /** Why: which player, how often, how well, how recently. */
  reasons: string[]
  /** Also one of our own comfort picks: banning it costs us too. */
  ours: boolean
}

const DAY = 24 * 3600 * 1000
/** A player whose last game is this many days before the team's last game has left the lineup. */
export const ROSTER_DAYS = 150

const lastGame = (player: PlayerPool) => player.champs.reduce((latest, c) => (c.last > latest ? c.last : latest), '')

/** Players still in the lineup at the end of the slice (pros who left are only history). */
export function currentPlayers(players: PlayerPool[], reference: string): PlayerPool[] {
  return players.filter(p => (Date.parse(reference) - Date.parse(lastGame(p))) / DAY <= ROSTER_DAYS)
}

/** How much a player relies on a champion: volume x win rate (smoothed), fading with age. */
export function comfort(c: {games: number; wins: number; last: string}, reference: string): number {
  const volume = c.games / (c.games + 3)
  const winRate = (c.wins + 1) / (c.games + 2)
  const days = Math.max(0, (Date.parse(reference) - Date.parse(c.last)) / DAY)
  const recency = days <= 60 ? 1 : days <= 180 ? 0.75 : 0.5
  return volume * (0.5 + winRate) * recency
}

/**
 * Ban targets against an opponent: the champions their players rely on most,
 * plus what they prioritise in the first rotation, minus anything already gone
 * (Fearless). Champions we would like to play ourselves are flagged, not hidden.
 */
export function banSuggestions(opponent: FullSlice, us: FullSlice | null, unavailable: Set<string>, limit = 8): Suggestion[] {
  const reference = opponent.last_date
  const scores = new Map<string, Suggestion>()
  const add = (champ: string, role: Role | null, score: number, reason: string) => {
    if (unavailable.has(champ)) return
    const entry = scores.get(champ) ?? {champ, role, score: 0, reasons: [], ours: false}
    entry.score += score
    entry.reasons.push(reason)
    scores.set(champ, entry)
  }
  for (const player of currentPlayers(opponent.players, reference)) {
    if (player.games < 3) continue
    for (const c of player.champs.slice(0, 6)) {
      add(c.champ, player.role, comfort(c, reference), `${player.name}: ${c.games} games, ${pct(c.wins, c.games)}% wins, last ${c.last}`)
    }
  }
  for (const row of opponent.champs) {
    if (row.rotation1 >= 3) add(row.champ, row.role, 0.4 * (row.rotation1 / opponent.games) * 5, `first-rotation pick in ${row.rotation1} of ${opponent.games} games`)
  }
  const ourComfort = new Set(us ? currentPlayers(us.players, us.last_date).flatMap(p => p.champs.slice(0, 3).map(c => c.champ)) : [])
  for (const entry of scores.values()) entry.ours = ourComfort.has(entry.champ)
  return [...scores.values()].sort((a, b) => b.score - a.score || a.champ.localeCompare(b.champ)).slice(0, limit)
}

/** Our comfort picks that this opponent tends to ban: plan to first-pick them or keep a backup. */
export function protect(us: FullSlice, opponent: FullSlice, unavailable: Set<string>, limit = 5) {
  const theirBans = new Map<string, number>()
  for (const row of opponent.champs) if (row.bans_by) theirBans.set(row.champ, row.bans_by)
  const out: {champ: string; player: string; role: Role; games: number; banned: number}[] = []
  for (const player of currentPlayers(us.players, us.last_date)) {
    for (const c of player.champs.slice(0, 5)) {
      const banned = theirBans.get(c.champ) ?? 0
      if (banned >= 2 && !unavailable.has(c.champ)) out.push({champ: c.champ, player: player.name, role: player.role, games: c.games, banned})
    }
  }
  return out.sort((a, b) => b.banned - a.banned || b.games - a.games).slice(0, limit)
}

/** Champions both teams' players in the same role rely on: the likely contested picks. */
export function contested(us: FullSlice, opponent: FullSlice, unavailable: Set<string>) {
  const out: {role: Role; champ: string; ours: number; theirs: number}[] = []
  for (const role of ROLES) {
    const mine = mainPlayer(us.players, role, us.last_date)
    const theirs = mainPlayer(opponent.players, role, opponent.last_date)
    if (!mine || !theirs) continue
    const theirGames = new Map(theirs.champs.map(c => [c.champ, c.games]))
    for (const c of mine.champs.slice(0, 8)) {
      const other = theirGames.get(c.champ)
      if (other && other >= 2 && c.games >= 2 && !unavailable.has(c.champ)) out.push({role, champ: c.champ, ours: c.games, theirs: other})
    }
  }
  return out.sort((a, b) => b.ours + b.theirs - (a.ours + a.theirs))
}

/** The player to plan around in a role: the current starter (most games among current players). */
export function mainPlayer(players: PlayerPool[], role: Role, reference?: string): PlayerPool | undefined {
  const inRole = players.filter(p => p.role === role)
  const current = reference ? currentPlayers(inRole, reference) : inRole
  return (current.length ? current : inRole).sort((a, b) => b.games - a.games || lastGame(b).localeCompare(lastGame(a)))[0]
}

/** The champions with the highest presence (picked or banned) in a team's drafts. */
export function priority(rows: ChampRow[], role: Role | 'all', limit = 15) {
  return rows.filter(r => role === 'all' || r.role === role).slice(0, limit)
}

/** Champion names for the board's search box, most played first. */
export function championNames(pack: Pack): string[] {
  return Object.entries(pack.champions).sort((a, b) => b[1].games - a[1].games || a[0].localeCompare(b[0])).map(([name]) => name)
}
