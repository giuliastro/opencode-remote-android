import { useEffect, useMemo, useRef, useState } from "react"
import type { CommandInfo, MessageEnvelope, ServerConfig, SessionView } from "../types"
import { api } from "../api"

export function useChat(params: {
  config: ServerConfig
  selectedSession: SessionView | null
  messages: MessageEnvelope[]
  commands: CommandInfo[]
  currentAgent: string | null
  setCurrentAgent: (agent: string | null) => void
  currentVariant: string | null
  setCurrentVariant: (variant: string | null) => void
  loadSelected: (id: string, dir: string) => Promise<void>
  refreshSessions: () => Promise<void>
  createSession: () => Promise<void>
  setMessages: React.Dispatch<React.SetStateAction<MessageEnvelope[]>>
  setRuntimeError: (err: string | null) => void
  prefs: { sound: boolean; autoScroll: boolean }
}) {
  const {
    config,
    selectedSession,
    messages,
    commands,
    currentAgent,
    setCurrentAgent,
    currentVariant,
    setCurrentVariant,
    loadSelected,
    refreshSessions,
    createSession,
    setMessages,
    setRuntimeError,
    prefs
  } = params

  // ── State ───────────────────────────────────────────────────────

  const [composer, setComposer] = useState("")
  const [busySending, setBusySending] = useState(false)
  const [slashOpen, setSlashOpen] = useState(false)
  const [slashFilter, setSlashFilter] = useState("")
  const [slashIndex, setSlashIndex] = useState(0)

  // ── Refs ────────────────────────────────────────────────────────

  const messagesRef = useRef<HTMLDivElement | null>(null)
  const textareaRef = useRef<HTMLTextAreaElement | null>(null)
  const completionAudioRef = useRef<HTMLAudioElement | null>(null)
  const wasRunningRef = useRef(false)

  // ── Derived ─────────────────────────────────────────────────────

  const filteredCommands = useMemo(() => {
    if (!slashOpen) return []
    const filter = slashFilter.toLowerCase()
    return commands.filter((cmd) => cmd.name.toLowerCase().includes(filter))
  }, [commands, slashFilter, slashOpen])

  // ── Actions ─────────────────────────────────────────────────────

  async function replyPermission(requestID: string, reply: "once" | "always" | "reject") {
    if (!selectedSession) return
    try {
      setRuntimeError(null)
      await api.replyPermission(config, requestID, selectedSession.directory, reply)
      await refreshSessions()
      await loadSelected(selectedSession.id, selectedSession.directory)
    } catch (err) {
      setRuntimeError((err as Error).message)
    }
  }

  async function replyQuestion(requestID: string, directory: string, answers: string[][]) {
    if (!selectedSession) return
    try {
      setRuntimeError(null)
      await api.replyQuestion(config, requestID, directory, answers)
      await refreshSessions()
      await loadSelected(selectedSession.id, selectedSession.directory)
    } catch (err) {
      setRuntimeError((err as Error).message)
    }
  }

  async function rejectQuestion(requestID: string) {
    if (!selectedSession) return
    try {
      setRuntimeError(null)
      await api.rejectQuestion(config, requestID)
      await refreshSessions()
      await loadSelected(selectedSession.id, selectedSession.directory)
    } catch (err) {
      setRuntimeError((err as Error).message)
    }
  }

  async function send() {
    if (!selectedSession) return
    const text = composer.trim()
    if (!text) return
    setComposer("")
    setSlashOpen(false)
    if (textareaRef.current) textareaRef.current.style.height = "auto"

    // If awaiting a question reply, route through the question endpoint.
    // Covers both "question" (specific) and "ask" (generic) when a requestID is present.
    // "permission" is handled by buttons only — user shouldn't be typing.
    const isQuestionState = (selectedSession.status === "question" || selectedSession.status === "ask") && selectedSession.requestID
    if (isQuestionState) {
      await replyQuestion(selectedSession.requestID!, selectedSession.directory, [[text]])
      return
    }

    setBusySending(true)
    setRuntimeError(null)
    try {
      if (text.startsWith("/")) {
        const normalized = text.slice(1).trim()
        const spaceIdx = normalized.indexOf(" ")
        const command = spaceIdx === -1 ? normalized : normalized.slice(0, spaceIdx)
        const args = spaceIdx === -1 ? "" : normalized.slice(spaceIdx + 1).trim()
        if (!command) return
        if (command === "new") {
          setBusySending(false)
          await createSession()
          return
        }
        const reply = await api.sendCommand(
          config,
          selectedSession.id,
          command,
          args,
          selectedSession.directory,
          currentAgent ?? undefined,
          currentVariant ?? undefined
        )
        if (reply && reply.info) {
          if (reply.info.agent) setCurrentAgent(reply.info.agent)
          setMessages((prev) => [...prev, reply])
        }
      } else {
        const reply = await api.sendPrompt(
          config,
          selectedSession.id,
          text,
          selectedSession.directory,
          currentAgent ?? undefined,
          currentVariant ?? undefined
        )
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

  function selectAgent(agent: string) {
    setCurrentAgent(agent)
  }

  function selectVariant(variant: string | null) {
    setCurrentVariant(variant)
  }

  async function selectModel(modelID: string) {
    if (!selectedSession) return
    try {
      setRuntimeError(null)
      const reply = await api.sendCommand(
        config,
        selectedSession.id,
        "model",
        modelID,
        selectedSession.directory,
        currentAgent ?? undefined,
        currentVariant ?? undefined
      )
      if (reply && reply.info) {
        setMessages((prev) => [...prev, reply])
      }
      await loadSelected(selectedSession.id, selectedSession.directory)
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

  // ── Effects ─────────────────────────────────────────────────────

  // Initialize completion audio element once
  useEffect(() => {
    completionAudioRef.current = new Audio("/audio/staplebops-01.aac")
    completionAudioRef.current.preload = "auto"
  }, [])

  // Auto-scroll to bottom when messages change (if autoScroll enabled)
  useEffect(() => {
    if (!prefs.autoScroll) return
    window.scrollTo(0, document.body.scrollHeight)
  }, [messages.length, busySending, prefs.autoScroll])

  // Play completion sound when a running session transitions to idle
  useEffect(() => {
    if (!selectedSession) {
      wasRunningRef.current = false
      return
    }
    const runningNow = ["busy", "retry"].includes(selectedSession.status)
    if (wasRunningRef.current && !runningNow) {
      const audio = completionAudioRef.current
      if (audio && prefs.sound) {
        audio.currentTime = 0
        audio.play().catch(() => undefined)
      }
    }
    wasRunningRef.current = runningNow
  }, [selectedSession?.id, selectedSession?.status, prefs.sound])

  // ── Return ──────────────────────────────────────────────────────

  return {
    composer,
    setComposer,
    busySending,
    setBusySending,
    slashOpen,
    setSlashOpen,
    slashFilter,
    setSlashFilter,
    slashIndex,
    setSlashIndex,
    messagesRef,
    textareaRef,
    completionAudioRef,
    wasRunningRef,
    filteredCommands,
    send,
    handleSlashSelect,
    selectAgent,
    selectVariant,
    abortSession,
    selectModel,
    replyPermission,
    replyQuestion,
    rejectQuestion
  }
}
