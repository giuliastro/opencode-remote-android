export default function CompactionPartDisplay({ part }: { part: { auto: boolean } }) {
  return (
    <div className="compaction-part">
      <span className="compaction-icon">📦</span>
      <span className="compaction-label">Compaction</span>
      <span className="compaction-type">{part.auto ? "Auto" : "Manual"}</span>
    </div>
  )
}
