import type { MessageEnvelope, SessionView, TodoItem, CommandInfo, ProviderInfo } from "../types"
import { renderInline, toDisplayLines } from "../components/message/messageHelpers"
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
  sessionInfo: SessionInfo
  runtimeError: string | null
  onBack: () => void
  isWorking: boolean
  abortSession: () => Promise<void>
  // Composer props from useChat
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
  selectModel: (modelID: string) => Promise<void>
}

export default function ChatScreen({
  selectedSession,
  renderedMessages,
  loadingSessionID,
  selectedID,
  todos,
  todosExpanded,
  setTodosExpanded,
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
  selectModel
}: ChatScreenProps) {
  const chatSub = selectedSession?.directory ?? ""

  const isRunning = selectedSession?.status === "busy" || selectedSession?.status === "retry"
  const isAsking = selectedSession?.status === "ask"

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
          {chatSub && <div className="chat-hsub">{chatSub}</div>}
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
        </div>
      </div>

      {/* Messages */}
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
          renderedMessages.map((message) => {
            const lines = message.text ? toDisplayLines(message.text) : []
            const isUser = message.info.role === "user"
            const agentName = message.info.agent ?? "opencode"

            return (
              <div key={message.info.id} className={`brow ${isUser ? "user" : "ai"}`}>
                <div className={`avatar ${isUser ? "me" : "ai"}`}>
                  {isUser ? "ME" : "AI"}
                </div>
                <div className="bcol">
                  <div className="brole">{isUser ? "you" : agentName}</div>
                  <div className="bubble">
                    {/* Step start parts */}
                    {message.stepStartParts.map((part) => (
                      <StepStartPartDisplay key={part.id} />
                    ))}

                    {/* Agent parts */}
                    {message.agentParts.map((part) => (
                      <AgentPartDisplay key={part.id} part={part as any} />
                    ))}

                    {/* Reasoning parts */}
                    {message.reasoningParts.map((part) => (
                      <ReasoningPartDisplay key={part.id} part={part as any} />
                    ))}

                    {/* Subtask parts */}
                    {message.subtaskParts.map((part) => (
                      <SubtaskPartDisplay key={part.id} part={part as any} />
                    ))}

                    {/* Tool parts */}
                    {message.toolParts.map((part) => (
                      <ToolPartDisplay key={part.id} part={part as any} />
                    ))}

                    {/* File parts */}
                    {message.fileParts.map((part) => (
                      <FilePartDisplay key={part.id} part={part as any} />
                    ))}

                    {/* Patch parts */}
                    {message.patchParts.map((part) => (
                      <PatchPartDisplay key={part.id} part={part as any} />
                    ))}

                    {/* Step finish parts */}
                    {message.stepFinishParts.map((part) => (
                      <StepFinishPartDisplay key={part.id} part={part as any} />
                    ))}

                    {/* Retry parts */}
                    {message.retryParts.map((part) => (
                      <RetryPartDisplay key={part.id} part={part as any} />
                    ))}

                    {/* Compaction parts */}
                    {message.compactionParts.map((part) => (
                      <CompactionPartDisplay key={part.id} part={part as any} />
                    ))}

                    {/* Text content */}
                    {lines.length > 0 && (
                      <div className="message-content">
                        {lines.map((line, index) => (
                          <p key={index}>{renderInline(line)}</p>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )
          })
        )}

        {/* Typing indicator */}
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

      {/* Permission prompt banner */}
      {isAsking && (
        <div className="ask-banner">
          <i className="ti ti-help-circle"></i>
          <span>{selectedSession?.statusMessage ?? "Opencode is awaiting your response"}</span>
        </div>
      )}

      {/* Todo box (collapsible) */}
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
                    {item.status === "completed" ? (
                      <i className="ti ti-checkbox"></i>
                    ) : (
                      <i className="ti ti-square"></i>
                    )}
                  </span>
                  <span>{item.content}</span>
                </div>
              ))}
            </div>
          )}
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
      {selectedSession && (
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
          currentModel={sessionInfo.model}
          selectModel={selectModel}
        />
      )}
    </div>
  )
}
