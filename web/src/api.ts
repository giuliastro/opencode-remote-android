import type {
  DiffFile,
  HealthResponse,
  MessageEnvelope,
  ServerConfig,
  Session,
  SessionStatus,
  TodoItem
} from "./types"

const jsonHeaders = {
  "Content-Type": "application/json",
  Accept: "application/json"
}

function authHeader(config: ServerConfig): string {
  return `Basic ${btoa(`${config.username}:${config.password}`)}`
}

function baseUrl(config: ServerConfig): string {
  return `http://${config.host}:${config.port}`
}

function withDirectory(path: string, directory?: string): string {
  if (!directory) return path
  const joiner = path.includes("?") ? "&" : "?"
  return `${path}${joiner}directory=${encodeURIComponent(directory)}`
}

async function request<T>(config: ServerConfig, path: string, init?: RequestInit): Promise<T> {
  const target = `${baseUrl(config)}${path}`
  let response: Response
  try {
    response = await fetch(target, {
      ...init,
      headers: {
        Authorization: authHeader(config),
        ...(init?.headers ?? {})
      }
    })
  } catch {
    throw new Error(
      `Network error: cannot reach ${target}. Check server hostname/port, Windows firewall, and CORS (--cors).`
    )
  }

  if (!response.ok) {
    let detail = `HTTP ${response.status}`
    try {
      const body = await response.json()
      detail = body?.data?.message ?? body?.message ?? JSON.stringify(body)
    } catch {
      const text = await response.text()
      if (text) detail = text
    }
    throw new Error(detail)
  }

  if (response.status === 204) return true as T
  return (await response.json()) as T
}

export const api = {
  health(config: ServerConfig) {
    return request<HealthResponse>(config, "/global/health")
  },

  listSessions(config: ServerConfig) {
    return request<Session[]>(config, "/session")
  },

  listStatuses(config: ServerConfig) {
    return request<Record<string, SessionStatus>>(config, "/session/status")
  },

  createSession(config: ServerConfig, title?: string) {
    return request<Session>(config, "/session", {
      method: "POST",
      headers: jsonHeaders,
      body: JSON.stringify({ title })
    })
  },

  renameSession(config: ServerConfig, id: string, title: string) {
    return request<Session>(config, `/session/${id}`, {
      method: "PATCH",
      headers: jsonHeaders,
      body: JSON.stringify({ title })
    })
  },

  deleteSession(config: ServerConfig, id: string) {
    return request<boolean>(config, `/session/${id}`, { method: "DELETE" })
  },

  loadMessages(config: ServerConfig, sessionID: string, directory?: string) {
    return request<MessageEnvelope[]>(config, withDirectory(`/session/${sessionID}/message?limit=100`, directory))
  },

  loadTodo(config: ServerConfig, sessionID: string) {
    return request<TodoItem[]>(config, `/session/${sessionID}/todo`)
  },

  loadDiff(config: ServerConfig, sessionID: string) {
    return request<DiffFile[]>(config, `/session/${sessionID}/diff`)
  },

  sendPrompt(config: ServerConfig, sessionID: string, text: string, directory?: string) {
    return request<MessageEnvelope>(config, withDirectory(`/session/${sessionID}/message`, directory), {
      method: "POST",
      headers: jsonHeaders,
      body: JSON.stringify({ parts: [{ type: "text", text }] })
    })
  },

  sendCommand(config: ServerConfig, sessionID: string, command: string, argumentsText: string, directory?: string) {
    return request<MessageEnvelope>(config, withDirectory(`/session/${sessionID}/command`, directory), {
      method: "POST",
      headers: jsonHeaders,
      body: JSON.stringify({ command, arguments: argumentsText })
    })
  },

  abort(config: ServerConfig, sessionID: string) {
    return request<boolean>(config, `/session/${sessionID}/abort`, {
      method: "POST",
      headers: jsonHeaders,
      body: JSON.stringify({})
    })
  }
}
