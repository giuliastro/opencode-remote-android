export default function FilePartDisplay({ part }: { part: { mime: string; filename?: string; url: string } }) {
  const isImage = part.mime.startsWith("image/")

  return (
    <div className="file-part">
      <div className="file-header">
        <span className="file-icon">{isImage ? "🖼️" : "📄"}</span>
        <span className="file-name">{part.filename || "Attachment"}</span>
        <span className="file-mime">{part.mime}</span>
      </div>
      {isImage && (
        <div className="file-preview">
          <img src={part.url} alt={part.filename || "Attachment"} />
        </div>
      )}
    </div>
  )
}
