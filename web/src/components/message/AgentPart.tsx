export default function AgentPartDisplay({ part }: { part: { name: string } }) {
  return (
    <div className="agent-part">
      <span className="agent-icon">🤖</span>
      <span className="agent-label">Agent</span>
      <span className="agent-name">{part.name}</span>
    </div>
  )
}
