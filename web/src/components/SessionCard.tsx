import { useRef } from "react"
import type { SessionView } from "../types"

type Props = {
  session: SessionView
  onClick: () => void
  onLongPress?: () => void
  selected?: boolean
  selectionMode?: boolean
}

function isAskLike(status: string) {
  return status === "ask" || status === "question" || status === "permission"
}

function getDotColor(status: string): string {
  if (status === "busy" || status === "retry") return "green"
  if (isAskLike(status)) return "amber"
  return "gray"
}

function getCardClass(status: string, selected?: boolean): string {
  const sel = selected ? " selected" : ""
  if (status === "busy" || status === "retry") return `scard running${sel}`
  if (isAskLike(status)) return `scard ask${sel}`
  return `scard${sel}`
}

function renderStatusTag(status: string, statusMessage?: string) {
  if (status === "busy" || status === "retry") {
    return <span className="tag running">running</span>
  }
  if (isAskLike(status)) {
    const label = status === "permission" ? "permission" : statusMessage ?? "awaiting you"
    return <span className="tag ask">{label}</span>
  }
  return <span className="tag idle">idle</span>
}

const LONG_PRESS_MS = 500

export default function SessionCard({ session, onClick, onLongPress, selected, selectionMode }: Props) {
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const didLongPressRef = useRef(false)
  const startPosRef = useRef({ x: 0, y: 0 })

  const startPress = (clientX: number, clientY: number) => {
    didLongPressRef.current = false
    startPosRef.current = { x: clientX, y: clientY }
    timerRef.current = setTimeout(() => {
      didLongPressRef.current = true
      onLongPress?.()
    }, LONG_PRESS_MS)
  }

  const cancelPress = () => {
    if (timerRef.current) {
      clearTimeout(timerRef.current)
      timerRef.current = null
    }
  }

  const handleTouchMove = (e: React.TouchEvent) => {
    const dx = e.touches[0].clientX - startPosRef.current.x
    const dy = e.touches[0].clientY - startPosRef.current.y
    if (Math.abs(dx) > 8 || Math.abs(dy) > 8) cancelPress()
  }

  const handleClick = () => {
    if (didLongPressRef.current) return
    onClick()
  }

  return (
    <div
      className={getCardClass(session.status, selected)}
      style={{ userSelect: "none", WebkitUserSelect: "none" }}
      onMouseDown={(e) => startPress(e.clientX, e.clientY)}
      onMouseUp={cancelPress}
      onMouseLeave={cancelPress}
      onTouchStart={(e) => startPress(e.touches[0].clientX, e.touches[0].clientY)}
      onTouchMove={handleTouchMove}
      onTouchEnd={cancelPress}
      onTouchCancel={cancelPress}
      onContextMenu={(e) => e.preventDefault()}
      onClick={handleClick}
    >
      {selectionMode ? (
        <div className="scard-check">
          <i className={selected ? "ti ti-circle-check-filled" : "ti ti-circle"} />
        </div>
      ) : (
        <div className={`sdot ${getDotColor(session.status)}`} />
      )}
      <div className="scard-info">
        <div className="scard-name">{session.title}</div>
        <div className="scard-path">{session.directory}</div>
        <div className="tags">
          {renderStatusTag(session.status, session.statusMessage)}
        </div>
      </div>
      {!selectionMode && <i className="ti ti-chevron-right scard-chevron" />}
    </div>
  )
}
