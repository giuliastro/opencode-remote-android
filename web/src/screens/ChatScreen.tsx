import { useState, useRef, useEffect } from "react"
import type { AgentInfo, DiffFile, MessageEnvelope, QuestionRequest, ServerConfig, SessionView, TodoItem, CommandInfo, ProviderInfo } from "../types"
import { api } from "../api"
import {
  extractAgentParts,
  extractCompactionParts,
  extractFileParts,
  extractPatchParts,
  extractReasoningParts,
  extractRetryParts,
  extractStepFinishParts,
  extractStepStartParts,
  extractSubtaskParts,
  extractText,
  extractToolParts,
  renderInline,
  toDisplayLines
} from "../components/message/messageHelpers"
import ToolPartDisplay from "../components/message/ToolPart"
import ReasoningPartDisplay from "../components/message/ReasoningPart"
import SubtaskPartDisplay from "../components/message/SubtaskPart"
import FilePartDisplay from "../components/message/FilePart"
import StepStartPartDisplay, { StepFinishPartDisplay } from "../components/message/StepPart"
import PatchPartDisplay from "../components/message/PatchPart"
import AgentPartDisplay from "../components/message/AgentPart"
import RetryPartDisplay from "../components/message/RetryPart"
import CompactionPartDisplay from "../components/message/CompactionPart"
import Composer from "../components/Composer"

type SessionInfo = {
  agent: string | null
  model: { providerID: string; modelID: string } | null
  variant: string | null
}

type ChatScreenProps = {
  config: ServerConfig
  selectedSession: SessionView | null
  renderedMessages: Array<MessageEnvelope & {
    text: string
    toolParts: Array<{ id: string; tool?: string; state?: MessageEnvelope["parts"][0]["state"] }>
    subtaskParts: Array<{ id: string; prompt?: string; description?: string; agent?: string }>
    reasoningParts: Array<{ id: string; text?: string }>
    fileParts: Array<{ id: string; mime?: string; filename?: string; url?: string }>
    stepStartParts: Array<{ id: string }>
    stepFinishParts: Array<{ id: string; reason?: string; cost?: number; tokens?: { input: number; output: number; reasoning: number } }>
    patchParts: Array<{ id: string; hash?: string; files?: string[] }>
    agentParts: Array<{ id: string; name?: string }>
    retryParts: Array<{ id: string; attempt?: number; error?: { name: string; data: { message: string } } }>
    compactionParts: Array<{ id: string; auto?: boolean }>
  }>
  loadingSessionID: string | null
  selectedID: string | null
  todos: TodoItem[]
  todosExpanded: boolean
  setTodosExpanded: (v: boolean) => void
  diff: DiffFile[]
  sessionInfo: SessionInfo
  runtimeError: string | null
  onBack: () => void
  isWorking: boolean
  abortSession: () => Promise<void>
  composer: string
  setComposer: (v: string) => void
  send: () => Promise<void>
  slashOpen: boolean
  setSlashOpen: (v: boolean) => void
  slashFilter: string
  setSlashFilter: (v: string) => void
  slashIndex: number
  setSlashIndex: (v: number) => void
  filteredCommands: CommandInfo[]
  handleSlashSelect: (cmd: CommandInfo) => void
  messagesRef: React.RefObject<HTMLDivElement | null>
  textareaRef: React.RefObject<HTMLTextAreaElement | null>
  providers: ProviderInfo[]
  connectedProviderIDs: string[]
  selectModel: (modelID: string) => Promise<void>
  currentVariant: string | null
  availableVariants: string[]
  selectVariant: (variant: string | null) => void
  currentAgent: string | null
  primaryAgents: AgentInfo[]
  selectAgent: (agent: string) => void
  questions: QuestionRequest[]
  replyPermission: (requestID: string, reply: "once" | "always" | "reject") => Promise<void>
  replyQuestion: (requestID: string, directory: string, answers: string[][]) => Promise<void>
  rejectQuestion: (requestID: string) => Promise<void>
  forkSession: (sessionID: string) => Promise<string | null>
  renameSession: (sessionID: string, title: string) => Promise<void>
  onSessionForked: () => void
}

function formatCost(cost: number): string {
  if (cost < 0.001) return ""
  if (cost < 0.01) return `$${cost.toFixed(4)}`
  return `$${cost.toFixed(3)}`
}

export default function ChatScreen({
  config,
  selectedSession,
  renderedMessages,
  loadingSessionID,
  selectedID,
  todos,
  todosExpanded,
  setTodosExpanded,
  diff,
  sessionInfo,
  runtimeError,
  onBack,
  isWorking,
  abortSession,
  composer,
  setComposer,
  send,
  slashOpen,
  setSlashOpen,
  slashFilter,
  setSlashFilter,
  slashIndex,
  setSlashIndex,
  filteredCommands,
  handleSlashSelect,
  messagesRef,
  textareaRef,
  providers,
  connectedProviderIDs,
  selectModel,
  currentVariant,
  availableVariants,
  selectVariant,
  currentAgent,
  primaryAgents,
  selectAgent,
  questions,
  replyPermission,
  replyQuestion,
  rejectQuestion,
  forkSession,
  renameSession,
  onSessionForked
}: ChatScreenProps) {
  const chatSub = selectedSession?.directory ?? ""
  const isRunning = selectedSession?.status === "busy" || selectedSession?.status === "retry"
  const isPermission = selectedSession?.status === "permission"
  const isQuestion = selectedSession?.status === "ask" || selectedSession?.status === "question"
  const isAsking = isPermission || isQuestion

  const [menuOpen, setMenuOpen] = useState(false)
  const [renameOpen, setRenameOpen] = useState(false)
  const [renameValue, setRenameValue] = useState("")
  const [activeTab, setActiveTab] = useState<"session" | "changes">("session")
  const [expandedMessages, setExpandedMessages] = useState<Set<string>>(new Set())
  const [subagentSession, setSubagentSession] = useState<{ id: string; title: string } | null>(null)
  const [subagentMessages, setSubagentMessages] = useState<MessageEnvelope[]>([])
  const [subagentLoading, setSubagentLoading] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)

  // Question card state
  const activeQuestion = questions.find((q) => q.sessionID === selectedSession?.id) ?? null
  const hasQuestionCard = isQuestion && !!activeQuestion
  const [qIdx, setQIdx] = useState(0)
  const [selectedOption, setSelectedOption] = useState<string | null>(null)
  const [selectedOptions, setSelectedOptions] = useState<Set<string>>(new Set())
  const [customText, setCustomText] = useState("")
  const [isCustom, setIsCustom] = useState(false)

  // Reset question state when activeQuestion changes
  useEffect(() => {
    setQIdx(0)
    setSelectedOption(null)
    setSelectedOptions(new Set())
    setCustomText("")
    setIsCustom(false)
  }, [activeQuestion?.id])

  useEffect(() => {
    setActiveTab("session")
    setExpandedMessages(new Set())
    setSubagentSession(null)
    setSubagentMessages([])
  }, [selectedSession?.id])

  useEffect(() => {
    if (!subagentSession || !selectedSession) return
    let cancelled = false
    const sessionID = subagentSession.id

    async function loadSubagent() {
      setSubagentLoading(true)
      try {
        const loaded = await api.loadMessages(config, sessionID, "")
        if (!cancelled) {
          setSubagentMessages(loaded)
        }
      } catch {
        if (!cancelled) {
          setSubagentMessages([])
        }
      } finally {
        if (!cancelled) {
          setSubagentLoading(false)
        }
      }
    }

    loadSubagent().catch(() => undefined)
    return () => {
      cancelled = true
    }
  }, [config, selectedSession, subagentSession])

  const currentQ = activeQuestion?.questions[qIdx]
  const totalQ = activeQuestion?.questions.length ?? 0
  const allowCustom = currentQ?.custom !== false
  const isMultiple = currentQ?.multiple === true

  function getAnswerForCurrentQ(): string[] {
    if (isCustom && customText.trim()) return [customText.trim()]
    if (isMultiple) return Array.from(selectedOptions)
    return selectedOption ? [selectedOption] : []
  }

  function canSubmit() {
    return getAnswerForCurrentQ().length > 0
  }

  function selectSingleOption(label: string) {
    setIsCustom(false)
    setSelectedOption(label)
    setCustomText("")
  }

  function toggleMultiOption(label: string) {
    setIsCustom(false)
    setSelectedOptions((prev) => {
      const next = new Set(prev)
      if (next.has(label)) next.delete(label)
      else next.add(label)
      return next
    })
  }

  function selectCustom() {
    setIsCustom(true)
    setSelectedOption(null)
    setSelectedOptions(new Set())
  }

  // Accumulated answers across question pages
  const [accAnswers, setAccAnswers] = useState<string[][]>([])

  async function handleQuestionSubmit() {
    if (!activeQuestion || !canSubmit()) return
    const answer = getAnswerForCurrentQ()
    const newAccAnswers = [...accAnswers, answer]
    if (qIdx < totalQ - 1) {
      // More questions — advance to next
      setAccAnswers(newAccAnswers)
      setQIdx(qIdx + 1)
      setSelectedOption(null)
      setSelectedOptions(new Set())
      setCustomText("")
      setIsCustom(false)
    } else {
      // Last question — submit all
      setAccAnswers([])
      await replyQuestion(activeQuestion.id, selectedSession!.directory, newAccAnswers)
    }
  }

  async function handleQuestionDismiss() {
    if (!activeQuestion) return
    setAccAnswers([])
    await rejectQuestion(activeQuestion.id)
  }

  // Close overflow menu on outside click
  useEffect(() => {
    if (!menuOpen) return
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false)
      }
    }
    document.addEventListener("mousedown", handler)
    return () => document.removeEventListener("mousedown", handler)
  }, [menuOpen])

  function openRename() {
    setMenuOpen(false)
    setRenameValue(selectedSession?.title ?? "")
    setRenameOpen(true)
  }

  async function handleRename() {
    if (!selectedSession || !renameValue.trim()) return
    setRenameOpen(false)
    await renameSession(selectedSession.id, renameValue.trim())
  }

  async function handleFork() {
    if (!selectedSession) return
    setMenuOpen(false)
    await forkSession(selectedSession.id)
    onSessionForked()
  }

  function handleCopyPath() {
    if (!selectedSession) return
    setMenuOpen(false)
    navigator.clipboard.writeText(selectedSession.directory).catch(() => undefined)
  }

  const costLabel = selectedSession?.cost ? formatCost(selectedSession.cost) : ""

  const subagentRenderedMessages = subagentMessages
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

  function toggleMessageExpanded(messageID: string) {
    setExpandedMessages((prev) => {
      const next = new Set(prev)
      if (next.has(messageID)) next.delete(messageID)
      else next.add(messageID)
      return next
    })
  }

  function handleOpenSubagent(sessionId: string, title: string) {
    setSubagentSession({ id: sessionId, title })
  }

  function getDiffStatus(file: DiffFile): "added" | "deleted" | "modified" {
    if (file.status === "added" || file.status === "deleted" || file.status === "modified") return file.status
    if (file.additions > 0 && file.deletions === 0) return "added"
    if (file.deletions > 0 && file.additions === 0) return "deleted"
    return "modified"
  }

  function renderMessageList(
    messages: ChatScreenProps["renderedMessages"],
    options: { readOnly?: boolean } = {}
  ) {
    return messages.map((message) => {
      const lines = message.text ? toDisplayLines(message.text) : []
      const isUser = message.info.role === "user"
      const agentName = message.info.agent ?? "opencode"
      const hasToolCalls = message.toolParts.length > 0
      const isCollapsed = !options.readOnly && !isUser && hasToolCalls && !expandedMessages.has(message.info.id)

      return (
        <div key={message.info.id} className={`brow ${isUser ? "user" : "ai"}`}>
          <div className={`avatar ${isUser ? "me" : "ai"}`}>
            {isUser ? "ME" : "AI"}
          </div>
          <div className="bcol">
            <div className="brole">{isUser ? "you" : agentName}</div>
            <div className="bubble">
              {!options.readOnly && !isUser && hasToolCalls && !isCollapsed && (
                <button className="msg-collapse-bar" onClick={() => toggleMessageExpanded(message.info.id)}>
                  <i className="ti ti-chevron-left" />
                  <span>collapse</span>
                </button>
              )}

              {isCollapsed ? (
                <>
                  {lines.length > 0 && (
                    <div className="message-content">
                      {lines.map((line, index) => (
                        <p key={index}>{renderInline(line)}</p>
                      ))}
                    </div>
                  )}
                  <button className="msg-summary-chip" onClick={() => toggleMessageExpanded(message.info.id)}>
                    <span>
                      <i className="ti ti-tools" />
                      {message.toolParts.length} tool calls
                    </span>
                    <i className="ti ti-chevron-right" />
                  </button>
                </>
              ) : (
                <>
                  {message.stepStartParts.map((part) => (
                    <StepStartPartDisplay key={part.id} />
                  ))}
                  {message.agentParts.map((part) => (
                    <AgentPartDisplay key={part.id} part={part as any} />
                  ))}
                  {message.reasoningParts.map((part) => (
                    <ReasoningPartDisplay key={part.id} part={part as any} />
                  ))}
                  {message.subtaskParts.map((part) => (
                    <SubtaskPartDisplay key={part.id} part={part as any} />
                  ))}
                  {message.toolParts.map((part) => (
                    <ToolPartDisplay
                      key={part.id}
                      part={part as any}
                      onOpenSubagent={options.readOnly ? undefined : handleOpenSubagent}
                    />
                  ))}
                  {message.fileParts.map((part) => (
                    <FilePartDisplay key={part.id} part={part as any} />
                  ))}
                  {message.patchParts.map((part) => (
                    <PatchPartDisplay key={part.id} part={part as any} />
                  ))}
                  {message.stepFinishParts.map((part) => (
                    <StepFinishPartDisplay key={part.id} part={part as any} />
                  ))}
                  {message.retryParts.map((part) => (
                    <RetryPartDisplay key={part.id} part={part as any} />
                  ))}
                  {message.compactionParts.map((part) => (
                    <CompactionPartDisplay key={part.id} part={part as any} />
                  ))}
                  {lines.length > 0 && (
                    <div className="message-content">
                      {lines.map((line, index) => (
                        <p key={index}>{renderInline(line)}</p>
                      ))}
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        </div>
      )
    })
  }

  return (
    <div className="app-screen">
      {/* Chat header */}
      <div className="chat-header">
        <div className="back-btn" onClick={onBack}>
          <i className="ti ti-chevron-left"></i>
        </div>
        <div className="chat-hinfo">
          <div className="chat-htitle">
            {selectedSession?.title ?? "Select a session"}
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            {chatSub && <div className="chat-hsub">{chatSub}</div>}
            {costLabel && <span className="cost-badge">{costLabel}</span>}
          </div>
        </div>
        <div className="chat-hbadges">
          {(isRunning || isAsking) && (
            <div className={`running-pill${isAsking ? " ask" : ""}`}>
              <div className={`rpulse${isAsking ? " ask" : ""}`}></div>
              {isAsking ? "awaiting you" : selectedSession?.status === "retry" ? "retrying" : "running"}
            </div>
          )}
          {isWorking && (
            <div className="stop-btn" onClick={() => { abortSession().catch(() => undefined) }}>
              <i className="ti ti-player-stop-filled"></i>
            </div>
          )}
          {/* Overflow menu */}
          {selectedSession && (
            <div style={{ position: "relative" }} ref={menuRef}>
              <div
                className="stop-btn"
                style={{ background: "var(--surface)", borderColor: "var(--border)" }}
                onClick={() => setMenuOpen((o) => !o)}
              >
                <i className="ti ti-dots" style={{ color: "var(--text-tertiary)" }}></i>
              </div>
              {menuOpen && (
                <div className="overflow-menu">
                  <button className="overflow-item" onClick={handleFork}>
                    <i className="ti ti-git-branch"></i>
                    Fork session
                  </button>
                  <button className="overflow-item" onClick={openRename}>
                    <i className="ti ti-pencil"></i>
                    Rename
                  </button>
                  <div className="overflow-sep" />
                  <button className="overflow-item" onClick={handleCopyPath}>
                    <i className="ti ti-copy"></i>
                    Copy path
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      <div className="chat-tabs" role="tablist" aria-label="Chat views">
        <button className={`chat-tab${activeTab === "session" ? " active" : ""}`} onClick={() => setActiveTab("session")}>
          Session
        </button>
        <button className={`chat-tab${activeTab === "changes" ? " active" : ""}`} onClick={() => setActiveTab("changes")}>
          Changes
          {diff.length > 0 && <span className="chat-tab-count">{diff.length}</span>}
        </button>
      </div>

      {activeTab === "session" ? (
        <>
          <div className="messages" ref={messagesRef as React.RefObject<HTMLDivElement>}>
            {loadingSessionID === selectedID ? (
              <div style={{ textAlign: "center", padding: "48px 16px", color: "var(--text-muted)" }}>
                <i className="ti ti-loader" style={{ fontSize: "32px", display: "block", marginBottom: "12px" }}></i>
                <p style={{ fontSize: "13px" }}>Loading session...</p>
              </div>
            ) : renderedMessages.length === 0 ? (
              <div style={{ textAlign: "center", padding: "48px 16px", color: "var(--text-muted)" }}>
                <i className="ti ti-message-2" style={{ fontSize: "48px", display: "block", marginBottom: "12px", opacity: 0.4 }}></i>
                <p style={{ fontSize: "14px", fontWeight: 600, color: "var(--text-secondary)" }}>No messages yet</p>
                <p style={{ fontSize: "11px", marginTop: "4px" }}>Start a conversation below</p>
              </div>
            ) : (
              renderMessageList(renderedMessages)
            )}

            {isRunning && !isAsking && renderedMessages.length > 0 && (
              <div className="brow ai">
                <div className="avatar ai">AI</div>
                <div className="bcol">
                  <div className="brole">{sessionInfo.agent ?? "opencode"}</div>
                  <div className="typing">
                    <div className="tdot"></div>
                    <div className="tdot"></div>
                    <div className="tdot"></div>
                  </div>
                </div>
              </div>
            )}
          </div>

          {todos.length > 0 && (
            <div className="todo-box" style={{ padding: "0 14px", flexShrink: 0 }}>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  padding: "8px 0",
                  cursor: "pointer",
                  fontSize: "11px",
                  fontFamily: "'IBM Plex Mono', monospace",
                  color: "var(--text-muted)"
                }}
                onClick={() => setTodosExpanded(!todosExpanded)}
              >
                <span>
                  <i className="ti ti-list-check" style={{ marginRight: "4px", color: "var(--accent)" }}></i>
                  Todo ({todos.length})
                </span>
                <i className={`ti ti-chevron-${todosExpanded ? "up" : "down"}`}></i>
              </div>
              {todosExpanded && (
                <div style={{ paddingBottom: "8px" }}>
                  {todos.slice(0, 6).map((item) => (
                    <div
                      key={item.id}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "8px",
                        padding: "4px 0",
                        fontSize: "11px",
                        color: "var(--text-secondary)"
                      }}
                    >
                      <span style={{ color: item.status === "completed" ? "var(--accent)" : "var(--text-muted)" }}>
                        {item.status === "completed" ? <i className="ti ti-checkbox"></i> : <i className="ti ti-square"></i>}
                      </span>
                      <span>{item.content}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </>
      ) : (
        <div className="changes-list">
          {diff.length === 0 ? (
            <div style={{ textAlign: "center", padding: "48px 16px", color: "var(--text-muted)" }}>
              <i className="ti ti-git-diff" style={{ fontSize: "40px", display: "block", marginBottom: "12px", opacity: 0.4 }}></i>
              <p style={{ fontSize: "14px", fontWeight: 600, color: "var(--text-secondary)" }}>No changes yet</p>
            </div>
          ) : (
            diff.map((file) => {
              const status = getDiffStatus(file)
              return (
                <div key={file.file} className="changes-file">
                  <div className={`changes-file-status ${status}`}>{status}</div>
                  <div className="changes-file-main">
                    <div className="changes-file-name">{file.file}</div>
                    <div className="changes-file-stats">
                      {file.additions > 0 && <span className="diff-add">+{file.additions}</span>}
                      {file.deletions > 0 && <span className="diff-del">-{file.deletions}</span>}
                    </div>
                  </div>
                </div>
              )
            })
          )}
        </div>
      )}

      {/* Permission banner */}
      {isPermission && selectedSession?.requestID && (
        <div className="ask-banner ask-banner-permission">
          <div className="ask-banner-msg">
            <i className="ti ti-shield-question"></i>
            <span>{selectedSession.statusMessage ?? "Permission required"}</span>
          </div>
          <div className="ask-banner-actions">
            <button className="perm-btn allow-once" onClick={() => replyPermission(selectedSession.requestID!, "once")}>
              Allow once
            </button>
            <button className="perm-btn allow-always" onClick={() => replyPermission(selectedSession.requestID!, "always")}>
              Always
            </button>
            <button className="perm-btn deny" onClick={() => replyPermission(selectedSession.requestID!, "reject")}>
              Deny
            </button>
          </div>
        </div>
      )}

      {/* Structured question card */}
      {hasQuestionCard && currentQ && (
        <div className="question-card">
          <div className="question-card-header">
            <span className="question-card-count">
              {qIdx + 1} of {totalQ} {totalQ === 1 ? "question" : "questions"}
            </span>
            <button className="question-card-dismiss-btn" onClick={() => { handleQuestionDismiss().catch(() => undefined) }} aria-label="Dismiss">
              <i className="ti ti-minus" />
            </button>
          </div>
          <div className="question-card-body">
            <div className="question-card-title">{currentQ.question}</div>
            <div className="question-card-hint">
              {isMultiple ? "Select all answers that apply" : "Select one answer"}
            </div>
            <div className="question-options">
              {currentQ.options.map((opt) => {
                const sel = isMultiple ? selectedOptions.has(opt.label) : selectedOption === opt.label
                return (
                  <div
                    key={opt.label}
                    className={`question-option${sel && !isCustom ? " selected" : ""}`}
                    onClick={() => isMultiple ? toggleMultiOption(opt.label) : selectSingleOption(opt.label)}
                  >
                    <div className="question-option-radio" />
                    <div className="question-option-text">
                      <div className="question-option-label">{opt.label}</div>
                      {opt.description && <div className="question-option-desc">{opt.description}</div>}
                    </div>
                  </div>
                )
              })}
              {allowCustom && (
                <div
                  className={`question-option${isCustom ? " selected" : ""}`}
                  onClick={selectCustom}
                >
                  <div className="question-option-radio" />
                  <div className="question-option-text">
                    <div className="question-option-label">Type your own answer</div>
                    {isCustom && (
                      <input
                        className="question-custom-input"
                        placeholder="Type your answer..."
                        value={customText}
                        onChange={(e) => setCustomText(e.target.value)}
                        onClick={(e) => e.stopPropagation()}
                        autoFocus
                      />
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
          <div className="question-card-actions">
            <button className="question-dismiss-btn" onClick={() => { handleQuestionDismiss().catch(() => undefined) }}>
              Dismiss
            </button>
            <button
              className="question-submit-btn"
              disabled={!canSubmit()}
              onClick={() => { handleQuestionSubmit().catch(() => undefined) }}
            >
              {qIdx < totalQ - 1 ? "Next" : "Submit"}
            </button>
          </div>
        </div>
      )}

      {/* Simple ask banner fallback (when question data isn't loaded yet) */}
      {isQuestion && !hasQuestionCard && (
        <div className="ask-banner">
          <i className="ti ti-help-circle"></i>
          <span>{selectedSession?.statusMessage ?? "Opencode is awaiting your response"}</span>
        </div>
      )}

      {/* Error display */}
      {runtimeError && (
        <div className="error fade-in" style={{ padding: "8px 14px 4px", fontSize: "11px", flexShrink: 0 }}>
          <i className="ti ti-alert-circle" style={{ marginRight: "4px" }}></i>
          {runtimeError}
        </div>
      )}

      {/* Composer */}
      {selectedSession && !isPermission && !hasQuestionCard && (
        <Composer
          composer={composer}
          setComposer={setComposer}
          send={send}
          slashOpen={slashOpen}
          setSlashOpen={setSlashOpen}
          slashFilter={slashFilter}
          setSlashFilter={setSlashFilter}
          slashIndex={slashIndex}
          setSlashIndex={setSlashIndex}
          filteredCommands={filteredCommands}
          handleSlashSelect={handleSlashSelect}
          textareaRef={textareaRef}
          isWorking={isWorking}
          abortSession={abortSession}
          providers={providers}
          connectedProviderIDs={connectedProviderIDs}
          currentModel={sessionInfo.model}
          selectModel={selectModel}
          currentVariant={currentVariant}
          availableVariants={availableVariants}
          selectVariant={selectVariant}
          currentAgent={currentAgent}
          primaryAgents={primaryAgents}
          selectAgent={selectAgent}
        />
      )}

      {/* Rename modal */}
      {renameOpen && (
        <div className="rename-overlay" onClick={() => setRenameOpen(false)}>
          <div className="rename-dialog" onClick={(e) => e.stopPropagation()}>
            <div className="rename-title">Rename session</div>
            <input
              className="rename-input"
              value={renameValue}
              onChange={(e) => setRenameValue(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") handleRename().catch(() => undefined) }}
              autoFocus
            />
            <div className="rename-actions">
              <button className="sbtn secondary" style={{ flex: "none", padding: "8px 16px" }} onClick={() => setRenameOpen(false)}>
                Cancel
              </button>
              <button className="sbtn primary" style={{ flex: "none", padding: "8px 16px" }} onClick={() => { handleRename().catch(() => undefined) }}>
                Save
              </button>
            </div>
          </div>
        </div>
      )}

      {subagentSession && (
        <div className="subagent-overlay">
          <div className="subagent-header">
            <button className="subagent-close" onClick={() => setSubagentSession(null)}>
              <i className="ti ti-chevron-left" />
            </button>
            <div className="subagent-title">Subagent: {subagentSession.title}</div>
          </div>
          <div className="messages">
            {subagentLoading ? (
              <div style={{ textAlign: "center", padding: "48px 16px", color: "var(--text-muted)" }}>
                <i className="ti ti-loader" style={{ fontSize: "32px", display: "block", marginBottom: "12px" }}></i>
                <p style={{ fontSize: "13px" }}>Loading subagent...</p>
              </div>
            ) : subagentRenderedMessages.length === 0 ? (
              <div style={{ textAlign: "center", padding: "48px 16px", color: "var(--text-muted)" }}>
                <i className="ti ti-robot" style={{ fontSize: "40px", display: "block", marginBottom: "12px", opacity: 0.4 }}></i>
                <p style={{ fontSize: "14px", fontWeight: 600, color: "var(--text-secondary)" }}>No subagent messages</p>
              </div>
            ) : (
              renderMessageList(subagentRenderedMessages, { readOnly: true })
            )}
          </div>
        </div>
      )}
    </div>
  )
}
