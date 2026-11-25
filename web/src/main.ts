// Fearless Ledger: loads a scouting pack and renders the scouting views.
import * as board from './board.ts'
import {boardView} from './boardView.ts'
import {html} from './html.ts'
import {championNames} from './stats.ts'
import {isFull, sliceOf, type Pack, type Role, type Side} from './types.ts'
import {methodView, prepView, scoutView, sheetView, type View} from './views.ts'

type Tab = 'scout' | 'prep' | 'sheet' | 'board' | 'method'
const TABS: [Tab, string][] = [['scout', 'Scouting report'], ['prep', 'Draft prep'], ['sheet', 'Scouting sheet'], ['board', 'Series board'], ['method', 'Method & data']]
const STORE = 'fearless-ledger:series'

interface State {
  pack: Pack
  teamId: string
  period: string
  side: Side
  tab: Tab
  roleFilter: Role | 'all'
  series: board.Series
  message: string
}

const app = document.getElementById('app')!
let state: State

function readHash(): Partial<State> {
  const params = new URLSearchParams(location.hash.slice(1))
  const out: Partial<State> = {}
  const tab = params.get('tab')
  if (tab && TABS.some(([t]) => t === tab)) out.tab = tab as Tab
  if (params.get('team')) out.teamId = params.get('team')!
  if (params.get('period')) out.period = params.get('period')!
  const side = params.get('side')
  if (side === 'any' || side === 'blue' || side === 'red') out.side = side
  return out
}

function writeHash() {
  const params = new URLSearchParams({tab: state.tab, team: state.teamId, period: state.period, side: state.side})
  history.replaceState(null, '', `#${params}`)
}

function loadSeries(pack: Pack, them: string): board.Series {
  try {
    const saved = board.parse(localStorage.getItem(STORE) ?? '')
    if (saved && saved.us === pack.home_team && pack.teams[saved.them]) return saved
  } catch {
    // Storage can be unavailable (private windows); the board still works for this visit.
  }
  return board.newSeries(pack.home_team, them)
}

function saveSeries() {
  try {
    localStorage.setItem(STORE, JSON.stringify(state.series))
  } catch {
    // Not persisted; nothing else to do.
  }
}

/** Start on the team Cloud9 Kia has played most often: the most likely next opponent to prepare. */
function defaultOpponent(pack: Pack) {
  const home = pack.teams[pack.home_team]
  const rivals = home?.slices['all|any']?.opponents ?? []
  for (const [name] of rivals) {
    const match = Object.values(pack.teams).find(t => t.name === name && t.id !== pack.home_team)
    if (match) return match.id
  }
  return Object.values(pack.teams).find(t => t.id !== pack.home_team)?.id ?? pack.home_team
}

function render() {
  const {pack} = state
  const team = pack.teams[state.teamId] ?? pack.teams[defaultOpponent(pack)]!
  const home = pack.teams[pack.home_team]!
  if (!team.slices[`${state.period}|any`]) state = {...state, period: 'all'}
  const slice = sliceOf(team, state.period, state.side)
  const homeSlice = sliceOf(home, state.period, 'any')
  const teams = Object.values(pack.teams).sort((a, b) => (a.id === pack.home_team ? -1 : b.id === pack.home_team ? 1 : a.name.localeCompare(b.name)))
  const controls = html`<div class="controls">
    <label>Team <select data-control="team">${teams.map(t => html`<option value="${t.id}" ${t.id === team.id ? 'selected' : ''}>${t.id === pack.home_team ? `${t.name} (self-scout)` : t.name}</option>`)}</select></label>
    <div role="group" aria-label="Period" class="seg-control">${pack.periods.filter(p => team.slices[`${p}|any`]).map(p => html`<button type="button" data-period="${p}" aria-pressed="${p === state.period}">${p === 'all' ? '2025–26' : p}</button>`)}</div>
    <div role="group" aria-label="Side" class="seg-control">${(['any', 'blue', 'red'] as const).map(s => html`<button type="button" data-side="${s}" aria-pressed="${s === state.side}">${s === 'any' ? 'Both sides' : `${s[0]!.toUpperCase()}${s.slice(1)}`}</button>`)}</div>
  </div>`
  const nav = html`<nav class="tabs" aria-label="Views">${TABS.map(([t, label]) => html`<button type="button" data-tab="${t}" aria-current="${t === state.tab ? 'page' : 'false'}">${label}</button>`)}</nav>`

  let body
  if (state.tab === 'method') body = methodView(pack)
  else if (state.tab === 'board') {
    const them = pack.teams[state.series.them] ?? team
    body = boardView({
      series: state.series, us: home, them, champions: championNames(pack), message: state.message,
      usSlice: isFull(homeSlice) ? homeSlice : null,
      themSlice: (s => (isFull(s) ? s : null))(sliceOf(them, state.period, 'any')),
    })
  } else if (!isFull(slice)) {
    body = html`<section class="panel"><h2>${team.name}</h2><p>No games for ${team.name} in this period and side. Try “2025–26” or “Both sides”.</p></section>`
  } else {
    const view: View = {pack, team, home, period: state.period, side: state.side, slice, homeSlice: isFull(homeSlice) ? homeSlice : null, roleFilter: state.roleFilter}
    body = state.tab === 'prep' ? prepView(view) : state.tab === 'sheet' ? sheetView(view) : scoutView(view)
  }
  app.innerHTML = `${nav}${state.tab === 'method' ? '' : controls}<div class="view">${body}</div>`
  writeHash()
}

function update(change: Partial<State>) {
  state = {...state, ...change}
  render()
}

function setSeries(series: board.Series, message = '') {
  state = {...state, series, message}
  saveSeries()
  render()
}

app.addEventListener('click', event => {
  const target = (event.target as HTMLElement).closest('button') as HTMLButtonElement | null
  if (!target) return
  const d = target.dataset
  if (d.tab) update({tab: d.tab as Tab, message: ''})
  else if (d.period) update({period: d.period})
  else if (d.side) update({side: d.side as Side})
  else if (d.roleFilter) update({roleFilter: d.roleFilter as Role | 'all'})
  else if (d.gameTab) setSeries({...state.series, current: Number(d.gameTab)})
  else if (d.action === 'print-sheet') window.print()
  else if (d.bestOf) {
    const bestOf = Number(d.bestOf) as 1 | 3 | 5
    const games = Array.from({length: bestOf}, (_, i) => state.series.games[i] ?? board.emptyGame(i % 2 ? 'red' : 'blue'))
    setSeries({...state.series, bestOf, games, current: Math.min(state.series.current, bestOf - 1)})
  } else if (d.ourSide) setSeries(board.setSide(state.series, state.series.current, d.ourSide as 'blue' | 'red'))
  else if (d.result) {
    const current = state.series.games[state.series.current]!
    setSeries(board.setResult(state.series, state.series.current, current.result === d.result ? null : (d.result as 'win' | 'loss')))
  } else if (d.action === 'reset') {
    if (confirm('Start a new series? The current board will be cleared.')) setSeries(board.newSeries(state.pack.home_team, state.teamId === state.pack.home_team ? state.series.them : state.teamId, state.series.bestOf), 'New series started.')
  } else if (d.action === 'export') {
    const blob = new Blob([JSON.stringify(state.series, null, 2)], {type: 'application/json'})
    const link = Object.assign(document.createElement('a'), {href: URL.createObjectURL(blob), download: `series-${state.pack.teams[state.series.them]?.name ?? 'opponent'}.json`.replace(/\s+/g, '-')})
    link.click()
    URL.revokeObjectURL(link.href)
  }
})

app.addEventListener('change', async event => {
  const el = event.target as HTMLInputElement | HTMLSelectElement
  const d = el.dataset
  if (d.control === 'team') {
    const teamId = el.value
    // The board follows the scouted opponent when it is still empty.
    const empty = state.series.games.every(g => !Object.keys(g.picks.us).length && !Object.keys(g.picks.them).length && !g.bans.us.length && !g.bans.them.length)
    const series = empty && teamId !== state.pack.home_team ? {...state.series, them: teamId} : state.series
    state = {...state, series}
    saveSeries()
    return update({teamId})
  }
  if (d.action === 'import' && el instanceof HTMLInputElement && el.files?.[0]) {
    const series = board.parse(await el.files[0].text())
    return series ? setSeries(series, 'Series imported.') : update({message: 'That file is not a Fearless Ledger series.'})
  }
  const value = el.value.trim()
  const known = new Set(Object.keys(state.pack.champions))
  const name = [...known].find(c => c.toLowerCase() === value.toLowerCase()) ?? value
  const index = state.series.current
  if (d.plan) return setSeries(board.setPlan(state.series, d.plan as Role, Number(d.game), name || null))
  if (!d.pick && !d.ban) return
  if (name) {
    const problem = board.check(state.series, index, name, known)
    const current = d.pick ? state.series.games[index]!.picks[d.pick as board.Who][d.role as Role] : state.series.games[index]!.bans[d.ban as board.Who][Number(d.slot)]
    if (problem && current !== name) {
      const why = problem === 'locked' ? `${name} was picked earlier in this series (Fearless).` : problem === 'taken' ? `${name} is already picked or banned in this game.` : `“${value}” is not a champion in the data.`
      el.value = current ?? ''
      return update({message: why})
    }
  }
  if (d.pick) setSeries(board.setPick(state.series, index, d.pick as board.Who, d.role as Role, name || null))
  else {
    const bans = [...state.series.games[index]!.bans[d.ban as board.Who]]
    bans[Number(d.slot)] = name
    setSeries(board.setBans(state.series, index, d.ban as board.Who, Array.from({length: 5}, (_, i) => bans[i] ?? '')))
  }
})

// Links such as #tab=prep&team=340 open a view directly (handy for sharing a report with the staff).
window.addEventListener('hashchange', () => {
  if (!state) return
  const hash = readHash()
  const change: Partial<State> = {}
  if (hash.tab && hash.tab !== state.tab) change.tab = hash.tab
  if (hash.teamId && hash.teamId !== state.teamId && state.pack.teams[hash.teamId]) change.teamId = hash.teamId
  if (hash.period && hash.period !== state.period && state.pack.periods.includes(hash.period)) change.period = hash.period
  if (hash.side && hash.side !== state.side) change.side = hash.side
  if (Object.keys(change).length) update(change)
})

async function loadPack(): Promise<Pack> {
  // A pack built from your own copy of the data (served by `npm run dev`) wins over the public demo.
  for (const file of ['local-pack.json', 'demo-pack.json']) {
    try {
      const response = await fetch(file, {cache: 'no-cache'})
      if (response.ok) return (await response.json()) as Pack
    } catch {
      // try the next one
    }
  }
  throw new Error('No scouting pack found.')
}

loadPack()
  .then(pack => {
    const hash = readHash()
    const opponent = hash.teamId && pack.teams[hash.teamId] ? hash.teamId : defaultOpponent(pack)
    state = {
      pack, teamId: opponent, period: hash.period && pack.periods.includes(hash.period) ? hash.period : pack.periods[0] ?? 'all', side: hash.side ?? 'any',
      tab: hash.tab ?? 'scout', roleFilter: 'all', series: loadSeries(pack, opponent), message: '',
    }
    document.getElementById('pack-note')!.textContent = pack.evidence
      ? `Local pack · ${Object.keys(pack.teams).length} teams · ${pack.games_total.toLocaleString('en-US')} games · with game lists`
      : `Public demo · LCS 2026 teams · built from ${pack.games_total.toLocaleString('en-US')} pro games (GRID) · aggregates only`
    render()
  })
  .catch(error => {
    app.innerHTML = `<section class="panel"><h2>Could not load the scouting pack</h2><p>${String(error)}</p></section>`
  })
