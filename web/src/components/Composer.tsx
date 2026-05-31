import { useCallback } from "react"
import type { AgentInfo, CommandInfo } from "../types"
import SessionMeta from "./SessionMeta"
import SlashPopover from "./SlashPopover"

type Props = {
  composer: string
  setComposer: (v: string) => void
  send: () => Promise<void>
  abortSession: () => Promise<void>
  isWorking: boolean
  sessionInfo: {
    agent: string | null
    model: { providerID: string; modelID: string } | null
    variant: string | null
  }
  availableVariants: string[]
  primaryAgents: AgentInfo[]
  currentAgent: string | null
  currentVariant: string | null
  cycleAgent: () => void
  cycleVariant: () => void
  agents: AgentInfo[]
  slashOpen: boolean
  setSlashOpen: (v: boolean) => void
  slashFilter: string
  setSlashFilter: (v: string) => void
  slashIndex: number
  setSlashIndex: (v: number) => void
  filteredCommands: CommandInfo[]
  handleSlashSelect: (cmd: CommandInfo) => void
  textareaRef: React.RefObject<HTMLTextAreaElement | null>
}

export default function Composer({
  composer,
  setComposer,
  send,
  abortSession,
  isWorking,
  sessionInfo,
  availableVariants,
  primaryAgents,
  currentAgent,
  currentVariant,
  cycleAgent,
  cycleVariant,
  agents,
  slashOpen,
  setSlashOpen,
  setSlashFilter,
  slashIndex,
  setSlashIndex,
  filteredCommands,
  handleSlashSelect,
  textareaRef
}: Props) {
  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      const el = e.target
      el.style.height = "auto"
      el.style.height = `${el.scrollHeight}px`
      const value = el.value
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
    },
    [setComposer, setSlashFilter, setSlashOpen, setSlashIndex]
  )

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (slashOpen && filteredCommands.length > 0) {
        if (e.key === "ArrowDown") {
          e.preventDefault()
          setSlashIndex((slashIndex + 1) % filteredCommands.length)
          return
        }
        if (e.key === "ArrowUp") {
          e.preventDefault()
          setSlashIndex((slashIndex - 1 + filteredCommands.length) % filteredCommands.length)
          return
        }
        if (e.key === "Enter" && !e.shiftKey) {
          e.preventDefault()
          handleSlashSelect(filteredCommands[slashIndex] ?? filteredCommands[0])
          return
        }
        if (e.key === "Escape") {
          e.preventDefault()
          setSlashOpen(false)
          return
        }
      }
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault()
        send()
      }
    },
    [slashOpen, filteredCommands, slashIndex, setSlashIndex, handleSlashSelect, setSlashOpen, send]
  )

  const handleBlur = useCallback(() => {
    setTimeout(() => setSlashOpen(false), 150)
  }, [setSlashOpen])

  // Build label for the model pill in the hints section
  const modelLabel = sessionInfo.model
    ? `${sessionInfo.model.providerID}/${sessionInfo.model.modelID}`
    : null

  const variantLabel = currentVariant ?? sessionInfo.variant
  const agentLabel = currentAgent ?? sessionInfo.agent

  return (
    <div className="composer">
      {/* Session meta — model/variant/agent cycle buttons */}
      <SessionMeta
        sessionInfo={sessionInfo}
        availableVariants={availableVariants}
        primaryAgents={primaryAgents}
        currentAgent={currentAgent}
        currentVariant={currentVariant}
        cycleAgent={cycleAgent}
        cycleVariant={cycleVariant}
        agents={agents}
      />

      {/* Slash command popover */}
      {slashOpen && filteredCommands.length > 0 && (
        <SlashPopover
          commands={filteredCommands}
          activeIndex={slashIndex}
          onSelect={handleSlashSelect}
          onHover={setSlashIndex}
        />
      )}

      {/* Composer box */}
      <div className="composer-box">
        <textarea
          ref={textareaRef as React.RefObject<HTMLTextAreaElement>}
          className="ctextarea"
          placeholder="message… (/ for commands)"
          rows={1}
          value={composer}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          onBlur={handleBlur}
          disabled={isWorking}
        />
        {isWorking ? (
          <button className="csend" onClick={abortSession} title="Stop">
            <i className="ti ti-player-stop-filled" />
          </button>
        ) : (
          <button className="csend" onClick={send} disabled={isWorking} title="Send">
            <i className="ti ti-send" />
          </button>
        )}
      </div>

      {/* Hints and pills */}
      <div className="composer-hints">
        <span className="chint">/ commands · ⇧↵ newline</span>
        {(modelLabel || variantLabel || agentLabel) && (
          <div className="cpills">
            {modelLabel && <span className="cpill">{modelLabel}</span>}
            {variantLabel && <span className="cpill">{variantLabel}</span>}
            {agentLabel && <span className="cpill">{agentLabel}</span>}
          </div>
        )}
      </div>
    </div>
  )
}
