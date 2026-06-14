import { Capacitor, CapacitorHttp } from "@capacitor/core"
import type {
  CommandInfo,
  DiffFile,
  FileStatusEntry,
  FileEntry,
  HealthResponse,
  MessageEnvelope,
  ModelOption,
  ModelSelection,
  ProjectCurrent,
  PathInfo,
  ServerConfig,
  Session,
  SessionStatus,
  TodoItem,
  VcsStatus
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

type ConfigProvidersResponse = {
  providers: Array<{
    id: string
    name: string
    models: Record<string, {
      id?: string
      name?: string
      status?: string
      capabilities?: {
        attachment?: boolean
        toolcall?: boolean
        tools?: boolean
      }
      limit?: {
        context?: number
        output?: number
      }
      variants?: Record<string, unknown>
    }>
  }>
  default?: Record<string, string>
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

function toModelBody(model?: ModelSelection) {
  if (!model) return undefined
  return { providerID: model.providerID, modelID: model.modelID }
}

function toCreateSessionModel(model?: ModelSelection) {
  if (!model) return undefined
  return { providerID: model.providerID, id: model.modelID, variant: model.variant || undefined }
}

function modelWireName(model?: ModelSelection) {
  if (!model) return undefined
  return `${model.providerID}/${model.modelID}`
}

export const api = {
  health(config: ServerConfig) {
    return request<HealthResponse>(config, "/global/health")
  },

  listSessions(config: ServerConfig, directory?: string) {
    return request<Session[]>(config, withDirectory("/session", directory))
  },

  listStatuses(config: ServerConfig, directory?: string) {
    return request<Record<string, SessionStatus>>(config, withDirectory("/session/status", directory))
  },

  loadPath(config: ServerConfig, directory?: string) {
    return request<PathInfo>(config, withDirectory("/path", directory))
  },

  listFiles(config: ServerConfig, path: string, directory?: string) {
    return request<FileEntry[]>(config, withDirectory(`/file?path=${encodeURIComponent(path)}`, directory))
  },

  listCommands(config: ServerConfig) {
    return request<CommandInfo[]>(config, "/command")
  },

  async listModels(config: ServerConfig, directory?: string) {
    const response = await request<ConfigProvidersResponse>(config, withDirectory("/config/providers", directory))
    return response.providers.flatMap((provider) => {
      const defaultModel = response.default?.[provider.id]
      return Object.entries(provider.models).flatMap(([modelID, model]) => {
        const base: ModelOption = {
          providerID: provider.id,
          providerName: provider.name || provider.id,
          modelID: model.id || modelID,
          modelName: model.name || model.id || modelID,
          status: model.status,
          contextLimit: model.limit?.context,
          outputLimit: model.limit?.output,
          tools: Boolean(model.capabilities?.toolcall || model.capabilities?.tools),
          attachments: Boolean(model.capabilities?.attachment),
          isDefault: defaultModel === modelID
        }
        const variantIDs = Object.keys(model.variants ?? {})
        return [
          base,
          ...variantIDs.map((variant) => ({ ...base, variant, isDefault: false }))
        ]
      })
    })
  },

  createSession(config: ServerConfig, title?: string, model?: ModelSelection, directory?: string) {
    return request<Session>(config, withDirectory("/session", directory), { method: "POST", body: { title, model: toCreateSessionModel(model) } })
  },

  renameSession(config: ServerConfig, id: string, title: string, directory?: string) {
    return request<Session>(config, withDirectory(`/session/${id}`, directory), { method: "PATCH", body: { title } })
  },

  deleteSession(config: ServerConfig, id: string, directory?: string) {
    return request<boolean>(config, withDirectory(`/session/${id}`, directory), { method: "DELETE" })
  },

  loadMessages(config: ServerConfig, sessionID: string, directory?: string) {
    return request<MessageEnvelope[]>(config, withDirectory(`/session/${sessionID}/message?limit=100`, directory))
  },

  loadTodo(config: ServerConfig, sessionID: string, directory?: string) {
    return request<TodoItem[]>(config, withDirectory(`/session/${sessionID}/todo`, directory))
  },

  loadDiff(config: ServerConfig, sessionID: string, directory?: string) {
    return request<DiffFile[]>(config, withDirectory(`/session/${sessionID}/diff`, directory))
  },

  loadProjectCurrent(config: ServerConfig, directory?: string) {
    return request<ProjectCurrent>(config, withDirectory("/project/current", directory))
  },

  loadVcs(config: ServerConfig, directory?: string) {
    return request<VcsStatus>(config, withDirectory("/vcs", directory))
  },

  loadFileStatus(config: ServerConfig, directory?: string) {
    return request<FileStatusEntry[] | Record<string, FileStatusEntry>>(config, withDirectory("/file/status", directory))
  },

  sendPrompt(config: ServerConfig, sessionID: string, text: string, directory?: string, model?: ModelSelection) {
    return request<boolean>(config, withDirectory(`/session/${sessionID}/prompt_async`, directory), {
      method: "POST",
      body: { parts: [{ type: "text", text }], model: toModelBody(model), variant: model?.variant || undefined }
    })
  },

  sendCommand(config: ServerConfig, sessionID: string, command: string, argumentsText: string, directory?: string, model?: ModelSelection) {
    return request<MessageEnvelope>(config, withDirectory(`/session/${sessionID}/command`, directory), {
      method: "POST",
      body: { command, arguments: argumentsText, model: modelWireName(model), variant: model?.variant || undefined }
    })
  },

  abort(config: ServerConfig, sessionID: string, directory?: string) {
    return request<boolean>(config, withDirectory(`/session/${sessionID}/abort`, directory), {
      method: "POST",
      body: {}
    })
  }
}
