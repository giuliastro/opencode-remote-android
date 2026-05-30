# Tailscale Embed Plan

Embed Tailscale (userspace networking mode) directly into the OpenCode Remote Android APK so the app auto-connects to Tailscale on launch without requiring the separate Tailscale app.

## Licenses

- This project: Apache 2.0
- Tailscale (`tailscale/tailscale`): BSD 3-Clause
- Compatible: yes — include Tailscale copyright notice in app (e.g. Open Source Licenses screen)

---

## Architecture Overview

```
React (TypeScript)
    │  TailscalePlugin.ts (Capacitor JS bridge)
    ▼
Capacitor Bridge
    │  TailscalePlugin.kt (@CapacitorPlugin)
    ▼
libtailscale.aar  (Go → gomobile → Android AAR)
    │  userspace WireGuard via gVisor netstack
    ▼
Tailscale network  →  OpenCode server (100.x.x.x:4096)
```

HTTP routing: a local TCP proxy runs inside the app on `127.0.0.1:PORT`.
The Kotlin plugin accepts connections on that port and forwards them through
Tailscale's custom `Dialer`. The React app connects to `127.0.0.1:PORT`
when Tailscale mode is active, instead of the raw host IP.

---

## Phase 1 — Build `libtailscale.aar`

### 1.1 Local build (one-time, to verify)

```bash
# Install Go 1.22+
# https://go.dev/dl/

# Install gomobile
go install golang.org/x/mobile/cmd/gomobile@latest
gomobile init

# Clone Tailscale
git clone https://github.com/tailscale/tailscale
cd tailscale

# Build the AAR (targets arm64-v8a and x86_64)
gomobile bind \
  -target android \
  -androidapi 26 \
  -o libtailscale.aar \
  tailscale.com/libtailscale

# Outputs:
#   libtailscale.aar
#   libtailscale-sources.jar
```

### 1.2 Automate in GitHub Actions

Add a reusable job `build-libtailscale` to `.github/workflows/build.yml`:

```yaml
build-libtailscale:
  runs-on: ubuntu-latest
  steps:
    - uses: actions/setup-go@v5
      with:
        go-version: '1.22'
    - run: go install golang.org/x/mobile/cmd/gomobile@latest && gomobile init
    - run: |
        git clone --depth 1 https://github.com/tailscale/tailscale ts
        cd ts
        gomobile bind -target android -androidapi 26 -o ../libtailscale.aar tailscale.com/libtailscale
    - uses: actions/upload-artifact@v4
      with:
        name: libtailscale-aar
        path: libtailscale.aar
```

The APK build job downloads this artifact and places the AAR before running Gradle.

Alternatively, commit `libtailscale.aar` to `web/android/app/libs/` directly to
avoid rebuilding on every CI run. Re-build only when bumping Tailscale version.

---

## Phase 2 — Android Gradle Integration

### 2.1 Place the AAR

```
web/android/app/libs/libtailscale.aar
web/android/app/libs/libtailscale-sources.jar
```

### 2.2 `web/android/app/build.gradle`

```gradle
android {
    defaultConfig {
        minSdk 26   // libtailscale requires API 26+
    }
}

dependencies {
    implementation fileTree(dir: 'libs', include: ['*.aar', '*.jar'])
    // libtailscale transitively needs these:
    implementation 'org.jetbrains.kotlinx:kotlinx-coroutines-android:1.7.3'
}
```

### 2.3 AndroidManifest.xml permissions

```xml
<uses-permission android:name="android.permission.INTERNET" />
<uses-permission android:name="android.permission.FOREGROUND_SERVICE" />
<!-- No BIND_VPN_SERVICE needed — userspace mode only -->
```

---

## Phase 3 — Capacitor Native Plugin (`TailscalePlugin.kt`)

Create `web/android/app/src/main/java/com/opencode/remote/TailscalePlugin.kt`:

```kotlin
@CapacitorPlugin(name = "Tailscale")
class TailscalePlugin : Plugin() {

    private var tsServer: com.tailscale.libtailscale.Server? = null
    private var localProxy: LocalTcpProxy? = null

    @PluginMethod
    fun connect(call: PluginCall) {
        val authKey = call.getString("authKey") ?: return call.reject("authKey required")
        val peerAddr = call.getString("peerAddr") ?: return call.reject("peerAddr required")
        val peerPort = call.getInt("peerPort", 4096)!!

        CoroutineScope(Dispatchers.IO).launch {
            try {
                val stateDir = context.filesDir.resolve("tailscale-state").also { it.mkdirs() }
                val server = com.tailscale.libtailscale.Server()
                server.start(stateDir.absolutePath, authKey)
                tsServer = server

                // Start local TCP proxy: 127.0.0.1:14096 → peerAddr:peerPort via Tailscale
                val proxy = LocalTcpProxy(server, peerAddr, peerPort, localPort = 14096)
                proxy.start()
                localProxy = proxy

                val ret = JSObject()
                ret.put("proxyPort", 14096)
                call.resolve(ret)
            } catch (e: Exception) {
                call.reject("Tailscale connect failed: ${e.message}")
            }
        }
    }

    @PluginMethod
    fun disconnect(call: PluginCall) {
        localProxy?.stop()
        tsServer?.close()
        localProxy = null
        tsServer = null
        call.resolve()
    }

    @PluginMethod
    fun getStatus(call: PluginCall) {
        val ret = JSObject()
        ret.put("connected", tsServer != null)
        call.resolve(ret)
    }

    override fun handleOnDestroy() {
        localProxy?.stop()
        tsServer?.close()
    }
}
```

### 3.1 `LocalTcpProxy.kt` (local port → Tailscale dial)

```kotlin
class LocalTcpProxy(
    private val server: com.tailscale.libtailscale.Server,
    private val remoteHost: String,
    private val remotePort: Int,
    private val localPort: Int
) {
    private var serverSocket: ServerSocket? = null
    private val scope = CoroutineScope(Dispatchers.IO + SupervisorJob())

    fun start() {
        serverSocket = ServerSocket(localPort, 50, InetAddress.getByName("127.0.0.1"))
        scope.launch {
            while (true) {
                val client = serverSocket?.accept() ?: break
                launch { handleClient(client) }
            }
        }
    }

    private suspend fun handleClient(client: Socket) {
        // server.dial() returns a socket connected via Tailscale userspace network
        val remote = server.dial("tcp", "$remoteHost:$remotePort")
        try {
            val toRemote = launch { client.inputStream.copyTo(remote.outputStream) }
            val toClient = launch { remote.inputStream.copyTo(client.outputStream) }
            toRemote.join(); toClient.join()
        } finally {
            client.close(); remote.close()
        }
    }

    fun stop() {
        scope.cancel()
        serverSocket?.close()
    }
}
```

> **Note:** Verify `server.dial()` signature against the actual gomobile-generated
> Java API once the AAR is built. The method name and return type may differ slightly.

### 3.2 Register plugin in `MainActivity.kt`

```kotlin
class MainActivity : BridgeActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        registerPlugin(TailscalePlugin::class.java)
        super.onCreate(savedInstanceState)
    }
}
```

---

## Phase 4 — TypeScript Bridge

Create `web/src/plugins/TailscalePlugin.ts`:

```typescript
import { registerPlugin } from '@capacitor/core'

export interface TailscalePlugin {
  connect(options: {
    authKey: string
    peerAddr: string
    peerPort?: number
  }): Promise<{ proxyPort: number }>
  disconnect(): Promise<void>
  getStatus(): Promise<{ connected: boolean }>
}

export const Tailscale = registerPlugin<TailscalePlugin>('Tailscale', {
  web: () => ({
    // No-op stub for browser dev mode
    connect: async () => ({ proxyPort: 0 }),
    disconnect: async () => {},
    getStatus: async () => ({ connected: false }),
  }),
})
```

---

## Phase 5 — App Integration

### 5.1 Settings additions

Add to the existing settings screen:

- **Tailscale** section
  - Toggle: `Enable Tailscale`
  - Input: `Auth Key` (masked, type=password) — generated at tailscale.com/admin → Keys
  - Input: `Tailscale Peer Address` (the 100.x.x.x IP of the PC running OpenCode)
  - Read-only status chip: `Connected` / `Disconnected`

Store in existing settings storage (Capacitor Preferences):
- `tailscale.enabled` (boolean)
- `tailscale.authKey` (string)
- `tailscale.peerAddr` (string)

### 5.2 Connection lifecycle (`App.tsx` or top-level hook)

```typescript
import { App } from '@capacitor/app'
import { Tailscale } from './plugins/TailscalePlugin'

// On mount — connect if enabled
useEffect(() => {
  if (settings.tailscaleEnabled && isNativePlatform()) {
    Tailscale.connect({
      authKey: settings.tailscaleAuthKey,
      peerAddr: settings.tailscalePeerAddr,
    }).then(({ proxyPort }) => {
      // Override host to localhost proxy
      setEffectiveHost(`127.0.0.1:${proxyPort}`)
    })
  }

  // Re-connect when app returns to foreground
  const listener = App.addListener('appStateChange', ({ isActive }) => {
    if (isActive && settings.tailscaleEnabled) {
      // re-connect if dropped
    }
  })

  return () => { listener.then(l => l.remove()) }
}, [])
```

### 5.3 HTTP client change

When Tailscale mode is active, replace the configured host with `127.0.0.1:14096`
for all API calls. The existing HTTP client code needs no other changes — it just
hits a different base URL which the local proxy forwards through Tailscale.

---

## Phase 6 — Auth Key Setup (user-facing docs)

Add to README:

1. Go to tailscale.com/admin → Settings → Keys → Generate auth key
2. Check **Reusable** and set expiry as desired (or use ephemeral for auto-cleanup)
3. Paste the key into OpenCode Remote → Settings → Tailscale → Auth Key
4. Enter the Tailscale IP of your PC (visible in tailscale.com/admin → Machines)

---

## Phase 7 — GitHub Actions CI Update

Modify `.github/workflows/build.yml`:

1. Add `build-libtailscale` job (see Phase 1.2)
2. In the APK build job, download the AAR artifact and copy to `web/android/app/libs/`
3. Ensure `minSdk 26` in Gradle (up from current minimum if needed)

---

## Implementation Order

1. [ ] Build `libtailscale.aar` locally and verify the gomobile Java API surface
2. [ ] Add AAR to Gradle, confirm it compiles
3. [ ] Write `TailscalePlugin.kt` + `LocalTcpProxy.kt`, register in `MainActivity.kt`
4. [ ] Write `TailscalePlugin.ts` TypeScript bridge
5. [ ] Add settings UI fields (auth key, peer addr, toggle)
6. [ ] Wire lifecycle: connect on launch, disconnect on `onDestroy`
7. [ ] Test on device: confirm HTTP traffic routes through proxy to Tailscale peer
8. [ ] Automate AAR build in GitHub Actions
9. [ ] Update README with Tailscale setup instructions

---

## Risks & Unknowns

| Risk | Mitigation |
|------|------------|
| `libtailscale` gomobile API may differ from assumed | Verify actual Java class/method names from AAR after Step 1 before writing Kotlin |
| `server.dial()` may be async or callback-based in Java | Adapt `LocalTcpProxy` accordingly |
| AAR binary size (~20-40 MB) increases APK size | Acceptable for personal-use APK; enable ABI splits if needed |
| Tailscale auth key expiry breaks connection silently | Show status in UI; prompt user to refresh key |
| `minSdk 26` requirement may break older devices | Check current `minSdk` in `build.gradle`; libtailscale requires API 26+ |
| Userspace networking performance vs. OS-level VPN | Should be fine for API traffic; not a concern for this use case |
