# OpenCode Remote (Android)

App Android per controllare OpenCode in rete locale (LAN):

- monitor sessioni attive e stato (`idle`, `busy`, `retry`)
- vedere avanzamento (messaggi, todo, diff)
- inviare prompt e slash command
- interrompere una sessione in esecuzione

## Requisiti server

Avvia OpenCode sul tuo PC in LAN:

```bash
OPENCODE_SERVER_USERNAME=opencode OPENCODE_SERVER_PASSWORD=la-tua-password opencode serve --hostname 0.0.0.0 --port 4096
```

Assicurati che telefono e PC siano sulla stessa rete Wi-Fi.

## Installazione APK da GitHub Actions

1. Carica questo progetto su GitHub.
2. Apri tab **Actions** e avvia **Build Android APK**.
3. Scarica artifact `opencode-remote-debug-apk`.
4. Installa `app-debug.apk` sul telefono Android.

Non serve installare Android SDK sul tuo PC.

## Configurazione app

Nella tab **Server** imposta:

- Host: IP LAN del PC (es. `192.168.1.20`)
- Porta: `4096` (o quella che usi)
- Username/password Basic Auth del server OpenCode

Poi premi **Salva** e **Test connessione**.

## Endpoints usati

- `/global/health`
- `/event` (SSE)
- `/session`, `/session/status`, `/session/:id`
- `/session/:id/message`, `/session/:id/command`, `/session/:id/abort`
- `/session/:id/todo`, `/session/:id/diff`
