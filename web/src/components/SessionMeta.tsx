import type { AgentInfo } from "../types"

type Props = {
  sessionInfo: {
    agent: string | null
    model: { providerID: string; modelID: string } | null
    variant: string | null
  }
  availableVariants: string[]
  primaryAgents: AgentInfo[]
  currentAgent: string | null
  currentVariant: string | null
  cycleAgent: () => void
  cycleVariant: () => void
  agents: AgentInfo[]
}

export default function SessionMeta({
  sessionInfo,
  availableVariants,
  primaryAgents,
  currentAgent,
  currentVariant,
  cycleAgent,
  cycleVariant,
  agents
}: Props) {
  const hasModelOrVariant = Boolean(sessionInfo.model || sessionInfo.variant)
  const effectiveAgentName = currentAgent ?? sessionInfo.agent ?? primaryAgents[0]?.name
  const agentDefaultVariant = agents.find((a) => a.name === effectiveAgentName)?.variant
  const displayVariant = currentVariant ?? agentDefaultVariant ?? availableVariants[0]

  if (!sessionInfo.agent && !sessionInfo.model && !sessionInfo.variant) return null

  return (
    <div className="session-meta">
      {hasModelOrVariant && (
        <div className="session-meta-model-row">
          {sessionInfo.model && (
            <span className="meta-model">
              <span className="meta-provider">{sessionInfo.model.providerID}</span>
              <span className="meta-sep">/</span>
              <span className="meta-modelid">{sessionInfo.model.modelID}</span>
            </span>
          )}
          {availableVariants.length > 0 && (
            <button
              type="button"
              className={`meta-variant${currentVariant ? " active" : ""}`}
              onClick={cycleVariant}
              title="Cycle model variant"
            >
              {displayVariant}
              <span className="meta-agent-cycle">↻</span>
            </button>
          )}
        </div>
      )}
      <div className="session-meta-agent-row">
        <button
          type="button"
          className={`meta-agent${currentAgent ? " active" : ""}`}
          onClick={primaryAgents.length > 0 ? cycleAgent : undefined}
          disabled={primaryAgents.length === 0}
          title={primaryAgents.length > 0 ? "Cycle agent" : undefined}
        >
          {effectiveAgentName ?? "—"}
          {primaryAgents.length > 0 && <span className="meta-agent-cycle">↻</span>}
        </button>
      </div>
    </div>
  )
}
