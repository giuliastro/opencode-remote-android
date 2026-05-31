import { useRef, useState, useEffect, useMemo } from "react"
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
  createSession: () => Promise<void>
  serverDirectory: string
  runtimeError: string | null
  refreshSessions: (silent?: boolean) => Promise<void>
  onOpenSettings: () => void
  deleteSession: (id: string) => Promise<void>
}

export default function SessionsScreen({
  config,
  connected,
  filteredSessions,
  onOpenSession,
  query,
  setQuery,
  createSession,
  runtimeError,
  refreshSessions,
  onOpenSettings,
  deleteSession
}: SessionsScreenProps) {
  const [pullDelta, setPullDelta] = useState(0)
  const [isPullRefreshing, setIsPullRefreshing] = useState(false)
  const pullDeltaRef = useRef(0)
  const sessionsRef = useRef<HTMLDivElement | null>(null)
  const PULL_THRESHOLD = 80

  const [selectionMode, setSelectionMode] = useState(false)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())

  function enterSelectionMode(id: string) {
    setSelectionMode(true)
    setSelectedIds(new Set([id]))
  }

  function toggleSelection(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  function exitSelectionMode() {
    setSelectionMode(false)
    setSelectedIds(new Set())
  }

  async function handleDelete() {
    const ids = Array.from(selectedIds)
    exitSelectionMode()
    await Promise.all(ids.map((id) => deleteSession(id)))
  }

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

  const groupedSections = useMemo(() => {
    const now = new Date()
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime()
    const startOfYesterday = startOfToday - 24 * 60 * 60 * 1000
    const dayOfWeek = (now.getDay() + 6) % 7 // Monday=0
    const startOfWeek = startOfToday - dayOfWeek * 24 * 60 * 60 * 1000
    const startOfLastWeek = startOfWeek - 7 * 24 * 60 * 60 * 1000
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).getTime()
    const normalizeTime = (updated: number) => (updated < 1_000_000_000_000 ? updated * 1000 : updated)

    const busy = filteredSessions.filter((s) => s.status === "busy" || s.status === "retry")
    const actionRequired = filteredSessions.filter((s) => s.status === "ask" || s.status === "question" || s.status === "permission")
    const rest = filteredSessions.filter((s) => s.status !== "busy" && s.status !== "retry" && s.status !== "ask" && s.status !== "question" && s.status !== "permission")

    const sections: Array<{ label: string; sessions: SessionView[] }> = []
    if (busy.length > 0) sections.push({ label: `Busy · ${busy.length}`, sessions: busy })
    if (actionRequired.length > 0) sections.push({ label: `Action required · ${actionRequired.length}`, sessions: actionRequired })

    const today = rest.filter((s) => normalizeTime(s.updated) >= startOfToday)
    const yesterday = rest.filter((s) => {
      const t = normalizeTime(s.updated)
      return t >= startOfYesterday && t < startOfToday
    })
    const thisWeek = rest.filter((s) => {
      const t = normalizeTime(s.updated)
      return t >= startOfWeek && t < startOfYesterday
    })
    const lastWeek = rest.filter((s) => {
      const t = normalizeTime(s.updated)
      return t >= startOfLastWeek && t < Math.min(startOfWeek, startOfYesterday)
    })
    const thisMonth = rest.filter((s) => {
      const t = normalizeTime(s.updated)
      return t >= startOfMonth && t < Math.min(startOfLastWeek, startOfYesterday)
    })
    const older = rest.filter((s) => normalizeTime(s.updated) < Math.min(startOfMonth, startOfYesterday))

    if (today.length > 0) sections.push({ label: `Today · ${today.length}`, sessions: today })
    if (yesterday.length > 0) sections.push({ label: `Yesterday · ${yesterday.length}`, sessions: yesterday })
    if (thisWeek.length > 0) sections.push({ label: `This week · ${thisWeek.length}`, sessions: thisWeek })
    if (lastWeek.length > 0) sections.push({ label: `Last week · ${lastWeek.length}`, sessions: lastWeek })
    if (thisMonth.length > 0) sections.push({ label: `This month · ${thisMonth.length}`, sessions: thisMonth })
    if (older.length > 0) sections.push({ label: `Older · ${older.length}`, sessions: older })

    return sections
  }, [filteredSessions])

  return (
    <div className="app-screen">
      {/* Nav header */}
      {selectionMode ? (
        <div className="nav-header">
          <button className="back-btn" onClick={exitSelectionMode} aria-label="Cancel">
            <i className="ti ti-x" />
          </button>
          <div>
            <div className="nav-title">{selectedIds.size} selected</div>
          </div>
          <button
            className="nav-action"
            aria-label="Delete selected"
            disabled={selectedIds.size === 0}
            style={{ color: selectedIds.size > 0 ? "var(--danger)" : undefined }}
            onClick={() => { handleDelete().catch(() => undefined) }}
          >
            <i className="ti ti-trash" />
          </button>
        </div>
      ) : (
        <div className="nav-header">
          <div>
            <div className="nav-title">Sessions</div>
            <div className="nav-sub">
              {config.host} · <span style={{ color: connected ? "var(--online-color)" : "var(--danger)" }}>{connected ? "online" : "offline"}</span>
            </div>
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <button
              className="nav-action"
              aria-label="New session"
              onClick={() => { createSession().catch(() => undefined) }}
            >
              <i className="ti ti-plus" />
            </button>
            <button
              className="nav-action"
              aria-label="Settings"
              onClick={onOpenSettings}
            >
              <i className="ti ti-settings" />
            </button>
          </div>
        </div>
      )}

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
          <span style={{ display: "block", textAlign: "center", fontSize: "11px", color: "var(--accent)", padding: "8px" }}>
            ↑ Release to refresh
          </span>
        ) : (
          <span style={{ display: "block", textAlign: "center", fontSize: "11px", color: "var(--text-muted)", padding: "8px" }}>
            ↓ Pull to refresh
          </span>
        )}
      </div>

      {/* Search row */}
      {!selectionMode && (
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
      )}

      {/* Sessions list */}
      <div className="list" ref={sessionsRef}>
        {filteredSessions.length === 0 ? (
          <div style={{ textAlign: "center", padding: "48px 16px", color: "var(--text-muted)" }}>
            <i className="ti ti-terminal-2" style={{ fontSize: "48px", display: "block", marginBottom: "12px", opacity: 0.4 }}></i>
            <p style={{ fontSize: "14px", fontWeight: 600, color: "var(--text-secondary)" }}>No sessions found</p>
            <p style={{ fontSize: "11px", marginTop: "4px" }}>Create a new session to get started</p>
          </div>
        ) : (
          <>
            {groupedSections.map((section, index) => (
              <div key={section.label}>
                <div className="list-section" style={{ marginTop: index > 0 ? "12px" : 0 }}>
                  {section.label}
                </div>
                {section.sessions.map((session) => (
                  <SessionCard
                    key={session.id}
                    session={session}
                    selectionMode={selectionMode}
                    selected={selectedIds.has(session.id)}
                    onLongPress={() => enterSelectionMode(session.id)}
                    onClick={() => selectionMode ? toggleSelection(session.id) : onOpenSession(session.id, session.directory)}
                  />
                ))}
              </div>
            ))}
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
