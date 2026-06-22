// PromptCard — renders a single prompt's metadata and text.
// Prompt text and expected_behavior use dir="auto" for RTL support.
import LawDocuments from './LawDocuments'

export default function PromptCard({ prompt, showExpected, onToggleExpected, showViolation, onToggleViolation }) {
  return (
    <div className="prompt-card">
      <div className="prompt-header">
        <span className="prompt-id">{prompt.id}</span>
        <span className="prompt-jurisdiction">{prompt.jurisdiction}</span>
      </div>
      <div className="prompt-meta">
        <span><strong>Compliance dimension:</strong> {prompt.compliance_dimension}</span>
      </div>
      <div className="prompt-meta">
        <strong>Law article:</strong> {prompt.law_article}
      </div>
      <div className="prompt-meta law-docs-row">
        <LawDocuments country={prompt.country} />
      </div>

      <div className="prompt-text-box">
        {prompt.prompt_text}
      </div>

      <div className="expand-row">
        <button
          type="button"
          className="btn btn-ghost expand-toggle"
          onClick={onToggleExpected}
        >
          {showExpected ? '▼' : '▶'} Show expected behavior
        </button>
        <button
          type="button"
          className="btn btn-ghost expand-toggle"
          onClick={onToggleViolation}
        >
          {showViolation ? '▼' : '▶'} Show violation type
        </button>
      </div>
      {showExpected && (
        <div className="expanded-field">
          <strong>Expected behavior:</strong>
          <div dir="auto">{prompt.expected_behavior}</div>
        </div>
      )}
      {showViolation && (
        <div className="expanded-field">
          <strong>Violation type:</strong>
          <div dir="auto">{prompt.violation_type}</div>
        </div>
      )}
    </div>
  )
}