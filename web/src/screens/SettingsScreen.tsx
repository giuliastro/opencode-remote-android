import type { McpServer, ServerConfig } from "../types"

type NoticeType = "info" | "success" | "error"

type SettingsScreenProps = {
  theme: "dark" | "light"
  setTheme: (t: "dark" | "light") => void
  draftConfig: ServerConfig
  setDraftConfig: (c: ServerConfig) => void
  connectedVersion: string
  settingsNotice: { type: NoticeType; text: string } | null
  testingConnection: boolean
  prefs: { sound: boolean; autoScroll: boolean }
  setPrefs: (p: { sound: boolean; autoScroll: boolean }) => void
  saveConfig: () => void
  testConnection: (c: ServerConfig) => Promise<void>
  onOpenHelp: () => void
  onBack: () => void
  mcpServers: Record<string, McpServer>
}

export default function SettingsScreen({
  theme,
  setTheme,
  draftConfig,
  setDraftConfig,
  connectedVersion,
  settingsNotice,
  testingConnection,
  prefs,
  setPrefs,
  saveConfig,
  testConnection,
  onOpenHelp,
  onBack,
  mcpServers
}: SettingsScreenProps) {
  const isConnected = Boolean(connectedVersion)

  return (
    <div className="app-screen">
      {/* Nav header */}
      <div className="nav-header" style={{ paddingBottom: "8px" }}>
        <button className="back-btn" onClick={onBack} aria-label="Back">
          <i className="ti ti-arrow-left" />
        </button>
        <div>
          <div className="nav-title">Settings</div>
        </div>
        <div style={{ width: 34 }} />
      </div>

      <div className="settings-scroll">
        {/* Connection banner */}
        {isConnected ? (
          <div className="conn-banner">
            <div className="rpulse"></div>
            Connected · opencode v{connectedVersion}
          </div>
        ) : (
          <div
            className="conn-banner"
            style={{ background: "var(--surface-danger)", borderColor: "var(--border-danger)", color: "var(--danger)" }}
          >
            <i className="ti ti-plug-off"></i>
            Disconnected
          </div>
        )}

        {/* Server group */}
        <div className="sgroup">
          <div className="sgroup-label">Server</div>
          <div className="sfield">
            <div className="sfield-row">
              <div>
                <div className="sfl">Host</div>
                <div className="sfs">IP address or hostname</div>
              </div>
              <input
                className="sfield-input"
                value={draftConfig.host}
                onChange={(e) => setDraftConfig({ ...draftConfig, host: e.target.value })}
                placeholder="192.168.1.42"
              />
            </div>
            <div className="sfield-row">
              <div>
                <div className="sfl">Port</div>
              </div>
              <input
                className="sfield-input"
                type="number"
                value={draftConfig.port}
                onChange={(e) => setDraftConfig({ ...draftConfig, port: Number(e.target.value || 0) })}
                placeholder="4096"
              />
            </div>
            <div className="sfield-row">
              <div>
                <div className="sfl">Username</div>
              </div>
              <input
                className="sfield-input"
                value={draftConfig.username}
                onChange={(e) => setDraftConfig({ ...draftConfig, username: e.target.value })}
                placeholder="opencode"
              />
            </div>
            <div className="sfield-row">
              <div>
                <div className="sfl">Password</div>
              </div>
              <input
                className="sfield-input"
                type="password"
                value={draftConfig.password}
                onChange={(e) => setDraftConfig({ ...draftConfig, password: e.target.value })}
                placeholder="••••••"
              />
            </div>
          </div>
          <div className="sbtn-row">
            <button
              className="sbtn secondary"
              disabled={testingConnection}
              onClick={() => { testConnection(draftConfig).catch(() => undefined) }}
            >
              <i className="ti ti-plug"></i>
              Test
            </button>
            <button
              className="sbtn primary"
              disabled={testingConnection}
              onClick={saveConfig}
            >
              <i className="ti ti-device-floppy"></i>
              Save
            </button>
          </div>
        </div>

        {/* Preferences group */}
        <div className="sgroup">
          <div className="sgroup-label">Preferences</div>
          <div className="sfield">
            <div className="sfield-row">
              <div>
                <div className="sfl">Dark mode</div>
              </div>
              <button
                className={`stoggle${theme === "dark" ? " on" : ""}`}
                onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
                aria-label="Dark mode"
              ></button>
            </div>
            <div className="sfield-row">
              <div>
                <div className="sfl">Completion sound</div>
                <div className="sfs">Alert when session finishes</div>
              </div>
              <button
                className={`stoggle${prefs.sound ? " on" : ""}`}
                onClick={() => setPrefs({ ...prefs, sound: !prefs.sound })}
                aria-label="Sound"
              ></button>
            </div>
            <div className="sfield-row">
              <div>
                <div className="sfl">Auto-scroll</div>
              </div>
              <button
                className={`stoggle${prefs.autoScroll ? " on" : ""}`}
                onClick={() => setPrefs({ ...prefs, autoScroll: !prefs.autoScroll })}
                aria-label="Auto-scroll"
              ></button>
            </div>
          </div>
        </div>

        {/* MCP Servers group */}
        {Object.keys(mcpServers).length > 0 && (
          <div className="sgroup">
            <div className="sgroup-label">MCP Servers</div>
            <div className="sfield">
              {Object.entries(mcpServers).map(([name, server]) => (
                <div className="sfield-row" key={name}>
                  <div className="sfl">{name}</div>
                  <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    <div
                      style={{
                        width: 7,
                        height: 7,
                        borderRadius: "50%",
                        background: server.status === "connected" ? "var(--online-color)" : "var(--text-muted)"
                      }}
                    />
                    <span style={{ fontFamily: "var(--font-mono)", fontSize: "11px", color: "var(--text-tertiary)" }}>
                      {server.status}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* About group */}
        <div className="sgroup">
          <div className="sgroup-label">About</div>
          <div className="sfield">
            <div className="sfield-row">
              <div className="sfl">OpenCode Remote</div>
              <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "11px", color: "var(--text-tertiary)" }}>
                v1.2.0
              </div>
            </div>
            <div
              className="sfield-row"
              style={{ cursor: "pointer" }}
              onClick={onOpenHelp}
            >
              <div className="sfl">Help &amp; docs</div>
              <i className="ti ti-chevron-right" style={{ color: "var(--text-muted)", fontSize: "16px" }}></i>
            </div>
          </div>
        </div>

        {/* Settings notice */}
        {settingsNotice && (
          <div
            className={`notice ${settingsNotice.type} fade-in`}
            style={{
              padding: "10px 14px",
              borderRadius: "10px",
              fontSize: "11px",
              fontFamily: "'IBM Plex Mono', monospace",
              marginBottom: "12px",
              background: settingsNotice.type === "success"
                ? "var(--tag-run-bg)"
                : settingsNotice.type === "error"
                ? "var(--surface-danger)"
                : "var(--chat-user-bg)",
              border: `1px solid ${
                settingsNotice.type === "success"
                  ? "var(--tag-run-border)"
                  : settingsNotice.type === "error"
                  ? "var(--border-danger)"
                  : "var(--chat-user-border)"
              }`,
              color: settingsNotice.type === "success"
                ? "var(--text-running)"
                : settingsNotice.type === "error"
                ? "var(--danger)"
                : "var(--text-user)"
            }}
          >
            {settingsNotice.type === "success" && <i className="ti ti-circle-check" style={{ marginRight: "4px" }}></i>}
            {settingsNotice.type === "error" && <i className="ti ti-alert-circle" style={{ marginRight: "4px" }}></i>}
            {settingsNotice.type === "info" && <i className="ti ti-info-circle" style={{ marginRight: "4px" }}></i>}
            {settingsNotice.text}
          </div>
        )}
      </div>
    </div>
  )
}
