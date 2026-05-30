import { useEffect, useMemo, useRef, useState } from "react"
import { App as CapApp } from "@capacitor/app"
import { api } from "./api"
import type { AgentInfo, CommandInfo, MessageEnvelope, ProviderInfo, ServerConfig, SessionView, TodoItem } from "./types"
import {
  SettingsIcon,
  FolderIcon,
  ChatIcon,
  HelpIcon,
  PlusIcon,
  TrashIcon,
  StopIcon,
  SaveIcon,
  TestIcon,
  LoadingIcon,
  RocketIcon,
  MenuIcon,
  SunIcon,
  MoonIcon
} from "./Icons"

const STORAGE_KEY = "opencode.remote.server"
const THEME_KEY = "opencode.remote.theme"

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

function extractToolParts(msg: MessageEnvelope) {
  return msg.parts.filter((part) => part.type === "tool" && part.tool && part.state)
}

function extractSubtaskParts(msg: MessageEnvelope) {
  return msg.parts.filter((part) => part.type === "subtask" && part.prompt)
}

function extractReasoningParts(msg: MessageEnvelope) {
  return msg.parts.filter((part) => part.type === "reasoning" && part.text)
}

function extractFileParts(msg: MessageEnvelope) {
  return msg.parts.filter((part) => part.type === "file" && part.url)
}

function extractStepStartParts(msg: MessageEnvelope) {
  return msg.parts.filter((part) => part.type === "step-start")
}

function extractStepFinishParts(msg: MessageEnvelope) {
  return msg.parts.filter((part) => part.type === "step-finish")
}

function extractPatchParts(msg: MessageEnvelope) {
  return msg.parts.filter((part) => part.type === "patch" && part.hash)
}

function extractAgentParts(msg: MessageEnvelope) {
  return msg.parts.filter((part) => part.type === "agent" && part.name)
}

function extractRetryParts(msg: MessageEnvelope) {
  return msg.parts.filter((part) => part.type === "retry")
}

function extractCompactionParts(msg: MessageEnvelope) {
  return msg.parts.filter((part) => part.type === "compaction")
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

function formatToolParams(input: Record<string, unknown>): string {
  try {
    const entries = Object.entries(input).filter(([, v]) => v !== undefined && v !== null)
    if (entries.length === 0) return ""
    return entries
      .map(([key, value]) => {
        const val = typeof value === "string" ? value : JSON.stringify(value)
        return `${key}: ${val}`
      })
      .join("\n")
  } catch {
    return JSON.stringify(input, null, 2)
  }
}

function ToolPartDisplay({ part }: { part: { tool: string; state: NonNullable<MessageEnvelope["parts"][0]["state"]> } }) {
  const [expanded, setExpanded] = useState(false)
  const state = part.state
  if (!state) return null

  const statusIcon = state.status === "completed" ? "✓" : state.status === "error" ? "✗" : state.status === "running" ? "⟳" : "○"
  const statusClass = state.status
  const params = formatToolParams(state.input)
  const hasOutput = state.status === "completed" || state.status === "error"
  const output = state.status === "completed" ? state.output : state.status === "error" ? state.error : ""
  const title = state.status === "completed" || state.status === "running" ? state.title : undefined

  return (
    <div className={`tool-part ${statusClass}`}>
      <div className="tool-header" onClick={() => hasOutput && setExpanded(!expanded)}>
        <span className={`tool-status ${statusClass}`}>{statusIcon}</span>
        <span className="tool-name">{part.tool}</span>
        {title && <span className="tool-title">{title}</span>}
        {hasOutput && (
          <button className="tool-toggle" onClick={(e) => { e.stopPropagation(); setExpanded(!expanded) }}>
            {expanded ? "▲" : "▼"}
          </button>
        )}
      </div>
      {params && (
        <div className="tool-params">
          <pre>{params}</pre>
        </div>
      )}
      {expanded && output && (
        <div className="tool-output">
          <pre>{output}</pre>
        </div>
      )}
    </div>
  )
}

function SubtaskPartDisplay({ part }: { part: { prompt: string; description?: string; agent?: string } }) {
  const [expanded, setExpanded] = useState(false)
  const hasDescription = Boolean(part.description)
  const hasAgent = Boolean(part.agent)

  return (
    <div className="subtask-part">
      <div className="subtask-header" onClick={() => setExpanded(!expanded)}>
        <span className="subtask-icon">📋</span>
        <span className="subtask-label">Subtask</span>
        {hasAgent && <span className="subtask-agent">{part.agent}</span>}
        <button className="subtask-toggle" onClick={(e) => { e.stopPropagation(); setExpanded(!expanded) }}>
          {expanded ? "▲" : "▼"}
        </button>
      </div>
      {expanded && (
        <div className="subtask-content">
          {hasDescription && (
            <div className="subtask-description">
              <strong>Description:</strong>
              <p>{part.description}</p>
            </div>
          )}
          <div className="subtask-prompt">
            <strong>Prompt:</strong>
            <pre>{part.prompt}</pre>
          </div>
        </div>
      )}
    </div>
  )
}

function ReasoningPartDisplay({ part }: { part: { text: string } }) {
  const [expanded, setExpanded] = useState(false)

  return (
    <div className="reasoning-part">
      <div className="reasoning-header" onClick={() => setExpanded(!expanded)}>
        <span className="reasoning-icon">💭</span>
        <span className="reasoning-label">Thinking</span>
        <button className="reasoning-toggle" onClick={(e) => { e.stopPropagation(); setExpanded(!expanded) }}>
          {expanded ? "▲" : "▼"}
        </button>
      </div>
      {expanded && (
        <div className="reasoning-content">
          <pre>{part.text}</pre>
        </div>
      )}
    </div>
  )
}

function FilePartDisplay({ part }: { part: { mime: string; filename?: string; url: string } }) {
  const isImage = part.mime.startsWith("image/")

  return (
    <div className="file-part">
      <div className="file-header">
        <span className="file-icon">{isImage ? "🖼️" : "📄"}</span>
        <span className="file-name">{part.filename || "Attachment"}</span>
        <span className="file-mime">{part.mime}</span>
      </div>
      {isImage && (
        <div className="file-preview">
          <img src={part.url} alt={part.filename || "Attachment"} />
        </div>
      )}
    </div>
  )
}

function StepStartPartDisplay() {
  return (
    <div className="step-part step-start">
      <span className="step-icon">▶️</span>
      <span className="step-label">Step started</span>
    </div>
  )
}

function StepFinishPartDisplay({ part }: { part: { reason: string; cost?: number; tokens?: { input: number; output: number; reasoning: number } } }) {
  return (
    <div className="step-part step-finish">
      <div className="step-header">
        <span className="step-icon">⏹️</span>
        <span className="step-label">Step finished</span>
        <span className="step-reason">{part.reason}</span>
      </div>
      {(part.cost !== undefined || part.tokens) && (
        <div className="step-stats">
          {part.cost !== undefined && <span className="step-cost">Cost: ${part.cost.toFixed(4)}</span>}
          {part.tokens && (
            <span className="step-tokens">
              Tokens: {part.tokens.input + part.tokens.output + part.tokens.reasoning}
            </span>
          )}
        </div>
      )}
    </div>
  )
}

function PatchPartDisplay({ part }: { part: { hash: string; files: string[] } }) {
  const [expanded, setExpanded] = useState(false)

  return (
    <div className="patch-part">
      <div className="patch-header" onClick={() => setExpanded(!expanded)}>
        <span className="patch-icon">🩹</span>
        <span className="patch-label">Patch</span>
        <span className="patch-files">{part.files.length} file(s)</span>
        <button className="patch-toggle" onClick={(e) => { e.stopPropagation(); setExpanded(!expanded) }}>
          {expanded ? "▲" : "▼"}
        </button>
      </div>
      {expanded && (
        <div className="patch-content">
          <div className="patch-hash">Hash: <code>{part.hash}</code></div>
          <ul className="patch-file-list">
            {part.files.map((file, index) => (
              <li key={index}>{file}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}

function AgentPartDisplay({ part }: { part: { name: string } }) {
  return (
    <div className="agent-part">
      <span className="agent-icon">🤖</span>
      <span className="agent-label">Agent</span>
      <span className="agent-name">{part.name}</span>
    </div>
  )
}

function RetryPartDisplay({ part }: { part: { attempt: number; error?: { name: string; data: { message: string } } } }) {
  return (
    <div className="retry-part">
      <div className="retry-header">
        <span className="retry-icon">🔄</span>
        <span className="retry-label">Retry #{part.attempt}</span>
      </div>
      {part.error && (
        <div className="retry-error">
          <strong>{part.error.name}:</strong> {part.error.data.message}
        </div>
      )}
    </div>
  )
}

function CompactionPartDisplay({ part }: { part: { auto: boolean } }) {
  return (
    <div className="compaction-part">
      <span className="compaction-icon">📦</span>
      <span className="compaction-label">Compaction</span>
      <span className="compaction-type">{part.auto ? "Auto" : "Manual"}</span>
    </div>
  )
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

  const [theme, setTheme] = useState<"dark" | "light">(() => {
    return (localStorage.getItem(THEME_KEY) as "dark" | "light") ?? "dark"
  })

  const [draftConfig, setDraftConfig] = useState<ServerConfig>(config)
  const [connectedVersion, setConnectedVersion] = useState<string>("")
  const [commands, setCommands] = useState<CommandInfo[]>([])
  const [agents, setAgents] = useState<AgentInfo[]>([])
  const [currentAgent, setCurrentAgent] = useState<string | null>(null)
  const [providers, setProviders] = useState<ProviderInfo[]>([])
  const [currentVariant, setCurrentVariant] = useState<string | null>(null)
  const [helpPage, setHelpPage] = useState<"overview" | "server" | "network" | "troubleshooting" | "commands">(
    "overview"
  )
  const [view, setView] = useState<"menu" | "settings" | "sessions" | "detail" | "help">(() => {
    return config.host && config.port > 0 ? "sessions" : "settings"
  })

  const [sessions, setSessions] = useState<SessionView[]>([])
  const [selectedID, setSelectedID] = useState<string | null>(null)
  const [messages, setMessages] = useState<MessageEnvelope[]>([])
  const [todos, setTodos] = useState<TodoItem[]>([])
  const [todosExpanded, setTodosExpanded] = useState(false)
  const [query, setQuery] = useState("")
  const [newSessionFolder, setNewSessionFolder] = useState("")
  const [composer, setComposer] = useState("")
  const [busySending, setBusySending] = useState(false)
  const [loadingSessionID, setLoadingSessionID] = useState<string | null>(null)
  const [testingConnection, setTestingConnection] = useState(false)
  const [settingsNotice, setSettingsNotice] = useState<{ type: NoticeType; text: string } | null>(null)
  const [runtimeError, setRuntimeError] = useState<string | null>(null)
  const [toast, setToast] = useState<{ type: NoticeType; text: string } | null>(null)
  const [pullDelta, setPullDelta] = useState(0)
  const [isPullRefreshing, setIsPullRefreshing] = useState(false)
  const [slashOpen, setSlashOpen] = useState(false)
  const [slashFilter, setSlashFilter] = useState("")
  const [slashIndex, setSlashIndex] = useState(0)
  const messagesRef = useRef<HTMLDivElement | null>(null)
  const textareaRef = useRef<HTMLTextAreaElement | null>(null)
  const completionAudioRef = useRef<HTMLAudioElement | null>(null)
  const wasRunningRef = useRef(false)
  const pullDeltaRef = useRef(0)
  const sessionsRef = useRef<HTMLElement | null>(null)
  const PULL_THRESHOLD = 80

  const selectedSession = useMemo(
    () => sessions.find((session) => session.id === selectedID) ?? null,
    [sessions, selectedID]
  )

  const filteredSessions = useMemo(() => {
    const isSubagent = (title: string) => /\(@\S+ subagent\)$/i.test(title)
    return sessions.filter((session) => {
      if (isSubagent(session.title)) return false
      const text = query.trim().toLowerCase()
      if (!text) return true
      return session.title.toLowerCase().includes(text) || session.directory.toLowerCase().includes(text)
    })
  }, [sessions, query])

  const renderedMessages = useMemo(() => {
    return messages
      .map((message) => ({
        ...message,
        text: extractText(message),
        toolParts: extractToolParts(message),
        subtaskParts: extractSubtaskParts(message),
        reasoningParts: extractReasoningParts(message),
        fileParts: extractFileParts(message),
        stepStartParts: extractStepStartParts(message),
        stepFinishParts: extractStepFinishParts(message),
        patchParts: extractPatchParts(message),
        agentParts: extractAgentParts(message),
        retryParts: extractRetryParts(message),
        compactionParts: extractCompactionParts(message)
      }))
      .filter((message) =>
        message.text ||
        message.toolParts.length > 0 ||
        message.subtaskParts.length > 0 ||
        message.reasoningParts.length > 0 ||
        message.fileParts.length > 0 ||
        message.stepStartParts.length > 0 ||
        message.stepFinishParts.length > 0 ||
        message.patchParts.length > 0 ||
        message.agentParts.length > 0 ||
        message.retryParts.length > 0 ||
        message.compactionParts.length > 0
      )
  }, [messages])

  const filteredCommands = useMemo(() => {
    if (!slashOpen) return []
    const filter = slashFilter.toLowerCase()
    return commands.filter((cmd) => cmd.name.toLowerCase().includes(filter))
  }, [commands, slashFilter, slashOpen])

  const hasConfiguredServer = Boolean(config.host && config.port > 0)
  const isSessionRunning = Boolean(selectedSession && ["busy", "retry"].includes(selectedSession.status))
  const isWorking = isSessionRunning

  const sessionInfo = useMemo(() => {
    const lastUser = [...messages].reverse().find((m) => m.info.role === "user")
    const lastAssistant = [...messages].reverse().find((m) => m.info.role === "assistant")
    const assistantModel = lastAssistant?.info?.modelID
      ? { providerID: lastAssistant.info.providerID ?? "", modelID: lastAssistant.info.modelID }
      : null
    return {
      agent: currentAgent ?? lastUser?.info?.agent ?? null,
      model: lastUser?.info?.model ?? assistantModel ?? null,
      variant: lastAssistant?.info?.mode ?? null
    }
  }, [messages, currentAgent])

  const availableVariants = useMemo(() => {
    const model = sessionInfo.model
    if (!model || providers.length === 0) return []
    const provider = providers.find((p) => p.id === model.providerID)
    const modelInfo = provider?.models[model.modelID]
    return modelInfo?.variants ? Object.keys(modelInfo.variants) : []
  }, [sessionInfo.model, providers])

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
          statusMessage: statuses[session.id]?.message,
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

  async function loadAgents() {
    if (!config.host || !config.password) return
    try {
      const list = await api.listAgents(config)
      setAgents(list)
    } catch {
      setAgents([])
    }
  }

  async function loadProviders() {
    if (!config.host || !config.password) return
    try {
      const resp = await api.listProviders(config)
      setProviders(resp.all)
    } catch {
      setProviders([])
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
      const lastUser = [...msg].reverse().find((m) => m.info.role === "user")
      const agent = lastUser?.info?.agent
      if (agent) {
        setCurrentAgent((prev) => prev ?? agent)
      }
    } catch (err) {
      setRuntimeError((err as Error).message)
    }
  }

  async function createSession() {
    const folder = newSessionFolder.trim()
    try {
      const created = await api.createSession(config, "Mobile session", folder)
      setNewSessionFolder("")
      await refreshSessions()
      setSelectedID(created.id)
      await loadSelected(created.id, created.directory)
    } catch (err) {
      const message = (err as Error).message
      setRuntimeError(message)
      setToast({ type: "error", text: message })
    }
  }

  async function send() {
    if (!selectedSession) return
    const text = composer.trim()
    if (!text) return
    setComposer("")
    setSlashOpen(false)

    setBusySending(true)
    setRuntimeError(null)
    try {
      if (text.startsWith("/")) {
        const normalized = text.slice(1)
        const command = normalized.split(" ")[0]?.trim()
        const args = normalized.slice(command.length).trim()
        if (!command) return
        const reply = await api.sendCommand(config, selectedSession.id, command, args, selectedSession.directory, currentAgent ?? undefined, currentVariant ?? undefined)
        if (reply && reply.info) {
          if (reply.info.agent) setCurrentAgent(reply.info.agent)
          setMessages((prev) => [...prev, reply])
        }
      } else {
        const reply = await api.sendPrompt(config, selectedSession.id, text, selectedSession.directory, currentAgent ?? undefined, currentVariant ?? undefined)
        if (reply && reply.info && reply.info.agent) {
          setCurrentAgent(reply.info.agent)
        }
      }
      await loadSelected(selectedSession.id, selectedSession.directory)
      await refreshSessions()
    } catch (err) {
      setRuntimeError((err as Error).message)
    } finally {
      setBusySending(false)
    }
  }

  function handleSlashSelect(cmd: CommandInfo) {
    setComposer(`/${cmd.name} `)
    setSlashOpen(false)
    setSlashFilter("")
    setSlashIndex(0)
    setTimeout(() => textareaRef.current?.focus(), 0)
  }

  function cycleAgent() {
    if (agents.length === 0) return
    const current = currentAgent ?? sessionInfo.agent ?? agents[0].name
    const idx = agents.findIndex((a) => a.name === current)
    const next = agents[(idx + 1) % agents.length]
    setCurrentAgent(next.name)
  }

  function cycleVariant() {
    if (availableVariants.length === 0) return
    if (!currentVariant) {
      setCurrentVariant(availableVariants[0])
      return
    }
    const idx = availableVariants.indexOf(currentVariant)
    if (idx === -1 || idx === availableVariants.length - 1) {
      setCurrentVariant(null)
    } else {
      setCurrentVariant(availableVariants[idx + 1])
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
    loadAgents().catch(() => undefined)
    loadProviders().catch(() => undefined)
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
    window.scrollTo(0, document.body.scrollHeight)
  }, [view, renderedMessages.length, busySending])

  useEffect(() => {
    completionAudioRef.current = new Audio("/audio/staplebops-01.aac")
    completionAudioRef.current.preload = "auto"
  }, [])

  useEffect(() => {
    if (view !== "sessions") return
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
  }, [view, config.host, config.password])

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme)
    localStorage.setItem(THEME_KEY, theme)
  }, [theme])

  useEffect(() => {
    if (!toast) return
    const timer = setTimeout(() => setToast(null), 4000)
    return () => clearTimeout(timer)
  }, [toast])

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

  useEffect(() => {
    const handleBackButton = () => {
      if (view === "detail") {
        setView("sessions")
      }
    }

    let listener: any = null
    CapApp.addListener("backButton", handleBackButton).then((l) => {
      listener = l
    })

    return () => {
      if (listener) {
        listener.remove()
      }
    }
  }, [view])



  return (
    <div className="app-shell">
      {toast && (
        <div className={`toast toast-${toast.type} fade-in`} onClick={() => setToast(null)}>
          {toast.type === 'success' && '✓ '}
          {toast.type === 'error' && '✗ '}
          {toast.type === 'info' && 'ℹ '}
          {toast.text}
        </div>
      )}
      <header className="top-nav panel fade-in">
        <div className="brand-section">
          <div className="brand-title">
            <img src="/app-icon.png" alt="" className="app-icon" />
            <h1>OpenCode Remote</h1>
          </div>
        </div>
        
        {/* Desktop navigation */}
        <nav className="desktop-nav tab-row" role="navigation" aria-label="Main navigation">
          <button 
            className={view === "settings" ? "active" : ""} 
            onClick={() => setView("settings")}
            aria-label="Settings"
          >
            <SettingsIcon size={18} />
            <span>Settings</span>
          </button>
          <button
            className={view === "sessions" ? "active" : ""}
            onClick={() => setView("sessions")}
            disabled={!hasConfiguredServer}
            aria-label="Sessions"
          >
            <FolderIcon size={18} />
            <span>Sessions</span>
          </button>
          <button
            className={view === "detail" ? "active" : ""}
            onClick={() => setView("detail")}
            disabled={!selectedSession}
            aria-label="Detail"
          >
            <ChatIcon size={18} />
            <span>Detail</span>
          </button>
          <button 
            className={view === "help" ? "active" : ""} 
            onClick={() => setView("help")}
            aria-label="Help"
          >
            <HelpIcon size={18} />
            <span>Help</span>
          </button>
        </nav>

        {/* Mobile menu button */}
        <button 
          className={view === "menu" ? "mobile-menu-btn active" : "mobile-menu-btn"}
          onClick={() => setView("menu")}
          aria-label="Open menu"
        >
          <MenuIcon size={24} />
        </button>
      </header>

      {view === "menu" && (
        <section className="panel menu-panel fade-in">
          <h2>Menu</h2>
          <div className="menu-grid">
            <button 
              className="menu-item"
              onClick={() => setView("settings")}
              aria-label="Settings"
            >
              <SettingsIcon size={28} />
              <span>Settings</span>
              <small>Configure server connection</small>
            </button>
            
            <button
              className="menu-item"
              onClick={() => setView("sessions")}
              disabled={!hasConfiguredServer}
              aria-label="Sessions"
            >
              <FolderIcon size={28} />
              <span>Sessions</span>
              <small>Manage your sessions</small>
            </button>
            
            <button
              className="menu-item"
              onClick={() => setView("detail")}
              disabled={!selectedSession}
              aria-label="Detail"
            >
              <ChatIcon size={28} />
              <span>Detail</span>
              <small>Chat with OpenCode</small>
            </button>
            
            <button 
              className="menu-item"
              onClick={() => setView("help")}
              aria-label="Help"
            >
              <HelpIcon size={28} />
              <span>Help</span>
              <small>Documentation & support</small>
            </button>
          </div>
        </section>
      )}

      {view === "settings" && (
        <section className="panel settings fade-in">
          <h2>Server Configuration</h2>
          
          <label htmlFor="host">
            Host Address
            <input 
              id="host"
              value={draftConfig.host} 
              onChange={(event) => setDraftConfig({ ...draftConfig, host: event.target.value })} 
              placeholder="192.168.1.100 or localhost"
            />
          </label>
          
          <label htmlFor="port">
            Port
            <input
              id="port"
              type="number"
              value={draftConfig.port}
              onChange={(event) => setDraftConfig({ ...draftConfig, port: Number(event.target.value || 0) })}
              placeholder="4096"
            />
          </label>
          
          <label htmlFor="username">
            Username
            <input
              id="username"
              value={draftConfig.username}
              onChange={(event) => setDraftConfig({ ...draftConfig, username: event.target.value })}
              placeholder="opencode"
            />
          </label>
          
          <label htmlFor="password">
            Password
            <input
              id="password"
              type="password"
              value={draftConfig.password}
              onChange={(event) => setDraftConfig({ ...draftConfig, password: event.target.value })}
              placeholder="Your server password"
            />
          </label>
          
          <label className="settings-appearance-label">
            Appearance
            <div className="theme-switcher">
              <button
                type="button"
                className={`theme-btn${theme === "dark" ? " active" : ""}`}
                onClick={() => setTheme("dark")}
              >
                <MoonIcon size={14} />
                Dark
              </button>
              <button
                type="button"
                className={`theme-btn${theme === "light" ? " active" : ""}`}
                onClick={() => setTheme("light")}
              >
                <SunIcon size={14} />
                Light
              </button>
            </div>
          </label>

          <div className="actions">
            <button
              onClick={saveConfig}
              disabled={testingConnection}
              className="btn-primary"
            >
              <SaveIcon size={18} />
              {testingConnection ? "Saving..." : "Save Configuration"}
            </button>
            <button 
              onClick={() => testConnection(draftConfig)} 
              className="btn-secondary"
              disabled={testingConnection}
            >
              {testingConnection ? (
                <>
                  <LoadingIcon size={18} />
                  Testing...
                </>
              ) : (
                <>
                  <TestIcon size={18} />
                  Test Connection
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
              Connected to OpenCode {connectedVersion}
            </div>
          )}
        </section>
      )}

      {view === "sessions" && (
        <section className="panel sessions fade-in" ref={sessionsRef}>
          <div
            className="pull-indicator"
            style={{ height: pullDelta > 10 ? `${Math.min(pullDelta * 0.6, 52)}px` : "0" }}
          >
            {isPullRefreshing ? (
              <LoadingIcon size={20} />
            ) : pullDelta >= PULL_THRESHOLD ? (
              <span>↑ Release to refresh</span>
            ) : (
              <span>↓ Pull to refresh</span>
            )}
          </div>
          <div className="header-row">
            <h2>Sessions</h2>
          </div>
          
          <div className="new-session-row">
            <input
              placeholder="Folder path (leave empty for current directory)"
              value={newSessionFolder}
              onChange={(event) => setNewSessionFolder(event.target.value)}
              className="new-session-input"
            />
            <button onClick={createSession} className="btn-primary">
              <PlusIcon size={18} />
              New Session
            </button>
          </div>
          
          <input
            placeholder="Search sessions by title or directory..."
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            className="search"
          />
          
          <div className="session-list">
            {filteredSessions.length === 0 ? (
              <div style={{ textAlign: 'center', padding: 'var(--space-8)', color: 'var(--secondary-500)' }}>
                <FolderIcon size={48} className="icon-empty-state" />
                <p>No sessions found</p>
                <p className="subtle">Create a new session to get started</p>
              </div>
            ) : (
              filteredSessions.map((session) => (
                <article 
                  key={session.id} 
                  className={`session-card ${selectedID === session.id ? "active" : ""} fade-in`}
                  onClick={() => openSession(session.id, session.directory).catch(() => undefined)}
                >
                  <div className="header-row">
                    <h3>{session.title}</h3>
                    <span className={`pill ${session.status}`}>{session.status}</span>
                  </div>
                  <p>{session.directory}</p>
                  <div className="session-stats">
                    {session.files > 0 || session.additions > 0 || session.deletions > 0 ? (
                      <span>
                        <strong>{session.files}</strong> files • 
                        <strong style={{ color: 'var(--success-600)' }}> +{session.additions}</strong> • 
                        <strong style={{ color: 'var(--accent-600)' }}> -{session.deletions}</strong>
                      </span>
                    ) : (
                      <span className="subtle">No file changes</span>
                    )}
                    <span className="subtle">• Updated {formatTime(session.updated)}</span>
                  </div>
                  <div className="inline-actions">
                    <button 
                      className="btn-danger" 
                      onClick={(e) => { e.stopPropagation(); deleteSession(session.id); }}
                    >
                      <TrashIcon size={16} />
                      Delete
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
            <div className="header-row">
              <div>
              <h2>
                {selectedSession ? (
                  <>
                    <ChatIcon size={24} className="icon-inline-heading" />
                    {selectedSession.title}
                  </>
                ) : (
                  "Select a session"
                )}
              </h2>
              {selectedSession && (
                <p className="subtle">
                  {selectedSession.directory} • Updated {formatTime(selectedSession.updated)}
                </p>
                )}
              </div>
            </div>

          <div className="todo-box">
            <div className="todo-header-row">
              <h3>
                <span style={{ marginRight: 'var(--space-2)' }}>📋</span>
                Todo Items
              </h3>
              <button
                type="button"
                className="todo-toggle-btn"
                onClick={() => setTodosExpanded((value) => !value)}
                aria-expanded={todosExpanded}
                aria-controls="todo-items-content"
              >
                {todosExpanded ? "Hide" : "Show"}
              </button>
            </div>
            {todosExpanded && (
              <div id="todo-items-content">
                {todos.length === 0 ? (
                  <p className="subtle">No todo items</p>
                ) : (
                  todos.slice(0, 6).map((item) => (
                    <div key={item.id} className="todo-item">
                      <span className={`todo-status ${item.status}`}>
                        {item.status === 'completed' ? '✓' : '○'}
                      </span>
                      <span>{item.content}</span>
                    </div>
                  ))
                )}
              </div>
            )}
          </div>

          <div className="messages" ref={messagesRef}>
            {loadingSessionID === selectedID ? (
              <div style={{ textAlign: 'center', padding: 'var(--space-8)', color: 'var(--secondary-500)' }}>
                <LoadingIcon size={32} />
                <p>Loading session...</p>
              </div>
            ) : renderedMessages.length === 0 ? (
              <div style={{ textAlign: 'center', padding: 'var(--space-8)', color: 'var(--secondary-500)' }}>
                <ChatIcon size={48} className="icon-empty-state" />
                <p>No messages yet</p>
                <p className="subtle">Start a conversation below</p>
              </div>
            ) : (
              renderedMessages.map((message) => {
                const lines = message.text ? toDisplayLines(message.text) : []
                return (
                  <article key={message.info.id} className={`message ${message.info.role} fade-in`}>
                    <header>
                      <strong>
                        {message.info.role === "user" ? "👤 You" : "🤖 OpenCode"}
                      </strong>
                      <small>{formatTime(message.info.time.created)}</small>
                    </header>
                    {message.stepStartParts.map((part) => (
                      <StepStartPartDisplay key={part.id} />
                    ))}
                    {message.agentParts.map((part) => (
                      <AgentPartDisplay key={part.id} part={part as { name: string }} />
                    ))}
                    {message.reasoningParts.map((part) => (
                      <ReasoningPartDisplay key={part.id} part={part as { text: string }} />
                    ))}
                    {message.subtaskParts.map((part) => (
                      <SubtaskPartDisplay key={part.id} part={part as { prompt: string; description?: string; agent?: string }} />
                    ))}
                    {message.toolParts.map((part) => (
                      <ToolPartDisplay key={part.id} part={part as { tool: string; state: NonNullable<MessageEnvelope["parts"][0]["state"]> }} />
                    ))}
                    {message.fileParts.map((part) => (
                      <FilePartDisplay key={part.id} part={part as { mime: string; filename?: string; url: string }} />
                    ))}
                    {message.patchParts.map((part) => (
                      <PatchPartDisplay key={part.id} part={part as { hash: string; files: string[] }} />
                    ))}
                    {message.stepFinishParts.map((part) => (
                      <StepFinishPartDisplay key={part.id} part={part as { reason: string; cost?: number; tokens?: { input: number; output: number; reasoning: number } }} />
                    ))}
                    {message.retryParts.map((part) => (
                      <RetryPartDisplay key={part.id} part={part as { attempt: number; error?: { name: string; data: { message: string } } }} />
                    ))}
                    {message.compactionParts.map((part) => (
                      <CompactionPartDisplay key={part.id} part={part as { auto: boolean }} />
                    ))}
                    {lines.length > 0 && (
                      <div className="message-content">
                        {lines.map((line, index) => (
                          <p key={index}>{renderInline(line)}</p>
                        ))}
                      </div>
                    )}
                  </article>
                )
              })
            )}
          </div>

          {selectedSession?.status === "ask" && (
            <div className="notice info fade-in" style={{ marginBottom: 'var(--space-3)' }}>
              <strong>OpenCode is asking:</strong>{" "}
              {selectedSession.statusMessage ?? "Waiting for your response..."}
            </div>
          )}

          <div className="composer">
            {selectedSession && (sessionInfo.model || sessionInfo.variant || sessionInfo.agent) && (
              <div className="session-meta">
                {(sessionInfo.model || sessionInfo.variant) && (
                  <div className="session-meta-model-row">
                    {sessionInfo.model && (
                      <span className="meta-model">
                        <span className="meta-provider">{sessionInfo.model.providerID}</span>
                        <span className="meta-sep">/</span>
                        <span className="meta-modelid">{sessionInfo.model.modelID}</span>
                      </span>
                    )}
                    {availableVariants.length > 0 && (
                      <button
                        type="button"
                        className={`meta-variant${currentVariant ? " active" : ""}`}
                        onClick={cycleVariant}
                        title="Cycle model variant"
                      >
                        {currentVariant ?? "auto"}
                      </button>
                    )}
                  </div>
                )}
                <button
                  type="button"
                  className="session-meta-agent"
                  onClick={agents.length > 0 ? cycleAgent : undefined}
                  disabled={agents.length === 0}
                  title={agents.length > 0 ? "Cycle agent" : undefined}
                >
                  <span className="meta-agent-name">{sessionInfo.agent ?? "—"}</span>
                  {agents.length > 0 && <span className="meta-agent-cycle">↻</span>}
                </button>
              </div>
            )}
            {slashOpen && filteredCommands.length > 0 && (
              <div className="slash-popover">
                {filteredCommands.map((cmd, index) => (
                  <button
                    key={cmd.name}
                    type="button"
                    className={`slash-item${index === slashIndex ? " active" : ""}`}
                    onMouseDown={(e) => {
                      e.preventDefault()
                      handleSlashSelect(cmd)
                    }}
                    onMouseEnter={() => setSlashIndex(index)}
                  >
                    <span className="slash-name">/{cmd.name}</span>
                    {cmd.description && (
                      <span className="slash-description">{cmd.description}</span>
                    )}
                  </button>
                ))}
              </div>
            )}
            <textarea
              ref={textareaRef}
              value={composer}
              onChange={(event) => {
                const value = event.target.value
                setComposer(value)
                if (value.startsWith("/")) {
                  const afterSlash = value.slice(1)
                  const hasSpace = afterSlash.includes(" ")
                  if (!hasSpace) {
                    setSlashFilter(afterSlash)
                    setSlashOpen(true)
                    setSlashIndex(0)
                    return
                  }
                }
                setSlashOpen(false)
              }}
              onKeyDown={(event) => {
                if (slashOpen && filteredCommands.length > 0) {
                  if (event.key === "ArrowDown") {
                    event.preventDefault()
                    setSlashIndex((i) => (i + 1) % filteredCommands.length)
                    return
                  }
                  if (event.key === "ArrowUp") {
                    event.preventDefault()
                    setSlashIndex((i) => (i - 1 + filteredCommands.length) % filteredCommands.length)
                    return
                  }
                  if (event.key === "Enter" && !event.shiftKey) {
                    event.preventDefault()
                    handleSlashSelect(filteredCommands[slashIndex] ?? filteredCommands[0])
                    return
                  }
                  if (event.key === "Escape") {
                    event.preventDefault()
                    setSlashOpen(false)
                    return
                  }
                }
                if (event.key === "Enter" && !event.shiftKey) {
                  event.preventDefault()
                  send().catch(() => undefined)
                }
              }}
              onBlur={() => {
                setTimeout(() => setSlashOpen(false), 150)
              }}
              disabled={!selectedSession}
            />
            <div className="composer-buttons">
              <button 
                onClick={send}
                disabled={!selectedSession}
                className="btn-primary"
              >
                <RocketIcon size={18} />
                Send
              </button>
              {isWorking && (
                <button 
                  onClick={abortSession}
                  disabled={!selectedSession}
                  className="btn-danger"
                >
                  <StopIcon size={18} />
                  Cancel
                </button>
              )}
            </div>
          </div>
          
          {runtimeError && <div className="error fade-in">✗ {runtimeError}</div>}
        </main>
      )}

      {view === "help" && (
        <section className="panel help fade-in">
          <h2>
            <HelpIcon size={24} className="icon-inline-heading" />
            Help & Documentation
          </h2>
          <div className="help-tabs" role="tablist">
            <button 
              className={helpPage === "overview" ? "active" : ""} 
              onClick={() => setHelpPage("overview")}
              role="tab"
              aria-selected={helpPage === "overview"}
            >
              Overview
            </button>
            <button 
              className={helpPage === "server" ? "active" : ""} 
              onClick={() => setHelpPage("server")}
              role="tab"
              aria-selected={helpPage === "server"}
            >
              Server
            </button>
            <button 
              className={helpPage === "network" ? "active" : ""} 
              onClick={() => setHelpPage("network")}
              role="tab"
              aria-selected={helpPage === "network"}
            >
              Network
            </button>
            <button 
              className={helpPage === "troubleshooting" ? "active" : ""} 
              onClick={() => setHelpPage("troubleshooting")}
              role="tab"
              aria-selected={helpPage === "troubleshooting"}
            >
              Troubleshooting
            </button>
            <button 
              className={helpPage === "commands" ? "active" : ""} 
              onClick={() => setHelpPage("commands")}
              role="tab"
              aria-selected={helpPage === "commands"}
            >
              Commands
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
    </div>
  )
}

export default App
