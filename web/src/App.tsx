import { useEffect, useMemo, useRef, useState } from "react"
import { api } from "./api"
import type { CommandInfo, MessageEnvelope, ServerConfig, SessionView, TodoItem } from "./types"

const STORAGE_KEY = "opencode.remote.server"

const defaultConfig: ServerConfig = {
  host: "",
  port: 4096,
  username: "opencode",
  password: ""
}

function formatTime(epoch: number): string {
  if (!epoch) return "-"
  return new Date(epoch).toLocaleString()
}

function extractText(msg: MessageEnvelope): string {
  return msg.parts
    .filter((part) => part.type === "text" && part.text)
    .map((part) => part.text)
    .join("\n")
    .trim()
}

function renderInline(text: string) {
  const codeChunks = text.split(/(`[^`]+`)/g)
  return codeChunks.map((chunk, index) => {
    if (chunk.startsWith("`") && chunk.endsWith("`")) {
      return <code key={`code-${index}`}>{chunk.slice(1, -1)}</code>
    }

    const nodes = []
    const boldPattern = /\*\*(.+?)\*\*/g
    let cursor = 0
    let match: RegExpExecArray | null = boldPattern.exec(chunk)

    while (match) {
      if (match.index > cursor) {
        nodes.push(<span key={`text-${index}-${cursor}`}>{chunk.slice(cursor, match.index)}</span>)
      }
      nodes.push(<strong key={`bold-${index}-${match.index}`}>{match[1]}</strong>)
      cursor = match.index + match[0].length
      match = boldPattern.exec(chunk)
    }

    if (cursor < chunk.length) {
      nodes.push(<span key={`tail-${index}-${cursor}`}>{chunk.slice(cursor)}</span>)
    }

    if (nodes.length === 0) {
      return <span key={`empty-${index}`}>{chunk}</span>
    }
    return <span key={`inline-${index}`}>{nodes}</span>
  })
}

function toDisplayLines(text: string): string[] {
  const normalized = text.includes("\n") ? text : text.replace(/\s-\s(?=\S)/g, "\n- ")
  return normalized
    .split("\n")
    .map((line) => line.trimEnd())
    .filter((line, idx, arr) => line.length > 0 || (idx > 0 && arr[idx - 1].length > 0))
}

function App() {
  type NoticeType = "info" | "success" | "error"

  const [config, setConfig] = useState<ServerConfig>(() => {
    const saved = localStorage.getItem(STORAGE_KEY)
    if (!saved) return defaultConfig
    try {
      return { ...defaultConfig, ...JSON.parse(saved) }
    } catch {
      return defaultConfig
    }
  })

  const [draftConfig, setDraftConfig] = useState<ServerConfig>(config)
  const [connectedVersion, setConnectedVersion] = useState<string>("")
  const [commands, setCommands] = useState<CommandInfo[]>([])
  const [helpPage, setHelpPage] = useState<"overview" | "server" | "network" | "troubleshooting" | "commands">(
    "overview"
  )
  const [view, setView] = useState<"settings" | "sessions" | "detail" | "help">(() => {
    return config.host && config.port > 0 ? "sessions" : "settings"
  })

  const [sessions, setSessions] = useState<SessionView[]>([])
  const [selectedID, setSelectedID] = useState<string | null>(null)
  const [messages, setMessages] = useState<MessageEnvelope[]>([])
  const [todos, setTodos] = useState<TodoItem[]>([])
  const [query, setQuery] = useState("")
  const [composer, setComposer] = useState("")
  const [busySending, setBusySending] = useState(false)
  const [testingConnection, setTestingConnection] = useState(false)
  const [settingsNotice, setSettingsNotice] = useState<{ type: NoticeType; text: string } | null>(null)
  const [runtimeError, setRuntimeError] = useState<string | null>(null)
  const messagesRef = useRef<HTMLDivElement | null>(null)
  const completionAudioRef = useRef<HTMLAudioElement | null>(null)
  const wasRunningRef = useRef(false)

  const selectedSession = useMemo(
    () => sessions.find((session) => session.id === selectedID) ?? null,
    [sessions, selectedID]
  )

  const filteredSessions = useMemo(() => {
    const text = query.trim().toLowerCase()
    if (!text) return sessions
    return sessions.filter((session) => {
      return session.title.toLowerCase().includes(text) || session.directory.toLowerCase().includes(text)
    })
  }, [sessions, query])

  const renderedMessages = useMemo(() => {
    return messages
      .map((message) => ({ ...message, text: extractText(message) }))
      .filter((message) => message.text)
  }, [messages])

  const hasConfiguredServer = Boolean(config.host && config.port > 0)
  const isSessionRunning = Boolean(selectedSession && ["busy", "retry"].includes(selectedSession.status))

  function saveConfig() {
    setConfig(draftConfig)
    localStorage.setItem(STORAGE_KEY, JSON.stringify(draftConfig))
    setSettingsNotice({ type: "success", text: "Configuration saved. Press Test to validate connectivity." })
    setRuntimeError(null)
    if (draftConfig.host && draftConfig.port > 0) {
      setView("sessions")
    }
  }

  async function testConnection(configToTest: ServerConfig) {
    setTestingConnection(true)
    setSettingsNotice({ type: "info", text: "Testing connection..." })
    try {
      const health = await Promise.race([
        api.health(configToTest),
        new Promise<never>((_, reject) => setTimeout(() => reject(new Error("Connection timed out")), 12000))
      ])
      setConnectedVersion(health.version)
      setSettingsNotice({ type: "success", text: `Connected to OpenCode ${health.version}` })
    } catch (err) {
      setSettingsNotice({ type: "error", text: `Connection failed: ${(err as Error).message}` })
    } finally {
      setTestingConnection(false)
    }
  }

  async function refreshSessions(silent = false) {
    if (!config.host || !config.password) return
    if (!silent) setRuntimeError(null)
    try {
      const [items, statuses] = await Promise.all([api.listSessions(config), api.listStatuses(config)])
      const mapped = items
        .map((session) => ({
          id: session.id,
          title: session.title,
          directory: session.directory,
          updated: session.time.updated,
          status: statuses[session.id]?.type ?? "idle",
          files: session.summary?.files ?? 0,
          additions: session.summary?.additions ?? 0,
          deletions: session.summary?.deletions ?? 0
        }))
        .sort((a, b) => b.updated - a.updated)
      setSessions(mapped)
    } catch (err) {
      setRuntimeError((err as Error).message)
    }
  }

  async function loadCommands() {
    if (!config.host || !config.password) return
    try {
      const list = await api.listCommands(config)
      setCommands(list)
    } catch {
      setCommands([])
    }
  }

  async function loadSelected(sessionID: string, directory: string) {
    setRuntimeError(null)
    try {
      const [msg, todo] = await Promise.all([
        api.loadMessages(config, sessionID, directory),
        api.loadTodo(config, sessionID)
      ])
      setMessages(msg)
      setTodos(todo)
    } catch (err) {
      setRuntimeError((err as Error).message)
    }
  }

  async function createSession() {
    try {
      const created = await api.createSession(config, "Mobile session")
      await refreshSessions()
      setSelectedID(created.id)
      await loadSelected(created.id, created.directory)
    } catch (err) {
      setRuntimeError((err as Error).message)
    }
  }

  async function send() {
    if (!selectedSession) return
    const text = composer.trim()
    if (!text) return
    setComposer("")

    setBusySending(true)
    setRuntimeError(null)
    try {
      if (text.startsWith("/")) {
        const normalized = text.startsWith("/") ? text.slice(1) : text
        const command = normalized.split(" ")[0]?.trim()
        const args = normalized.slice(command.length).trim()
        if (!command) return
        await api.sendCommand(config, selectedSession.id, command, args, selectedSession.directory)
      } else {
        await api.sendPrompt(config, selectedSession.id, text, selectedSession.directory)
      }
      await loadSelected(selectedSession.id, selectedSession.directory)
      await refreshSessions()
    } catch (err) {
      setRuntimeError((err as Error).message)
    } finally {
      setBusySending(false)
    }
  }

  async function deleteSession(sessionID: string) {
    try {
      await api.deleteSession(config, sessionID)
      if (selectedID === sessionID) {
        setSelectedID(null)
        setMessages([])
        setTodos([])
        setView("sessions")
      }
      await refreshSessions(true)
    } catch (err) {
      setRuntimeError((err as Error).message)
    }
  }

  async function abortSession() {
    if (!selectedSession) return
    try {
      await api.abort(config, selectedSession.id)
      await refreshSessions()
      await loadSelected(selectedSession.id, selectedSession.directory)
    } catch (err) {
      setRuntimeError((err as Error).message)
    }
  }

  useEffect(() => {
    if (!config.host || !config.password) return
    refreshSessions(true).catch(() => undefined)
    loadCommands().catch(() => undefined)
    const timer = setInterval(() => {
      refreshSessions(true).catch(() => undefined)
      if (selectedSession) {
        loadSelected(selectedSession.id, selectedSession.directory).catch(() => undefined)
      }
    }, 3500)
    return () => clearInterval(timer)
  }, [config.host, config.password, selectedSession?.id])

  useEffect(() => {
    if (!hasConfiguredServer) {
      setView("settings")
    }
  }, [hasConfiguredServer])

  useEffect(() => {
    if (view !== "detail") return
    const container = messagesRef.current
    if (!container) return
    container.scrollTop = container.scrollHeight
  }, [view, renderedMessages.length, busySending])

  useEffect(() => {
    completionAudioRef.current = new Audio("/audio/staplebops-01.aac")
    completionAudioRef.current.preload = "auto"
  }, [])

  useEffect(() => {
    if (!selectedSession) {
      wasRunningRef.current = false
      return
    }
    const runningNow = ["busy", "retry"].includes(selectedSession.status)
    if (wasRunningRef.current && !runningNow) {
      const audio = completionAudioRef.current
      if (audio) {
        audio.currentTime = 0
        audio.play().catch(() => undefined)
      }
    }
    wasRunningRef.current = runningNow
  }, [selectedSession?.id, selectedSession?.status])

  return (
    <div className="app-shell">
      <header className="top-nav panel">
        <div>
          <h1>🛰️ OpenCode Remote</h1>
          <p className="subtle">Remote control for your OpenCode server</p>
        </div>
        <div className="tab-row">
          <button className={view === "settings" ? "active" : "secondary"} onClick={() => setView("settings")}>⚙️ Settings</button>
          <button
            className={view === "sessions" ? "active" : "secondary"}
            onClick={() => setView("sessions")}
            disabled={!hasConfiguredServer}
          >
            📂 Sessions
          </button>
          <button
            className={view === "detail" ? "active" : "secondary"}
            onClick={() => setView("detail")}
            disabled={!selectedSession}
          >
            💬 Detail
          </button>
          <button className={view === "help" ? "active" : "secondary"} onClick={() => setView("help")}>❓ Help</button>
        </div>
      </header>

      {view === "settings" && (
        <section className="panel settings">
          <label>
            Host
            <input value={draftConfig.host} onChange={(event) => setDraftConfig({ ...draftConfig, host: event.target.value })} />
          </label>
          <label>
            Port
            <input
              value={draftConfig.port}
              onChange={(event) => setDraftConfig({ ...draftConfig, port: Number(event.target.value || 0) })}
            />
          </label>
          <label>
            Username
            <input
              value={draftConfig.username}
              onChange={(event) => setDraftConfig({ ...draftConfig, username: event.target.value })}
            />
          </label>
          <label>
            Password
            <input
              type="password"
              value={draftConfig.password}
              onChange={(event) => setDraftConfig({ ...draftConfig, password: event.target.value })}
            />
          </label>
          <div className="actions">
            <button onClick={saveConfig} disabled={testingConnection}>💾 Save</button>
            <button onClick={() => testConnection(draftConfig)} className="secondary" disabled={testingConnection}>
              {testingConnection ? "⏳ Testing..." : "🧪 Test"}
            </button>
          </div>
          {settingsNotice && <p className={`notice ${settingsNotice.type}`}>{settingsNotice.text}</p>}
          {connectedVersion && <p className="subtle">Connected version: {connectedVersion}</p>}
        </section>
      )}

      {view === "sessions" && (
        <section className="panel sessions">
          <div className="header-row">
            <h2>📂 Sessions</h2>
            <div className="inline-actions">
              <button onClick={createSession}>➕ New</button>
            </div>
          </div>
          <input
            placeholder="Search sessions"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            className="search"
          />
          <div className="session-list">
            {filteredSessions.map((session) => (
              <article key={session.id} className={`session-card ${selectedID === session.id ? "active" : ""}`}>
                <div className="header-row">
                  <strong>{session.title}</strong>
                  <span className={`pill ${session.status}`}>{session.status}</span>
                </div>
                <p>{session.directory}</p>
                <small>
                  {session.files > 0 || session.additions > 0 || session.deletions > 0
                    ? `changes +${session.additions} / -${session.deletions} · files ${session.files}`
                    : `no file changes in summary · updated ${formatTime(session.updated)}`}
                </small>
                <div className="inline-actions">
                  <button
                    onClick={() => {
                      setSelectedID(session.id)
                      loadSelected(session.id, session.directory).catch(() => undefined)
                      setView("detail")
                    }}
                  >
                    ▶ Open
                  </button>
                  <button className="danger" onClick={() => deleteSession(session.id)}>
                    🗑 Delete
                  </button>
                </div>
              </article>
            ))}
          </div>
          {runtimeError && <p className="error">{runtimeError}</p>}
        </section>
      )}

      {view === "detail" && (
        <main className="panel detail">
          <div className="header-row">
            <h2>{selectedSession ? `💬 ${selectedSession.title}` : "Select a session"}</h2>
            {isSessionRunning && (
              <button className="danger" onClick={abortSession} disabled={!selectedSession}>
                ⛔ Stop
              </button>
            )}
          </div>

          {selectedSession && (
            <p className="subtle">
              {selectedSession.directory} - updated {formatTime(selectedSession.updated)}
            </p>
          )}

          {(isSessionRunning || busySending) && (
            <p className="running-banner">Waiting for OpenCode... processing in progress.</p>
          )}

          <div className="todo-box">
            <strong>🧾 Todo items</strong>
            <p className="subtle">Generated by OpenCode when it tracks planned tasks for this session.</p>
            {todos.length === 0 && <p className="subtle">No todo items</p>}
            {todos.slice(0, 6).map((item) => (
              <p key={item.id}>
                [{item.status}] {item.content}
              </p>
            ))}
          </div>

          <div className="messages" ref={messagesRef}>
            {renderedMessages.map((message) => {
                const lines = toDisplayLines(message.text)
                return (
                  <article key={message.info.id} className={`message ${message.info.role}`}>
                    <header>
                      <strong>{message.info.role === "user" ? "You" : "OpenCode"}</strong>
                      <small>{formatTime(message.info.time.created)}</small>
                    </header>
                    {lines.map((line, index) => <p key={index}>{renderInline(line)}</p>)}
                  </article>
                )
              })}
          </div>

          <div className="composer">
            <textarea
              value={composer}
              onChange={(event) => setComposer(event.target.value)}
              placeholder="Type a prompt. If it starts with / it will be sent as a slash command."
              onKeyDown={(event) => {
                if (event.key === "Enter" && !event.shiftKey) {
                  event.preventDefault()
                  send().catch(() => undefined)
                }
              }}
            />
            <button onClick={send} disabled={!selectedSession || busySending || isSessionRunning}>
              {busySending || isSessionRunning ? "⏳ Waiting..." : "🚀 Send"}
            </button>
          </div>
          {runtimeError && <p className="error">{runtimeError}</p>}
        </main>
      )}

      {view === "help" && (
        <section className="panel help">
          <h2>Help</h2>
          <div className="help-tabs">
            <button className={helpPage === "overview" ? "active" : "secondary"} onClick={() => setHelpPage("overview")}>Overview</button>
            <button className={helpPage === "server" ? "active" : "secondary"} onClick={() => setHelpPage("server")}>Server</button>
            <button className={helpPage === "network" ? "active" : "secondary"} onClick={() => setHelpPage("network")}>Network</button>
            <button className={helpPage === "troubleshooting" ? "active" : "secondary"} onClick={() => setHelpPage("troubleshooting")}>Troubleshooting</button>
            <button className={helpPage === "commands" ? "active" : "secondary"} onClick={() => setHelpPage("commands")}>Commands</button>
          </div>

          {helpPage === "overview" && (
            <ul>
              <li>Use Settings to configure host, port, username and password.</li>
              <li>Press Test to validate only the draft values currently in the form.</li>
              <li>Press Save to apply settings to the running app and polling loop.</li>
              <li>Open a session from Sessions, then interact in Detail.</li>
              <li>Press Enter to send prompt, Shift+Enter for a new line.</li>
              <li>If text starts with <code>/</code>, it is sent as slash command automatically.</li>
            </ul>
          )}

          {helpPage === "server" && (
            <div className="help-block">
              <p className="subtle">Start OpenCode server with Basic Auth</p>
              <p><strong>macOS/Linux (bash/zsh):</strong></p>
              <pre>OPENCODE_SERVER_USERNAME=opencode OPENCODE_SERVER_PASSWORD=your-password npx -y opencode-ai serve --hostname 0.0.0.0 --port 4096</pre>
              <p><strong>Windows PowerShell:</strong></p>
              <pre>$env:OPENCODE_SERVER_USERNAME="opencode"; $env:OPENCODE_SERVER_PASSWORD="your-password"; npx -y opencode-ai serve --hostname 0.0.0.0 --port 4096</pre>
              <p><strong>Windows cmd:</strong></p>
              <pre>set OPENCODE_SERVER_USERNAME=opencode && set OPENCODE_SERVER_PASSWORD=your-password && npx -y opencode-ai serve --hostname 0.0.0.0 --port 4096</pre>
              <p className="subtle">For browser debugging with CORS, add: <code>--cors http://localhost:5173</code></p>
            </div>
          )}

          {helpPage === "network" && (
            <div className="help-block">
              <ul>
                <li>LAN mode: use your PC local IP (for example <code>192.168.1.61</code>).</li>
                <li>WAN mode is possible via NAT/port-forwarding, VPN, or reverse proxy.</li>
                <li>Open inbound TCP port (for example 4096) in OS firewall and router/NAT.</li>
                <li>For external exposure prefer TLS (HTTPS reverse proxy) and strong passwords.</li>
                <li>Restrict source IPs if possible, and avoid exposing without authentication.</li>
              </ul>
            </div>
          )}

          {helpPage === "troubleshooting" && (
            <div className="help-block">
              <p><strong>Quick checks:</strong></p>
              <ol>
                <li>Verify server is listening: <code>netstat -ano | findstr :4096</code></li>
                <li>Check health endpoint from same machine.</li>
                <li>Check health endpoint from phone browser.</li>
              </ol>
              <p><strong>Health check examples:</strong></p>
              <pre>curl -u opencode:your-password http://127.0.0.1:4096/global/health</pre>
              <pre>curl -u opencode:your-password http://YOUR_IP:4096/global/health</pre>
              <p className="subtle">If Settings Test passes but sessions fail, re-open the session and check server model/provider availability.</p>
            </div>
          )}

          {helpPage === "commands" && (
            <>
              <p className="subtle">Available slash commands from <code>/command</code></p>
              {commands.length === 0 ? (
                <p className="subtle">No command list returned by server.</p>
              ) : (
                <ul>
                  {commands.map((cmd) => (
                    <li key={cmd.name}>
                      <strong>/{cmd.name}</strong>
                      {cmd.description ? ` - ${cmd.description}` : ""}
                    </li>
                  ))}
                </ul>
              )}
            </>
          )}
          {runtimeError && <p className="error">{runtimeError}</p>}
        </section>
      )}
    </div>
  )
}

export default App
