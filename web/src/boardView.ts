// The Fearless series board: record each game's draft as it happens and see
// what is left for every player, what to ban next and whether the plan holds.
import {decided, lockedBefore, planIssues, poolBurn, remaining, score, takenIn, type Series, type Who} from './board.ts'
import {esc, html, raw, roleLabel, type Raw} from './html.ts'
import {banSuggestions, mainPlayer} from './stats.ts'
import type {FullSlice, Team} from './types.ts'
import {ROLES} from './types.ts'

export interface BoardContext {
  series: Series
  us: Team
  them: Team
  usSlice: FullSlice | null
  themSlice: FullSlice | null
  champions: string[]
  message: string
}

function draftColumn(ctx: BoardContext, who: Who): Raw {
  const index = ctx.series.current
  const game = ctx.series.games[index]!
  const team = who === 'us' ? ctx.us : ctx.them
  const side = who === 'us' ? game.ourSide : game.ourSide === 'blue' ? 'red' : 'blue'
  const bans = Array.from({length: 5}, (_, i) => game.bans[who][i])
  return html`<div class="draft-col ${side}">
    <h4>${team.name} <span class="${side}-text">${side}</span></h4>
    <div class="ban-row">${bans.map((b, i) => html`<label class="ban"><span>Ban ${i + 1}</span>${raw(`<input list="champions" autocomplete="off" spellcheck="false" data-ban="${who}" data-slot="${i}" aria-label="${escAttr(team.name)} ban ${i + 1}" value="${escAttr(b)}">`)}</label>`)}</div>
    ${ROLES.map(role => html`<label class="pick"><span class="role r-${role}">${roleLabel[role]}</span>${raw(`<input list="champions" autocomplete="off" spellcheck="false" data-pick="${who}" data-role="${role}" aria-label="${escAttr(team.name)} ${role} pick" value="${escAttr(game.picks[who][role])}">`)}</label>`)}
  </div>`
}

const escAttr = (value: string | undefined) => esc(value ?? '')

function pools(ctx: BoardContext): Raw {
  const index = ctx.series.current
  const row = (slice: FullSlice | null, role: (typeof ROLES)[number]) => {
    const player = slice ? mainPlayer(slice.players, role, slice.last_date) : undefined
    if (!player) return html`<td class="muted">no data</td>`
    const burn = poolBurn(player, ctx.series, index)
    return html`<td><div class="pool-head"><b>${player.name}</b> <small>${burn.gone}/${burn.of} of top champions gone</small></div>
      <ul class="pool-chips">${remaining(player, ctx.series, index).slice(0, 8).map(c => html`<li class="${c.status}" title="${c.games} games${c.status === 'locked' ? ' · picked earlier in the series' : c.status === 'taken' ? ' · picked or banned this game' : ''}">${c.champ} <span>${c.games}</span></li>`)}</ul></td>`
  }
  return html`<div class="scroll"><table class="pools-table">
    <thead><tr><th scope="col">Role</th><th scope="col">${ctx.us.name}</th><th scope="col">${ctx.them.name}</th></tr></thead>
    <tbody>${ROLES.map(role => html`<tr><th scope="row"><span class="role r-${role}">${roleLabel[role]}</span></th>${row(ctx.usSlice, role)}${row(ctx.themSlice, role)}</tr>`)}</tbody>
  </table></div>`
}

function plan(ctx: BoardContext): Raw {
  const issues = planIssues(ctx.series)
  const bad = new Set(issues.map(i => `${i.role}:${i.game}`))
  const games = Array.from({length: ctx.series.bestOf}, (_, i) => i)
  return html`<div class="scroll"><table class="plan">
    <thead><tr><th scope="col">Role</th>${games.map(g => html`<th scope="col">Game ${g + 1}</th>`)}</tr></thead>
    <tbody>${ROLES.map(role => html`<tr><th scope="row"><span class="role r-${role}">${roleLabel[role]}</span></th>${games.map(g => html`<td class="${bad.has(`${role}:${g}`) ? 'bad' : ''}">${raw(`<input list="champions" autocomplete="off" spellcheck="false" data-plan="${role}" data-game="${g}" aria-label="Plan ${role} game ${g + 1}" value="${escAttr(ctx.series.plan[role]?.[g])}">`)}</td>`)}</tr>`)}</tbody>
  </table></div>
  ${issues.length ? html`<ul class="issues">${issues.map(i => html`<li><b>${i.champ}</b> (${roleLabel[i.role]}, game ${i.game + 1}): ${i.why}</li>`)}</ul>` : html`<p class="ok">The plan holds: no champion is planned twice or already gone.</p>`}`
}

export function boardView(ctx: BoardContext): Raw {
  const s = ctx.series
  const index = s.current
  const game = s.games[index]!
  const locked = lockedBefore(s, index)
  const unavailable = new Set([...locked, ...takenIn(game)])
  const bans = ctx.themSlice ? banSuggestions(ctx.themSlice, ctx.usSlice, unavailable, 6) : []
  const [w, l] = score(s)
  return html`
  <section class="panel">
    <h2>Fearless series board: ${ctx.us.name} vs ${ctx.them.name}</h2>
    <div class="board-bar">
      <div role="group" aria-label="Series length" class="seg-control">${([1, 3, 5] as const).map(n => html`<button type="button" data-best-of="${n}" aria-pressed="${s.bestOf === n}">Bo${n}</button>`)}</div>
      <div role="tablist" aria-label="Games" class="game-tabs">${s.games.map((g, i) => html`<button type="button" role="tab" data-game-tab="${i}" aria-selected="${i === index}">Game ${i + 1}${g.result ? (g.result === 'win' ? ' ✓' : ' ✗') : ''}</button>`)}</div>
      <span class="series-score" aria-live="polite">Series ${w}–${l}${decided(s) ? ' (decided)' : ''}</span>
      <span class="spacer"></span>
      <button type="button" data-action="export">Export</button>
      <label class="file-btn">Import<input type="file" accept="application/json" data-action="import"></label>
      <button type="button" data-action="reset">New series</button>
    </div>
    ${ctx.message ? html`<p class="message" role="status">${ctx.message}</p>` : ''}
  </section>
  <div class="board">
    <section class="panel">
      <div class="game-bar">
        <h3>Game ${index + 1} draft</h3>
        <div role="group" aria-label="Our side" class="seg-control">${(['blue', 'red'] as const).map(side => html`<button type="button" data-our-side="${side}" aria-pressed="${game.ourSide === side}">We are ${side}</button>`)}</div>
        <div role="group" aria-label="Result" class="seg-control">${(['win', 'loss'] as const).map(r => html`<button type="button" data-result="${r}" aria-pressed="${game.result === r}">${r === 'win' ? 'We won' : 'We lost'}</button>`)}</div>
      </div>
      <div class="two">${draftColumn(ctx, 'us')}${draftColumn(ctx, 'them')}</div>
      <h4>Gone for this game (${locked.size} picked earlier in the series)</h4>
      ${locked.size ? html`<ul class="pool-chips">${[...locked].sort().map(c => html`<li class="locked">${c}</li>`)}</ul>` : html`<p class="muted">Nothing yet: this is the first game, or earlier games are empty.</p>`}
    </section>
    <section class="panel">
      <h3>Ban next (game ${index + 1})</h3>
      <p class="note">Recomputed from what is still available: champions already picked in the series or taken this game are left out.</p>
      <ol class="suggestions">${bans.map(b => html`<li><div class="sug-head"><b>${b.champ}</b> <span class="role r-${b.role}">${roleLabel[b.role ?? '?']}</span>${b.ours ? html` <span class="flag">also ours</span>` : ''}</div><small>${b.reasons[0]}</small></li>`)}</ol>
    </section>
  </div>
  <section class="panel"><h3>What each player has left in game ${index + 1}</h3><p class="note">Most-played champions first; struck through = picked earlier in the series, dimmed = picked or banned in this game.</p>${pools(ctx)}</section>
  <section class="panel"><h3>Our game-by-game plan</h3><p class="note">Write which champion each of our players should save for which game. The board warns when a plan uses a champion twice or one that is already gone.</p>${plan(ctx)}</section>
  <datalist id="champions">${ctx.champions.map(c => html`<option value="${c}"></option>`)}</datalist>`
}
