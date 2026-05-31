import { useState } from "react"

export default function ReasoningPartDisplay({ part }: { part: { text: string } }) {
  const [expanded, setExpanded] = useState(false)

  return (
    <div className="reasoning-part">
      <div className="reasoning-header" onClick={() => setExpanded(!expanded)}>
        <span className="reasoning-icon">💭</span>
        <span className="reasoning-label">Thinking</span>
        <button className="reasoning-toggle" onClick={(e) => { e.stopPropagation(); setExpanded(!expanded) }}>
          {expanded ? "▲" : "▼"}
        </button>
      </div>
      {expanded && (
        <div className="reasoning-content">
          <pre>{part.text}</pre>
        </div>
      )}
    </div>
  )
}
