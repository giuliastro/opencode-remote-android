package ai.opencode.remote.data

import android.content.Context
import android.content.SharedPreferences
import ai.opencode.remote.model.ServerConfig
import androidx.security.crypto.EncryptedSharedPreferences
import androidx.security.crypto.MasterKeys

class SecureSettingsStore(context: Context) {
    private val prefs: SharedPreferences

    init {
        val keyAlias = MasterKeys.getOrCreate(MasterKeys.AES256_GCM_SPEC)
        prefs = EncryptedSharedPreferences.create(
            "opencode_remote_secure",
            keyAlias,
            context,
            EncryptedSharedPreferences.PrefKeyEncryptionScheme.AES256_SIV,
            EncryptedSharedPreferences.PrefValueEncryptionScheme.AES256_GCM
        )
    }

    fun save(config: ServerConfig) {
        prefs.edit()
            .putString(KEY_HOST, config.host)
            .putInt(KEY_PORT, config.port)
            .putString(KEY_USERNAME, config.username)
            .putString(KEY_PASSWORD, config.password)
            .apply()
    }

    fun load(): ServerConfig {
        return ServerConfig(
            host = prefs.getString(KEY_HOST, "") ?: "",
            port = prefs.getInt(KEY_PORT, 4096),
            username = prefs.getString(KEY_USERNAME, "opencode") ?: "opencode",
            password = prefs.getString(KEY_PASSWORD, "") ?: ""
        )
    }

    companion object {
        private const val KEY_HOST = "host"
        private const val KEY_PORT = "port"
        private const val KEY_USERNAME = "username"
        private const val KEY_PASSWORD = "password"
    }
}
