export type ServerConfig = {
  host: string
  port: number
  username: string
  password: string
}

export type HealthResponse = {
  healthy: boolean
  version: string
}

export type Session = {
  id: string
  title: string
  directory: string
  projectID?: string
  cost?: number
  tokens?: {
    input: number
    output: number
    reasoning: number
    cache: { read: number; write: number }
  }
  agent?: string
  model?: { id: string; providerID: string; variant?: string }
  time: {
    created: number
    updated: number
  }
  summary?: {
    additions: number
    deletions: number
    files: number
  }
}

export type Project = {
  id: string
  worktree: string
  vcs?: string
  icon?: { color: string }
  sandboxes: unknown[]
  time: { created: number; updated: number; initialized?: number }
}

export type McpServer = { status: string }

export type SessionStatus = {
  type: string
  attempt?: number
  message?: string
  next?: number
  requestID?: string
}

export type ToolStatePending = {
  status: "pending"
  input: Record<string, unknown>
  raw: string
}

export type ToolStateRunning = {
  status: "running"
  input: Record<string, unknown>
  title?: string
  metadata?: Record<string, unknown>
  time: { start: number }
}

export type ToolStateCompleted = {
  status: "completed"
  input: Record<string, unknown>
  output: string
  title: string
  metadata: Record<string, unknown>
  time: { start: number; end: number }
}

export type ToolStateError = {
  status: "error"
  input: Record<string, unknown>
  error: string
  metadata?: Record<string, unknown>
  time: { start: number; end: number }
}

export type ToolState = ToolStatePending | ToolStateRunning | ToolStateCompleted | ToolStateError

export type MessageEnvelope = {
  info: {
    id: string
    role: string
    sessionID: string
    agent?: string
    mode?: string
    // user message: model nested
    model?: {
      providerID: string
      modelID: string
    }
    // assistant message: model flat
    providerID?: string
    modelID?: string
    time: {
      created: number
      completed?: number
    }
  }
  parts: Array<{
    id: string
    type: string
    text?: string
    tool?: string
    callID?: string
    state?: ToolState
    prompt?: string
    description?: string
    agent?: string
    // ReasoningPart fields
    // (uses text field from above)
    // FilePart fields
    mime?: string
    filename?: string
    url?: string
    // StepStartPart fields
    snapshot?: string
    // StepFinishPart fields
    reason?: string
    cost?: number
    tokens?: {
      input: number
      output: number
      reasoning: number
      cache: {
        read: number
        write: number
      }
    }
    // PatchPart fields
    hash?: string
    files?: string[]
    // AgentPart fields
    name?: string
    // RetryPart fields
    attempt?: number
    error?: {
      name: string
      data: {
        message: string
      }
    }
    // CompactionPart fields
    auto?: boolean
  }>
}

export type TodoItem = {
  content: string
  status: string
  priority: string
  id: string
}

export type DiffFile = {
  file: string
  additions: number
  deletions: number
}

export type SessionView = {
  id: string
  title: string
  directory: string
  projectID?: string
  updated: number
  status: string
  statusMessage?: string
  requestID?: string
  cost?: number
  agent?: string
  files: number
  additions: number
  deletions: number
}

export type QuestionOption = {
  label: string
  description: string
}

export type QuestionInfo = {
  question: string
  header: string
  options: QuestionOption[]
  multiple?: boolean
  custom?: boolean
}

export type QuestionRequest = {
  id: string
  sessionID: string
  questions: QuestionInfo[]
}

export type CommandInfo = {
  name: string
  description?: string
}

export type AgentInfo = {
  name: string
  description?: string
  mode: "subagent" | "primary" | "all"
  hidden?: boolean
  variant?: string
  model?: {
    modelID: string
    providerID: string
  }
}

export type ModelInfo = {
  id: string
  name: string
  variants?: Record<string, unknown>
}

export type ProviderInfo = {
  id: string
  name: string
  models: Record<string, ModelInfo>
}

export type ProviderResponse = {
  all: ProviderInfo[]
  default: Record<string, string>
  connected: string[]
}

export type PathInfo = {
  home: string
  state: string
  config: string
  worktree: string
  directory: string
}
