// Print-ready scouting data, derived only from the selected aggregate slice.
import {banSuggestions, currentPlayers, insights, pct, protect} from './stats.ts'
import type {View} from './views.ts'
import {ROLES, type Role} from './types.ts'

export interface SheetData {
  selfScout: boolean
  team: {
    name: string
    games: number
    wins: number
    losses: number
    blue: {games: number; wins: number}
    red: {games: number; wins: number}
    firstDate: string
    lastDate: string
  }
  insights: ReturnType<typeof insights>
  bans: {champ: string; role: Role | null; reason: string}[]
  protect: {champ: string; player: string; role: Role; games: number; banned: number}[]
  players: {role: Role; name: string; champs: {champ: string; games: number; wins: number; last: string}[]}[]
  rotations: {champ: string; role: Role | null; count: number; games: number}[]
  jungleStarts: {name: string; count: number; games: number; rate: number}[]
  objectives: {key: string; label: string; took: number | null; games: number | null; rate: number | null}[]
}

const OBJECTIVES = [
  ['first_blood', 'First blood'],
  ['first_drake', 'First dragon'],
  ['first_herald', 'First Rift Herald'],
  ['first_tower', 'First tower'],
] as const

/** Prepare the selected team's print sheet without reading match-level evidence. */
export function sheetData(v: View): SheetData {
  const s = v.slice
  const selfScout = v.team.id === v.home.id
  const [blueGames, blueWins] = s.sides.blue
  const [redGames, redWins] = s.sides.red
  const current = currentPlayers(s.players, s.last_date)
  const jungleGames = Object.values(s.jungle.start).reduce((total, count) => total + count, 0)

  return {
    selfScout,
    team: {
      name: v.team.name,
      games: s.games,
      wins: s.wins,
      losses: s.games - s.wins,
      blue: {games: blueGames, wins: blueWins},
      red: {games: redGames, wins: redWins},
      firstDate: s.first_date,
      lastDate: s.last_date,
    },
    insights: insights(v.team.name, s).slice(0, 5),
    bans: selfScout ? [] : banSuggestions(s, v.homeSlice, new Set(), 5).map(b => ({champ: b.champ, role: b.role, reason: b.reasons[0] ?? ''})),
    protect: selfScout || !v.homeSlice ? [] : protect(v.homeSlice, s, new Set(), 3),
    players: ROLES.flatMap(role => {
      const player = current.filter(p => p.role === role).sort((a, b) => b.games - a.games || a.name.localeCompare(b.name))[0]
      return player ? [{role, name: player.name, champs: player.champs.slice(0, 3).map(c => ({champ: c.champ, games: c.games, wins: c.wins, last: c.last}))}] : []
    }),
    rotations: [...s.champs]
      .filter(c => c.rotation1 > 0)
      .sort((a, b) => b.rotation1 - a.rotation1 || a.champ.localeCompare(b.champ))
      .slice(0, 5)
      .map(c => ({champ: c.champ, role: c.role, count: c.rotation1, games: s.games})),
    jungleStarts: jungleGames
      ? Object.entries(s.jungle.start).filter(([, count]) => count > 0).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
        .map(([name, count]) => ({name, count, games: jungleGames, rate: pct(count, jungleGames)}))
      : [],
    objectives: OBJECTIVES.map(([key, label]) => {
      const objective = s.objectives[key]
      const valid = objective !== undefined && objective.games > 0
      return {
        key,
        label,
        took: valid ? objective.took : null,
        games: valid ? objective.games : null,
        rate: valid ? pct(objective.took, objective.games) : null,
      }
    }),
  }
}