import type { SessionView } from "../types"

type Props = {
  session: SessionView
  onClick: () => void
}

function getDotColor(status: string): string {
  if (status === "busy" || status === "retry") return "green"
  if (status === "ask") return "amber"
  return "gray"
}

function getCardClass(status: string): string {
  const base = "scard"
  if (status === "busy" || status === "retry") return `${base} running`
  if (status === "ask") return `${base} ask`
  return base
}

function renderStatusTag(status: string, statusMessage?: string) {
  if (status === "busy" || status === "retry") {
    return <span className="tag running">running</span>
  }
  if (status === "ask") {
    return <span className="tag ask">{statusMessage ?? "awaiting you"}</span>
  }
  return <span className="tag idle">idle</span>
}

export default function SessionCard({ session, onClick }: Props) {
  return (
    <div
      className={getCardClass(session.status)}
      onClick={onClick}
    >
      <div className={`sdot ${getDotColor(session.status)}`} />
      <div className="scard-info">
        <div className="scard-name">{session.title}</div>
        <div className="scard-path">{session.directory}</div>
        <div className="tags">
          {renderStatusTag(session.status, session.statusMessage)}
        </div>
      </div>
      <i className="ti ti-chevron-right scard-chevron" />
    </div>
  )
}
