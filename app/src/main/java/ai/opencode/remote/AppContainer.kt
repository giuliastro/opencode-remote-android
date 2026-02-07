package ai.opencode.remote

import android.content.Context
import ai.opencode.remote.data.OpencodeRepository
import ai.opencode.remote.data.SecureSettingsStore

class AppContainer(context: Context) {
    private val appContext = context.applicationContext
    val settingsStore = SecureSettingsStore(appContext)
    val repository = OpencodeRepository(settingsStore)
}
