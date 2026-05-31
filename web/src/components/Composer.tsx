import { useCallback, useState } from "react"
import type { AgentInfo, CommandInfo, ProviderInfo } from "../types"
import SlashPopover from "./SlashPopover"
import ModelPicker from "./ModelPicker"
import AgentPicker from "./AgentPicker"
import VariantPicker from "./VariantPicker"

type Props = {
  composer: string
  setComposer: (v: string) => void
  send: () => Promise<void>
  abortSession: () => Promise<void>
  isWorking: boolean
  slashOpen: boolean
  setSlashOpen: (v: boolean) => void
  slashFilter: string
  setSlashFilter: (v: string) => void
  slashIndex: number
  setSlashIndex: (v: number) => void
  filteredCommands: CommandInfo[]
  handleSlashSelect: (cmd: CommandInfo) => void
  textareaRef: React.RefObject<HTMLTextAreaElement | null>
  providers: ProviderInfo[]
  connectedProviderIDs: string[]
  currentModel: { providerID: string; modelID: string } | null
  selectModel: (modelID: string) => Promise<void>
  currentVariant: string | null
  availableVariants: string[]
  selectVariant: (variant: string | null) => void
  currentAgent: string | null
  primaryAgents: AgentInfo[]
  selectAgent: (agent: string) => void
}

export default function Composer({
  composer,
  setComposer,
  send,
  abortSession,
  isWorking,
  slashOpen,
  setSlashOpen,
  setSlashFilter,
  slashIndex,
  setSlashIndex,
  filteredCommands,
  handleSlashSelect,
  textareaRef,
  providers,
  connectedProviderIDs,
  currentModel,
  selectModel,
  currentVariant,
  availableVariants,
  selectVariant,
  currentAgent,
  primaryAgents,
  selectAgent
}: Props) {
  const [modelPickerOpen, setModelPickerOpen] = useState(false)
  const [agentPickerOpen, setAgentPickerOpen] = useState(false)
  const [variantPickerOpen, setVariantPickerOpen] = useState(false)

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
      if (slashOpen) {
        if (e.key === "ArrowDown" && filteredCommands.length > 0) {
          e.preventDefault()
          setSlashIndex((slashIndex + 1) % filteredCommands.length)
          return
        }
        if (e.key === "ArrowUp" && filteredCommands.length > 0) {
          e.preventDefault()
          setSlashIndex((slashIndex - 1 + filteredCommands.length) % filteredCommands.length)
          return
        }
        if (e.key === "Enter") {
          e.preventDefault()
          if (filteredCommands.length > 0) {
            handleSlashSelect(filteredCommands[slashIndex] ?? filteredCommands[0])
          } else {
            setSlashOpen(false)
          }
          return
        }
        if (e.key === "Escape") {
          e.preventDefault()
          setSlashOpen(false)
          return
        }
      }
      // Enter inserts a newline — send via the send button only
    },
    [slashOpen, filteredCommands, slashIndex, setSlashIndex, handleSlashSelect, setSlashOpen]
  )

  const handleBlur = useCallback(() => {
    setTimeout(() => setSlashOpen(false), 150)
  }, [setSlashOpen])

  const modelDisplayName = currentModel
    ? (providers
        .find((p) => p.id === currentModel.providerID)
        ?.models[currentModel.modelID]?.name ?? currentModel.modelID)
    : null

  const agentDisplayName = currentAgent ?? primaryAgents[0]?.name ?? null

  return (
    <div className="composer">
      {modelPickerOpen && (
        <ModelPicker
          providers={providers}
          connectedProviderIDs={connectedProviderIDs}
          currentModelID={currentModel?.modelID ?? null}
          onSelect={(id) => { selectModel(id).catch(() => undefined) }}
          onClose={() => setModelPickerOpen(false)}
        />
      )}

      {agentPickerOpen && (
        <AgentPicker
          agents={primaryAgents}
          currentAgent={currentAgent}
          onSelect={selectAgent}
          onClose={() => setAgentPickerOpen(false)}
        />
      )}

      {variantPickerOpen && (
        <VariantPicker
          availableVariants={availableVariants}
          currentVariant={currentVariant}
          onSelect={selectVariant}
          onClose={() => setVariantPickerOpen(false)}
        />
      )}

      {slashOpen && filteredCommands.length > 0 && (
        <SlashPopover
          commands={filteredCommands}
          activeIndex={slashIndex}
          onSelect={handleSlashSelect}
          onHover={setSlashIndex}
        />
      )}

      <div className="composer-meta">
        <button
          className="cmeta-btn"
          onClick={() => setModelPickerOpen(true)}
          title="Switch model"
        >
          <i className="ti ti-brain" />
          <span>{modelDisplayName ?? "no model"}</span>
        </button>

        {availableVariants.length > 0 && (
          <button
            className="cmeta-btn"
            onClick={() => setVariantPickerOpen(true)}
            title="Select variant"
          >
            <i className="ti ti-sparkles" />
            <span>{currentVariant ?? "auto"}</span>
          </button>
        )}

        {primaryAgents.length > 0 && agentDisplayName && (
          <button
            className="cmeta-btn"
            onClick={() => setAgentPickerOpen(true)}
            title="Select agent"
          >
            <i className="ti ti-robot" />
            <span>{agentDisplayName}</span>
          </button>
        )}
      </div>

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
    </div>
  )
}
