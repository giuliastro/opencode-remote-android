import { useState } from "react"
import type { MessageEnvelope } from "../../types"
import { formatToolParams } from "./messageHelpers"

export default function ToolPartDisplay({ part }: { part: { tool: string; state: NonNullable<MessageEnvelope["parts"][0]["state"]> } }) {
  const [expanded, setExpanded] = useState(false)
  const state = part.state
  if (!state) return null

  const statusIcon = state.status === "completed" ? "✓" : state.status === "error" ? "✗" : state.status === "running" ? "⟳" : "○"
  const statusClass = state.status
  const params = formatToolParams(state.input)
  const hasOutput = state.status === "completed" || state.status === "error"
  const output = state.status === "completed" ? state.output : state.status === "error" ? state.error : ""
  const title = state.status === "completed" || state.status === "running" ? state.title : undefined

  return (
    <div className={`tool-part ${statusClass}`}>
      <div className="tool-header" onClick={() => hasOutput && setExpanded(!expanded)}>
        <span className={`tool-status ${statusClass}`}>{statusIcon}</span>
        <span className="tool-name">{part.tool}</span>
        {title && <span className="tool-title">{title}</span>}
        {hasOutput && (
          <button className="tool-toggle" onClick={(e) => { e.stopPropagation(); setExpanded(!expanded) }}>
            {expanded ? "▲" : "▼"}
          </button>
        )}
      </div>
      {params && (
        <div className="tool-params">
          <pre>{params}</pre>
        </div>
      )}
      {expanded && output && (
        <div className="tool-output">
          <pre>{output}</pre>
        </div>
      )}
    </div>
  )
}
