import { useState } from "react"

export default function PatchPartDisplay({ part }: { part: { hash: string; files: string[] } }) {
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
