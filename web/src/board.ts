// The Fearless series board: what has been picked in earlier games, what is
// still available to each player, and whether our game-by-game plan still
// holds. Pure functions over a plain object, saved in the browser.
//
// Rule implemented (LCK/LEC/LTA/LCS "Fearless Draft"): a champion picked by
// either team in an earlier game of the series cannot be picked again by
// anyone in that series. Bans reset every game.
import type {PlayerPool, Role} from './types.ts'
import {ROLES} from './types.ts'

export type Who = 'us' | 'them'

export interface GameDraft {
  ourSide: 'blue' | 'red'
  bans: Record<Who, string[]>
  picks: Record<Who, Partial<Record<Role, string>>>
  result: 'win' | 'loss' | null
}

export interface Series {
  version: 1
  us: string
  them: string
  bestOf: 1 | 3 | 5
  current: number
  games: GameDraft[]
  /** Our plan: role -> champion we intend to play in game k (index k). */
  plan: Partial<Record<Role, string[]>>
}

export const emptyGame = (ourSide: 'blue' | 'red' = 'blue'): GameDraft => ({ourSide, bans: {us: [], them: []}, picks: {us: {}, them: {}}, result: null})

export function newSeries(us: string, them: string, bestOf: 1 | 3 | 5 = 3): Series {
  return {version: 1, us, them, bestOf, current: 0, games: Array.from({length: bestOf}, (_, i) => emptyGame(i % 2 ? 'red' : 'blue')), plan: {}}
}

const picksOf = (game: GameDraft) => [...Object.values(game.picks.us), ...Object.values(game.picks.them)].filter((c): c is string => !!c)

/** Champions nobody may pick in game `index`: everything picked in the games before it. */
export function lockedBefore(series: Series, index: number): Set<string> {
  const out = new Set<string>()
  for (const game of series.games.slice(0, index)) for (const champ of picksOf(game)) out.add(champ)
  return out
}

/** Everything already used in game `index` itself (its picks and bans). */
export function takenIn(game: GameDraft): Set<string> {
  return new Set([...picksOf(game), ...game.bans.us, ...game.bans.them].filter(Boolean))
}

export type Problem = 'locked' | 'taken' | 'unknown'

/** Can this champion still be picked (or banned) in game `index`? */
export function check(series: Series, index: number, champ: string, known: Set<string>): Problem | null {
  if (!known.has(champ)) return 'unknown'
  const game = series.games[index]
  if (!game) return 'unknown'
  if (lockedBefore(series, index).has(champ)) return 'locked'
  if (takenIn(game).has(champ)) return 'taken'
  return null
}

export function setPick(series: Series, index: number, who: Who, role: Role, champ: string | null): Series {
  const games = series.games.map((game, i) => {
    if (i !== index) return game
    const picks = {...game.picks[who]}
    if (champ) picks[role] = champ
    else delete picks[role]
    return {...game, picks: {...game.picks, [who]: picks}}
  })
  return {...series, games}
}

export function setBans(series: Series, index: number, who: Who, bans: string[]): Series {
  const games = series.games.map((game, i) => (i === index ? {...game, bans: {...game.bans, [who]: bans.slice(0, 5)}} : game))
  return {...series, games}
}

export function setResult(series: Series, index: number, result: GameDraft['result']): Series {
  return {...series, games: series.games.map((game, i) => (i === index ? {...game, result} : game))}
}

export function setSide(series: Series, index: number, side: 'blue' | 'red'): Series {
  return {...series, games: series.games.map((game, i) => (i === index ? {...game, ourSide: side} : game))}
}

export function setPlan(series: Series, role: Role, index: number, champ: string | null): Series {
  const row = [...(series.plan[role] ?? [])]
  row[index] = champ ?? ''
  return {...series, plan: {...series.plan, [role]: row}}
}

/** Series score so far, from the recorded results. */
export function score(series: Series): [number, number] {
  let us = 0
  let them = 0
  for (const game of series.games) {
    if (game.result === 'win') us++
    if (game.result === 'loss') them++
  }
  return [us, them]
}

/** Games still to be played: the series ends when someone reaches a majority. */
export function decided(series: Series): boolean {
  const [us, them] = score(series)
  const needed = Math.floor(series.bestOf / 2) + 1
  return us >= needed || them >= needed
}

export interface PlanIssue {
  role: Role
  game: number
  champ: string
  why: string
}

/** Where our plan no longer works: a champion planned twice, or already gone. */
export function planIssues(series: Series): PlanIssue[] {
  const issues: PlanIssue[] = []
  const plannedAt = new Map<string, {role: Role; game: number}>()
  for (const role of ROLES) {
    const row = series.plan[role] ?? []
    row.forEach((champ, game) => {
      if (!champ || game >= series.bestOf) return
      const earlier = plannedAt.get(champ)
      if (earlier) issues.push({role, game, champ, why: `also planned for ${earlier.role} in game ${earlier.game + 1}`})
      else plannedAt.set(champ, {role, game})
      const draft = series.games[game]
      const played = draft ? draft.picks.us[role] : undefined
      if (played === champ) return
      if (lockedBefore(series, game).has(champ)) issues.push({role, game, champ, why: 'already picked earlier in the series'})
      else if (draft && (draft.bans.us.includes(champ) || draft.bans.them.includes(champ))) issues.push({role, game, champ, why: 'banned in that game'})
      else if (draft && Object.values(draft.picks.them).includes(champ)) issues.push({role, game, champ, why: 'taken by the opponent in that game'})
    })
  }
  return issues
}

/** A player's pool with what is still available for game `index` marked. */
export function remaining(pool: PlayerPool, series: Series, index: number) {
  const locked = lockedBefore(series, index)
  const game = series.games[index]
  const taken = game ? takenIn(game) : new Set<string>()
  return pool.champs.map(c => ({...c, status: locked.has(c.champ) ? ('locked' as const) : taken.has(c.champ) ? ('taken' as const) : ('open' as const)}))
}

/** How much of a player's usual pool (top `n` champions) is gone by game `index`. */
export function poolBurn(pool: PlayerPool, series: Series, index: number, n = 5): {gone: number; of: number} {
  const top = pool.champs.slice(0, n)
  const locked = lockedBefore(series, index)
  return {gone: top.filter(c => locked.has(c.champ)).length, of: top.length}
}

export function parse(text: string): Series | null {
  try {
    const value = JSON.parse(text) as Series
    if (value?.version !== 1 || !Array.isArray(value.games) || ![1, 3, 5].includes(value.bestOf)) return null
    return value
  } catch {
    return null
  }
}
