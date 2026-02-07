package ai.opencode.remote

import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.lifecycle.viewmodel.compose.viewModel
import ai.opencode.remote.ui.AppViewModel
import ai.opencode.remote.ui.AppViewModelFactory
import ai.opencode.remote.ui.screens.OpenCodeRemoteRoot
import ai.opencode.remote.ui.theme.OpenCodeRemoteTheme

class MainActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        enableEdgeToEdge()

        val container = (application as OpenCodeRemoteApp).container

        setContent {
            OpenCodeRemoteTheme {
                val viewModel: AppViewModel = viewModel(
                    factory = AppViewModelFactory(container.repository)
                )
                val state by viewModel.state.collectAsStateWithLifecycle()
                var currentTab by rememberSaveable { mutableStateOf("sessions") }

                OpenCodeRemoteRoot(
                    state = state,
                    currentTab = currentTab,
                    onTabChange = { currentTab = it },
                    onSaveConfig = viewModel::saveConfig,
                    onTestConnection = viewModel::testConnection,
                    onRefreshSessions = viewModel::refreshSessions,
                    onOpenSession = viewModel::openSession,
                    onCreateSession = viewModel::createSession,
                    onRenameSession = viewModel::renameSession,
                    onDeleteSession = viewModel::deleteSession,
                    onSendMessage = viewModel::sendMessage,
                    onSendCommand = viewModel::sendCommand,
                    onAbort = viewModel::abortSession,
                    onClearError = viewModel::clearError
                )
            }
        }
    }
}
