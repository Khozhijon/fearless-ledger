// Tests for the printable scouting sheet, using invented teams and numbers.
import assert from 'node:assert/strict'
import {test} from 'node:test'
import {sheetData} from '../web/src/sheet.ts'
import {sheetView, type View} from '../web/src/views.ts'
import {insights} from '../web/src/stats.ts'
import type {FullSlice, Pack, PlayerPool, Role, Team} from '../web/src/types.ts'
import {ROLES} from '../web/src/types.ts'

const pool = (id: string, role: Role, champs: [string, number, number, string][]): PlayerPool => ({
  id, name: id, role, games: champs.reduce((total, champ) => total + champ[1], 0), depth: champs.filter(champ => champ[1] >= 2).length,
  champs: champs.map(([champ, games, wins, last]) => ({champ, games, wins, last})),
})

function slice(players: PlayerPool[], extra: Partial<FullSlice> = {}): FullSlice {
  return {
    games: 10, wins: 6, first_date: '2026-01-01', last_date: '2026-06-01', series: 5, events: ['Made-up League'],
    sides: {blue: [5, 3], red: [5, 3]}, opponents: [['Other', 10]],
    champs: [
      {champ: 'Alpha', role: 'mid', picks: 8, wins: 6, bans_by: 3, bans_vs: 5, first_pick: 4, rotation1: 8, presence: 0.9},
      {champ: 'Beta', role: 'top', picks: 5, wins: 3, bans_by: 3, bans_vs: 4, first_pick: 2, rotation1: 6, presence: 0.7},
      {champ: 'Gamma', role: 'jungle', picks: 4, wins: 2, bans_by: 3, bans_vs: 0, first_pick: 2, rotation1: 5, presence: 0.5},
      {champ: 'Delta', role: 'bot', picks: 3, wins: 2, bans_by: 3, bans_vs: 0, first_pick: 1, rotation1: 4, presence: 0.4},
      {champ: 'Epsilon', role: 'support', picks: 2, wins: 1, bans_by: 0, bans_vs: 0, first_pick: 1, rotation1: 3, presence: 0.3},
      {champ: 'Zeta', role: 'mid', picks: 1, wins: 0, bans_by: 0, bans_vs: 0, first_pick: 0, rotation1: 2, presence: 0.2},
    ],
    bans: {blue: {phase1: [['Omega', 4]], phase2: [['Theta', 3]]}, red: {phase1: [['Iota', 4]], phase2: []}},
    ban_roles: {phase1: {mid: 5}, phase2: {support: 4, bot: 2}},
    pick_roles: {blue: [{jungle: 6, mid: 3, bot: 1}, {}, {}, {}, {top: 5}], red: [{}, {}, {}, {}, {top: 6}]},
    fearless: [{game: 1, n: 8, comfort_share: 0.6, top: []}, {game: 3, n: 4, comfort_share: 0.25, top: []}],
    players,
    objectives: {
      first_blood: {games: 10, took: 6, avg_t: null},
      first_drake: {games: 10, took: 7, avg_t: 400},
      first_herald: {games: 10, took: 4, avg_t: 800},
      first_tower: {games: 10, took: 5, avg_t: 900},
    },
    first_tower_lanes: {bot: 4, top: 1},
    jungle: {games: 10, junglers: [['Jungler', 10]], start: {'red buff': 6, 'blue buff': 4}, end_half: {top: 6, bot: 4}, first_scuttle: {top: 5, bot: 5}, early_kills: {before_s: 480, games: 10, zones: {bot: 6, top: 2, river: 1}}},
    ...extra,
  }
}

const roster = [
  pool('Top Starter', 'top', [['Beta', 6, 4, '2026-05-20']]),
  pool('Jungle Starter', 'jungle', [['Gamma', 7, 4, '2026-05-20']]),
  pool('Mid Starter', 'mid', [['Alpha', 8, 6, '2026-05-20'], ['Zeta', 2, 1, '2026-05-19'], ['Eta', 1, 1, '2026-05-18'], ['Theta', 1, 0, '2026-05-17']]),
  pool('Mid Backup', 'mid', [['Iota', 5, 3, '2026-05-20']]),
  pool('Former Mid', 'mid', [['Old Champ', 15, 11, '2025-03-01']]),
  pool('Bot Starter', 'bot', [['Delta', 5, 3, '2026-05-20']]),
  pool('Support Starter', 'support', [['Epsilon', 4, 2, '2026-05-20']]),
]

const homeSlice = slice([pool('Home Mid', 'mid', [['Alpha', 6, 4, '2026-05-20'], ['Beta', 5, 3, '2026-05-20'], ['Gamma', 4, 3, '2026-05-20'], ['Delta', 3, 2, '2026-05-20']])])
const opponentSlice = slice(roster)

function makeView(teamSlice = opponentSlice, home = homeSlice, self = false): View {
  const opponent: Team = {id: 'opponent', name: 'Made-up Team', slices: {'all|any': teamSlice}}
  const c9: Team = {id: 'home', name: 'Made-up Home', slices: {'all|any': home}}
  const pack: Pack = {home_team: c9.id, periods: ['all'], games_total: 20, date_range: ['2026-01-01', '2026-06-01'], champions: {}, teams: {[c9.id]: c9, [opponent.id]: opponent}, evidence: false}
  return {pack, team: self ? c9 : opponent, home: c9, period: 'all', side: 'any', slice: self ? home : teamSlice, homeSlice: home, roleFilter: 'all'}
}

test('sheet chooses one current player per role in role order and excludes former players', () => {
  const view = makeView()
  const data = sheetData(view)
  assert.deepEqual(data.players.map(player => player.role), ROLES)
  assert.equal(data.players.find(player => player.role === 'mid')?.name, 'Mid Starter')
  assert.ok(!data.players.some(player => player.name === 'Former Mid' || player.name === 'Mid Backup'))
  assert.deepEqual(data.players.find(player => player.role === 'mid')?.champs.map(champ => champ.champ), ['Alpha', 'Zeta', 'Eta'])
  assert.ok(!sheetView(view).html.includes('Former Mid'))
})

test('sheet caps ban and protect lists, and every displayed rate carries its sample count', () => {
  const view = makeView()
  const data = sheetData(view)
  assert.equal(data.bans.length, 5)
  assert.ok(data.bans.every(ban => ban.reason.length > 0))
  assert.ok(data.bans.some(ban => /\d+ games, \d+ wins \(\d+% wins\)/.test(ban.reason)))
  assert.equal(data.protect.length, 3)
  assert.deepEqual(data.insights, insights(view.team.name, view.slice).slice(0, 5))
  assert.deepEqual(data.rotations.map(row => [row.count, row.games]), [[8, 10], [6, 10], [5, 10], [4, 10], [3, 10]])
  assert.deepEqual(data.jungleStarts.map(row => [row.count, row.games]), [[6, 10], [4, 10]])
  assert.deepEqual(data.objectives.map(row => [row.took, row.games]), [[6, 10], [7, 10], [4, 10], [5, 10]])
  assert.match(sheetView(view).html, /80% \(8 of 10 games\)/)
  assert.match(sheetView(view).html, /60% \(6 of 10 games\)/)
  assert.match(sheetView(view).html, /70% \(7 of 10\)/)
})

test('missing objectives show no number, and self-scout omits ban and protect sections', () => {
  const noObjectives = makeView(slice(roster, {objectives: {}}))
  const missingData = sheetData(noObjectives)
  assert.ok(missingData.objectives.every(objective => objective.took === null && objective.games === null && objective.rate === null))
  const missingHtml = sheetView(noObjectives).html
  assert.match(missingHtml, /First blood: –/)
  assert.match(missingHtml, /First dragon: –/)

  const self = makeView(homeSlice, homeSlice, true)
  const selfData = sheetData(self)
  assert.equal(selfData.selfScout, true)
  assert.deepEqual(selfData.bans, [])
  assert.deepEqual(selfData.protect, [])
  assert.ok(!sheetView(self).html.includes('<h3>Ban targets</h3>'))
  assert.ok(!sheetView(self).html.includes('<h3>Protect picks</h3>'))
})