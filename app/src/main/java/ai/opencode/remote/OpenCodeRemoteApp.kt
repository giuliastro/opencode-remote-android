package ai.opencode.remote

import android.app.Application

class OpenCodeRemoteApp : Application() {
    lateinit var container: AppContainer

    override fun onCreate() {
        super.onCreate()
        container = AppContainer(applicationContext)
    }
}
