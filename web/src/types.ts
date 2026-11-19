// The scouting pack the Python pipeline writes (pipeline/ledger/aggregate.py).
// Everything in it is a count or a rate; game-by-game lists appear only in a
// locally built pack (`evidence`), never in the public one.

export type Role = 'top' | 'jungle' | 'mid' | 'bot' | 'support'
export const ROLES: Role[] = ['top', 'jungle', 'mid', 'bot', 'support']
export type Side = 'any' | 'blue' | 'red'

export interface ChampionInfo {
  role: Role
  roles: Partial<Record<Role, number>>
  games: number
}

export interface ChampRow {
  champ: string
  role: Role | null
  picks: number
  wins: number
  bans_by: number
  bans_vs: number
  first_pick: number
  rotation1: number
  presence: number
}

export interface PoolChamp {
  champ: string
  games: number
  wins: number
  last: string
}

export interface PlayerPool {
  id: string
  name: string
  role: Role
  games: number
  champs: PoolChamp[]
  depth: number
}

export interface FearlessGame {
  game: number
  n: number
  comfort_share: number | null
  top: [string, number][]
}

export interface Objective {
  games: number
  took: number
  avg_t: number | null
}

export interface JungleHabits {
  games: number
  junglers: [string, number][]
  start: Record<string, number>
  end_half: Record<string, number>
  first_scuttle: Record<string, number>
  early_kills: {before_s: number; games: number; zones: Record<string, number>}
}

export interface TeamSlice {
  games: number
  wins?: number
  first_date?: string
  last_date?: string
  series?: number
  events?: string[]
  sides?: {blue: [number, number]; red: [number, number]}
  opponents?: [string, number][]
  champs?: ChampRow[]
  bans?: Record<'blue' | 'red', {phase1: [string, number][]; phase2: [string, number][]}>
  ban_roles?: {phase1: Record<string, number>; phase2: Record<string, number>}
  pick_roles?: Record<'blue' | 'red', Record<string, number>[]>
  fearless?: FearlessGame[]
  players?: PlayerPool[]
  objectives?: Record<string, Objective>
  first_tower_lanes?: Record<string, number>
  jungle?: JungleHabits
}

export interface EvidenceGame {
  series_id: string
  game_id: string
  date: string
  event: string
  game: number | null
  side: 'blue' | 'red'
  opponent: string
  won: boolean
  draft: [string, string][]
}

export interface Team {
  id: string
  name: string
  slices: Record<string, TeamSlice>
  evidence?: EvidenceGame[]
}

export interface Pack {
  home_team: string
  periods: string[]
  games_total: number
  date_range: [string, string] | null
  champions: Record<string, ChampionInfo>
  teams: Record<string, Team>
  evidence: boolean
}

export function sliceOf(team: Team, period: string, side: Side): TeamSlice {
  return team.slices[`${period}|${side}`] ?? {games: 0}
}

/** A complete, ready-to-use slice: guarantees the fields the views read. */
export type FullSlice = Required<TeamSlice>

export function isFull(slice: TeamSlice): slice is FullSlice {
  return slice.games > 0 && Array.isArray(slice.champs)
}
