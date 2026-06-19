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

export type ModelSelection = {
  providerID: string
  modelID: string
  variant?: string
}

export type ModelOption = ModelSelection & {
  providerName: string
  modelName: string
  status?: string
  contextLimit?: number
  outputLimit?: number
  tools?: boolean
  attachments?: boolean
  isDefault?: boolean
}

export type Session = {
  id: string
  title: string
  directory: string
  time: {
    created: number
    updated: number
  }
  summary?: {
    additions: number
    deletions: number
    files: number
  }
  model?: {
    id: string
    providerID: string
    variant?: string
  }
}

export type SessionStatus = {
  type: string
  attempt?: number
  message?: string
  next?: number
}

export type MessageEnvelope = {
  info: {
    id: string
    role: string
    sessionID: string
    time: {
      created: number
      completed?: number
    }
  }
  parts: Array<{
    id: string
    type: string
    text?: string
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

export type ProjectCurrent = Record<string, unknown> & {
  name?: string
  path?: string
  directory?: string
  root?: string
}

export type VcsStatus = Record<string, unknown> & {
  branch?: string
  status?: string
  ahead?: number
  behind?: number
}

export type FileStatusEntry = Record<string, unknown> & {
  path?: string
  file?: string
  status?: string
}

export type FileEntry = {
  name: string
  path: string
  absolute: string
  type: "file" | "directory"
  ignored?: boolean
}

export type PathInfo = {
  home: string
  state: string
  config: string
  worktree: string
  directory: string
}

export type ProjectDashboard = {
  project: ProjectCurrent | null
  vcs: VcsStatus | null
  files: FileStatusEntry[]
}

export type SessionView = {
  id: string
  title: string
  directory: string
  updated: number
  status: string
  files: number
  additions: number
  deletions: number
  model?: ModelSelection
}

export type CommandInfo = {
  name: string
  description?: string
  source?: "command" | "mcp" | "skill"
}
