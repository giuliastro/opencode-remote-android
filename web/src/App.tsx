import { useEffect, useState } from "react"
import { App as CapApp } from "@capacitor/app"
import { useServerConfig } from "./hooks/useServerConfig"
import { useServerData } from "./hooks/useServerData"
import { useChat } from "./hooks/useChat"
import ProjectsScreen from "./screens/ProjectsScreen"
import SessionsScreen from "./screens/SessionsScreen"
import ChatScreen from "./screens/ChatScreen"
import SettingsScreen from "./screens/SettingsScreen"
import HelpScreen from "./screens/HelpScreen"
import type { Project } from "./types"

type Screen = "projects" | "sessions" | "chat" | "settings" | "help"

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

  const [screen, setScreen] = useState<Screen>(() =>
    sv.hasConfiguredServer ? "projects" : "settings"
  )
  const [selectedProject, setSelectedProject] = useState<Project | null>(null)

  const connected = sv.connectedVersion !== ""

  const isWorking = Boolean(
    sd.selectedSession && ["busy", "retry", "ask", "question", "permission"].includes(sd.selectedSession.status),
  )

  function openProject(project: Project) {
    setSelectedProject(project)
    setScreen("sessions")
  }

  function openSession(id: string, dir: string) {
    sd.setSelectedID(id)
    sd.loadSelected(id, dir).catch(() => undefined)
    setScreen("chat")
  }

  async function handleCreateSession(directory?: string) {
    await sd.createSession(directory)
    setScreen("chat")
  }

  function handleSaveConfig() {
    sv.saveConfig()
    sd.setRuntimeError(null)
    setScreen("projects")
  }

  // Android back button
  useEffect(() => {
    let listener: { remove: () => void } | null = null

    const onBack = () => {
      if (screen === "help") {
        setScreen("settings")
      } else if (screen === "chat") {
        setScreen("sessions")
      } else if (screen === "sessions") {
        setScreen("projects")
      }
      // else: default system behaviour
    }

    CapApp.addListener("backButton", onBack).then((l) => {
      listener = l
    })

    return () => {
      if (listener) listener.remove()
    }
  }, [screen])

  const renderScreen = () => {
    if (screen === "chat") {
      return (
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
          diff={sd.diff}
          onBack={() => setScreen("sessions")}
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
          connectedProviderIDs={sd.connectedProviderIDs}
          selectModel={chat.selectModel}
          currentVariant={sd.currentVariant}
          availableVariants={sd.availableVariants}
          cycleVariant={chat.cycleVariant}
          currentAgent={sd.currentAgent}
          primaryAgents={sd.primaryAgents}
          cycleAgent={chat.cycleAgent}
          questions={sd.questions}
          replyPermission={chat.replyPermission}
          replyQuestion={chat.replyQuestion}
          rejectQuestion={chat.rejectQuestion}
          forkSession={sd.forkSession}
          renameSession={sd.renameSession}
          onSessionForked={() => setScreen("sessions")}
        />
      )
    }

    if (screen === "help") {
      return (
        <HelpScreen
          onBack={() => setScreen("settings")}
          commands={sd.commands}
        />
      )
    }

    if (screen === "settings") {
      return (
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
          onOpenHelp={() => setScreen("help")}
          onBack={() => setScreen(sv.hasConfiguredServer ? "projects" : "settings")}
          mcpServers={sd.mcpServers}
        />
      )
    }

    if (screen === "sessions" && selectedProject) {
      return (
        <SessionsScreen
          project={selectedProject}
          sessions={sd.sessions}
          selectedID={sd.selectedID}
          onOpenSession={openSession}
          onBack={() => setScreen("projects")}
          query={sd.query}
          setQuery={sd.setQuery}
          createSession={handleCreateSession}
          runtimeError={sd.runtimeError}
          refreshSessions={sd.refreshSessions}
          deleteSession={sd.deleteSession}
        />
      )
    }

    // Default: projects
    return (
      <ProjectsScreen
        config={{ host: sv.config.host }}
        connected={connected}
        projects={sd.projects}
        sessions={sd.sessions}
        onOpenProject={openProject}
        onOpenSettings={() => setScreen("settings")}
        refreshSessions={sd.refreshSessions}
        runtimeError={sd.runtimeError}
      />
    )
  }

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
      {renderScreen()}
    </div>
  )
}

export default App
