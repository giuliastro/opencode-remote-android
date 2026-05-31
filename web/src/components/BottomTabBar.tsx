type Props = {
  tab: "sessions" | "new" | "settings"
  onTabChange: (tab: "sessions" | "new" | "settings") => void
}

export default function BottomTabBar({ tab, onTabChange }: Props) {
  return (
    <div className="tab-bar">
      <button
        className={`tab-item${tab === "sessions" ? " active" : ""}`}
        onClick={() => onTabChange("sessions")}
        aria-label="Sessions"
      >
        <i className="ti ti-terminal-2"></i>
        <span className="tab-label">Sessions</span>
      </button>
      <button
        className={`tab-item${tab === "new" ? " active" : ""}`}
        onClick={() => onTabChange("new")}
        aria-label="New"
      >
        <i className="ti ti-plus"></i>
        <span className="tab-label">New</span>
      </button>
      <button
        className={`tab-item${tab === "settings" ? " active" : ""}`}
        onClick={() => onTabChange("settings")}
        aria-label="Settings"
      >
        <i className="ti ti-settings"></i>
        <span className="tab-label">Settings</span>
      </button>
    </div>
  )
}
