import { useState } from "react"
import type { MessageEnvelope } from "../../types"
import { formatToolParams } from "./messageHelpers"

type Props = {
  part: { tool: string; state: NonNullable<MessageEnvelope["parts"][0]["state"]> }
  onOpenSubagent?: (sessionId: string, title: string) => void
}

export default function ToolPartDisplay({ part, onOpenSubagent }: Props) {
  const [expanded, setExpanded] = useState(false)
  const state = part.state
  if (!state) return null

  const isTask = part.tool === "task"
  const statusIcon = state.status === "completed" ? "✓" : state.status === "error" ? "✗" : state.status === "running" ? "⟳" : "○"
  const statusClass = state.status
  const params = formatToolParams(state.input)
  const hasOutput = state.status === "completed" || state.status === "error"
  const output = state.status === "completed" ? state.output : state.status === "error" ? state.error : ""
  const title = state.status === "completed" || state.status === "running" ? state.title : undefined
  const metadata = "metadata" in state ? state.metadata : undefined
  const sessionId = typeof metadata?.sessionId === "string" ? metadata.sessionId : null
  const canOpenSubagent = isTask && !!sessionId && !!onOpenSubagent

  function handleClick() {
    if (canOpenSubagent && sessionId) {
      onOpenSubagent(sessionId, title ?? "Subagent")
      return
    }
    setExpanded((value) => !value)
  }

  const canExpand = Boolean(params || hasOutput)
  const label = isTask ? "Subagent" : part.tool
  const bodyVisible = expanded && canExpand && !canOpenSubagent

  return (
    <div className={`tool-part ${statusClass}${isTask ? " task" : ""}`}>
      <div className="tool-header" onClick={canExpand || canOpenSubagent ? handleClick : undefined} style={{ cursor: canExpand || canOpenSubagent ? "pointer" : "default" }}>
        <span className={`tool-status ${statusClass}`}>{statusIcon}</span>
        <span className="tool-name">
          {isTask && <i className="ti ti-robot" style={{ marginRight: 4 }} />}
          {label}
        </span>
        {title && <span className="tool-title">{title}</span>}
        {(canExpand || canOpenSubagent) && (
          <span className="tool-chevron">{bodyVisible ? "‹" : "›"}</span>
        )}
      </div>
      {bodyVisible && (
        <div className="tool-body">
          {params && (
            <div className="tool-params">
              <pre>{params}</pre>
            </div>
          )}
          {params && output && <div className="tool-divider" />}
          {output && (
            <div className="tool-output">
              <pre>{output}</pre>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
