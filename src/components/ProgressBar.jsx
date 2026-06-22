// ProgressBar — visual bar showing X / Y progress.
export default function ProgressBar({ done, total, className }) {
  const pct = total > 0 ? Math.round((done / total) * 100) : 0
  return (
    <div className={`progress ${className || ''}`}>
      <div className="progress-track">
        <div className="progress-fill" style={{ width: `${pct}%` }} />
      </div>
      <span className="progress-label">{done} / {total} prompts</span>
    </div>
  )
}