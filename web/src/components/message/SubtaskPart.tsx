import { useState } from "react"

export default function SubtaskPartDisplay({ part }: { part: { prompt: string; description?: string; agent?: string } }) {
  const [expanded, setExpanded] = useState(false)
  const hasDescription = Boolean(part.description)
  const hasAgent = Boolean(part.agent)

  return (
    <div className="subtask-part">
      <div className="subtask-header" onClick={() => setExpanded(!expanded)}>
        <span className="subtask-icon">📋</span>
        <span className="subtask-label">Subtask</span>
        {hasAgent && <span className="subtask-agent">{part.agent}</span>}
        <button className="subtask-toggle" onClick={(e) => { e.stopPropagation(); setExpanded(!expanded) }}>
          {expanded ? "▲" : "▼"}
        </button>
      </div>
      {expanded && (
        <div className="subtask-content">
          {hasDescription && (
            <div className="subtask-description">
              <strong>Description:</strong>
              <p>{part.description}</p>
            </div>
          )}
          <div className="subtask-prompt">
            <strong>Prompt:</strong>
            <pre>{part.prompt}</pre>
          </div>
        </div>
      )}
    </div>
  )
}
