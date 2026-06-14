import { useEffect, useMemo, useRef, useState } from "react"
import { api } from "./api"
import { createTranslator, languageOptions, normalizeLanguage, type LanguageCode } from "./i18n"
import type { CommandInfo, DiffFile, FileEntry, FileStatusEntry, MessageEnvelope, ModelOption, ModelSelection, ProjectDashboard, ServerConfig, SessionView, TodoItem } from "./types"
import {
  SettingsIcon,
  FolderIcon,
  ChatIcon,
  HelpIcon,
  PlusIcon,
  PlayIcon,
  TrashIcon,
  StopCircleIcon,
  SendIcon,
  SaveIcon,
  TestIcon,
  LoadingIcon,
  RefreshIcon
} from "./Icons"

const STORAGE_KEY = "opencode.remote.server"
const LANGUAGE_STORAGE_KEY = "opencode.remote.language"
const MODEL_STORAGE_KEY = "opencode.remote.model"
const NEW_SESSION_DIRECTORY_STORAGE_KEY = "opencode.remote.newSessionDirectory"

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

function assistantPayloadLength(items: MessageEnvelope[]): number {
  return items
    .filter((message) => message.info.role !== "user")
    .reduce((sum, message) => sum + extractText(message).length, 0)
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

function toFileStatusList(input: FileStatusEntry[] | Record<string, FileStatusEntry>): FileStatusEntry[] {
  if (Array.isArray(input)) return input
  return Object.entries(input).map(([path, value]) => ({ path, ...value }))
}

function pickString(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value : null
}

function summarizeJson(value: unknown): string {
  if (value === null || value === undefined) return "-"
  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") return String(value)
  return JSON.stringify(value)
}

function configKey(config: ServerConfig): string {
  return JSON.stringify({
    host: config.host.trim(),
    port: config.port,
    username: config.username.trim(),
    password: config.password
  })
}

function canTestConfig(config: ServerConfig): boolean {
  return Boolean(config.host.trim() && config.port > 0 && config.username.trim())
}

function modelKey(model: ModelSelection): string {
  return [model.providerID, model.modelID, model.variant ?? ""].map(encodeURIComponent).join("|")
}

function modelFromKey(value: string | null): ModelSelection | null {
  if (!value) return null
  const [providerID, modelID, variant] = value.split("|").map((part) => decodeURIComponent(part))
  if (!providerID || !modelID) return null
  return { providerID, modelID, variant: variant || undefined }
}

function sameModel(a: ModelSelection | null | undefined, b: ModelSelection | null | undefined): boolean {
  return Boolean(a && b && a.providerID === b.providerID && a.modelID === b.modelID && (a.variant ?? "") === (b.variant ?? ""))
}

function normalizeDirectory(value: string): string | undefined {
  const trimmed = value.trim()
  return trimmed.length > 0 ? trimmed : undefined
}

function formatLimit(value?: number): string {
  if (!value) return "-"
  if (value >= 1_000_000) return `${Math.round(value / 1_000_000)}M`
  if (value >= 1_000) return `${Math.round(value / 1_000)}K`
  return String(value)
}

function createOptimisticUserMessage(sessionID: string, text: string): MessageEnvelope {
  const now = Date.now()
  return {
    info: {
      id: `optimistic-${now}`,
      role: "user",
      sessionID,
      time: { created: now }
    },
    parts: [
      {
        id: `optimistic-part-${now}`,
        type: "text",
        text
      }
    ]
  }
}

function hasMatchingUserMessage(messages: MessageEnvelope[], optimistic: MessageEnvelope): boolean {
  const text = extractText(optimistic)
  return messages.some((message) => (
    message.info.sessionID === optimistic.info.sessionID &&
    message.info.role === "user" &&
    extractText(message) === text
  ))
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
  const [modelOptions, setModelOptions] = useState<ModelOption[]>([])
  const [modelLoadError, setModelLoadError] = useState<string | null>(null)
  const [selectedModelKey, setSelectedModelKey] = useState<string | null>(() => localStorage.getItem(MODEL_STORAGE_KEY))
  const [helpPage, setHelpPage] = useState<"overview" | "server" | "network" | "troubleshooting" | "commands">(
    "overview"
  )
  const [view, setView] = useState<"settings" | "sessions" | "detail" | "help">(() => {
    return config.host && config.port > 0 ? "sessions" : "settings"
  })

  const [sessions, setSessions] = useState<SessionView[]>([])
  const [selectedID, setSelectedID] = useState<string | null>(null)
  const [newSessionDirectory, setNewSessionDirectory] = useState(() => localStorage.getItem(NEW_SESSION_DIRECTORY_STORAGE_KEY) ?? "")
  const [showNewSessionPicker, setShowNewSessionPicker] = useState(false)
  const [pickerPath, setPickerPath] = useState("")
  const [pickerItems, setPickerItems] = useState<FileEntry[]>([])
  const [pickerLoading, setPickerLoading] = useState(false)
  const [pickerError, setPickerError] = useState<string | null>(null)
  const [messages, setMessages] = useState<MessageEnvelope[]>([])
  const [optimisticUserMessages, setOptimisticUserMessages] = useState<MessageEnvelope[]>([])
  const [todos, setTodos] = useState<TodoItem[]>([])
  const [diffFiles, setDiffFiles] = useState<DiffFile[]>([])
  const [selectedDiffFile, setSelectedDiffFile] = useState<string | null>(null)
  const [projectDashboard, setProjectDashboard] = useState<ProjectDashboard | null>(null)
  const [loadingProjectDashboard, setLoadingProjectDashboard] = useState(false)
  const [dashboardError, setDashboardError] = useState<string | null>(null)
  const [todosExpanded, setTodosExpanded] = useState(false)
  const [query, setQuery] = useState("")
  const [composer, setComposer] = useState("")
  const [busySending, setBusySending] = useState(false)
  const [loadingSessionID, setLoadingSessionID] = useState<string | null>(null)
  const [testingConnection, setTestingConnection] = useState(false)
  const [creatingSession, setCreatingSession] = useState(false)
  const [refreshingSessions, setRefreshingSessions] = useState(false)
  const [awaitingAssistantReply, setAwaitingAssistantReply] = useState(false)
  const [settingsNotice, setSettingsNotice] = useState<{ type: NoticeType; text: string } | null>(null)
  const [runtimeError, setRuntimeError] = useState<string | null>(null)
  const [connectionState, setConnectionState] = useState<"idle" | "connecting" | "connected" | "reconnecting" | "offline">(
    config.host && config.port > 0 ? "connecting" : "idle"
  )
  const [connectionMessage, setConnectionMessage] = useState<string>("")
  const [lastTestedConfigKey, setLastTestedConfigKey] = useState<string | null>(null)
  const [sessionToDelete, setSessionToDelete] = useState<SessionView | null>(null)
  const [activeDetailSheet, setActiveDetailSheet] = useState<null | "ai" | "vcs" | "files" | "details">(null)
  const messagesRef = useRef<HTMLDivElement | null>(null)
  const messagesEndRef = useRef<HTMLDivElement | null>(null)
  const composerRef = useRef<HTMLDivElement | null>(null)
  const completionAudioRef = useRef<HTMLAudioElement | null>(null)
  const completionShouldPlayRef = useRef(false)
  const wasAwaitingAssistantReplyRef = useRef(false)
  const wasRunningRef = useRef(false)
  const awaitingAssistantBaselineRef = useRef("")
  const sessionsScrollYRef = useRef(0)
  const loadSelectedRequestRef = useRef(0)
  const backgroundFailureCountRef = useRef(0)
  const initialSessionLoadRef = useRef(true)

  const selectedSession = useMemo(
    () => sessions.find((session) => session.id === selectedID) ?? null,
    [sessions, selectedID]
  )
  const selectedDiff = useMemo(
    () => diffFiles.find((file) => file.file === selectedDiffFile) ?? diffFiles[0] ?? null,
    [diffFiles, selectedDiffFile]
  )
  const projectPath = projectDashboard?.project
    ? pickString(projectDashboard.project.path) || pickString(projectDashboard.project.directory) || pickString(projectDashboard.project.root)
    : null
  const projectName = projectDashboard?.project
    ? pickString(projectDashboard.project.name) || (projectPath ? projectPath.split("/").filter(Boolean).pop() ?? projectPath : null)
    : null
  const vcsBranch = projectDashboard?.vcs
    ? pickString(projectDashboard.vcs.branch) || pickString(projectDashboard.vcs.status) || summarizeJson(projectDashboard.vcs)
    : null
  const selectedModel = useMemo(() => modelFromKey(selectedModelKey), [selectedModelKey])
  const activeModelOption = useMemo(() => {
    if (selectedModel) {
      const explicit = modelOptions.find((option) => sameModel(option, selectedModel))
      if (explicit) return explicit
    }
    if (selectedSession?.model) {
      const current = modelOptions.find((option) => sameModel(option, selectedSession.model))
      if (current) return current
    }
    return modelOptions.find((option) => option.isDefault) ?? modelOptions[0] ?? null
  }, [modelOptions, selectedModel, selectedSession?.model])
  const activeModel = activeModelOption ? { providerID: activeModelOption.providerID, modelID: activeModelOption.modelID, variant: activeModelOption.variant } : selectedModel ?? undefined

  const filteredSessions = useMemo(() => {
    const text = query.trim().toLowerCase()
    if (!text) return sessions
    return sessions.filter((session) => {
      return session.title.toLowerCase().includes(text) || session.directory.toLowerCase().includes(text)
    })
  }, [sessions, query])
  const selectedNewSessionDirectory = normalizeDirectory(newSessionDirectory)

  const renderedMessages = useMemo(() => {
    return [...messages, ...optimisticUserMessages]
      .map((message) => ({ ...message, text: extractText(message) }))
      .filter((message) => message.text)
  }, [messages, optimisticUserMessages])

  const messageScrollSignature = useMemo(() => {
    return renderedMessages.map((message) => `${message.info.id}:${message.text.length}`).join("|")
  }, [renderedMessages])

  const assistantResponseSignature = useMemo(() => {
    return renderedMessages
      .filter((message) => message.info.role !== "user")
      .map((message) => `${message.info.id}:${message.text.length}`)
      .join("|")
  }, [renderedMessages])

  const hasConfiguredServer = Boolean(config.host && config.port > 0)
  const draftConfigKey = configKey(draftConfig)
  const savedConfigKey = configKey(config)
  const hasDraftChanges = draftConfigKey !== savedConfigKey
  const canTestDraft = canTestConfig(draftConfig)
  const testAlreadyPassedForDraft = lastTestedConfigKey === draftConfigKey
  const connectionStatusText = connectionMessage || (connectionState === "connecting"
    ? t('connection.connecting')
    : connectionState === "reconnecting"
      ? t('connection.reconnecting')
      : connectionState === "connected"
        ? t('connection.connected')
        : connectionState === "offline"
          ? t('connection.offline')
          : "")
  const isSessionRunning = Boolean(selectedSession && ["busy", "retry"].includes(selectedSession.status))
  const isWaitingForOpenCodeReply = awaitingAssistantReply || busySending || isSessionRunning
  const isWorking = isWaitingForOpenCodeReply
  const showTypingBubble = Boolean(selectedSession) && isWaitingForOpenCodeReply
  const activeSessions = sessions.filter((session) => ["busy", "retry"].includes(session.status)).length
  const changedSessions = sessions.filter(
    (session) => session.files > 0 || session.additions > 0 || session.deletions > 0
  ).length
  const totalDiffAdditions = diffFiles.reduce((sum, file) => sum + file.additions, 0)
  const totalDiffDeletions = diffFiles.reduce((sum, file) => sum + file.deletions, 0)
  const showModelChip = modelOptions.length > 1 || Boolean(activeModelOption)
  const showVcsChip = Boolean(vcsBranch || loadingProjectDashboard || dashboardError)
  const showFilesChip = diffFiles.length > 0

  async function openSession(sessionID: string, directory: string) {
    sessionsScrollYRef.current = window.scrollY
    setSelectedID(sessionID)
    setMessages([])
    setOptimisticUserMessages([])
    setTodos([])
    setDiffFiles([])
    setSelectedDiffFile(null)
    setProjectDashboard(null)
    setDashboardError(null)
    setAwaitingAssistantReply(false)
    setRuntimeError(null)
    setView("detail")
    setLoadingSessionID(sessionID)
    try {
      await loadSelected(sessionID, directory)
    } catch (err) {
      setRuntimeError((err as Error).message)
    }
    setLoadingSessionID((activeID) => (activeID === sessionID ? null : activeID))
  }

  function saveConfig() {
    setConfig(draftConfig)
    localStorage.setItem(STORAGE_KEY, JSON.stringify(draftConfig))
    setSettingsNotice({ type: "success", text: t('settings.saved') })
    setConnectionState("connecting")
    setConnectionMessage(t('connection.connecting'))
    setRuntimeError(null)
    backgroundFailureCountRef.current = 0
    initialSessionLoadRef.current = true
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
      setLastTestedConfigKey(configKey(configToTest))
      setSettingsNotice({ type: "success", text: t('settings.testedNotSaved', { version: health.version }) })
    } catch (err) {
      setSettingsNotice({ type: "error", text: t('settings.connectionFailed', { message: (err as Error).message }) })
    } finally {
      setTestingConnection(false)
    }
  }

  async function refreshSessions(silent = false) {
    if (!config.host || config.port <= 0) return
    if (!silent) {
      setRuntimeError(null)
      setConnectionState(sessions.length === 0 ? "connecting" : "reconnecting")
      setConnectionMessage(sessions.length === 0 ? t('connection.loadingSessions') : t('connection.refreshing'))
    } else if (initialSessionLoadRef.current && sessions.length === 0) {
      setConnectionState("connecting")
      setConnectionMessage(t('connection.loadingSessions'))
    }
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
          deletions: session.summary?.deletions ?? 0,
          model: session.model ? { providerID: session.model.providerID, modelID: session.model.id, variant: session.model.variant } : undefined
        }))
        .sort((a, b) => b.updated - a.updated)
      setSessions(mapped)
      backgroundFailureCountRef.current = 0
      initialSessionLoadRef.current = false
      setConnectionState("connected")
      setConnectionMessage(t('connection.connected'))
      setRuntimeError(null)
    } catch (err) {
      const message = (err as Error).message
      if (!silent) {
        setConnectionState("offline")
        setConnectionMessage(t('connection.offline'))
        setRuntimeError(message)
        return
      }

      backgroundFailureCountRef.current += 1
      if (backgroundFailureCountRef.current === 1) {
        setConnectionState("reconnecting")
        setConnectionMessage(t('connection.reconnecting'))
        return
      }

      setConnectionState("offline")
      setConnectionMessage(t('connection.offline'))
      if (backgroundFailureCountRef.current >= 3) {
        setRuntimeError(message)
      }
    }
  }

  async function refreshSessionsWithIndicator() {
    if (refreshingSessions) return
    setRefreshingSessions(true)
    try {
      await refreshSessions()
    } finally {
      setRefreshingSessions(false)
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

  async function loadModels() {
    if (!config.host || config.port <= 0) return
    try {
      const list = await api.listModels(config, selectedSession?.directory ?? selectedNewSessionDirectory)
      setModelOptions(list)
      setModelLoadError(null)
      const saved = modelFromKey(selectedModelKey)
      if (saved && list.some((option) => sameModel(option, saved))) return
      const sessionModel = selectedSession?.model
      const sessionOption = sessionModel ? list.find((option) => sameModel(option, sessionModel)) : null
      const fallback = sessionOption ?? list.find((option) => option.isDefault) ?? list[0]
      if (fallback) {
        const nextKey = modelKey(fallback)
        setSelectedModelKey(nextKey)
        localStorage.setItem(MODEL_STORAGE_KEY, nextKey)
      }
    } catch (err) {
      setModelLoadError((err as Error).message)
    }
  }

  function changeModel(nextKey: string) {
    setSelectedModelKey(nextKey)
    localStorage.setItem(MODEL_STORAGE_KEY, nextKey)
  }

  async function loadSelected(sessionID: string, directory: string) {
    const requestID = ++loadSelectedRequestRef.current
    const [msg, todo, diff] = await Promise.all([
      api.loadMessages(config, sessionID, directory),
      api.loadTodo(config, sessionID, directory),
      api.loadDiff(config, sessionID, directory).catch(() => [])
    ])
    if (requestID !== loadSelectedRequestRef.current) return
    setMessages((current) => {
      if (assistantPayloadLength(current) > assistantPayloadLength(msg)) return current
      return msg
    })
    setOptimisticUserMessages((current) => current.filter((message) => !hasMatchingUserMessage(msg, message)))
    setTodos(todo)
    setDiffFiles(diff)
    setSelectedDiffFile((current) => (current && diff.some((file) => file.file === current) ? current : diff[0]?.file ?? null))
    await loadProjectDashboard(directory)
  }

  async function loadProjectDashboard(directory: string) {
    setLoadingProjectDashboard(true)
    setDashboardError(null)
    try {
      const [project, vcs, fileStatus] = await Promise.all([
        api.loadProjectCurrent(config, directory).catch(() => null),
        api.loadVcs(config, directory).catch(() => null),
        api.loadFileStatus(config, directory).catch(() => [])
      ])
      setProjectDashboard({ project, vcs, files: toFileStatusList(fileStatus) })
    } catch (err) {
      setDashboardError((err as Error).message)
    } finally {
      setLoadingProjectDashboard(false)
    }
  }

  function syncChatBottomClearance() {
    const container = messagesRef.current
    const composer = composerRef.current
    if (!container || !composer) return

    const composerRect = composer.getBoundingClientRect()
    const composerStyles = window.getComputedStyle(composer)
    const composerBottom = Number.parseFloat(composerStyles.bottom) || 0
    const clearance = Math.ceil(composerRect.height + composerBottom + 16)
    container.style.setProperty("--chat-bottom-clearance", `${clearance}px`)
  }

  function scrollMessagesToBottom(behavior: ScrollBehavior = "smooth") {
    requestAnimationFrame(() => {
      syncChatBottomClearance()
      requestAnimationFrame(() => {
        const container = messagesRef.current
        const end = messagesEndRef.current
        if (container) {
          container.scrollTo({ top: container.scrollHeight, behavior })
        }
        end?.scrollIntoView({ block: "end", behavior })

        const composerRect = composerRef.current?.getBoundingClientRect()
        const endRect = end?.getBoundingClientRect()
        if (composerRect && endRect && endRect.bottom > composerRect.top - 12) {
          const coveredByComposer = endRect.bottom - composerRect.top + 12
          window.scrollBy({ top: coveredByComposer, behavior })
        }
      })
    })
  }

  async function browseNewSessionDirectory(path: string) {
    setPickerLoading(true)
    setPickerError(null)
    try {
      const items = await api.listFiles(config, path, path)
      setPickerPath(path)
      setPickerItems(items.filter((item) => item.type === "directory").sort((a, b) => a.name.localeCompare(b.name)))
    } catch (err) {
      setPickerError((err as Error).message)
      setPickerItems([])
    } finally {
      setPickerLoading(false)
    }
  }

  async function openNewSessionPicker() {
    if (creatingSession) return
    setRuntimeError(null)
    setShowNewSessionPicker(true)
    setPickerError(null)
    try {
      const pathInfo = await api.loadPath(config, selectedNewSessionDirectory)
      await browseNewSessionDirectory(selectedNewSessionDirectory ?? pathInfo.directory)
    } catch (err) {
      setPickerError((err as Error).message)
    }
  }

  function parentDirectory(path: string): string | null {
    if (!path || path === "/") return null
    const normalized = path.replace(/[/\\]+$/, "")
    const separator = normalized.includes("\\") ? "\\" : "/"
    const index = normalized.lastIndexOf(separator)
    if (index <= 0) return separator === "/" ? "/" : null
    return normalized.slice(0, index)
  }

  async function createSession(directory = selectedNewSessionDirectory) {
    if (creatingSession) return
    setCreatingSession(true)
    setRuntimeError(null)
    try {
      const created = await api.createSession(config, "Mobile session", activeModel, directory)
      if (directory) {
        setNewSessionDirectory(directory)
      }
      setShowNewSessionPicker(false)
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
    const optimisticMessage = createOptimisticUserMessage(selectedSession.id, text)
    setOptimisticUserMessages((current) => [...current, optimisticMessage])
    awaitingAssistantBaselineRef.current = assistantResponseSignature
    completionShouldPlayRef.current = true
    setAwaitingAssistantReply(true)
    scrollMessagesToBottom("smooth")

    setBusySending(true)
    setRuntimeError(null)
    try {
      if (text.startsWith("/")) {
        const normalized = text.startsWith("/") ? text.slice(1) : text
        const command = normalized.split(" ")[0]?.trim()
        const args = normalized.slice(command.length).trim()
        if (!command) return
        await api.sendCommand(config, selectedSession.id, command, args, selectedSession.directory, activeModel)
        await loadSelected(selectedSession.id, selectedSession.directory)
        setOptimisticUserMessages((current) => current.filter((message) => message.info.id !== optimisticMessage.info.id))
      } else {
        await api.sendPrompt(config, selectedSession.id, text, selectedSession.directory, activeModel)
        await loadSelected(selectedSession.id, selectedSession.directory)
      }
      await refreshSessions()
    } catch (err) {
      completionShouldPlayRef.current = false
      setAwaitingAssistantReply(false)
      setOptimisticUserMessages((current) => current.filter((message) => message.info.id !== optimisticMessage.info.id))
      setComposer((current) => current || text)
      setRuntimeError((err as Error).message)
    } finally {
      setBusySending(false)
    }
  }

  async function deleteSession(sessionID: string) {
    try {
      await api.deleteSession(config, sessionID, sessionToDelete?.directory)
      if (selectedID === sessionID) {
        setSelectedID(null)
        setMessages([])
        setOptimisticUserMessages([])
        setTodos([])
        setDiffFiles([])
        setSelectedDiffFile(null)
        setProjectDashboard(null)
        setDashboardError(null)
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
      await api.abort(config, selectedSession.id, selectedSession.directory)
      completionShouldPlayRef.current = false
      setAwaitingAssistantReply(false)
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
    localStorage.setItem(NEW_SESSION_DIRECTORY_STORAGE_KEY, newSessionDirectory)
  }, [newSessionDirectory])

  useEffect(() => {
    if (!config.host || config.port <= 0) {
      setConnectionState("idle")
      setConnectionMessage("")
      return
    }
    setConnectionState("connecting")
    setConnectionMessage(t('connection.connecting'))
    backgroundFailureCountRef.current = 0
    initialSessionLoadRef.current = true
    refreshSessions(true).catch(() => undefined)
    loadCommands().catch(() => undefined)
    loadModels().catch(() => undefined)
    const timer = setInterval(() => {
      refreshSessions(true).catch(() => undefined)
      if (selectedSession) {
        loadSelected(selectedSession.id, selectedSession.directory).catch(() => undefined)
      }
    }, 3500)
    return () => clearInterval(timer)
  }, [config.host, config.port, config.username, config.password, selectedSession?.id, selectedNewSessionDirectory])

  useEffect(() => {
    if (!hasConfiguredServer) {
      setView("settings")
    }
  }, [hasConfiguredServer])

  useEffect(() => {
    if (view !== "detail") return
    scrollMessagesToBottom("auto")
  }, [view, messageScrollSignature, isWorking, showTypingBubble])

  useEffect(() => {
    if (!awaitingAssistantReply) return
    if (assistantResponseSignature && assistantResponseSignature !== awaitingAssistantBaselineRef.current) {
      setAwaitingAssistantReply(false)
    }
  }, [assistantResponseSignature, awaitingAssistantReply])

  useEffect(() => {
    completionAudioRef.current = new Audio("/audio/staplebops-01.aac")
    completionAudioRef.current.preload = "auto"
  }, [])

  useEffect(() => {
    if (wasAwaitingAssistantReplyRef.current && !awaitingAssistantReply && completionShouldPlayRef.current) {
      completionShouldPlayRef.current = false
      const audio = completionAudioRef.current
      if (audio) {
        audio.currentTime = 0
        audio.play().catch(() => undefined)
      }
    }
    wasAwaitingAssistantReplyRef.current = awaitingAssistantReply
  }, [awaitingAssistantReply])

  useEffect(() => {
    if (!selectedSession) {
      wasRunningRef.current = false
      return
    }
    wasRunningRef.current = ["busy", "retry"].includes(selectedSession.status)
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
              <p className="subtle">{t('settings.draftHint')}</p>
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
              disabled={testingConnection || !hasDraftChanges}
              className="btn-primary"
            >
              <SaveIcon size={18} />
              {hasDraftChanges ? t('settings.save') : t('settings.savedButton')}
            </button>
            <button 
              onClick={() => testConnection(draftConfig)} 
              className="btn-secondary"
              disabled={testingConnection || !canTestDraft || testAlreadyPassedForDraft}
              title={!canTestDraft ? t('settings.testNeedsFields') : testAlreadyPassedForDraft ? t('settings.testAlreadyPassed') : undefined}
            >
              {testingConnection ? (
                <>
                  <LoadingIcon size={18} />
                  {t('settings.testing')}
                </>
              ) : (
                <>
                  <TestIcon size={18} />
                  {testAlreadyPassedForDraft ? t('settings.testOk') : t('settings.test')}
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
          
          <div className="connection-help">
            <span>{canTestDraft ? t('settings.readyToTest') : t('settings.testNeedsFields')}</span>
            <span>{hasDraftChanges ? t('settings.unsavedChanges') : t('settings.noUnsavedChanges')}</span>
          </div>

          {connectedVersion && testAlreadyPassedForDraft && (
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
              {connectionStatusText && (
                <p className={`connection-status ${connectionState}`}>
                  {['connecting', 'reconnecting'].includes(connectionState) && <LoadingIcon size={14} />}
                  {connectionStatusText}
                </p>
              )}
            </div>
            <div className="inline-actions">
              <button onClick={refreshSessionsWithIndicator} className="btn-secondary" disabled={refreshingSessions}>
                {refreshingSessions ? <LoadingIcon size={18} /> : <RefreshIcon size={18} />}
                {t('sessions.refresh')}
              </button>
              <button onClick={openNewSessionPicker} className="btn-primary" disabled={creatingSession}>
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
            {filteredSessions.length === 0 && ['connecting', 'reconnecting'].includes(connectionState) ? (
              <div className="empty-state connection-pending">
                <LoadingIcon size={40} className="icon-empty-state" />
                <p>{t('sessions.loadingTitle')}</p>
                <p className="subtle">{t('sessions.loadingHint')}</p>
              </div>
            ) : filteredSessions.length === 0 ? (
              <div className="empty-state">
                <FolderIcon size={48} className="icon-empty-state" />
                <p>{t('sessions.emptyTitle')}</p>
                <p className="subtle">{connectionState === "offline" ? t('sessions.offlineHint') : t('sessions.emptyHint')}</p>
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

      {showNewSessionPicker && (
        <div className="modal-backdrop" role="presentation" onClick={() => setShowNewSessionPicker(false)}>
          <section
            className="modal-card folder-picker fade-in"
            role="dialog"
            aria-modal="true"
            aria-labelledby="new-session-title"
            onClick={(event) => event.stopPropagation()}
          >
            <h2 id="new-session-title">{t('sessions.newSessionTitle')}</h2>
            <p className="subtle">{t('sessions.projectDirectoryDefault')}</p>
            <div className="folder-picker-current">
              <span>{t('sessions.projectDirectoryLabel')}</span>
              <strong>{pickerPath || t('detail.loadingProject')}</strong>
            </div>
            <div className="inline-actions">
              <button type="button" className="btn-secondary" onClick={() => createSession("").catch(() => undefined)} disabled={creatingSession}>
                {t('sessions.useServerDefault')}
              </button>
              <button type="button" className="btn-primary" onClick={() => createSession(pickerPath).catch(() => undefined)} disabled={creatingSession || !pickerPath}>
                {creatingSession ? <LoadingIcon size={16} /> : <PlusIcon size={16} />}
                {t('sessions.useThisFolder')}
              </button>
            </div>
            {pickerError && <div className="error fade-in">✗ {pickerError}</div>}
            <div className="folder-list">
              {pickerLoading ? (
                <div className="empty-state compact"><LoadingIcon size={28} /><p>{t('sessions.folderPickerLoading')}</p></div>
              ) : (
                <>
                  {parentDirectory(pickerPath) && (
                    <button type="button" className="folder-row" onClick={() => browseNewSessionDirectory(parentDirectory(pickerPath) ?? pickerPath).catch(() => undefined)}>
                      <FolderIcon size={16} />
                      <span>{t('sessions.parentFolder')}</span>
                    </button>
                  )}
                  {pickerItems.length === 0 ? (
                    <p className="subtle">{t('sessions.folderPickerEmpty')}</p>
                  ) : pickerItems.map((item) => (
                    <button key={item.absolute} type="button" className="folder-row" onClick={() => browseNewSessionDirectory(item.absolute).catch(() => undefined)}>
                      <FolderIcon size={16} />
                      <span>{item.name}</span>
                    </button>
                  ))}
                </>
              )}
            </div>
            <div className="modal-actions">
              <button className="btn-secondary" onClick={() => setShowNewSessionPicker(false)}>
                {t('session.cancel')}
              </button>
            </div>
          </section>
        </div>
      )}

      {view === "detail" && (
        <main className="panel detail fade-in">
          <div className="detail-topbar">
            <button className="btn-secondary" onClick={() => { setView("sessions"); requestAnimationFrame(() => window.scrollTo({ top: sessionsScrollYRef.current })) }}>{t('detail.backToSessions')}</button>
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

          {selectedSession && (
            <section className="session-context-strip" aria-label={t('detail.contextStripLabel')}>
              {showModelChip && (
                <button type="button" className="context-chip" onClick={() => setActiveDetailSheet("ai")}>
                  <span>{t('detail.aiChip')}</span>
                  <strong>{activeModelOption?.modelName ?? t('detail.modelLoading')}</strong>
                </button>
              )}
              {showVcsChip && (
                <button type="button" className="context-chip" onClick={() => setActiveDetailSheet("vcs")}>
                  <span>{t('detail.vcsLabel')}</span>
                  <strong>{loadingProjectDashboard ? t('detail.loadingProject') : vcsBranch || t('detail.unavailable')}</strong>
                </button>
              )}
              {showFilesChip && (
                <button type="button" className="context-chip" onClick={() => setActiveDetailSheet("files")}>
                  <span>{t('detail.filesChip')}</span>
                  <strong>{t('detail.filesCount', { count: diffFiles.length })}</strong>
                  <small><span className="positive">+{totalDiffAdditions}</span> <span className="negative">-{totalDiffDeletions}</span></small>
                </button>
              )}
              <button type="button" className="context-chip ghost" onClick={() => setActiveDetailSheet("details")}>
                <span>{t('detail.detailsChip')}</span>
                <strong>{projectName || t('detail.projectLabel')}</strong>
              </button>
            </section>
          )}

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

          <div className="messages-wrap">
            <div className="messages" ref={messagesRef}>
            {loadingSessionID === selectedID ? (
              <div className="empty-state compact">
                <LoadingIcon size={32} />
                <p>{t('detail.loading')}</p>
              </div>
            ) : renderedMessages.length === 0 && !showTypingBubble ? (
              <div className="empty-state compact">
                <ChatIcon size={40} className="icon-empty-state" />
                <p>{t('detail.emptyTitle')}</p>
                <p className="subtle">{t('detail.emptyHint')}</p>
              </div>
            ) : (
              <>
                {renderedMessages.map((message) => {
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
                })}
                {showTypingBubble && (
                  <article className="message assistant typing-bubble fade-in" aria-label={t('detail.waiting')}>
                    <div className="typing-dots" aria-hidden="true">
                      <span className="typing-dot" />
                      <span className="typing-dot" />
                      <span className="typing-dot" />
                    </div>
                  </article>
                )}
                <div ref={messagesEndRef} className="messages-end" aria-hidden="true" />
              </>
            )}
            </div>
          </div>

          <div className="composer" ref={composerRef}>
            <textarea
              value={composer}
              onChange={(event) => setComposer(event.target.value)}
              placeholder={t('detail.composerPlaceholder')}
              onFocus={() => {
                syncChatBottomClearance()
                setTimeout(() => scrollMessagesToBottom("smooth"), 400)
                const onResize = () => {
                  scrollMessagesToBottom("smooth")
                  window.removeEventListener("resize", onResize)
                }
                window.addEventListener("resize", onResize, { once: true })
              }}
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
                  <StopCircleIcon size={18} />
                  {t('detail.waiting')}
                </>
              ) : (
                <>
                  <SendIcon size={18} />
                  {t('detail.send')}
                </>
              )}
            </button>
          </div>
          
          {runtimeError && <div className="error fade-in">✗ {runtimeError}</div>}
        </main>
      )}

      {activeDetailSheet && selectedSession && (
        <div className="sheet-backdrop" role="presentation" onClick={() => setActiveDetailSheet(null)}>
          <section
            className="bottom-sheet fade-in"
            role="dialog"
            aria-modal="true"
            aria-labelledby="detail-sheet-title"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="sheet-handle" aria-hidden="true" />
            <div className="sheet-header">
              <div>
                <h3 id="detail-sheet-title">
                  {activeDetailSheet === "ai" && t('detail.modelTitle')}
                  {activeDetailSheet === "vcs" && t('detail.vcsLabel')}
                  {activeDetailSheet === "files" && t('detail.changedFilesTitle')}
                  {activeDetailSheet === "details" && t('detail.sessionDetailsTitle')}
                </h3>
                <p className="subtle">
                  {activeDetailSheet === "ai" && t('detail.modelHint')}
                  {activeDetailSheet === "vcs" && (projectPath || selectedSession.directory)}
                  {activeDetailSheet === "files" && t('detail.changedFilesHint')}
                  {activeDetailSheet === "details" && t('detail.sessionDetailsHint')}
                </p>
              </div>
              <button type="button" className="btn-secondary compact" onClick={() => setActiveDetailSheet(null)}>
                {t('detail.closeSheet')}
              </button>
            </div>

            {activeDetailSheet === "ai" && (
              <div className="sheet-content">
                <button type="button" className="btn-secondary" onClick={() => loadModels().catch(() => undefined)}>
                  <RefreshIcon size={16} />
                  {t('detail.refreshModels')}
                </button>
                {modelOptions.length > 0 ? (
                  <div className="model-controls">
                    <label htmlFor="model-select">
                      {t('detail.modelSelectLabel')}
                      <select
                        id="model-select"
                        value={activeModelOption ? modelKey(activeModelOption) : selectedModelKey ?? ""}
                        onChange={(event) => changeModel(event.target.value)}
                        disabled={isWorking}
                      >
                        {modelOptions.map((option) => (
                          <option key={modelKey(option)} value={modelKey(option)}>
                            {option.modelName} · {option.providerName}{option.variant ? ` · ${option.variant}` : ""}{option.isDefault ? ` · ${t('detail.modelDefault')}` : ""}
                          </option>
                        ))}
                      </select>
                    </label>
                    {activeModelOption && (
                      <div className="model-meta">
                        <span>{t('detail.modelProvider', { provider: activeModelOption.providerName })}</span>
                        <span>{t('detail.modelContext', { context: formatLimit(activeModelOption.contextLimit), output: formatLimit(activeModelOption.outputLimit) })}</span>
                        <span>{activeModelOption.tools ? t('detail.modelToolsYes') : t('detail.modelToolsNo')}</span>
                        {activeModelOption.variant && <span>{t('detail.modelVariant', { variant: activeModelOption.variant })}</span>}
                      </div>
                    )}
                  </div>
                ) : (
                  <p className="subtle">{modelLoadError ? t('detail.modelLoadError', { message: modelLoadError }) : t('detail.modelLoading')}</p>
                )}
              </div>
            )}

            {activeDetailSheet === "vcs" && (
              <div className="sheet-content project-dashboard single-column">
                <div className="dashboard-card">
                  <span className="dashboard-label">{t('detail.projectLabel')}</span>
                  <strong>{projectName || selectedSession.directory}</strong>
                  <small>{projectPath || selectedSession.directory}</small>
                </div>
                <div className="dashboard-card">
                  <span className="dashboard-label">{t('detail.vcsLabel')}</span>
                  <strong>{loadingProjectDashboard ? t('detail.loadingProject') : vcsBranch || t('detail.unavailable')}</strong>
                  {projectDashboard?.vcs && (
                    <small>{t('detail.aheadBehind', { ahead: projectDashboard.vcs.ahead ?? 0, behind: projectDashboard.vcs.behind ?? 0 })}</small>
                  )}
                </div>
              </div>
            )}

            {activeDetailSheet === "files" && (
              <div className="sheet-content">
                <span className="change-summary">
                  <strong>{t('detail.filesCount', { count: diffFiles.length })}</strong>
                  <strong className="positive">+{totalDiffAdditions}</strong>
                  <strong className="negative">-{totalDiffDeletions}</strong>
                </span>
                <div className="diff-file-list">
                  {diffFiles.map((file) => (
                    <button
                      type="button"
                      key={file.file}
                      className={selectedDiff?.file === file.file ? "diff-file active" : "diff-file"}
                      onClick={() => setSelectedDiffFile(file.file)}
                    >
                      <span>{file.file}</span>
                      <span>
                        <strong className="positive">+{file.additions}</strong>{" "}
                        <strong className="negative">-{file.deletions}</strong>
                      </span>
                    </button>
                  ))}
                </div>
                {selectedDiff && (
                  <div className="mini-diff-card">
                    <strong>{selectedDiff.file}</strong>
                    <div className="mini-diff-bars" aria-hidden="true">
                      <span className="mini-diff-add" style={{ flexGrow: Math.max(selectedDiff.additions, 1) }} />
                      <span className="mini-diff-del" style={{ flexGrow: Math.max(selectedDiff.deletions, 1) }} />
                    </div>
                    <p className="subtle">{t('detail.linesAddedDeleted', { additions: selectedDiff.additions, deletions: selectedDiff.deletions })}</p>
                  </div>
                )}
              </div>
            )}

            {activeDetailSheet === "details" && (
              <div className="sheet-content project-dashboard single-column">
                <div className="dashboard-card">
                  <span className="dashboard-label">{t('detail.projectLabel')}</span>
                  <strong>{projectName || selectedSession.directory}</strong>
                  <small>{projectPath || selectedSession.directory}</small>
                </div>
                <div className="dashboard-card">
                  <span className="dashboard-label">{t('detail.fileStatusLabel')}</span>
                  <strong>{projectDashboard?.files.length ?? 0}</strong>
                  <small>{dashboardError ? t('detail.dashboardError', { message: dashboardError }) : t('detail.fileStatusSource')}</small>
                </div>
                <div className="dashboard-card">
                  <span className="dashboard-label">{t('detail.modelTitle')}</span>
                  <strong>{activeModelOption?.modelName ?? t('detail.modelLoading')}</strong>
                  <small>{activeModelOption?.providerName ?? "-"}</small>
                </div>
              </div>
            )}
          </section>
        </div>
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
