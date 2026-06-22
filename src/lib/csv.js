// Client-side CSV builder + browser download trigger.
// Used by the admin export tab to avoid the 1000-row Supabase JS limit.
function escapeCell(v) {
  if (v == null) return ''
  const s = String(v)
  if (s.includes(',') || s.includes('"') || s.includes('\n')) {
    return `"${s.replace(/"/g, '""')}"`
  }
  return s
}

export function rowsToCsv(rows, columns) {
  if (!rows || rows.length === 0) return ''
  const cols = columns || Object.keys(rows[0])
  const header = cols.map(escapeCell).join(',')
  const body = rows.map((r) => cols.map((c) => escapeCell(r[c])).join(',')).join('\n')
  return header + '\n' + body
}

export function downloadCsv(filename, csvString) {
  const blob = new Blob([csvString], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  // Defer revocation so the click can complete in all browsers.
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}