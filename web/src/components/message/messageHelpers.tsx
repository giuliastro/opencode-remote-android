import type { MessageEnvelope, ToolState } from "../../types"

type ToolPart = {
  id: string
  type: string
  tool: string
  state: ToolState
}

export function formatTime(epoch: number): string {
  if (!epoch) return "-"
  return new Date(epoch).toLocaleString()
}

export function extractText(msg: MessageEnvelope): string {
  return msg.parts
    .filter((part) => part.type === "text" && part.text)
    .map((part) => part.text)
    .join("\n")
    .trim()
}

export function extractToolParts(msg: MessageEnvelope) {
  return msg.parts.filter((part): part is ToolPart => part.type === "tool" && !!part.tool && !!part.state)
}

export function extractSubtaskParts(msg: MessageEnvelope) {
  return msg.parts.filter((part) => part.type === "subtask" && part.prompt)
}

export function extractReasoningParts(msg: MessageEnvelope) {
  return msg.parts.filter((part) => part.type === "reasoning" && part.text)
}

export function extractFileParts(msg: MessageEnvelope) {
  return msg.parts.filter((part) => part.type === "file" && part.url)
}

export function extractStepStartParts(msg: MessageEnvelope) {
  return msg.parts.filter((part) => part.type === "step-start")
}

export function extractStepFinishParts(msg: MessageEnvelope) {
  return msg.parts.filter((part) => part.type === "step-finish")
}

export function extractPatchParts(msg: MessageEnvelope) {
  return msg.parts.filter((part) => part.type === "patch" && part.hash)
}

export function extractAgentParts(msg: MessageEnvelope) {
  return msg.parts.filter((part) => part.type === "agent" && part.name)
}

export function extractRetryParts(msg: MessageEnvelope) {
  return msg.parts.filter((part) => part.type === "retry")
}

export function extractCompactionParts(msg: MessageEnvelope) {
  return msg.parts.filter((part) => part.type === "compaction")
}

export function renderInline(text: string) {
  const codeChunks = text.split(/(`[^`]+`)/g)
  return codeChunks.map((chunk, index) => {
    if (chunk.startsWith("`") && chunk.endsWith("`")) {
      return <code key={`code-${index}`}>{chunk.slice(1, -1)}</code>
    }

    const nodes = []
    const boldPattern = /\*\*(.+?)\*\*/g
    let cursor = 0
    let match: RegExpExecArray | null = boldPattern.exec(chunk)

    while (match) {
      if (match.index > cursor) {
        nodes.push(<span key={`text-${index}-${cursor}`}>{chunk.slice(cursor, match.index)}</span>)
      }
      nodes.push(<strong key={`bold-${index}-${match.index}`}>{match[1]}</strong>)
      cursor = match.index + match[0].length
      match = boldPattern.exec(chunk)
    }

    if (cursor < chunk.length) {
      nodes.push(<span key={`tail-${index}-${cursor}`}>{chunk.slice(cursor)}</span>)
    }

    if (nodes.length === 0) {
      return <span key={`empty-${index}`}>{chunk}</span>
    }
    return <span key={`inline-${index}`}>{nodes}</span>
  })
}

export function toDisplayLines(text: string): string[] {
  const normalized = text.includes("\n") ? text : text.replace(/\s-\s(?=\S)/g, "\n- ")
  return normalized
    .split("\n")
    .map((line) => line.trimEnd())
    .filter((line, idx, arr) => line.length > 0 || (idx > 0 && arr[idx - 1].length > 0))
}

export function formatToolParams(input: Record<string, unknown>): string {
  try {
    const entries = Object.entries(input).filter(([, v]) => v !== undefined && v !== null)
    if (entries.length === 0) return ""
    return entries
      .map(([key, value]) => {
        const val = typeof value === "string" ? value : JSON.stringify(value)
        return `${key}: ${val}`
      })
      .join("\n")
  } catch {
    return JSON.stringify(input, null, 2)
  }
}
