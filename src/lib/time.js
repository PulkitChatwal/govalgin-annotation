// Time formatting helpers.
export function formatSeconds(seconds) {
  if (!seconds || seconds < 0) return '0s'
  const m = Math.floor(seconds / 60)
  const s = seconds % 60
  if (m === 0) return `${s}s`
  return `${m}m ${s}s`
}

export function todayIso() {
  const d = new Date()
  return d.toISOString().slice(0, 10)
}