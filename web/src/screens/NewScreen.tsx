type NewScreenProps = {
  newSessionFolder: string
  setNewSessionFolder: (f: string) => void
  serverDirectory: string
  createSession: () => Promise<void>
}

export default function NewScreen({
  newSessionFolder,
  setNewSessionFolder,
  serverDirectory,
  createSession
}: NewScreenProps) {
  return (
    <div className="app-screen">
      {/* Nav header */}
      <div className="nav-header">
        <div>
          <div className="nav-title">New Session</div>
        </div>
      </div>

      <div style={{ padding: "12px 16px", display: "flex", flexDirection: "column", gap: "12px" }}>
        {/* Directory input */}
        <div>
          <label
            htmlFor="new-session-dir"
            style={{
              fontSize: "11px",
              fontFamily: "'IBM Plex Mono', monospace",
              fontWeight: 600,
              textTransform: "uppercase",
              letterSpacing: "0.12em",
              color: "var(--text-muted)",
              marginBottom: "8px",
              display: "block",
              padding: "0 2px"
            }}
          >
            Directory
          </label>
          <input
            id="new-session-dir"
            className="new-input"
            placeholder="~/projects/new-app (optional)"
            value={newSessionFolder}
            onChange={(e) => setNewSessionFolder(e.target.value)}
            style={{ width: "100%" }}
          />
        </div>

        {/* Server directory hint */}
        {serverDirectory && (
          <div
            style={{
              fontSize: "10px",
              fontFamily: "'IBM Plex Mono', monospace",
              color: "var(--text-muted)",
              padding: "0 2px"
            }}
          >
            Server directory: <span style={{ color: "var(--text-secondary)" }}>{serverDirectory}</span>
          </div>
        )}

        {/* Create button */}
        <button
          className="new-btn"
          onClick={() => { createSession().catch(() => undefined) }}
          style={{
            width: "100%",
            justifyContent: "center",
            padding: "12px 14px",
            fontSize: "14px"
          }}
        >
          <i className="ti ti-plus"></i>Create Session
        </button>
      </div>
    </div>
  )
}
