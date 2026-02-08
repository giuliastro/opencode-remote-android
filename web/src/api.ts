import { Capacitor, CapacitorHttp } from "@capacitor/core"
import type {
  DiffFile,
  HealthResponse,
  MessageEnvelope,
  ServerConfig,
  Session,
  SessionStatus,
  TodoItem
} from "./types"

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

type RequestOptions = {
  method?: "GET" | "POST" | "PATCH" | "DELETE"
  body?: unknown
}

async function request<T>(config: ServerConfig, path: string, options: RequestOptions = {}): Promise<T> {
  const target = `${baseUrl(config)}${path}`

  const headers: Record<string, string> = {
    Accept: "application/json"
  }
  if (config.username && config.password) {
    headers.Authorization = authHeader(config)
  }
  if (options.body !== undefined) {
    headers["Content-Type"] = "application/json"
  }

  const method = options.method ?? "GET"

  if (Capacitor.isNativePlatform()) {
    try {
      const response = await CapacitorHttp.request({
        url: target,
        method,
        headers,
        data: options.body,
        connectTimeout: 12_000,
        readTimeout: 30_000
      })

      if (response.status >= 400) {
        const body = response.data
        const detail =
          (typeof body === "object" && body && (body as { data?: { message?: string } }).data?.message) ||
          (typeof body === "object" && body && (body as { message?: string }).message) ||
          JSON.stringify(body)
        throw new Error(detail || `HTTP ${response.status}`)
      }

      if (response.status === 204) return true as T
      return response.data as T
    } catch {
      throw new Error(`Network error: cannot reach ${target}. Check host, port, and firewall.`)
    }
  }

  let response: Response
  try {
    response = await fetch(target, {
      method,
      headers,
      body: options.body === undefined ? undefined : JSON.stringify(options.body)
    })
  } catch {
    const corsHint = config.username && config.password
      ? " Browser mode + Basic Auth may be blocked by CORS preflight; use APK/native mode or disable auth temporarily for browser debugging."
      : ""
    throw new Error(
      `Network error: cannot reach ${target}. Check server hostname/port, Windows firewall, and CORS (--cors).${corsHint}`
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
    return request<Session>(config, "/session", { method: "POST", body: { title } })
  },

  renameSession(config: ServerConfig, id: string, title: string) {
    return request<Session>(config, `/session/${id}`, { method: "PATCH", body: { title } })
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
      body: { parts: [{ type: "text", text }] }
    })
  },

  sendCommand(config: ServerConfig, sessionID: string, command: string, argumentsText: string, directory?: string) {
    return request<MessageEnvelope>(config, withDirectory(`/session/${sessionID}/command`, directory), {
      method: "POST",
      body: { command, arguments: argumentsText }
    })
  },

  abort(config: ServerConfig, sessionID: string) {
    return request<boolean>(config, `/session/${sessionID}/abort`, {
      method: "POST",
      body: {}
    })
  }
}
