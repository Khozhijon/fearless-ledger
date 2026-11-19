// Tests for the scouting logic and the Fearless series board, on made-up teams.
import assert from 'node:assert/strict'
import {test} from 'node:test'
import * as board from '../web/src/board.ts'
import {banSuggestions, comfort, contested, currentPlayers, insights, mainPlayer, protect} from '../web/src/stats.ts'
import type {FullSlice, PlayerPool, Role} from '../web/src/types.ts'

const pool = (id: string, role: Role, champs: [string, number, number, string][]): PlayerPool => ({
  id, name: id.toUpperCase(), role, games: champs.reduce((a, c) => a + c[1], 0), depth: champs.filter(c => c[1] >= 2).length,
  champs: champs.map(([champ, games, wins, last]) => ({champ, games, wins, last})),
})

function slice(players: PlayerPool[], extra: Partial<FullSlice> = {}): FullSlice {
  return {
    games: 20, wins: 12, first_date: '2026-01-01', last_date: '2026-06-01', series: 8, events: ['Made-up League'],
    sides: {blue: [10, 7], red: [10, 5]}, opponents: [['Other', 20]],
    champs: [{champ: 'Alpha', role: 'mid', picks: 6, wins: 5, bans_by: 0, bans_vs: 9, first_pick: 4, rotation1: 6, presence: 0.75}],
    bans: {blue: {phase1: [['Zed', 6]], phase2: []}, red: {phase1: [], phase2: []}},
    ban_roles: {phase1: {mid: 6}, phase2: {support: 5, bot: 2}},
    pick_roles: {blue: [{jungle: 6, mid: 2, bot: 2}, {}, {}, {}, {top: 5, mid: 1}], red: [{}, {}, {}, {}, {top: 7, support: 3}]},
    fearless: [{game: 1, n: 8, comfort_share: 0.6, top: []}, {game: 3, n: 4, comfort_share: 0.2, top: []}],
    players, objectives: {first_drake: {games: 20, took: 14, avg_t: 400}, first_grubs: {games: 20, took: 6, avg_t: 330}, first_tower: {games: 20, took: 10, avg_t: 900}},
    first_tower_lanes: {bot: 7, top: 3},
    jungle: {games: 20, junglers: [['JG', 20]], start: {'red buff': 15, 'blue buff': 5}, end_half: {top: 14, bot: 6}, first_scuttle: {top: 12, bot: 8}, early_kills: {before_s: 480, games: 20, zones: {bot: 9, top: 3, river: 2}}},
    ...extra,
  }
}

const them = slice([
  pool('mid1', 'mid', [['Alpha', 8, 7, '2026-05-30'], ['Beta', 4, 1, '2026-05-01']]),
  pool('jg1', 'jungle', [['Gamma', 6, 4, '2026-05-20']]),
  pool('oldmid', 'mid', [['Delta', 12, 10, '2025-03-01']]), // left the team long ago
])
const us = slice([pool('ourmid', 'mid', [['Alpha', 5, 3, '2026-05-25'], ['Epsilon', 4, 3, '2026-05-25']])])

test('insights state habits with their evidence', () => {
  const list = insights('Them', them)
  const text = list.map(i => i.text).join('\n')
  assert.match(text, /first pick on jungle 60%/)
  assert.match(text, /keep top for the red-side last pick .* 70%/)
  assert.match(text, /phase-two bans target support/)
  assert.match(text, /game 1 60% .* games 3-5 only 20%/)
  assert.match(text, /JG starts on red buff 75%/)
  assert.match(text, /first dragon \(70%, around 6:40\)/)
  assert.match(text, /bot lane 70%/)
  assert.ok(list.every(i => i.evidence.length > 0))
  assert.equal(list.find(i => i.topic === 'fearless')?.confidence, 'thin') // only 4 late games
})

test('comfort rewards volume, wins and recency', () => {
  const recent = comfort({games: 8, wins: 7, last: '2026-05-30'}, '2026-06-01')
  const stale = comfort({games: 8, wins: 7, last: '2025-06-01'}, '2026-06-01')
  const few = comfort({games: 1, wins: 1, last: '2026-05-30'}, '2026-06-01')
  assert.ok(recent > stale && recent > few)
})

test('former players are left out of suggestions and plans', () => {
  assert.deepEqual(currentPlayers(them.players, them.last_date).map(p => p.id), ['mid1', 'jg1'])
  assert.equal(mainPlayer(them.players, 'mid', them.last_date)?.id, 'mid1')
  const bans = banSuggestions(them, us, new Set())
  assert.equal(bans[0]?.champ, 'Alpha')
  assert.ok(bans[0]?.ours, 'Alpha is also our comfort pick')
  assert.ok(!bans.some(b => b.champ === 'Delta'))
})

test('unavailable champions are never suggested', () => {
  assert.ok(!banSuggestions(them, us, new Set(['Alpha'])).some(b => b.champ === 'Alpha'))
})

test('protect and contested find shared interest', () => {
  const banningThem = slice(them.players, {champs: [{champ: 'Epsilon', role: 'mid', picks: 0, wins: 0, bans_by: 5, bans_vs: 0, first_pick: 0, rotation1: 0, presence: 0.25}]})
  assert.deepEqual(protect(us, banningThem, new Set()).map(p => p.champ), ['Epsilon'])
  assert.deepEqual(contested(us, them, new Set()).map(c => c.champ), ['Alpha'])
})

test('Fearless board locks champions picked in earlier games', () => {
  let s = board.newSeries('us', 'them', 3)
  s = board.setPick(s, 0, 'us', 'mid', 'Alpha')
  s = board.setPick(s, 0, 'them', 'mid', 'Beta')
  s = board.setBans(s, 0, 'us', ['Gamma'])
  const known = new Set(['Alpha', 'Beta', 'Gamma', 'Delta'])
  assert.equal(board.check(s, 1, 'Alpha', known), 'locked')
  assert.equal(board.check(s, 1, 'Gamma', known), null, 'bans reset every game')
  assert.equal(board.check(s, 0, 'Gamma', known), 'taken')
  assert.equal(board.check(s, 1, 'Nobody', known), 'unknown')
  assert.deepEqual([...board.lockedBefore(s, 2)].sort(), ['Alpha', 'Beta'])
})

test('series score and when it is decided', () => {
  let s = board.newSeries('us', 'them', 3)
  s = board.setResult(s, 0, 'win')
  assert.equal(board.decided(s), false)
  s = board.setResult(s, 1, 'win')
  assert.deepEqual(board.score(s), [2, 0])
  assert.equal(board.decided(s), true)
})

test('plan issues: duplicates, already gone, banned or taken', () => {
  let s = board.newSeries('us', 'them', 5)
  s = board.setPick(s, 0, 'them', 'top', 'Alpha')
  s = board.setPlan(s, 'top', 1, 'Alpha') // gone after game 1
  s = board.setPlan(s, 'mid', 2, 'Beta')
  s = board.setPlan(s, 'bot', 3, 'Beta') // planned twice
  s = board.setBans(s, 4, 'them', ['Gamma'])
  s = board.setPlan(s, 'jungle', 4, 'Gamma') // banned in that game
  const why = board.planIssues(s).map(i => `${i.champ}:${i.why}`)
  assert.deepEqual(why.sort(), ['Alpha:already picked earlier in the series', 'Beta:also planned for mid in game 3', 'Gamma:banned in that game'])
})

test('a played plan is not an issue', () => {
  let s = board.newSeries('us', 'them', 3)
  s = board.setPlan(s, 'mid', 0, 'Alpha')
  s = board.setPick(s, 0, 'us', 'mid', 'Alpha')
  assert.deepEqual(board.planIssues(s), [])
})

test('remaining pool and burn', () => {
  let s = board.newSeries('us', 'them', 3)
  s = board.setPick(s, 0, 'them', 'jungle', 'Alpha')
  s = board.setBans(s, 1, 'us', ['Beta'])
  const p = them.players[0]!
  assert.deepEqual(board.remaining(p, s, 1).map(c => c.status), ['locked', 'taken'])
  assert.deepEqual(board.poolBurn(p, s, 1), {gone: 1, of: 2})
})

test('import accepts only a valid series', () => {
  const s = board.newSeries('us', 'them', 5)
  assert.deepEqual(board.parse(JSON.stringify(s)), s)
  assert.equal(board.parse('{"version":2}'), null)
  assert.equal(board.parse('not json'), null)
})
