import { useCallback, useEffect, useMemo, useState } from "react"
import type { AgentInfo, CommandInfo, DiffFile, McpServer, MessageEnvelope, Project, ProviderInfo, QuestionRequest, ServerConfig, SessionView, TodoItem } from "../types"
import { api } from "../api"
import {
  extractText,
  extractToolParts,
  extractSubtaskParts,
  extractReasoningParts,
  extractFileParts,
  extractStepStartParts,
  extractStepFinishParts,
  extractPatchParts,
  extractAgentParts,
  extractRetryParts,
  extractCompactionParts
} from "../components/message/messageHelpers"

const BUILTIN_COMMANDS: CommandInfo[] = [
  { name: "new",     description: "New session" },
  { name: "model",   description: "Switch model" },
  { name: "agent",   description: "Switch agent" },
  { name: "compact", description: "Compact context" },
  { name: "fork",    description: "Fork session" },
  { name: "undo",    description: "Undo last message" },
  { name: "redo",    description: "Redo last message" },
  { name: "mcp",     description: "MCP tools" },
]

export type NoticeType = "info" | "success" | "error"

export function useServerData(config: ServerConfig) {
  const [sessions, setSessions] = useState<SessionView[]>([])
  const [selectedID, setSelectedID] = useState<string | null>(null)
  const [messages, setMessages] = useState<MessageEnvelope[]>([])
  const [todos, setTodos] = useState<TodoItem[]>([])
  const [todosExpanded, setTodosExpanded] = useState(false)
  const [query, setQuery] = useState("")
  const [newSessionFolder, setNewSessionFolder] = useState("")
  const [loadingSessionID, setLoadingSessionID] = useState<string | null>(null)
  const [runtimeError, setRuntimeError] = useState<string | null>(null)
  const [toast, setToast] = useState<{ type: NoticeType; text: string } | null>(null)
  const [commands, setCommands] = useState<CommandInfo[]>(BUILTIN_COMMANDS)
  const [agents, setAgents] = useState<AgentInfo[]>([])
  const [currentAgent, setCurrentAgent] = useState<string | null>(null)
  const [providers, setProviders] = useState<ProviderInfo[]>([])
  const [connectedProviderIDs, setConnectedProviderIDs] = useState<string[]>([])
  const [currentVariant, setCurrentVariant] = useState<string | null>(null)
  const [serverDirectory, setServerDirectory] = useState<string>("")
  const [projects, setProjects] = useState<Project[]>([])
  const [mcpServers, setMcpServers] = useState<Record<string, McpServer>>({})
  const [diff, setDiff] = useState<DiffFile[]>([])
  const [questions, setQuestions] = useState<QuestionRequest[]>([])

  // ── Derived values ──────────────────────────────────────────────

  const selectedSession = useMemo(
    () => sessions.find((session) => session.id === selectedID) ?? null,
    [sessions, selectedID]
  )

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

  const primaryAgents = useMemo(
    () => agents.filter((a) => (a.mode === "primary" || a.mode === "all") && !a.hidden),
    [agents]
  )

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

  // Clear variant when the current variant is no longer available
  useEffect(() => {
    if (currentVariant && !availableVariants.includes(currentVariant)) {
      setCurrentVariant(null)
    }
  }, [availableVariants, currentVariant])

  // ── Data-loading functions ──────────────────────────────────────

  const refreshSessions = useCallback(async (silent = false) => {
    if (!config.host || !config.password) return
    if (!silent) setRuntimeError(null)
    try {
      const [items, statuses] = await Promise.all([api.listSessions(config), api.listStatuses(config)])
      const mapped = items
        .map((session) => ({
          id: session.id,
          title: session.title,
          directory: session.directory,
          projectID: session.projectID,
          parentID: session.parentID,
          updated: session.time.updated,
          status: statuses[session.id]?.type ?? "idle",
          statusMessage: statuses[session.id]?.message,
          requestID: statuses[session.id]?.requestID,
          cost: session.cost,
          agent: session.agent,
          files: session.summary?.files ?? 0,
          additions: session.summary?.additions ?? 0,
          deletions: session.summary?.deletions ?? 0
        }))
        .sort((a, b) => b.updated - a.updated)
      setSessions(mapped)
      setRuntimeError(null)
    } catch (err) {
      setRuntimeError((err as Error).message)
    }
  }, [config])

  const loadCommands = useCallback(async () => {
    if (!config.host || !config.password) return
    try {
      const list = await api.listCommands(config)
      const serverNames = new Set(list.map((c) => c.name))
      setCommands([...BUILTIN_COMMANDS.filter((c) => !serverNames.has(c.name)), ...list])
    } catch {
      setCommands(BUILTIN_COMMANDS)
    }
  }, [config])

  const loadAgents = useCallback(async () => {
    if (!config.host || !config.password) return
    try {
      const list = await api.listAgents(config)
      setAgents(list)
    } catch {
      setAgents([])
    }
  }, [config])

  const loadProviders = useCallback(async () => {
    if (!config.host || !config.password) return
    try {
      const resp = await api.listProviders(config)
      setProviders(resp.all)
      setConnectedProviderIDs(resp.connected ?? [])
    } catch {
      setProviders([])
      setConnectedProviderIDs([])
    }
  }, [config])

  const loadPath = useCallback(async () => {
    if (!config.host || !config.password) return
    try {
      const resp = await api.getPath(config)
      setServerDirectory(resp.directory)
    } catch {
      setServerDirectory("")
    }
  }, [config])

  const loadProjects = useCallback(async () => {
    if (!config.host || !config.password) return
    try {
      const list = await api.listProjects(config)
      setProjects(list)
    } catch {
      setProjects([])
    }
  }, [config])

  const loadMcp = useCallback(async () => {
    if (!config.host || !config.password) return
    try {
      const result = await api.listMcp(config)
      setMcpServers(result)
    } catch {
      setMcpServers({})
    }
  }, [config])

  const loadQuestions = useCallback(async () => {
    if (!config.host || !config.password) return
    try {
      const list = await api.listQuestions(config)
      setQuestions(list)
    } catch {
      setQuestions([])
    }
  }, [config])

  const loadSelected = useCallback(async (sessionID: string, directory: string) => {
    try {
      const [msg, todo, diffFiles] = await Promise.all([
        api.loadMessages(config, sessionID, directory),
        api.loadTodo(config, sessionID),
        api.loadDiff(config, sessionID).catch(() => [] as DiffFile[])
      ])
      setMessages(msg)
      setTodos(todo)
      setDiff(diffFiles)
      const lastUser = [...msg].reverse().find((m) => m.info.role === "user")
      const agent = lastUser?.info?.agent
      if (agent) {
        setCurrentAgent((prev) => prev ?? agent)
      }
    } catch (err) {
      setRuntimeError((err as Error).message)
    }
  }, [config])

  // ── Session management functions ────────────────────────────────

  const createSession = useCallback(async (directory?: string) => {
    const folder = (directory ?? newSessionFolder).trim()
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
  }, [config, newSessionFolder, refreshSessions, loadSelected])

  const deleteSession = useCallback(async (sessionID: string) => {
    try {
      await api.deleteSession(config, sessionID)
      if (selectedID === sessionID) {
        setSelectedID(null)
        setMessages([])
        setTodos([])
        setDiff([])
      }
      await refreshSessions(true)
    } catch (err) {
      setRuntimeError((err as Error).message)
    }
  }, [config, selectedID, refreshSessions])

  const forkSession = useCallback(async (sessionID: string): Promise<string | null> => {
    try {
      const forked = await api.forkSession(config, sessionID)
      await refreshSessions(true)
      setToast({ type: "success", text: `Forked as "${forked.title}"` })
      return forked.id
    } catch (err) {
      const message = (err as Error).message
      setToast({ type: "error", text: message })
      return null
    }
  }, [config, refreshSessions])

  const renameSession = useCallback(async (sessionID: string, title: string) => {
    try {
      await api.renameSession(config, sessionID, title)
      await refreshSessions(true)
    } catch (err) {
      setToast({ type: "error", text: (err as Error).message })
    }
  }, [config, refreshSessions])

  // ── Effects ─────────────────────────────────────────────────────

  // Polling: initial load + periodic refresh
  useEffect(() => {
    if (!config.host || !config.password) return
    refreshSessions(true).catch(() => undefined)
    loadCommands().catch(() => undefined)
    loadAgents().catch(() => undefined)
    loadProviders().catch(() => undefined)
    loadPath().catch(() => undefined)
    loadProjects().catch(() => undefined)
    loadMcp().catch(() => undefined)
    loadQuestions().catch(() => undefined)
    const timer = setInterval(() => {
      refreshSessions(true).catch(() => undefined)
      loadQuestions().catch(() => undefined)
      if (selectedSession) {
        loadSelected(selectedSession.id, selectedSession.directory).catch(() => undefined)
      }
    }, 3500)
    return () => clearInterval(timer)
  }, [config.host, config.password, selectedSession?.id])

  // Toast auto-dismiss
  useEffect(() => {
    if (!toast) return
    const timer = setTimeout(() => setToast(null), 4000)
    return () => clearTimeout(timer)
  }, [toast])

  // ── Return ──────────────────────────────────────────────────────

  return {
    sessions,
    setSessions,
    selectedID,
    setSelectedID,
    messages,
    setMessages,
    todos,
    setTodos,
    todosExpanded,
    setTodosExpanded,
    query,
    setQuery,
    newSessionFolder,
    setNewSessionFolder,
    loadingSessionID,
    setLoadingSessionID,
    runtimeError,
    setRuntimeError,
    toast,
    setToast,
    commands,
    setCommands,
    agents,
    setAgents,
    currentAgent,
    setCurrentAgent,
    providers,
    setProviders,
    connectedProviderIDs,
    setConnectedProviderIDs,
    currentVariant,
    setCurrentVariant,
    serverDirectory,
    setServerDirectory,
    projects,
    mcpServers,
    diff,
    questions,
    selectedSession,
    renderedMessages,
    primaryAgents,
    sessionInfo,
    availableVariants,
    refreshSessions,
    loadCommands,
    loadAgents,
    loadProviders,
    loadPath,
    loadProjects,
    loadMcp,
    loadSelected,
    createSession,
    deleteSession,
    forkSession,
    renameSession
  }
}
