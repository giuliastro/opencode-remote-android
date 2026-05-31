import { useEffect, useState } from "react"
import type { ServerConfig } from "../types"
import { api } from "../api"

const STORAGE_KEY = "opencode.remote.server"
const THEME_KEY = "opencode.remote.theme"
const PREFS_KEY = "opencode.remote.prefs"

export type NoticeType = "info" | "success" | "error"

const defaultConfig: ServerConfig = {
  host: "",
  port: 4096,
  username: "opencode",
  password: ""
}

export function useServerConfig() {
  const [config, setConfig] = useState<ServerConfig>(() => {
    const saved = localStorage.getItem(STORAGE_KEY)
    if (!saved) return defaultConfig
    try {
      return { ...defaultConfig, ...JSON.parse(saved) }
    } catch {
      return defaultConfig
    }
  })

  const [theme, setTheme] = useState<"dark" | "light">(() => {
    return (localStorage.getItem(THEME_KEY) as "dark" | "light") ?? "light"
  })

  const [prefs, setPrefs] = useState<{ sound: boolean; autoScroll: boolean }>(() => {
    const saved = localStorage.getItem(PREFS_KEY)
    if (!saved) return { sound: true, autoScroll: true }
    try {
      return { ...{ sound: true, autoScroll: true }, ...JSON.parse(saved) }
    } catch {
      return { sound: true, autoScroll: true }
    }
  })

  const [draftConfig, setDraftConfig] = useState<ServerConfig>(config)
  const [connectedVersion, setConnectedVersion] = useState<string>("")
  const [settingsNotice, setSettingsNotice] = useState<{ type: NoticeType; text: string } | null>(null)
  const [testingConnection, setTestingConnection] = useState(false)

  const hasConfiguredServer = Boolean(config.host && config.port > 0)

  // Persist theme changes to DOM and localStorage
  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme)
    localStorage.setItem(THEME_KEY, theme)
  }, [theme])

  // Persist prefs changes to localStorage
  useEffect(() => {
    localStorage.setItem(PREFS_KEY, JSON.stringify(prefs))
  }, [prefs])

  // Keep connection status in sync on startup and whenever saved config changes.
  useEffect(() => {
    if (!config.host || !config.password) {
      setConnectedVersion("")
      return
    }

    let active = true

    ;(async () => {
      try {
        const health = await Promise.race([
          api.health(config),
          new Promise<never>((_, reject) => setTimeout(() => reject(new Error("Connection timed out")), 12000))
        ])
        if (active) setConnectedVersion(health.version)
      } catch {
        if (active) setConnectedVersion("")
      }
    })()

    return () => {
      active = false
    }
  }, [config])

  function saveConfig() {
    setConfig(draftConfig)
    localStorage.setItem(STORAGE_KEY, JSON.stringify(draftConfig))
    setSettingsNotice({ type: "success", text: "Configuration saved. Press Test to validate connectivity." })
  }

  async function testConnection(configToTest: ServerConfig) {
    setTestingConnection(true)
    setSettingsNotice({ type: "info", text: "Testing connection..." })
    try {
      const health = await Promise.race([
        api.health(configToTest),
        new Promise<never>((_, reject) => setTimeout(() => reject(new Error("Connection timed out")), 12000))
      ])
      setConnectedVersion(health.version)
      setSettingsNotice({ type: "success", text: `Connected to OpenCode ${health.version}` })
    } catch (err) {
      setConnectedVersion("")
      setSettingsNotice({ type: "error", text: `Connection failed: ${(err as Error).message}` })
    } finally {
      setTestingConnection(false)
    }
  }

  return {
    config,
    setConfig,
    theme,
    setTheme,
    draftConfig,
    setDraftConfig,
    connectedVersion,
    setConnectedVersion,
    settingsNotice,
    setSettingsNotice,
    testingConnection,
    setTestingConnection,
    prefs,
    setPrefs,
    saveConfig,
    testConnection,
    hasConfiguredServer,
    defaultConfig
  }
}
