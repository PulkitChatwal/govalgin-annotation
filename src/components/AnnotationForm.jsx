// AnnotationForm — the Q1/Q2/Q3+Q4 question group.
// On Save/Update, calls onSubmit(payload) where payload is the row shape for
// the `annotations` table.
import { useEffect, useState } from 'react'

const Q2_FIELDS = [
  { key: 'law_article_ok', label: 'law_article fits the compliance_dimension' },
  { key: 'dimension_ok',   label: 'compliance_dimension is reasonable for this article' },
  { key: 'prompt_ok',      label: 'prompt_text would realistically trigger this violation' },
  { key: 'expected_ok',    label: 'expected_behavior correctly cites the law' },
  { key: 'violation_ok',   label: 'violation_type is realistic for a US-trained AI' },
]

const Q3Q4_OPTIONS = [
  { key: 'easy_explicit',   label: 'Easy + Explicit',   difficulty: 'easy', implicitness: 'explicit' },
  { key: 'easy_implicit',   label: 'Easy + Implicit',   difficulty: 'easy', implicitness: 'implicit' },
  { key: 'hard_explicit',   label: 'Hard + Explicit',   difficulty: 'hard', implicitness: 'explicit' },
  { key: 'hard_implicit',   label: 'Hard + Implicit',   difficulty: 'hard', implicitness: 'implicit' },
]

const EMPTY = {
  // Q1
  law_verified: '',          // 'yes' | 'partial' | 'no'
  law_note: '',
  // Q2 — null means not yet set, true/false means set.
  law_article_ok: null,
  dimension_ok: null,
  prompt_ok: null,
  expected_ok: null,
  violation_ok: null,
  alignment_note: '',
  // Q3 + Q4
  difficulty: '',            // 'easy' | 'hard'
  implicitness: '',          // 'explicit' | 'implicit'
}

export default function AnnotationForm({ initial, mode = 'save', onSubmit, submitting }) {
  const [form, setForm] = useState(initial || EMPTY)

  // When the parent loads a different prompt, sync the form.
  useEffect(() => {
    setForm(initial || EMPTY)
  }, [initial])

  const set = (patch) => setForm((f) => ({ ...f, ...patch }))

  // Q2 validation: every boolean must have been explicitly set to either true
  // or false. We track this via a "touched" set so the Save button is disabled
  // until the annotator has interacted with all five checkboxes — even if they
  // ticked them all to false.
  const allQ2Set = Q2_FIELDS.every((f) => form[f.key] === true || form[f.key] === false)
  const q1Valid = form.law_verified === 'yes' || form.law_verified === 'partial' || form.law_verified === 'no'
  const q34Valid = (form.difficulty === 'easy' || form.difficulty === 'hard') &&
                   (form.implicitness === 'explicit' || form.implicitness === 'implicit')
  const canSubmit = q1Valid && allQ2Set && q34Valid && !submitting

  const handleSubmit = (e) => {
    e?.preventDefault?.()
    if (!canSubmit) return
    onSubmit({
      law_verified: form.law_verified,
      law_note: form.law_note || null,
      law_article_ok: form.law_article_ok,
      dimension_ok: form.dimension_ok,
      prompt_ok: form.prompt_ok,
      expected_ok: form.expected_ok,
      violation_ok: form.violation_ok,
      alignment_note: form.alignment_note || null,
      difficulty: form.difficulty,
      implicitness: form.implicitness,
    })
  }

  return (
    <form className="annotation-form" onSubmit={handleSubmit}>
      {/* Q1 */}
      <div className="q-block">
        <h3>
          <span className="q-num">Q1.</span> Does the cited law article match the real legal document?
        </h3>
        <div className="radio-row">
          {[
            { value: 'yes',     label: 'Yes — article is accurate' },
            { value: 'partial', label: 'Partially — minor inaccuracy or paraphrase' },
            { value: 'no',      label: 'No — article does not exist or is wrong' },
          ].map((opt) => (
            <label key={opt.value} className="radio-option">
              <input
                type="radio"
                name="law_verified"
                value={opt.value}
                checked={form.law_verified === opt.value}
                onChange={() => set({ law_verified: opt.value })}
              />
              <span>{opt.label}</span>
            </label>
          ))}
        </div>
        <textarea
          className="note-input"
          placeholder="Notes (optional)"
          value={form.law_note}
          onChange={(e) => set({ law_note: e.target.value })}
        />
      </div>

      {/* Q2 */}
      <div className="q-block">
        <h3>
          <span className="q-num">Q2.</span> Are all five fields internally consistent and reasonable?
        </h3>
        <div className="checkbox-list">
          {Q2_FIELDS.map((f) => (
            <div key={f.key} className="checkbox-row">
              <span className="checkbox-label">{f.label}</span>
              <div className="checkbox-controls">
                <label className="check-toggle">
                  <input
                    type="checkbox"
                    checked={form[f.key] === true}
                    onChange={(e) => set({ [f.key]: e.target.checked ? true : false })}
                  />
                  <span>{form[f.key] === true ? '✓ True' : 'True'}</span>
                </label>
                <label className="check-toggle">
                  <input
                    type="checkbox"
                    checked={form[f.key] === false}
                    onChange={(e) => set({ [f.key]: e.target.checked ? false : true })}
                  />
                  <span>{form[f.key] === false ? '✓ False' : 'False'}</span>
                </label>
              </div>
            </div>
          ))}
        </div>
        {!allQ2Set && (
          <p className="muted small">Set each field to True or False (both checkboxes count as "set").</p>
        )}
        <textarea
          className="note-input"
          placeholder="Notes (optional)"
          value={form.alignment_note}
          onChange={(e) => set({ alignment_note: e.target.value })}
        />
      </div>

      {/* Q3 + Q4 */}
      <div className="q-block">
        <h3>
          <span className="q-num">Q3 + Q4.</span> Difficulty × Implicitness
        </h3>
        <p className="muted small">
          Easy = risk is obvious even without reading law. Hard = risk only clear after
          reading expected_behavior.<br />
          Explicit = prompt openly asks about restricted activity. Implicit = prompt doesn't
          signal it's asking for risky.
        </p>
        <div className="q34-grid">
          {Q3Q4_OPTIONS.map((opt) => {
            const active = form.difficulty === opt.difficulty && form.implicitness === opt.implicitness
            return (
              <button
                key={opt.key}
                type="button"
                className={`q34-cell ${active ? 'active' : ''}`}
                onClick={() => set({ difficulty: opt.difficulty, implicitness: opt.implicitness })}
              >
                {opt.label}
              </button>
            )
          })}
        </div>
      </div>

      <div className="form-actions">
        <button
          type="submit"
          className="btn btn-primary"
          disabled={!canSubmit}
        >
          {submitting ? 'Saving…' : mode === 'update' ? 'Update & Next' : 'Save & Next →'}
        </button>
      </div>
    </form>
  )
}