// The scouting report, the draft-prep page and the method page.
import {html, meter, raw, roleBar, roleLabel, type Raw} from './html.ts'
import {rift} from './rift.ts'
import {sheetData} from './sheet.ts'
import {banSuggestions, clock, contested, currentPlayers, insights, pct, priority, protect, type Suggestion} from './stats.ts'
import type {FullSlice, Pack, Role, Team} from './types.ts'
import {ROLES} from './types.ts'

export interface View {
  pack: Pack
  team: Team
  home: Team
  period: string
  side: 'any' | 'blue' | 'red'
  slice: FullSlice
  homeSlice: FullSlice | null
  roleFilter: Role | 'all'
}

const winPct = (wins: number, games: number) => (games ? `${pct(wins, games)}%` : '–')
const periodLabel = (period: string) => (period === 'all' ? 'all 2025–26 games' : `${period} only`)
const sideLabel = (side: string) => (side === 'any' ? 'both sides' : `${side} side`)

export function scope(v: View): string {
  return `${v.team.name} · ${periodLabel(v.period)} · ${sideLabel(v.side)}`
}

function summary(v: View): Raw {
  const s = v.slice
  const [bg, bw] = s.sides.blue
  const [rg, rw] = s.sides.red
  return html`<section class="summary" aria-label="Sample">
    <div><b>${s.games}</b><span>games (${s.series} series)</span></div>
    <div><b>${winPct(s.wins, s.games)}</b><span>won (${s.wins}–${s.games - s.wins})</span></div>
    <div><b>${winPct(bw, bg)}</b><span>blue side (${bg} games)</span></div>
    <div><b>${winPct(rw, rg)}</b><span>red side (${rg} games)</span></div>
    <div class="wide"><b>${s.first_date} → ${s.last_date}</b><span>${s.events.join(' · ')}</span></div>
  </section>`
}

function whiteboard(v: View): Raw {
  const list = insights(v.team.name, v.slice)
  if (!list.length) return html`<p class="muted">Not enough games in this slice for clear habits. Widen the period or side.</p>`
  return html`<ol class="insights">${list.map(
    i => html`<li class="insight t-${i.topic}">
      <span class="tag">${i.topic}</span>
      <p>${i.text}</p>
      <small>${i.evidence}${i.confidence === 'thin' ? raw(' · <em class="thin">small sample</em>') : ''}</small>
    </li>`,
  )}</ol>`
}

function pickOrder(v: View): Raw {
  const s = v.slice
  const rows = (side: 'blue' | 'red') =>
    s.pick_roles[side].map((mix, i) => html`<tr><th scope="row">${side === 'blue' ? 'B' : 'R'}${i + 1}</th><td>${roleBar(mix)}</td></tr>`)
  return html`<div class="two">
    <div><h4 class="blue-text">Blue-side picks</h4><table class="bars"><tbody>${rows('blue')}</tbody></table></div>
    <div><h4 class="red-text">Red-side picks</h4><table class="bars"><tbody>${rows('red')}</tbody></table></div>
  </div>
  <p class="note">Which role each pick slot goes to. B1 is the first pick of the draft; R5 is the last (the counter-pick). Order: B1, R1–R2, B2–B3, R3, then after the second ban phase R4, B4–B5, R5.</p>`
}

function bans(v: View): Raw {
  const s = v.slice
  const list = (items: [string, number][], games: number) =>
    items.length ? html`<ol class="chips">${items.slice(0, 6).map(([c, n]) => html`<li><b>${c}</b> <span>${n}/${games}</span></li>`)}</ol>` : html`<p class="muted">none</p>`
  const [bg] = s.sides.blue
  const [rg] = s.sides.red
  return html`<div class="grid4">
    <div><h4 class="blue-text">Blue · phase 1</h4>${list(s.bans.blue.phase1, bg)}</div>
    <div><h4 class="blue-text">Blue · phase 2</h4>${list(s.bans.blue.phase2, bg)}</div>
    <div><h4 class="red-text">Red · phase 1</h4>${list(s.bans.red.phase1, rg)}</div>
    <div><h4 class="red-text">Red · phase 2</h4>${list(s.bans.red.phase2, rg)}</div>
  </div>
  <div class="two">
    <div><h4>Phase-1 bans by role</h4>${roleBar(s.ban_roles.phase1)}</div>
    <div><h4>Phase-2 bans by role</h4>${roleBar(s.ban_roles.phase2)}</div>
  </div>`
}

function priorityTable(v: View): Raw {
  const rows = priority(v.slice.champs, v.roleFilter, 18)
  const chip = (role: Role | 'all') => html`<button type="button" class="chip-btn" data-role-filter="${role}" aria-pressed="${v.roleFilter === role}">${role === 'all' ? 'All roles' : roleLabel[role]}</button>`
  return html`<div class="filters" role="group" aria-label="Filter by role">${chip('all')}${ROLES.map(chip)}</div>
  <div class="scroll"><table class="data">
    <thead><tr><th scope="col">Champion</th><th scope="col">Role</th><th scope="col" title="Share of their games where it was picked or banned by either team">Presence</th><th scope="col">Picked</th><th scope="col">Won</th><th scope="col" title="First pick of the draft (B1 or R1)">1st pick</th><th scope="col" title="Picked in the first three picks">Rotation 1</th><th scope="col">Banned by them</th><th scope="col">Banned vs them</th></tr></thead>
    <tbody>${rows.map(
      r => html`<tr>
        <th scope="row">${r.champ}</th><td><span class="role r-${r.role}">${roleLabel[r.role ?? '?']}</span></td>
        <td>${meter(r.presence, `${Math.round(100 * r.presence)}%`)} ${Math.round(100 * r.presence)}%</td>
        <td>${r.picks}</td><td>${r.picks ? winPct(r.wins, r.picks) : '–'}</td><td>${r.first_pick || ''}</td><td>${r.rotation1 || ''}</td><td>${r.bans_by || ''}</td><td>${r.bans_vs || ''}</td>
      </tr>`,
    )}</tbody>
  </table></div>`
}

function fearless(v: View): Raw {
  const games = v.slice.fearless
  return html`<div class="fearless">${games.map(
    g => html`<article>
      <h4>Game ${g.game}</h4>
      <p class="small">${g.n} games</p>
      <p>${meter(g.comfort_share ?? 0, `comfort picks ${Math.round(100 * (g.comfort_share ?? 0))}%`)} <b>${Math.round(100 * (g.comfort_share ?? 0))}%</b> comfort picks</p>
      <ol class="mini">${g.top.slice(0, 5).map(([c, n]) => html`<li>${c} <span>${n}</span></li>`)}</ol>
    </article>`,
  )}</div>
  <p class="note">Comfort pick = one of that player's three most-played champions in this slice. Every 2025–26 event in the data used Fearless Draft, so each game of a series removes the champions picked before it.</p>`
}

function players(v: View): Raw {
  const current = new Set(currentPlayers(v.slice.players, v.slice.last_date).map(p => p.id))
  const main = v.slice.players.filter(p => p.games >= Math.min(5, v.slice.games)).sort((a, b) => Number(current.has(b.id)) - Number(current.has(a.id)))
  return html`<div class="players">${main.map(
    p => html`<article class="player ${current.has(p.id) ? '' : 'former'}">
      <header><span class="role r-${p.role}">${roleLabel[p.role]}</span> <h4>${p.name}</h4>${current.has(p.id) ? '' : html` <span class="flag">no longer in the lineup</span>`} <small>${p.games} games · ${p.depth} champions played twice or more</small></header>
      <table class="pool"><tbody>${p.champs.slice(0, 7).map(
        c => html`<tr><th scope="row">${c.champ}</th><td>${c.games}</td><td>${winPct(c.wins, c.games)}</td><td class="muted">${c.last}</td></tr>`,
      )}</tbody></table>
    </article>`,
  )}</div>`
}

function objectives(v: View): Raw {
  const o = v.slice.objectives
  const names: [string, string][] = [['first_blood', 'First blood'], ['first_grubs', 'First void grubs'], ['first_drake', 'First dragon'], ['first_herald', 'First Rift Herald'], ['first_tower', 'First tower'], ['first_baron', 'First Baron']]
  const j = v.slice.jungle
  const mix = (record: Record<string, number>) => roleBar(record)
  return html`<div class="macro">
    ${rift(j.early_kills.zones, `Where kills involving their jungler happen before ${clock(j.early_kills.before_s)} (${Object.values(j.early_kills.zones).reduce((a, b) => a + b, 0)} kills, ${j.early_kills.games} games)`)}
    <div>
      <h4>Jungle first clear${j.junglers[0] ? ` · ${j.junglers.map(([n, g]) => `${n} (${g})`).join(', ')}` : ''}</h4>
      <table class="bars"><tbody>
        <tr><th scope="row">Starts on</th><td>${mix(j.start)}</td></tr>
        <tr><th scope="row">Clear ends</th><td>${mix(Object.fromEntries(Object.entries(j.end_half).map(([k, n]) => [`${k} side`, n])))}</td></tr>
        <tr><th scope="row">First scuttle</th><td>${mix(Object.fromEntries(Object.entries(j.first_scuttle).map(([k, n]) => [`${k} river`, n])))}</td></tr>
      </tbody></table>
      <h4>First objectives</h4>
      <table class="data compact"><thead><tr><th scope="col">Objective</th><th scope="col">Took it</th><th scope="col">Avg. time</th></tr></thead><tbody>
        ${names.map(([key, label]) => {
          const x = o[key]
          return x ? html`<tr><th scope="row">${label}</th><td>${meter(x.games ? x.took / x.games : 0)} ${pct(x.took, x.games)}% <span class="muted">(${x.took}/${x.games})</span></td><td>${clock(x.avg_t)}</td></tr>` : ''
        })}
      </tbody></table>
      ${Object.keys(v.slice.first_tower_lanes).length ? html`<h4>Their first tower, by lane</h4>${roleBar(v.slice.first_tower_lanes)}` : ''}
    </div>
  </div>`
}

function evidence(v: View): Raw {
  const list = v.team.evidence
  if (!list) {
    return html`<p class="note">The public demo shows counts and rates only: the GRID data licence does not allow re-publishing match-level data. Run Fearless Ledger on your own copy of the hackathon data (README, "Run it locally") to see every game behind these numbers, with its full draft.</p>`
  }
  const games = list.filter(g => (v.period === 'all' || g.date.startsWith(v.period)) && (v.side === 'any' || g.side === v.side)).slice(-40).reverse()
  return html`<div class="scroll"><table class="data compact">
    <thead><tr><th scope="col">Date</th><th scope="col">Event</th><th scope="col">Game</th><th scope="col">Side</th><th scope="col">Opponent</th><th scope="col">Result</th><th scope="col">Draft (their picks in bold)</th></tr></thead>
    <tbody>${games.map(g => {
      const mine = g.side === 'blue' ? 'B' : 'R'
      return html`<tr><td>${g.date}</td><td>${g.event}</td><td>${g.game ?? ''}</td><td class="${g.side}-text">${g.side}</td><td>${g.opponent}</td><td>${g.won ? 'Win' : 'Loss'}</td>
        <td class="draft">${g.draft.map(([slot, champ]) => (slot.startsWith(mine) && !slot.includes('ban') ? html`<b title="${slot}">${champ}</b> ` : slot.includes('ban') ? html`<s title="${slot}">${champ}</s> ` : html`<span title="${slot}">${champ}</span> `))}</td></tr>`
    })}</tbody></table></div>
    <p class="note">Last ${games.length} games in this slice, newest first. Struck through = banned.</p>`
}

export function scoutView(v: View): Raw {
  const self = v.team.id === v.home.id
  return html`
  <section class="panel">
    <h2>${self ? 'Self-scout' : 'Scouting report'}: ${v.team.name}</h2>
    <p class="scope">${scope(v)}</p>
    ${summary(v)}
  </section>
  <section class="panel"><h3>What to put on the whiteboard</h3>${whiteboard(v)}</section>
  <section class="panel"><h3>Draft: who gets each pick</h3>${pickOrder(v)}</section>
  <section class="panel"><h3>Draft: bans</h3>${bans(v)}</section>
  <section class="panel"><h3>Draft: champion priority</h3>${priorityTable(v)}</section>
  <section class="panel"><h3>Fearless: how their picks change through a series</h3>${fearless(v)}</section>
  <section class="panel"><h3>Player pools</h3>${players(v)}</section>
  <section class="panel"><h3>Early macro: jungle and first objectives</h3>${objectives(v)}</section>
  <section class="panel"><h3>Evidence</h3>${evidence(v)}</section>`
}

export function sheetView(v: View): Raw {
  const data = sheetData(v)
  const team = data.team
  const objectiveRate = (objective: typeof data.objectives[number]) =>
    objective.rate == null ? '–' : `${objective.rate}% (${objective.took} of ${objective.games})`
  return html`<article class="sheet">
    <header class="sheet-head">
      <div><h2>Scouting sheet: ${team.name}</h2><p class="scope">${scope(v)}</p></div>
      <button type="button" data-action="print-sheet">Print sheet</button>
    </header>
    <div class="sheet-grid">
      <div class="sheet-col">
        <section class="sheet-block">
          <h3>Team record</h3>
          <p><b>${team.wins}–${team.losses}</b> · ${team.games} games</p>
          <p>Blue: ${team.blue.wins}–${team.blue.games - team.blue.wins} (${team.blue.wins} wins in ${team.blue.games} games) · Red: ${team.red.wins}–${team.red.games - team.red.wins} (${team.red.wins} wins in ${team.red.games} games)</p>
          <p>${team.firstDate} – ${team.lastDate}</p>
        </section>
        <section class="sheet-block">
          <h3>Whiteboard insights</h3>
          ${data.insights.length ? html`<ol>${data.insights.map(i => html`<li><p>${i.text}</p><small>${i.evidence}</small></li>`)}</ol>` : html`<p class="muted">Not enough games in this slice for clear habits.</p>`}
        </section>
        ${data.selfScout ? '' : html`<section class="sheet-block">
          <h3>Ban targets</h3>
          ${data.bans.length ? html`<ol>${data.bans.map(b => html`<li><b>${b.champ}</b> <small>${b.reason}</small></li>`)}</ol>` : html`<p class="muted">No clear ban targets in this slice.</p>`}
        </section>
        ${data.selfScout ? '' : html`<section class="sheet-block">
          <h3>Protect picks</h3>
          ${data.protect.length ? html`<ul>${data.protect.map(p => html`<li><b>${p.champ}</b> · ${p.player} (${roleLabel[p.role]}) <small>${p.games} games; banned ${p.banned} times</small></li>`)}</ul>` : html`<p class="muted">No repeated bans on our current picks in this slice.</p>`}
        </section>`}`}
      </div>
      <div class="sheet-col">
        <section class="sheet-block">
          <h3>First-rotation picks</h3>
          ${data.rotations.length ? html`<ul>${data.rotations.map(r => html`<li><b>${r.champ}</b> · ${pct(r.count, r.games)}% (${r.count} of ${r.games} games)</li>`)}</ul>` : html`<p class="muted">No first-rotation picks in this slice.</p>`}
        </section>
        <section class="sheet-block">
          <h3>Current players</h3>
          ${data.players.length ? html`<ul>${data.players.map(p => html`<li><b>${roleLabel[p.role]} · ${p.name}</b>${p.champs.length ? html`<ul>${p.champs.map(c => html`<li>${c.champ}: ${c.games} games, ${c.wins} wins · last ${c.last}</li>`)}</ul>` : html`<small>No champion sample</small>`}</li>`)}</ul>` : html`<p class="muted">No current players in this slice.</p>`}
        </section>
        <section class="sheet-block">
          <h3>Jungle and first objectives</h3>
          <p><b>Jungle starts</b></p>
          ${data.jungleStarts.length ? html`<ul>${data.jungleStarts.map(j => html`<li>${j.name}: ${j.rate}% (${j.count} of ${j.games} games)</li>`)}</ul>` : html`<p class="muted">No observed starts in this slice.</p>`}
          <ul>${data.objectives.map(o => html`<li>${o.label}: ${objectiveRate(o)}</li>`)}</ul>
        </section>
      </div>
    </div>
  </article>`
}

function suggestionList(list: Suggestion[]): Raw {
  const top = list[0]?.score || 1
  return html`<ol class="suggestions">${list.map(
    s => html`<li>
      <div class="sug-head"><b>${s.champ}</b> <span class="role r-${s.role}">${roleLabel[s.role ?? '?']}</span> ${s.ours ? html`<span class="flag" title="Also one of our players' top-3 champions">also ours</span>` : ''} ${meter(s.score / top)}</div>
      <small>${s.reasons.slice(0, 2).join(' · ')}</small>
    </li>`,
  )}</ol>`
}

export function prepView(v: View): Raw {
  if (v.team.id === v.home.id) return html`<section class="panel"><h2>Draft prep</h2><p>Pick an opponent above to prepare a draft against them. Cloud9 Kia is the home team.</p></section>`
  const us = v.homeSlice
  const none = new Set<string>()
  const bansFor = banSuggestions(v.slice, us, none)
  const keep = us ? protect(us, v.slice, none) : []
  const clash = us ? contested(us, v.slice, none) : []
  const firsts = [...v.slice.champs].filter(c => c.rotation1 > 0).sort((a, b) => b.rotation1 - a.rotation1).slice(0, 8)
  return html`
  <section class="panel">
    <h2>Draft prep: ${v.home.name} vs ${v.team.name}</h2>
    <p class="scope">Opponent: ${scope(v)} · ${v.home.name}: same period, both sides</p>
  </section>
  <div class="two">
    <section class="panel"><h3>Ban targets</h3><p class="note">Ranked by how much their players rely on each champion (games played, win rate, how recently) plus how often the team takes it in the first rotation.</p>${suggestionList(bansFor)}</section>
    <section class="panel">
      <h3>Protect: our picks they ban</h3>
      ${keep.length ? html`<ol class="suggestions">${keep.map(k => html`<li><div class="sug-head"><b>${k.champ}</b> <span class="role r-${k.role}">${roleLabel[k.role]}</span></div><small>${k.player} has ${k.games} games on it; ${v.team.name} banned it ${k.banned} times</small></li>`)}</ol>` : html`<p class="muted">They do not repeatedly ban our top picks in this slice.</p>`}
      <h3>Contested: both sides' players want it</h3>
      ${clash.length ? html`<table class="data compact"><thead><tr><th scope="col">Role</th><th scope="col">Champion</th><th scope="col">Our games</th><th scope="col">Their games</th></tr></thead><tbody>${clash.slice(0, 10).map(c => html`<tr><td><span class="role r-${c.role}">${roleLabel[c.role]}</span></td><th scope="row">${c.champ}</th><td>${c.ours}</td><td>${c.theirs}</td></tr>`)}</tbody></table>` : html`<p class="muted">No shared comfort picks by role.</p>`}
      <h3>Their first-rotation picks</h3>
      <ol class="chips">${firsts.map(c => html`<li><b>${c.champ}</b> <span>${c.rotation1}/${v.slice.games}</span></li>`)}</ol>
    </section>
  </div>`
}

export function methodView(pack: Pack): Raw {
  return html`<section class="panel prose">
    <h2>How Fearless Ledger works</h2>
    <p>Fearless Ledger reads the official GRID event feeds of ${pack.games_total.toLocaleString('en-US')} professional League of Legends games (LCK, LEC, LTA, LCS; ${pack.date_range?.[0]} to ${pack.date_range?.[1]}) that Cloud9 and GRID provided for this hackathon, and turns them into scouting answers a coach can act on.</p>
    <ol>
      <li><b>Replay.</b> A Python pipeline streams each series feed and keeps, per game: the 20-step draft, who played what, the result, the first blood, tower, grubs, dragon, herald and Baron, every kill before 14:00 with its location and assists, and the jungler's position at 1:35, 2:30 and 3:20.</li>
      <li><b>Roles.</b> GRID does not record roles, and its player order is not reliable in 2025–26 feeds. Each player's role is inferred from the first eight minutes (who clears camps, who stands in which lane, who has more gold at 10:00) and then settled to the role that player plays most often, which removes early lane swaps.</li>
      <li><b>Fearless.</b> A series counts as Fearless when no champion is picked twice across its games; every event in this data qualifies.</li>
      <li><b>Aggregate.</b> For each team, period and side the pipeline counts draft slots, bans by phase, champion priority, player pools, Fearless shifts by game number, first objectives and jungle habits.</li>
      <li><b>Suggest.</b> Ban targets weigh each opponent player's reliance on a champion (games, smoothed win rate, recency) and the team's first-rotation priority. Every number on screen shows its sample size; samples under 15 are marked "small sample".</li>
    </ol>
    <h3>Data licence</h3>
    <p>The match data is licensed for this hackathon only and may not be redistributed. This public page therefore holds aggregates only (counts and rates for the LCS 2026 teams), and the repository contains no data at all. Run the pipeline on your own copy of the hackathon data to scout any team in it with every game listed.</p>
    <p>Match data provided by GRID. League of Legends is a trademark of Riot Games, Inc. This project is not endorsed by Riot Games, Cloud9 or GRID.</p>
  </section>`
}

