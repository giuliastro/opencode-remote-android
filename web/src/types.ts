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
}

export type CommandInfo = {
  name: string
  description?: string
}
