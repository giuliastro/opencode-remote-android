import { useEffect, useState } from "react"
import { App as CapApp } from "@capacitor/app"
import { useServerConfig } from "./hooks/useServerConfig"
import { useServerData } from "./hooks/useServerData"
import { useChat } from "./hooks/useChat"
import SessionsScreen from "./screens/SessionsScreen"
import ChatScreen from "./screens/ChatScreen"
import SettingsScreen from "./screens/SettingsScreen"
import HelpScreen from "./screens/HelpScreen"

function App() {
  const sv = useServerConfig()
  const sd = useServerData(sv.config)

  const chat = useChat({
    config: sv.config,
    selectedSession: sd.selectedSession,
    messages: sd.messages,
    commands: sd.commands,
    currentAgent: sd.currentAgent,
    setCurrentAgent: sd.setCurrentAgent,
    currentVariant: sd.currentVariant,
    setCurrentVariant: sd.setCurrentVariant,
    sessionInfo: sd.sessionInfo,
    availableVariants: sd.availableVariants,
    primaryAgents: sd.primaryAgents,
    loadSelected: sd.loadSelected,
    refreshSessions: sd.refreshSessions,
    createSession: sd.createSession,
    setMessages: sd.setMessages,
    setRuntimeError: sd.setRuntimeError,
    prefs: sv.prefs,
  })

  const [tab, setTab] = useState<"sessions" | "settings">(() =>
    sv.hasConfiguredServer ? "sessions" : "settings",
  )
  const [chatOpen, setChatOpen] = useState(false)
  const [helpOpen, setHelpOpen] = useState(false)

  const connected = sv.connectedVersion !== ""

  const isWorking = Boolean(
    sd.selectedSession && ["busy", "retry", "ask"].includes(sd.selectedSession.status),
  )

  function openSession(id: string, dir: string) {
    sd.setSelectedID(id)
    sd.loadSelected(id, dir).catch(() => undefined)
    setChatOpen(true)
  }

  function handleSaveConfig() {
    sv.saveConfig()
    sd.setRuntimeError(null)
    setTab("sessions")
  }

  async function handleCreateSession() {
    await sd.createSession()
    setChatOpen(true)
  }

  // ── Android back button ──────────────────────────────────────────
  useEffect(() => {
    let listener: { remove: () => void } | null = null

    const onBack = () => {
      if (helpOpen) {
        setHelpOpen(false)
      } else if (chatOpen) {
        setChatOpen(false)
        setTab("sessions")
      }
      // else: default system behaviour
    }

    CapApp.addListener("backButton", onBack).then((l) => {
      listener = l
    })

    return () => {
      if (listener) listener.remove()
    }
  }, [helpOpen, chatOpen])

  return (
    <div className="app-shell">
      {sd.toast && (
        <div
          className={`toast toast-${sd.toast.type} fade-in`}
          onClick={() => sd.setToast(null)}
        >
          {sd.toast.text}
        </div>
      )}

      {chatOpen ? (
        <ChatScreen
          selectedSession={sd.selectedSession}
          renderedMessages={sd.renderedMessages}
          loadingSessionID={sd.loadingSessionID}
          selectedID={sd.selectedID}
          todos={sd.todos}
          todosExpanded={sd.todosExpanded}
          setTodosExpanded={sd.setTodosExpanded}
          sessionInfo={sd.sessionInfo}
          runtimeError={sd.runtimeError}
          onBack={() => {
            setChatOpen(false)
            setTab("sessions")
          }}
          isWorking={isWorking}
          abortSession={chat.abortSession}
          composer={chat.composer}
          setComposer={chat.setComposer}
          send={chat.send}
          slashOpen={chat.slashOpen}
          setSlashOpen={chat.setSlashOpen}
          slashFilter={chat.slashFilter}
          setSlashFilter={chat.setSlashFilter}
          slashIndex={chat.slashIndex}
          setSlashIndex={chat.setSlashIndex}
          filteredCommands={chat.filteredCommands}
          handleSlashSelect={chat.handleSlashSelect}
          messagesRef={chat.messagesRef}
          textareaRef={chat.textareaRef}
          providers={sd.providers}
          selectModel={chat.selectModel}
        />
      ) : helpOpen ? (
        <HelpScreen
          onBack={() => setHelpOpen(false)}
          commands={sd.commands}
        />
      ) : (
        <>
          {tab === "sessions" && (
            <SessionsScreen
              config={{ host: sv.config.host }}
              connected={connected}
              filteredSessions={sd.filteredSessions}
              selectedID={sd.selectedID}
              onOpenSession={openSession}
              query={sd.query}
              setQuery={sd.setQuery}
              createSession={handleCreateSession}
              serverDirectory={sd.serverDirectory}
              runtimeError={sd.runtimeError}
              refreshSessions={sd.refreshSessions}
              onOpenSettings={() => setTab("settings")}
              deleteSession={sd.deleteSession}
            />
          )}
          {tab === "settings" && (
            <SettingsScreen
              theme={sv.theme}
              setTheme={sv.setTheme}
              draftConfig={sv.draftConfig}
              setDraftConfig={sv.setDraftConfig}
              connectedVersion={sv.connectedVersion}
              settingsNotice={sv.settingsNotice}
              testingConnection={sv.testingConnection}
              prefs={sv.prefs}
              setPrefs={sv.setPrefs}
              saveConfig={handleSaveConfig}
              testConnection={sv.testConnection}
              onOpenHelp={() => setHelpOpen(true)}
              onBack={() => setTab("sessions")}
            />
          )}
        </>
      )}
    </div>
  )
}

export default App
