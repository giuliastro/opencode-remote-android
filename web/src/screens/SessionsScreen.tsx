import { useRef, useState, useEffect } from "react"
import type { SessionView } from "../types"
import SessionCard from "../components/SessionCard"

type SessionsScreenProps = {
  config: { host: string }
  connected: boolean
  filteredSessions: SessionView[]
  selectedID: string | null
  onOpenSession: (id: string, directory: string) => void
  query: string
  setQuery: (q: string) => void
  newSessionFolder: string
  setNewSessionFolder: (f: string) => void
  createSession: () => Promise<void>
  serverDirectory: string
  runtimeError: string | null
  refreshSessions: (silent?: boolean) => Promise<void>
}

export default function SessionsScreen({
  config,
  connected,
  filteredSessions,
  onOpenSession,
  query,
  setQuery,
  newSessionFolder,
  setNewSessionFolder,
  createSession,
  runtimeError,
  refreshSessions
}: SessionsScreenProps) {
  const [pullDelta, setPullDelta] = useState(0)
  const [isPullRefreshing, setIsPullRefreshing] = useState(false)
  const pullDeltaRef = useRef(0)
  const sessionsRef = useRef<HTMLDivElement | null>(null)
  const PULL_THRESHOLD = 80

  // Pull-to-refresh touch handlers
  useEffect(() => {
    const el = sessionsRef.current
    if (!el) return

    let startY = 0
    let dragging = false

    const onTouchStart = (e: TouchEvent) => {
      if (window.scrollY > 5) return
      startY = e.touches[0].clientY
      dragging = true
    }

    const onTouchMove = (e: TouchEvent) => {
      if (!dragging) return
      const delta = e.touches[0].clientY - startY
      if (delta > 0) {
        e.preventDefault()
        const clamped = Math.min(delta, PULL_THRESHOLD * 1.5)
        pullDeltaRef.current = clamped
        setPullDelta(clamped)
      } else {
        pullDeltaRef.current = 0
        setPullDelta(0)
        dragging = false
      }
    }

    const onTouchEnd = async () => {
      if (!dragging) return
      dragging = false
      const delta = pullDeltaRef.current
      pullDeltaRef.current = 0
      setPullDelta(0)
      if (delta >= PULL_THRESHOLD) {
        setIsPullRefreshing(true)
        await refreshSessions()
        setIsPullRefreshing(false)
      }
    }

    el.addEventListener("touchstart", onTouchStart, { passive: true })
    el.addEventListener("touchmove", onTouchMove, { passive: false })
    el.addEventListener("touchend", onTouchEnd, { passive: true })

    return () => {
      el.removeEventListener("touchstart", onTouchStart)
      el.removeEventListener("touchmove", onTouchMove)
      el.removeEventListener("touchend", onTouchEnd)
    }
  }, [refreshSessions])

  // Group sessions into running (busy|retry|ask) and recent (idle)
  const runningSessions = filteredSessions.filter(
    (s) => s.status === "busy" || s.status === "retry" || s.status === "ask"
  )
  const recentSessions = filteredSessions.filter(
    (s) => s.status === "idle"
  )

  return (
    <div className="app-screen">
      {/* Nav header */}
      <div className="nav-header">
        <div>
          <div className="nav-title">Sessions</div>
          <div className="nav-sub">
            {config.host} · {connected ? "connected" : "offline"}
          </div>
        </div>
      </div>

      {/* Pull-to-refresh indicator */}
      <div
        className="pull-indicator"
        style={{
          height: pullDelta > 10 ? `${Math.min(pullDelta * 0.6, 52)}px` : "0",
          overflow: "hidden",
          transition: pullDelta === 0 ? "height 0.2s" : "none"
        }}
      >
        {isPullRefreshing ? (
          <i className="ti ti-refresh ti-spin" style={{ display: "block", textAlign: "center", padding: "8px" }} />
        ) : pullDelta >= PULL_THRESHOLD ? (
          <span style={{ display: "block", textAlign: "center", fontSize: "11px", color: "#39ff9a", padding: "8px" }}>
            ↑ Release to refresh
          </span>
        ) : (
          <span style={{ display: "block", textAlign: "center", fontSize: "11px", color: "#2a3450", padding: "8px" }}>
            ↓ Pull to refresh
          </span>
        )}
      </div>

      {/* New session row */}
      <div className="new-row">
        <input
          className="new-input"
          placeholder="~/projects/new-app (optional)"
          value={newSessionFolder}
          onChange={(e) => setNewSessionFolder(e.target.value)}
        />
        <button className="new-btn" onClick={() => { createSession().catch(() => undefined) }}>
          <i className="ti ti-plus"></i>New
        </button>
      </div>

      {/* Search row */}
      <div className="search-row">
        <div className="search-box">
          <i className="ti ti-search"></i>
          <input
            placeholder="Search sessions by title or directory..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
      </div>

      {/* Sessions list */}
      <div className="list" ref={sessionsRef}>
        {filteredSessions.length === 0 ? (
          <div style={{ textAlign: "center", padding: "48px 16px", color: "#2a3450" }}>
            <i className="ti ti-terminal-2" style={{ fontSize: "48px", display: "block", marginBottom: "12px", opacity: 0.4 }}></i>
            <p style={{ fontSize: "14px", fontWeight: 600, color: "#4a6080" }}>No sessions found</p>
            <p style={{ fontSize: "11px", marginTop: "4px" }}>Create a new session to get started</p>
          </div>
        ) : (
          <>
            {/* Running section */}
            {runningSessions.length > 0 && (
              <>
                <div className="list-section">Running · {runningSessions.length}</div>
                {runningSessions.map((session) => (
                  <SessionCard
                    key={session.id}
                    session={session}
                    onClick={() => onOpenSession(session.id, session.directory)}
                  />
                ))}
              </>
            )}

            {/* Recent section */}
            {recentSessions.length > 0 && (
              <>
                <div className="list-section" style={{ marginTop: runningSessions.length > 0 ? "12px" : 0 }}>
                  Recent
                </div>
                {recentSessions.map((session) => (
                  <SessionCard
                    key={session.id}
                    session={session}
                    onClick={() => onOpenSession(session.id, session.directory)}
                  />
                ))}
              </>
            )}
          </>
        )}
      </div>

      {/* Error display */}
      {runtimeError && (
        <div className="error fade-in" style={{ padding: "8px 16px 12px", fontSize: "11px" }}>
          <i className="ti ti-alert-circle" style={{ marginRight: "4px" }}></i>
          {runtimeError}
        </div>
      )}
    </div>
  )
}
