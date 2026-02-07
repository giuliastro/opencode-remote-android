package ai.opencode.remote.ui

import ai.opencode.remote.data.OpencodeRepository
import ai.opencode.remote.model.MessageUi
import ai.opencode.remote.model.ServerConfig
import ai.opencode.remote.model.SessionUi
import ai.opencode.remote.model.TodoItemDto
import androidx.lifecycle.ViewModel
import androidx.lifecycle.ViewModelProvider
import androidx.lifecycle.viewModelScope
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch

data class AppUiState(
    val config: ServerConfig = ServerConfig(),
    val sessions: List<SessionUi> = emptyList(),
    val selectedSessionId: String? = null,
    val messages: List<MessageUi> = emptyList(),
    val todos: List<TodoItemDto> = emptyList(),
    val diffFiles: Int = 0,
    val serverVersion: String? = null,
    val loading: Boolean = false,
    val error: String? = null,
    val connectionMessage: String? = null
)

class AppViewModel(private val repository: OpencodeRepository) : ViewModel() {
    private val _state = MutableStateFlow(AppUiState(config = repository.config.value))
    val state: StateFlow<AppUiState> = _state.asStateFlow()

    init {
        viewModelScope.launch {
            repository.config.collect { cfg ->
                _state.update { it.copy(config = cfg) }
            }
        }
        viewModelScope.launch {
            repository.sessions.collect { sessions ->
                _state.update { it.copy(sessions = sessions) }
            }
        }
        viewModelScope.launch {
            repository.messages.collect { messages ->
                _state.update { it.copy(messages = messages) }
            }
        }
        viewModelScope.launch {
            repository.todos.collect { todos ->
                _state.update { it.copy(todos = todos) }
            }
        }
        viewModelScope.launch {
            repository.diffFiles.collect { diffCount ->
                _state.update { it.copy(diffFiles = diffCount) }
            }
        }
        viewModelScope.launch {
            repository.serverVersion.collect { version ->
                _state.update { it.copy(serverVersion = version) }
            }
        }
        viewModelScope.launch {
            repository.error.collect { error ->
                _state.update { it.copy(error = error) }
            }
        }

        repository.startEvents { _state.value.selectedSessionId }
        refreshSessions()
    }

    fun saveConfig(config: ServerConfig) {
        repository.saveConfig(config)
        _state.update { it.copy(connectionMessage = "Configurazione salvata") }
    }

    fun testConnection() {
        viewModelScope.launch {
            _state.update { it.copy(loading = true, connectionMessage = null) }
            val result = repository.testConnection()
            _state.update {
                it.copy(
                    loading = false,
                    connectionMessage = result.fold(
                        onSuccess = { version -> "Connesso. OpenCode v$version" },
                        onFailure = { err -> "Connessione fallita: ${err.message}" }
                    )
                )
            }
        }
    }

    fun refreshSessions() {
        viewModelScope.launch {
            _state.update { it.copy(loading = true) }
            repository.refreshSessions()
            _state.update { it.copy(loading = false) }
        }
    }

    fun createSession(title: String?) {
        viewModelScope.launch {
            repository.createSession(title)
        }
    }

    fun renameSession(id: String, title: String) {
        viewModelScope.launch {
            repository.renameSession(id, title)
        }
    }

    fun deleteSession(id: String) {
        viewModelScope.launch {
            repository.deleteSession(id)
        }
    }

    fun openSession(sessionId: String) {
        _state.update { it.copy(selectedSessionId = sessionId) }
        viewModelScope.launch {
            _state.update { it.copy(loading = true) }
            repository.loadSessionDetail(sessionId)
            _state.update { it.copy(loading = false) }
        }
    }

    fun sendMessage(text: String) {
        val sessionId = _state.value.selectedSessionId ?: return
        viewModelScope.launch {
            repository.sendMessage(sessionId, text)
        }
    }

    fun sendCommand(command: String, arguments: String) {
        val sessionId = _state.value.selectedSessionId ?: return
        viewModelScope.launch {
            repository.sendCommand(sessionId, command, arguments)
        }
    }

    fun abortSession() {
        val sessionId = _state.value.selectedSessionId ?: return
        viewModelScope.launch {
            repository.abortSession(sessionId)
        }
    }

    fun clearError() {
        repository.clearError()
    }

    override fun onCleared() {
        repository.stopEvents()
        super.onCleared()
    }
}

class AppViewModelFactory(private val repository: OpencodeRepository) : ViewModelProvider.Factory {
    override fun <T : ViewModel> create(modelClass: Class<T>): T {
        if (modelClass.isAssignableFrom(AppViewModel::class.java)) {
            @Suppress("UNCHECKED_CAST")
            return AppViewModel(repository) as T
        }
        throw IllegalArgumentException("Unknown ViewModel class")
    }
}
