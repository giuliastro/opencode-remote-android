export default function StepStartPartDisplay() {
  return (
    <div className="step-part">
      <span className="step-icon">▶️</span>
      <span className="step-label">Step started</span>
    </div>
  )
}

export function StepFinishPartDisplay({ part }: { part: { reason: string; cost?: number; tokens?: { input: number; output: number; reasoning: number } } }) {
  return (
    <div className="step-part">
      <div>
        <span className="step-icon">⏹️</span>
        <span className="step-label">Step finished</span>
        <span className="step-reason">{part.reason}</span>
      </div>
      {(part.cost !== undefined || part.tokens) && (
        <div className="step-stats">
          {part.cost !== undefined && <span className="step-cost">Cost: ${part.cost.toFixed(4)}</span>}
          {part.tokens && (
            <span className="step-tokens">
              Tokens: {part.tokens.input + part.tokens.output + part.tokens.reasoning}
            </span>
          )}
        </div>
      )}
    </div>
  )
}
