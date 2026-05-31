import { useState } from "react"
import type { CommandInfo } from "../types"

type HelpPage = "overview" | "server" | "network" | "troubleshooting" | "commands"

type HelpScreenProps = {
  onBack: () => void
  commands: CommandInfo[]
}

export default function HelpScreen({ onBack, commands }: HelpScreenProps) {
  const [helpPage, setHelpPage] = useState<HelpPage>("overview")

  return (
    <div className="app-screen">
      {/* Header with back button */}
      <div className="chat-header" style={{ borderBottom: "1px solid #0f1520" }}>
        <div className="back-btn" onClick={onBack}>
          <i className="ti ti-chevron-left"></i>
        </div>
        <div className="chat-hinfo">
          <div className="chat-htitle">Help &amp; Documentation</div>
          <div className="chat-hsub">Quick reference and guides</div>
        </div>
      </div>

      {/* Help tabs */}
      <div className="help-tabs" role="tablist" style={{ padding: "0 14px", flexShrink: 0 }}>
        {(["overview", "server", "network", "troubleshooting", "commands"] as const).map((tab) => (
          <button
            key={tab}
            className={helpPage === tab ? "active" : ""}
            onClick={() => setHelpPage(tab)}
            role="tab"
            aria-selected={helpPage === tab}
            style={{
              flex: 1,
              padding: "8px 4px",
              fontSize: "10px",
              fontFamily: "'IBM Plex Mono', monospace",
              fontWeight: 600,
              textTransform: "uppercase",
              letterSpacing: "0.06em",
              border: "none",
              background: "none",
              color: helpPage === tab ? "#39ff9a" : "#2a3450",
              borderBottom: helpPage === tab ? "2px solid #39ff9a" : "2px solid transparent",
              cursor: "pointer"
            }}
          >
            {tab === "overview" ? "Overview" :
             tab === "server" ? "Server" :
             tab === "network" ? "Network" :
             tab === "troubleshooting" ? "Troubleshooting" :
             "Commands"}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="settings-scroll" style={{ padding: "12px 16px", flex: 1, overflowY: "auto" }}>
        {helpPage === "overview" && (
          <div className="help-content fade-in">
            <h3 style={{ fontSize: "15px", fontWeight: 700, color: "#d0d8e8", marginBottom: "12px" }}>Getting Started</h3>
            <ul style={{ fontSize: "12px", color: "#4a6080", lineHeight: "1.8", paddingLeft: "16px" }}>
              <li><strong style={{ color: "#8090b0" }}>Configure Server:</strong> Use Settings to enter host, port, username and password</li>
              <li><strong style={{ color: "#8090b0" }}>Test Connection:</strong> Press Test to validate server connectivity</li>
              <li><strong style={{ color: "#8090b0" }}>Save Settings:</strong> Press Save to apply configuration and start polling</li>
              <li><strong style={{ color: "#8090b0" }}>Browse Sessions:</strong> View and manage sessions from the Sessions tab</li>
              <li><strong style={{ color: "#8090b0" }}>Interact:</strong> Open a session and chat in the Detail view</li>
              <li><strong style={{ color: "#8090b0" }}>Quick Input:</strong> Press Enter to send, Shift+Enter for new lines</li>
              <li><strong style={{ color: "#8090b0" }}>Slash Commands:</strong> Text starting with <code style={{ background: "#101520", padding: "1px 4px", borderRadius: "3px", fontSize: "11px" }}>/</code> is sent as a command</li>
            </ul>

            <h3 style={{ fontSize: "15px", fontWeight: 700, color: "#d0d8e8", margin: "20px 0 12px" }}>Key Features</h3>
            <ul style={{ fontSize: "12px", color: "#4a6080", lineHeight: "1.8", paddingLeft: "16px" }}>
              <li>🔄 Real-time session monitoring</li>
              <li>💬 Interactive chat interface</li>
              <li>📋 Todo tracking display</li>
              <li>⚡ Instant session control</li>
              <li>🔔 Completion notifications</li>
            </ul>
          </div>
        )}

        {helpPage === "server" && (
          <div className="help-content fade-in">
            <h3 style={{ fontSize: "15px", fontWeight: 700, color: "#d0d8e8", marginBottom: "12px" }}>Starting the OpenCode Server</h3>
            <p style={{ fontSize: "12px", color: "#4a6080", marginBottom: "12px" }}>Start OpenCode server with Basic Authentication enabled:</p>

            <div className="code-blocks">
              <h4 style={{ fontSize: "11px", fontFamily: "'IBM Plex Mono', monospace", color: "#2a3450", marginBottom: "6px" }}>macOS / Linux (bash/zsh)</h4>
              <pre style={{
                background: "#060a0e",
                border: "1px solid #102030",
                borderRadius: "8px",
                padding: "10px 12px",
                fontFamily: "'IBM Plex Mono', monospace",
                fontSize: "10px",
                color: "#40c080",
                lineHeight: "1.65",
                marginBottom: "12px",
                overflow: "auto"
              }}>{`OPENCODE_SERVER_USERNAME=opencode \\
OPENCODE_SERVER_PASSWORD=your-password \\
npx -y opencode-ai serve --hostname 0.0.0.0 --port 4096`}</pre>

              <h4 style={{ fontSize: "11px", fontFamily: "'IBM Plex Mono', monospace", color: "#2a3450", marginBottom: "6px" }}>Windows PowerShell</h4>
              <pre style={{
                background: "#060a0e",
                border: "1px solid #102030",
                borderRadius: "8px",
                padding: "10px 12px",
                fontFamily: "'IBM Plex Mono', monospace",
                fontSize: "10px",
                color: "#40c080",
                lineHeight: "1.65",
                marginBottom: "12px",
                overflow: "auto"
              }}>{`$env:OPENCODE_SERVER_USERNAME="opencode"
$env:OPENCODE_SERVER_PASSWORD="your-password"
npx -y opencode-ai serve --hostname 0.0.0.0 --port 4096`}</pre>

              <h4 style={{ fontSize: "11px", fontFamily: "'IBM Plex Mono', monospace", color: "#2a3450", marginBottom: "6px" }}>Windows Command Prompt</h4>
              <pre style={{
                background: "#060a0e",
                border: "1px solid #102030",
                borderRadius: "8px",
                padding: "10px 12px",
                fontFamily: "'IBM Plex Mono', monospace",
                fontSize: "10px",
                color: "#40c080",
                lineHeight: "1.65",
                overflow: "auto"
              }}>{`set OPENCODE_SERVER_USERNAME=opencode
set OPENCODE_SERVER_PASSWORD=your-password
npx -y opencode-ai serve --hostname 0.0.0.0 --port 4096`}</pre>
            </div>

            <div className="help-note" style={{
              marginTop: "16px",
              background: "#0a1420",
              border: "1px solid #1a2840",
              borderRadius: "8px",
              padding: "10px 12px",
              fontSize: "11px",
              color: "#4a8ad0"
            }}>
              <strong style={{ display: "block", marginBottom: "4px" }}>🔧 Browser Debugging:</strong>
              <p style={{ color: "#4a6080" }}>Add CORS origins for browser testing:</p>
              <pre style={{
                background: "#060a0e",
                border: "1px solid #102030",
                borderRadius: "6px",
                padding: "8px 10px",
                fontFamily: "'IBM Plex Mono', monospace",
                fontSize: "10px",
                color: "#40c080",
                marginTop: "6px",
                overflow: "auto"
              }}>--cors http://localhost:5173 --cors http://127.0.0.1:5173</pre>
            </div>
          </div>
        )}

        {helpPage === "network" && (
          <div className="help-content fade-in">
            <h3 style={{ fontSize: "15px", fontWeight: 700, color: "#d0d8e8", marginBottom: "12px" }}>Network Configuration</h3>

            <div className="network-modes">
              <h4 style={{ fontSize: "12px", fontWeight: 600, color: "#8090b0", marginBottom: "6px" }}>🌐 LAN Mode (Recommended)</h4>
              <p style={{ fontSize: "12px", color: "#4a6080", marginBottom: "12px" }}>Use your PC's local IP address for devices on the same network:</p>
              <pre style={{
                background: "#060a0e",
                border: "1px solid #102030",
                borderRadius: "8px",
                padding: "8px 10px",
                fontFamily: "'IBM Plex Mono', monospace",
                fontSize: "10px",
                color: "#40c080",
                marginBottom: "16px"
              }}>Example: 192.168.1.61</pre>

              <h4 style={{ fontSize: "12px", fontWeight: 600, color: "#8090b0", marginBottom: "6px" }}>🌍 WAN Mode (Advanced)</h4>
              <ul style={{ fontSize: "12px", color: "#4a6080", lineHeight: "1.8", paddingLeft: "16px", marginBottom: "16px" }}>
                <li>Configure NAT/port forwarding on your router</li>
                <li>Set up a VPN for secure remote access</li>
                <li>Use a reverse proxy with TLS/HTTPS</li>
              </ul>
            </div>

            <div className="security-checklist" style={{
              background: "#0a1c12",
              border: "1px solid #1a4030",
              borderRadius: "8px",
              padding: "10px 12px"
            }}>
              <h4 style={{ fontSize: "11px", fontWeight: 600, color: "#39ff9a", marginBottom: "6px" }}>🔒 Security Requirements</h4>
              <ul style={{ fontSize: "11px", color: "#4a6080", lineHeight: "1.8", paddingLeft: "16px" }}>
                <li>✅ Open TCP port 4096 in OS firewall</li>
                <li>✅ Configure router/NAT port forwarding</li>
                <li>✅ Use strong authentication passwords</li>
                <li>✅ Prefer TLS/HTTPS for external access</li>
                <li>✅ Restrict source IPs when possible</li>
                <li>⚠️ Never expose without authentication</li>
              </ul>
            </div>
          </div>
        )}

        {helpPage === "troubleshooting" && (
          <div className="help-content fade-in">
            <h3 style={{ fontSize: "15px", fontWeight: 700, color: "#d0d8e8", marginBottom: "12px" }}>Troubleshooting Guide</h3>

            <div className="troubleshooting-steps" style={{ marginBottom: "16px" }}>
              <h4 style={{ fontSize: "12px", fontWeight: 600, color: "#8090b0", marginBottom: "6px" }}>🔍 Connection Diagnostics</h4>
              <ol style={{ fontSize: "12px", color: "#4a6080", lineHeight: "1.8", paddingLeft: "16px" }}>
                <li><strong style={{ color: "#8090b0" }}>Verify Server:</strong> Check if OpenCode is listening on port 4096</li>
                <li><strong style={{ color: "#8090b0" }}>Test Locally:</strong> Check health endpoint from the same machine</li>
                <li><strong style={{ color: "#8090b0" }}>Test Network:</strong> Check health endpoint from your phone browser</li>
                <li><strong style={{ color: "#8090b0" }}>Check Firewall:</strong> Ensure port 4096 is open in OS firewall</li>
              </ol>
            </div>

            <div className="health-checks" style={{ marginBottom: "16px" }}>
              <h4 style={{ fontSize: "12px", fontWeight: 600, color: "#8090b0", marginBottom: "8px" }}>🩺 Health Check Commands</h4>
              <div className="code-examples">
                <h5 style={{ fontSize: "11px", color: "#2a3450", marginBottom: "4px", fontFamily: "'IBM Plex Mono', monospace" }}>Local Machine:</h5>
                <pre style={{
                  background: "#060a0e",
                  border: "1px solid #102030",
                  borderRadius: "8px",
                  padding: "8px 10px",
                  fontFamily: "'IBM Plex Mono', monospace",
                  fontSize: "10px",
                  color: "#40c080",
                  lineHeight: "1.65",
                  marginBottom: "10px",
                  overflow: "auto"
                }}>{`curl -u opencode:your-password \\
http://127.0.0.1:4096/global/health`}</pre>

                <h5 style={{ fontSize: "11px", color: "#2a3450", marginBottom: "4px", fontFamily: "'IBM Plex Mono', monospace" }}>From Phone/Network:</h5>
                <pre style={{
                  background: "#060a0e",
                  border: "1px solid #102030",
                  borderRadius: "8px",
                  padding: "8px 10px",
                  fontFamily: "'IBM Plex Mono', monospace",
                  fontSize: "10px",
                  color: "#40c080",
                  lineHeight: "1.65",
                  overflow: "auto"
                }}>{`curl -u opencode:your-password \\
http://YOUR_PC_IP:4096/global/health`}</pre>
              </div>
            </div>

            <div className="common-issues" style={{
              background: "#120f04",
              border: "1px solid #2a2008",
              borderRadius: "8px",
              padding: "10px 12px"
            }}>
              <h4 style={{ fontSize: "11px", fontWeight: 600, color: "#f59e0b", marginBottom: "6px" }}>⚠️ Common Issues</h4>
              <ul style={{ fontSize: "11px", color: "#4a6080", lineHeight: "1.8", paddingLeft: "16px" }}>
                <li><strong style={{ color: "#8090b0" }}>CORS Errors:</strong> Add <code style={{ background: "#101520", padding: "1px 4px", borderRadius: "3px", fontSize: "10px" }}>--cors</code> flags to server</li>
                <li><strong style={{ color: "#8090b0" }}>Connection Timeout:</strong> Check firewall settings</li>
                <li><strong style={{ color: "#8090b0" }}>Auth Failures:</strong> Verify username/password</li>
                <li><strong style={{ color: "#8090b0" }}>Session Issues:</strong> Re-open session and check server models</li>
              </ul>
            </div>
          </div>
        )}

        {helpPage === "commands" && (
          <div className="help-content fade-in">
            <h3 style={{ fontSize: "15px", fontWeight: 700, color: "#d0d8e8", marginBottom: "8px" }}>Slash Commands</h3>
            <p style={{ fontSize: "12px", color: "#4a6080", marginBottom: "12px" }}>
              Available commands from the OpenCode server. Type these in the chat input starting with <code style={{ background: "#101520", padding: "1px 4px", borderRadius: "3px", fontSize: "11px" }}>/</code>:
            </p>

            {commands.length === 0 ? (
              <div style={{ textAlign: "center", padding: "32px 16px" }}>
                <i className="ti ti-help-circle" style={{ fontSize: "48px", display: "block", marginBottom: "12px", opacity: 0.4, color: "#2a3450" }}></i>
                <p style={{ fontSize: "13px", color: "#4a6080" }}>No commands available</p>
                <p style={{ fontSize: "11px", color: "#2a3450", marginTop: "4px" }}>Connect to a server to see available commands</p>
              </div>
            ) : (
              <>
                <div className="commands-grid">
                  {commands.map((cmd) => (
                    <div
                      key={cmd.name}
                      style={{
                        background: "#101520",
                        border: "1px solid #182030",
                        borderRadius: "10px",
                        padding: "10px 12px",
                        marginBottom: "6px"
                      }}
                    >
                      <code style={{
                        fontFamily: "'IBM Plex Mono', monospace",
                        fontSize: "12px",
                        color: "#39ff9a",
                        fontWeight: 600
                      }}>
                        /{cmd.name}
                      </code>
                      {cmd.description && (
                        <p style={{
                          fontSize: "11px",
                          color: "#4a6080",
                          marginTop: "4px"
                        }}>{cmd.description}</p>
                      )}
                    </div>
                  ))}
                </div>

                <div style={{ marginTop: "16px" }}>
                  <h4 style={{ fontSize: "12px", fontWeight: 600, color: "#8090b0", marginBottom: "8px" }}>💡 Usage Examples</h4>
                  <div className="example-commands" style={{ display: "flex", flexWrap: "wrap", gap: "6px" }}>
                    {["/help", "/status", "/clear", "/save"].map((cmd) => (
                      <pre
                        key={cmd}
                        style={{
                          background: "#060a0e",
                          border: "1px solid #102030",
                          borderRadius: "6px",
                          padding: "6px 10px",
                          fontFamily: "'IBM Plex Mono', monospace",
                          fontSize: "10px",
                          color: "#40c080"
                        }}
                      >{cmd}</pre>
                    ))}
                  </div>
                </div>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
