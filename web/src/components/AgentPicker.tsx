import type { AgentInfo } from "../types"

type Props = {
  agents: AgentInfo[]
  currentAgent: string | null
  onSelect: (agent: string) => void
  onClose: () => void
}

export default function AgentPicker({ agents, currentAgent, onSelect, onClose }: Props) {
  return (
    <div className="mpicker-overlay" onClick={onClose}>
      <div className="mpicker-sheet" onClick={(e) => e.stopPropagation()}>
        <div className="mpicker-header">
          <span className="mpicker-title">Select agent</span>
          <button className="mpicker-close" onClick={onClose} aria-label="Close">
            <i className="ti ti-x" />
          </button>
        </div>
        <div className="mpicker-list">
          {agents.map((agent) => {
            const active = currentAgent === agent.name
            return (
              <button
                key={agent.name}
                className={`mpicker-item${active ? " active" : ""}`}
                onClick={() => {
                  onSelect(agent.name)
                  onClose()
                }}
              >
                <span className="mpicker-model-name">{agent.name}</span>
                <span className="mpicker-model-id">{agent.description ?? agent.mode}</span>
                {active && <i className="ti ti-check mpicker-check" />}
              </button>
            )
          })}
          {agents.length === 0 && <div className="mpicker-empty">No agents available</div>}
        </div>
      </div>
    </div>
  )
}
