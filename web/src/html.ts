// Tiny helpers for building markup safely: every value goes through `esc`.
export const esc = (value: unknown) =>
  String(value ?? '').replace(/[&<>"']/g, c => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'})[c] as string)

/** Tagged template that escapes interpolations unless they are already `raw`. */
export class Raw {
  readonly html: string
  constructor(html: string) {
    this.html = html
  }
  toString() {
    return this.html
  }
}
export const raw = (html: string) => new Raw(html)

export function html(strings: TemplateStringsArray, ...values: unknown[]): Raw {
  let out = strings[0] ?? ''
  values.forEach((value, i) => {
    const part = Array.isArray(value) ? value.flat(Infinity).map(v => (v instanceof Raw ? v.html : esc(v))).join('') : value instanceof Raw ? value.html : value === false || value == null ? '' : esc(value)
    out += part + (strings[i + 1] ?? '')
  })
  return new Raw(out)
}

export const roleLabel: Record<string, string> = {top: 'Top', jungle: 'Jungle', mid: 'Mid', bot: 'Bot', support: 'Support', '?': 'Unknown'}

/** A horizontal stacked bar of a role mix, with an accessible text version. */
export function roleBar(mix: Record<string, number> | undefined): Raw {
  const entries = Object.entries(mix ?? {}).sort((a, b) => b[1] - a[1])
  const total = entries.reduce((a, [, n]) => a + n, 0)
  if (!total) return html`<span class="muted">no games</span>`
  const label = entries.map(([role, n]) => `${roleLabel[role] ?? role} ${Math.round((100 * n) / total)}%`).join(', ')
  const kind = (key: string, i: number) => (key in roleLabel ? `r-${key}` : `k${Math.min(i, 3)}`)
  return html`<div class="stack" role="img" aria-label="${label}">${entries.map(
    ([role, n], i) => html`<span class="seg ${kind(role, i)}" style="width:${((100 * n) / total).toFixed(1)}%" title="${roleLabel[role] ?? role}: ${n} of ${total}">${n / total >= 0.18 ? `${roleLabel[role] ?? role} ${Math.round((100 * n) / total)}%` : ''}</span>`,
  )}</div>`
}

export function meter(share: number, label = ''): Raw {
  const width = Math.max(0, Math.min(1, share)) * 100
  return html`<span class="meter" role="img" aria-label="${label || `${Math.round(width)}%`}"><span style="width:${width.toFixed(1)}%"></span></span>`
}
