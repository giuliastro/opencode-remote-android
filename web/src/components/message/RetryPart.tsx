export default function RetryPartDisplay({ part }: { part: { attempt: number; error?: { name: string; data: { message: string } } } }) {
  return (
    <div className="retry-part">
      <div className="retry-header">
        <span className="retry-icon">🔄</span>
        <span className="retry-label">Retry #{part.attempt}</span>
      </div>
      {part.error && (
        <div className="retry-error">
          <strong>{part.error.name}:</strong> {part.error.data.message}
        </div>
      )}
    </div>
  )
}
