# OpenCode Remote (Web + Android APK)

OpenCode Remote is now a web-first mobile UI built with React + Vite, then packaged as Android APK through Capacitor.

This gives fast debugging during development and stable APK generation when needed.

## Features

- manage local OpenCode server credentials and connection
- list sessions with status (`idle`, `busy`, `retry`)
- inspect session messages and todo items
- send prompt text or slash commands to a selected session
- abort a running session
- mobile-first responsive layout (works in browser and Android WebView)

## Why Web-First

- faster iteration: no APK rebuild for every bug fix
- easier debugging with browser network/tools
- same UI can run in browser and inside Android app
- APK generated only when you want to install on device

## Run Locally (Web)

```bash
cd web
npm install
npm run dev
```

Open the shown URL from your browser (or your phone on the same LAN).

## OpenCode Server Setup

Start the OpenCode server with LAN access and Basic Auth.

PowerShell example:

```powershell
$env:OPENCODE_SERVER_USERNAME="opencode"
$env:OPENCODE_SERVER_PASSWORD="your-password"
npx -y opencode-ai serve --hostname 0.0.0.0 --port 4096 --cors http://localhost:5173
```

If you open the web UI from another host/IP, add corresponding `--cors` origins.

For Android APK (Capacitor WebView), include `http://localhost` as allowed origin too:

```powershell
npx -y opencode-ai serve --hostname 0.0.0.0 --port 4096 --cors http://localhost --cors http://localhost:5173 --cors http://<YOUR_PC_IP>:5173
```

If mobile still cannot connect, allow TCP 4096 through Windows Firewall.

## Android APK Build (Cloud, no local SDK required)

1. Push to `main` or run workflow manually.
2. Open GitHub Actions -> **Build Android APK**.
3. Download artifact `opencode-remote-debug-apk`.
4. Install `app-debug.apk` on Android.

The workflow does this automatically:

- builds the React app
- creates Capacitor Android project
- compiles debug APK with Gradle

## Manual Android Packaging (Optional)

```bash
cd web
npm run build
npx cap add android
npx cap sync android
```

Then open `web/android` in Android Studio if you want local native debugging.

## App Configuration

Use your LAN server values:

- Host: computer LAN IP (for example `192.168.1.20`)
- Port: `4096`
- Username/password: Basic Auth credentials used to start OpenCode server

## Main Endpoints Used

- `/global/health`
- `/session`, `/session/status`, `/session/:id`
- `/session/:id/message`, `/session/:id/command`, `/session/:id/abort`
- `/session/:id/todo`, `/session/:id/diff`
