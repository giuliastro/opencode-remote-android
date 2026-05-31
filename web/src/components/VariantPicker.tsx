type Props = {
  availableVariants: string[]
  currentVariant: string | null
  onSelect: (variant: string | null) => void
  onClose: () => void
}

export default function VariantPicker({ availableVariants, currentVariant, onSelect, onClose }: Props) {
  return (
    <div className="mpicker-overlay" onClick={onClose}>
      <div className="mpicker-sheet" onClick={(e) => e.stopPropagation()}>
        <div className="mpicker-header">
          <span className="mpicker-title">Select variant</span>
          <button className="mpicker-close" onClick={onClose} aria-label="Close">
            <i className="ti ti-x" />
          </button>
        </div>
        <div className="mpicker-list">
          <button
            className={`mpicker-item${currentVariant === null ? " active" : ""}`}
            onClick={() => {
              onSelect(null)
              onClose()
            }}
          >
            <span className="mpicker-model-name">auto</span>
            <span className="mpicker-model-id">Use model default</span>
            {currentVariant === null && <i className="ti ti-check mpicker-check" />}
          </button>
          {availableVariants.map((variant) => {
            const active = currentVariant === variant
            return (
              <button
                key={variant}
                className={`mpicker-item${active ? " active" : ""}`}
                onClick={() => {
                  onSelect(variant)
                  onClose()
                }}
              >
                <span className="mpicker-model-name">{variant}</span>
                <span className="mpicker-model-id">Model variant</span>
                {active && <i className="ti ti-check mpicker-check" />}
              </button>
            )
          })}
        </div>
      </div>
    </div>
  )
}
