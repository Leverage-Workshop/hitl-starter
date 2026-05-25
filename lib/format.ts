export const fmtTime = (iso: string): string => {
  const d = new Date(iso)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`
}

export const fmtMoney = (n: number): string => {
  if (!n) return '—'
  if (n >= 1000) return `$${(n / 1000).toFixed(0)}k`
  return `$${n}`
}

export const fmtRelative = (iso: string): string => {
  const d = new Date(iso)
  const diff = (Date.now() - d.getTime()) / 60000
  if (diff < 60) return `${Math.round(diff)}m`
  if (diff < 24 * 60) return `${Math.round(diff / 60)}h`
  return `${Math.round(diff / (24 * 60))}d`
}
