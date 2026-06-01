import { useEffect, useMemo, useRef, useState } from "react"
import { api } from "./api"
import { createTranslator, languageOptions, normalizeLanguage, type LanguageCode } from "./i18n"
import type { CommandInfo, MessageEnvelope, ServerConfig, SessionView, TodoItem } from "./types"
import {
  SettingsIcon,
  FolderIcon,
  ChatIcon,
  HelpIcon,
  PlusIcon,
  PlayIcon,
  TrashIcon,
  StopIcon,
  SaveIcon,
  TestIcon,
  LoadingIcon,
  RocketIcon
} from "./Icons"

const STORAGE_KEY = "opencode.remote.server"
const LANGUAGE_STORAGE_KEY = "opencode.remote.language"

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
  const [language, setLanguage] = useState<LanguageCode>(() => {
    return normalizeLanguage(localStorage.getItem(LANGUAGE_STORAGE_KEY) || navigator.language)
  })
  const t = useMemo(() => createTranslator(language), [language])

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
  const [todosExpanded, setTodosExpanded] = useState(false)
  const [query, setQuery] = useState("")
  const [composer, setComposer] = useState("")
  const [busySending, setBusySending] = useState(false)
  const [loadingSessionID, setLoadingSessionID] = useState<string | null>(null)
  const [testingConnection, setTestingConnection] = useState(false)
  const [creatingSession, setCreatingSession] = useState(false)
  const [settingsNotice, setSettingsNotice] = useState<{ type: NoticeType; text: string } | null>(null)
  const [runtimeError, setRuntimeError] = useState<string | null>(null)
  const [sessionToDelete, setSessionToDelete] = useState<SessionView | null>(null)
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
  const isWorking = busySending || isSessionRunning
  const activeSessions = sessions.filter((session) => ["busy", "retry"].includes(session.status)).length
  const changedSessions = sessions.filter(
    (session) => session.files > 0 || session.additions > 0 || session.deletions > 0
  ).length

  async function openSession(sessionID: string, directory: string) {
    setSelectedID(sessionID)
    setMessages([])
    setTodos([])
    setRuntimeError(null)
    setView("detail")
    setLoadingSessionID(sessionID)
    await loadSelected(sessionID, directory)
    setLoadingSessionID((activeID) => (activeID === sessionID ? null : activeID))
  }

  function saveConfig() {
    setConfig(draftConfig)
    localStorage.setItem(STORAGE_KEY, JSON.stringify(draftConfig))
    setSettingsNotice({ type: "success", text: t('settings.saved') })
    setRuntimeError(null)
    if (draftConfig.host && draftConfig.port > 0) {
      setView("sessions")
    }
  }

  async function testConnection(configToTest: ServerConfig) {
    setTestingConnection(true)
    setSettingsNotice({ type: "info", text: t('settings.testingConnection') })
    try {
      const health = await Promise.race([
        api.health(configToTest),
        new Promise<never>((_, reject) => setTimeout(() => reject(new Error("Connection timed out")), 12000))
      ])
      setConnectedVersion(health.version)
      setConfig(configToTest)
      localStorage.setItem(STORAGE_KEY, JSON.stringify(configToTest))
      setView("sessions")
      setSettingsNotice({ type: "success", text: t('settings.connectedSaved', { version: health.version }) })
    } catch (err) {
      setSettingsNotice({ type: "error", text: t('settings.connectionFailed', { message: (err as Error).message }) })
    } finally {
      setTestingConnection(false)
    }
  }

  async function refreshSessions(silent = false) {
    if (!config.host || config.port <= 0) return
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
    if (!config.host || config.port <= 0) return
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
    if (creatingSession) return
    setCreatingSession(true)
    setRuntimeError(null)
    try {
      const created = await api.createSession(config, "Mobile session")
      await refreshSessions()
      setSelectedID(created.id)
      setView("detail")
      await loadSelected(created.id, created.directory)
    } catch (err) {
      setRuntimeError((err as Error).message)
    } finally {
      setCreatingSession(false)
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
      setSessionToDelete(null)
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
    localStorage.setItem(LANGUAGE_STORAGE_KEY, language)
  }, [language])

  useEffect(() => {
    if (!config.host || config.port <= 0) return
    refreshSessions(true).catch(() => undefined)
    loadCommands().catch(() => undefined)
    const timer = setInterval(() => {
      refreshSessions(true).catch(() => undefined)
      if (selectedSession) {
        loadSelected(selectedSession.id, selectedSession.directory).catch(() => undefined)
      }
    }, 3500)
    return () => clearInterval(timer)
  }, [config.host, config.port, config.password, selectedSession?.id])

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

  const navItems = [
    { view: "sessions" as const, label: t('nav.sessions'), icon: <FolderIcon size={19} />, disabled: !hasConfiguredServer },
    { view: "detail" as const, label: t('nav.detail'), icon: <ChatIcon size={19} />, disabled: !selectedSession },
    { view: "settings" as const, label: t('nav.settings'), icon: <SettingsIcon size={19} />, disabled: false },
    { view: "help" as const, label: t('nav.help'), icon: <HelpIcon size={19} />, disabled: false }
  ]

  return (
    <div className="app-shell">
      <header className="top-nav fade-in">
        <div className="brand-section">
          <div className="brand-title">
            <img src="/app-icon.png" alt="" className="app-icon" />
            <div>
              <h1>{t('app.title')}</h1>
              <p className="subtle">
                {hasConfiguredServer ? `${config.host}:${config.port}` : t('settings.title')}
              </p>
            </div>
          </div>
        </div>

        <nav className="desktop-nav tab-row" role="navigation" aria-label="Main navigation">
          {navItems.map((item) => (
            <button
              key={item.view}
              className={view === item.view ? "active" : ""}
              onClick={() => setView(item.view)}
              disabled={item.disabled}
              aria-label={item.label}
            >
              {item.icon}
              <span>{item.label}</span>
            </button>
          ))}
        </nav>
      </header>

      {view === "settings" && (
        <section className="panel settings fade-in">
          <div className="section-heading">
            <div>
              <h2>{t('settings.title')}</h2>
              <p className="subtle">{hasConfiguredServer ? `${config.host}:${config.port}` : t('settings.hostPlaceholder')}</p>
            </div>
          </div>

          <div className="form-grid">
          <label htmlFor="language">
            {t('settings.language')}
            <select
              id="language"
              value={language}
              onChange={(event) => setLanguage(normalizeLanguage(event.target.value))}
            >
              {languageOptions.map((option) => (
                <option key={option.code} value={option.code}>{option.label}</option>
              ))}
            </select>
          </label>
          
          <label htmlFor="host">
            {t('settings.host')}
            <input 
              id="host"
              value={draftConfig.host} 
              onChange={(event) => setDraftConfig({ ...draftConfig, host: event.target.value })} 
              placeholder={t('settings.hostPlaceholder')}
            />
          </label>
          
          <label htmlFor="port">
            {t('settings.port')}
            <input
              id="port"
              type="number"
              value={draftConfig.port}
              onChange={(event) => setDraftConfig({ ...draftConfig, port: Number(event.target.value || 0) })}
              placeholder="4096"
            />
          </label>
          
          <label htmlFor="username">
            {t('settings.username')}
            <input
              id="username"
              value={draftConfig.username}
              onChange={(event) => setDraftConfig({ ...draftConfig, username: event.target.value })}
              placeholder="opencode"
            />
          </label>
          
          <label htmlFor="password">
            {t('settings.password')}
            <input
              id="password"
              type="password"
              value={draftConfig.password}
              onChange={(event) => setDraftConfig({ ...draftConfig, password: event.target.value })}
              placeholder={t('settings.passwordPlaceholder')}
            />
          </label>
          </div>
          
          <div className="actions">
            <button 
              onClick={saveConfig} 
              disabled={testingConnection}
              className="btn-primary"
            >
              <SaveIcon size={18} />
              {testingConnection ? t('settings.saving') : t('settings.save')}
            </button>
            <button 
              onClick={() => testConnection(draftConfig)} 
              className="btn-secondary"
              disabled={testingConnection}
            >
              {testingConnection ? (
                <>
                  <LoadingIcon size={18} />
                  {t('settings.testing')}
                </>
              ) : (
                <>
                  <TestIcon size={18} />
                  {t('settings.test')}
                </>
              )}
            </button>
          </div>
          
          {settingsNotice && (
            <div className={`notice ${settingsNotice.type} fade-in`}>
              {settingsNotice.type === 'success' && '✓ '}
              {settingsNotice.type === 'error' && '✗ '}
              {settingsNotice.type === 'info' && 'ℹ '}
              {settingsNotice.text}
            </div>
          )}
          
          {connectedVersion && (
            <div className="notice success fade-in">
              <TestIcon size={16} />
              {t('settings.connectedTo', { version: connectedVersion })}
            </div>
          )}
        </section>
      )}

      {view === "sessions" && (
        <section className="panel sessions fade-in">
          <div className="section-heading">
            <div>
              <h2>{t('sessions.title')}</h2>
              <p className="subtle">
                {t('sessions.summary', { total: sessions.length, active: activeSessions, changed: changedSessions })}
              </p>
            </div>
            <div className="inline-actions">
              <button onClick={() => refreshSessions()} className="btn-secondary">
                <LoadingIcon size={18} />
                {t('sessions.refresh')}
              </button>
              <button onClick={createSession} className="btn-primary" disabled={creatingSession}>
                {creatingSession ? <LoadingIcon size={18} /> : <PlusIcon size={18} />}
                {creatingSession ? t('sessions.creating') : t('sessions.new')}
              </button>
            </div>
          </div>
          
          <div className="toolbar">
            <input
              placeholder={t('sessions.searchPlaceholder')}
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              className="search"
            />
          </div>
          
          <div className="session-list">
            {filteredSessions.length === 0 ? (
              <div className="empty-state">
                <FolderIcon size={48} className="icon-empty-state" />
                <p>{t('sessions.emptyTitle')}</p>
                <p className="subtle">{t('sessions.emptyHint')}</p>
              </div>
            ) : (
              filteredSessions.map((session) => (
                <article 
                  key={session.id} 
                  className={`session-card ${selectedID === session.id ? "active" : ""} fade-in`}
                  onClick={() => openSession(session.id, session.directory).catch(() => undefined)}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" || event.key === " ") {
                      event.preventDefault()
                      openSession(session.id, session.directory).catch(() => undefined)
                    }
                  }}
                >
                  <div className="session-card-main">
                    <div>
                      <h3>{session.title}</h3>
                      <p>{session.directory}</p>
                    </div>
                    <span className={`pill ${session.status}`}>{session.status}</span>
                  </div>
                  <div className="session-stats">
                    {session.files > 0 || session.additions > 0 || session.deletions > 0 ? (
                      <span className="change-summary">
                        <strong>{session.files}</strong> files
                        <strong className="positive">+{session.additions}</strong>
                        <strong className="negative">-{session.deletions}</strong>
                      </span>
                    ) : (
                      <span className="subtle">{t('sessions.noFileChanges')}</span>
                    )}
                    <span className="subtle">{t('sessions.updated', { time: formatTime(session.updated) })}</span>
                  </div>
                  <div className="inline-actions">
                    <button
                      onClick={(event) => {
                        event.stopPropagation()
                        openSession(session.id, session.directory).catch(() => undefined)
                      }}
                      className="btn-primary"
                    >
                      <PlayIcon size={16} />
                      {t('sessions.open')}
                    </button>
                    <button 
                      className="btn-danger" 
                      onClick={(event) => {
                        event.stopPropagation()
                        setSessionToDelete(session)
                      }}
                    >
                      <TrashIcon size={16} />
                      {t('sessions.delete')}
                    </button>
                  </div>
                </article>
              ))
            )}
          </div>
          
          {runtimeError && <div className="error fade-in">✗ {runtimeError}</div>}
        </section>
      )}

      {view === "detail" && (
        <main className="panel detail fade-in">
          <div className="detail-topbar">
            <button className="btn-secondary" onClick={() => setView("sessions")}>{t('detail.backToSessions')}</button>
            {selectedSession && (
              <span className={`pill ${selectedSession.status}`}>{selectedSession.status}</span>
            )}
          </div>
          <div className="header-row detail-header">
              <div>
              <h2>
                {selectedSession ? (
                  <>
                    <ChatIcon size={24} className="icon-inline-heading" />
                    {selectedSession.title}
                  </>
                ) : (
                  t('detail.selectSession')
                )}
              </h2>
              {selectedSession && (
                <p className="subtle">
                  {selectedSession.directory} • {t('sessions.updated', { time: formatTime(selectedSession.updated) })}
                </p>
                )}
              </div>
            </div>

          {todos.length > 0 && (
            <div className="todo-box">
              <div className="todo-header-row">
                <h3>
                  <span style={{ marginRight: 'var(--space-2)' }}>📋</span>
                  {t('todo.title')}
                </h3>
                <button
                  type="button"
                  className="todo-toggle-btn"
                  onClick={() => setTodosExpanded((value) => !value)}
                  aria-expanded={todosExpanded}
                  aria-controls="todo-items-content"
                >
                  {todosExpanded ? t('todo.hide') : t('todo.show')}
                </button>
              </div>
              {todosExpanded && (
                <div id="todo-items-content">
                  {todos.slice(0, 6).map((item) => (
                    <div key={item.id} className="todo-item">
                      <span className={`todo-status ${item.status}`}>
                        {item.status === 'completed' ? '✓' : '○'}
                      </span>
                      <span>{item.content}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          <div className="messages" ref={messagesRef}>
            {loadingSessionID === selectedID ? (
              <div className="empty-state compact">
                <LoadingIcon size={32} />
                <p>{t('detail.loading')}</p>
              </div>
            ) : renderedMessages.length === 0 ? (
              <div className="empty-state compact">
                <ChatIcon size={40} className="icon-empty-state" />
                <p>{t('detail.emptyTitle')}</p>
                <p className="subtle">{t('detail.emptyHint')}</p>
              </div>
            ) : (
              renderedMessages.map((message) => {
                const lines = toDisplayLines(message.text)
                return (
                  <article key={message.info.id} className={`message ${message.info.role} fade-in`}>
                    <header>
                      <strong>
                        {message.info.role === "user" ? t('detail.you') : t('detail.opencode')}
                      </strong>
                      <small>{formatTime(message.info.time.created)}</small>
                    </header>
                    <div className="message-content">
                      {lines.map((line, index) => (
                        <p key={index}>{renderInline(line)}</p>
                      ))}
                    </div>
                  </article>
                )
              })
            )}
          </div>

          <div className="composer">
            <textarea
              value={composer}
              onChange={(event) => setComposer(event.target.value)}
              placeholder={t('detail.composerPlaceholder')}
              onKeyDown={(event) => {
                if (event.key === "Enter" && !event.shiftKey) {
                  event.preventDefault()
                  if (!isWorking) {
                    send().catch(() => undefined)
                  }
                }
              }}
              disabled={!selectedSession || isWorking}
            />
            <button 
              onClick={isWorking ? abortSession : send}
              disabled={!selectedSession}
              className={isWorking ? "btn-danger" : "btn-primary"}
            >
              {isWorking ? (
                <>
                  <StopIcon size={18} />
                  {t('detail.waiting')}
                </>
              ) : (
                <>
                  <RocketIcon size={18} />
                  {t('detail.send')}
                </>
              )}
            </button>
          </div>
          
          {runtimeError && <div className="error fade-in">✗ {runtimeError}</div>}
        </main>
      )}

      {sessionToDelete && (
        <div className="modal-backdrop" role="presentation" onClick={() => setSessionToDelete(null)}>
          <section
            className="modal-card fade-in"
            role="dialog"
            aria-modal="true"
            aria-labelledby="delete-session-title"
            onClick={(event) => event.stopPropagation()}
          >
            <h2 id="delete-session-title">{t('session.deleteTitle')}</h2>
            <p>
              {t('session.deleteBodyPrefix')} <strong>{sessionToDelete.title}</strong>.
            </p>
            <p className="subtle">{sessionToDelete.directory}</p>
            <div className="modal-actions">
              <button className="btn-secondary" onClick={() => setSessionToDelete(null)}>
                {t('session.cancel')}
              </button>
              <button className="btn-danger" onClick={() => deleteSession(sessionToDelete.id)}>
                <TrashIcon size={16} />
                {t('session.deleteConfirm')}
              </button>
            </div>
          </section>
        </div>
      )}

      {view === "help" && (
        <section className="panel help fade-in">
          <h2>
            <HelpIcon size={24} className="icon-inline-heading" />
            {t('help.title')}
          </h2>
          <div className="help-tabs" role="tablist">
            <button 
              className={helpPage === "overview" ? "active" : ""} 
              onClick={() => setHelpPage("overview")}
              role="tab"
              aria-selected={helpPage === "overview"}
            >
              {t('help.overview')}
            </button>
            <button 
              className={helpPage === "server" ? "active" : ""} 
              onClick={() => setHelpPage("server")}
              role="tab"
              aria-selected={helpPage === "server"}
            >
              {t('help.server')}
            </button>
            <button 
              className={helpPage === "network" ? "active" : ""} 
              onClick={() => setHelpPage("network")}
              role="tab"
              aria-selected={helpPage === "network"}
            >
              {t('help.network')}
            </button>
            <button 
              className={helpPage === "troubleshooting" ? "active" : ""} 
              onClick={() => setHelpPage("troubleshooting")}
              role="tab"
              aria-selected={helpPage === "troubleshooting"}
            >
              {t('help.troubleshooting')}
            </button>
            <button 
              className={helpPage === "commands" ? "active" : ""} 
              onClick={() => setHelpPage("commands")}
              role="tab"
              aria-selected={helpPage === "commands"}
            >
              {t('help.commands')}
            </button>
          </div>

          {helpPage === "overview" && (
            <div className="help-content fade-in">
              <h3>Getting Started</h3>
              <ul>
                <li><strong>Configure Server:</strong> Use Settings to enter host, port, username and password</li>
                <li><strong>Test Connection:</strong> Press Test to validate server connectivity</li>
                <li><strong>Save Settings:</strong> Press Save to apply configuration and start polling</li>
                <li><strong>Browse Sessions:</strong> View and manage sessions from the Sessions tab</li>
                <li><strong>Interact:</strong> Open a session and chat in the Detail view</li>
                <li><strong>Quick Input:</strong> Press Enter to send, Shift+Enter for new lines</li>
                <li><strong>Slash Commands:</strong> Text starting with <code>/</code> is sent as a command</li>
              </ul>
              
              <h3>Key Features</h3>
              <ul>
                <li>🔄 Real-time session monitoring</li>
                <li>💬 Interactive chat interface</li>
                <li>📋 Todo tracking display</li>
                <li>⚡ Instant session control</li>
                <li>🔔 Completion notifications</li>
              </ul>
            </div>
          )}

          {helpPage === "server" && (
            <div className="help-content fade-in">
              <h3>Starting the OpenCode Server</h3>
              <p>Start OpenCode server with Basic Authentication enabled:</p>
              
              <div className="code-blocks">
                <h4>macOS / Linux (bash/zsh)</h4>
                <pre>OPENCODE_SERVER_USERNAME=opencode \
OPENCODE_SERVER_PASSWORD=your-password \
npx -y opencode-ai serve --hostname 0.0.0.0 --port 4096</pre>
                
                <h4>Windows PowerShell</h4>
                <pre>$env:OPENCODE_SERVER_USERNAME="opencode"
$env:OPENCODE_SERVER_PASSWORD="your-password"
npx -y opencode-ai serve --hostname 0.0.0.0 --port 4096</pre>
                
                <h4>Windows Command Prompt</h4>
                <pre>set OPENCODE_SERVER_USERNAME=opencode
set OPENCODE_SERVER_PASSWORD=your-password
npx -y opencode-ai serve --hostname 0.0.0.0 --port 4096</pre>
              </div>
              
              <div className="help-note">
                <strong>🔧 Browser Debugging:</strong>
                <p>Add CORS origins for browser testing:</p>
                <pre>--cors http://localhost:5173 --cors http://127.0.0.1:5173</pre>
              </div>
            </div>
          )}

          {helpPage === "network" && (
            <div className="help-content fade-in">
              <h3>Network Configuration</h3>
              
              <div className="network-modes">
                <h4>🌐 LAN Mode (Recommended)</h4>
                <p>Use your PC's local IP address for devices on the same network:</p>
                <pre>Example: 192.168.1.61</pre>
                
                <h4>🌍 WAN Mode (Advanced)</h4>
                <ul>
                  <li>Configure NAT/port forwarding on your router</li>
                  <li>Set up a VPN for secure remote access</li>
                  <li>Use a reverse proxy with TLS/HTTPS</li>
                </ul>
              </div>
              
              <div className="security-checklist">
                <h4>🔒 Security Requirements</h4>
                <ul>
                  <li>✅ Open TCP port 4096 in OS firewall</li>
                  <li>✅ Configure router/NAT port forwarding</li>
                  <li>✅ Use strong authentication passwords</li>
                  <li>✅ Prefer TLS/HTTPS for external access</li>
                  <li>✅ Restrict source IPs when possible</li>
                  <li>⚠️ Never expose without authentication</li>
                </ul>
              </div>
            </div>
          )}

          {helpPage === "troubleshooting" && (
            <div className="help-content fade-in">
              <h3>Troubleshooting Guide</h3>
              
              <div className="troubleshooting-steps">
                <h4>🔍 Connection Diagnostics</h4>
                <ol>
                  <li><strong>Verify Server:</strong> Check if OpenCode is listening on port 4096</li>
                  <li><strong>Test Locally:</strong> Check health endpoint from the same machine</li>
                  <li><strong>Test Network:</strong> Check health endpoint from your phone browser</li>
                  <li><strong>Check Firewall:</strong> Ensure port 4096 is open in OS firewall</li>
                </ol>
              </div>
              
              <div className="health-checks">
                <h4>🩺 Health Check Commands</h4>
                <div className="code-examples">
                  <h5>Local Machine:</h5>
                  <pre>curl -u opencode:your-password \
http://127.0.0.1:4096/global/health</pre>
                  
                  <h5>From Phone/Network:</h5>
                  <pre>curl -u opencode:your-password \
http://YOUR_PC_IP:4096/global/health</pre>
                </div>
              </div>
              
              <div className="common-issues">
                <h4>⚠️ Common Issues</h4>
                <ul>
                  <li><strong>CORS Errors:</strong> Add <code>--cors</code> flags to server</li>
                  <li><strong>Connection Timeout:</strong> Check firewall settings</li>
                  <li><strong>Auth Failures:</strong> Verify username/password</li>
                  <li><strong>Session Issues:</strong> Re-open session and check server models</li>
                </ul>
              </div>
            </div>
          )}

          {helpPage === "commands" && (
            <div className="help-content fade-in">
              <h3>Slash Commands</h3>
              <p>Available commands from the OpenCode server. Type these in the chat input starting with <code>/</code>:</p>
              
              {commands.length === 0 ? (
                <div className="no-commands">
                  <HelpIcon size={48} className="icon-empty-state" />
                  <p className="subtle">No commands available</p>
                  <p className="subtle">Connect to a server to see available commands</p>
                </div>
              ) : (
                <div className="commands-grid">
                  {commands.map((cmd) => (
                    <div key={cmd.name} className="command-card">
                      <code className="command-name">/{cmd.name}</code>
                      {cmd.description && (
                        <p className="command-description">{cmd.description}</p>
                      )}
                    </div>
                  ))}
                </div>
              )}
              
              <div className="command-examples">
                <h4>💡 Usage Examples</h4>
                <div className="example-commands">
                  <pre>/help</pre>
                  <pre>/status</pre>
                  <pre>/clear</pre>
                  <pre>/save</pre>
                </div>
              </div>
            </div>
          )}
          {runtimeError && <p className="error">{runtimeError}</p>}
        </section>
      )}

      <nav className="bottom-nav" role="navigation" aria-label="Mobile navigation">
        {navItems.map((item) => (
          <button
            key={item.view}
            className={view === item.view ? "active" : ""}
            onClick={() => setView(item.view)}
            disabled={item.disabled}
            aria-label={item.label}
          >
            {item.icon}
            <span>{item.label}</span>
          </button>
        ))}
      </nav>
    </div>
  )
}

export default App
