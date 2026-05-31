import type { CommandInfo } from "../types"

type Props = {
  commands: CommandInfo[]
  activeIndex: number
  onSelect: (cmd: CommandInfo) => void
  onHover: (index: number) => void
}

export default function SlashPopover({ commands, activeIndex, onSelect, onHover }: Props) {
  if (commands.length === 0) return null

  return (
    <div className="slash-popover">
      {commands.map((cmd, index) => (
        <button
          key={cmd.name}
          type="button"
          className={`slash-item${index === activeIndex ? " active" : ""}`}
          onMouseDown={(e) => {
            e.preventDefault()
            onSelect(cmd)
          }}
          onMouseEnter={() => onHover(index)}
        >
          <span className="slash-name">/{cmd.name}</span>
          {cmd.description && (
            <span className="slash-description">{cmd.description}</span>
          )}
        </button>
      ))}
    </div>
  )
}
