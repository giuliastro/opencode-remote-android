import { useRef, useState, useEffect } from "react"
import type { Project, SessionView } from "../types"

type ProjectsScreenProps = {
  config: { host: string }
  connected: boolean
  projects: Project[]
  sessions: SessionView[]
  onOpenProject: (project: Project) => void
  onOpenSettings: () => void
  refreshSessions: (silent?: boolean) => Promise<void>
  runtimeError: string | null
}

function projectName(worktree: string): string {
  const parts = worktree.replace(/\\/g, "/").split("/").filter(Boolean)
  return parts[parts.length - 1] ?? worktree
}

export default function ProjectsScreen({
  config,
  connected,
  projects,
  sessions,
  onOpenProject,
  onOpenSettings,
  refreshSessions,
  runtimeError
}: ProjectsScreenProps) {
  const [pullDelta, setPullDelta] = useState(0)
  const [isPullRefreshing, setIsPullRefreshing] = useState(false)
  const listRef = useRef<HTMLDivElement | null>(null)
  const pullDeltaRef = useRef(0)
  const PULL_THRESHOLD = 80

  const isSubagent = (title: string) => /\(@\S+ subagent\)$/i.test(title)

  // Count non-subagent sessions per project
  function sessionCount(projectID: string): number {
    return sessions.filter((s) => s.projectID === projectID && !isSubagent(s.title)).length
  }

  // Pull-to-refresh
  useEffect(() => {
    const el = listRef.current
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

  return (
    <div className="app-screen">
      {/* Nav header */}
      <div className="nav-header">
        <div>
          <div className="nav-title">Projects</div>
          <div className="nav-sub">
            {config.host} · <span style={{ color: connected ? "var(--online-color)" : "var(--danger)" }}>{connected ? "online" : "offline"}</span>
          </div>
        </div>
        <button
          className="nav-action"
          aria-label="Settings"
          onClick={onOpenSettings}
        >
          <i className="ti ti-settings" />
        </button>
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
          <span style={{ display: "block", textAlign: "center", fontSize: "11px", color: "var(--accent)", padding: "8px" }}>
            ↑ Release to refresh
          </span>
        ) : (
          <span style={{ display: "block", textAlign: "center", fontSize: "11px", color: "var(--text-muted)", padding: "8px" }}>
            ↓ Pull to refresh
          </span>
        )}
      </div>

      {/* Projects list */}
      <div className="list" ref={listRef}>
        {projects.length === 0 ? (
          <div style={{ textAlign: "center", padding: "48px 16px", color: "var(--text-muted)" }}>
            <i className="ti ti-folder-off" style={{ fontSize: "48px", display: "block", marginBottom: "12px", opacity: 0.4 }}></i>
            <p style={{ fontSize: "14px", fontWeight: 600, color: "var(--text-secondary)" }}>No projects found</p>
            <p style={{ fontSize: "11px", marginTop: "4px" }}>Open a directory in OpenCode to create a project</p>
          </div>
        ) : (
          projects.map((project) => {
            const name = projectName(project.worktree)
            const count = sessionCount(project.id)
            const color = project.icon?.color ?? ""
            return (
              <div
                key={project.id}
                className="pcard"
                onClick={() => onOpenProject(project)}
              >
                <div className="pcard-dot" data-color={color} />
                <div className="pcard-info">
                  <div className="pcard-name">{name}</div>
                  <div className="pcard-path">{project.worktree}</div>
                </div>
                <div className="pcard-meta">
                  {count > 0 && (
                    <span className="pcard-count">{count}</span>
                  )}
                  <i className="ti ti-chevron-right" style={{ color: "var(--text-tertiary)", fontSize: "16px" }} />
                </div>
              </div>
            )
          })
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
