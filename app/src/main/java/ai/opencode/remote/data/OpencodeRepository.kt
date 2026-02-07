package ai.opencode.remote.data

import ai.opencode.remote.model.MessageUi
import ai.opencode.remote.model.ServerConfig
import ai.opencode.remote.model.SessionUi
import ai.opencode.remote.model.TodoItemDto
import java.io.IOException
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.Job
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch

class OpencodeRepository(
    private val settingsStore: SecureSettingsStore,
    private val api: OpencodeApi = OpencodeApi()
) {
    private val repoScope = CoroutineScope(Dispatchers.IO)
    private var eventsJob: Job? = null

    private val _config = MutableStateFlow(settingsStore.load())
    val config: StateFlow<ServerConfig> = _config.asStateFlow()

    private val _sessions = MutableStateFlow<List<SessionUi>>(emptyList())
    val sessions: StateFlow<List<SessionUi>> = _sessions.asStateFlow()

    private val _messages = MutableStateFlow<List<MessageUi>>(emptyList())
    val messages: StateFlow<List<MessageUi>> = _messages.asStateFlow()

    private val _todos = MutableStateFlow<List<TodoItemDto>>(emptyList())
    val todos: StateFlow<List<TodoItemDto>> = _todos.asStateFlow()

    private val _diffFiles = MutableStateFlow(0)
    val diffFiles: StateFlow<Int> = _diffFiles.asStateFlow()

    private val _serverVersion = MutableStateFlow<String?>(null)
    val serverVersion: StateFlow<String?> = _serverVersion.asStateFlow()

    private val _error = MutableStateFlow<String?>(null)
    val error: StateFlow<String?> = _error.asStateFlow()

    fun saveConfig(config: ServerConfig) {
        settingsStore.save(config)
        _config.value = config
    }

    suspend fun testConnection(): Result<String> {
        val current = _config.value
        return runCatching {
            val response = api.health(current)
            if (!response.healthy) {
                throw IOException("Server unhealthy")
            }
            _serverVersion.value = response.version
            response.version
        }.onFailure {
            _error.value = it.message
        }
    }

    suspend fun refreshSessions() {
        val current = _config.value
        runCatching {
            val sessions = api.listSessions(current)
            val statuses = api.listStatuses(current)
            _sessions.value = sessions
                .map { s ->
                    val st = statuses[s.id]?.type ?: "unknown"
                    SessionUi(
                        id = s.id,
                        title = s.title,
                        directory = s.directory,
                        updatedAt = s.time.updated,
                        status = st,
                        additions = s.summary?.additions ?: 0,
                        deletions = s.summary?.deletions ?: 0,
                        files = s.summary?.files ?: 0
                    )
                }
                .sortedByDescending { it.updatedAt }
        }.onFailure {
            _error.value = it.message
        }
    }

    suspend fun createSession(title: String?) {
        runCatching {
            api.createSession(_config.value, title)
            refreshSessions()
        }.onFailure {
            _error.value = it.message
        }
    }

    suspend fun renameSession(id: String, title: String) {
        runCatching {
            api.updateSessionTitle(_config.value, id, title)
            refreshSessions()
        }.onFailure {
            _error.value = it.message
        }
    }

    suspend fun deleteSession(id: String) {
        runCatching {
            api.deleteSession(_config.value, id)
            refreshSessions()
        }.onFailure {
            _error.value = it.message
        }
    }

    suspend fun loadSessionDetail(sessionId: String, directory: String?) {
        runCatching {
            val messages = api.getMessages(_config.value, sessionId, directory = directory)
            val todos = api.getTodos(_config.value, sessionId)
            val diff = api.getDiff(_config.value, sessionId)
            _messages.value = messages.mapNotNull { envelope ->
                val text = envelope.parts
                    .filter { it.type == "text" && !it.text.isNullOrBlank() }
                    .joinToString("\n") { it.text.orEmpty() }
                    .trim()
                if (text.isBlank()) {
                    null
                } else {
                    MessageUi(
                        id = envelope.info.id,
                        role = envelope.info.role,
                        createdAt = envelope.info.time.created,
                        text = text
                    )
                }
            }
            _todos.value = todos
            _diffFiles.value = diff.size
        }.onFailure {
            _error.value = it.message
        }
    }

    suspend fun sendMessage(sessionId: String, text: String, directory: String?) {
        runCatching {
            api.sendMessageAsync(_config.value, sessionId, text, directory)
            delay(400)
            loadSessionDetail(sessionId, directory)
            refreshSessions()
        }.onFailure {
            _error.value = it.message
        }
    }

    suspend fun sendCommand(sessionId: String, command: String, arguments: String, directory: String?) {
        runCatching {
            api.sendCommand(_config.value, sessionId, command, arguments, directory)
            loadSessionDetail(sessionId, directory)
            refreshSessions()
        }.onFailure {
            _error.value = it.message
        }
    }

    suspend fun abortSession(sessionId: String, directory: String?) {
        runCatching {
            api.abort(_config.value, sessionId)
            loadSessionDetail(sessionId, directory)
            refreshSessions()
        }.onFailure {
            _error.value = it.message
        }
    }

    fun clearError() {
        _error.value = null
    }

    fun startEvents(sessionIdProvider: () -> Pair<String, String?>?) {
        eventsJob?.cancel()
        eventsJob = repoScope.launch {
            while (true) {
                runCatching {
                    api.streamEvents(_config.value) { event ->
                        val type = event.payload?.type.orEmpty()
                        if (
                            type.startsWith("session.") ||
                            type.startsWith("message.") ||
                            type == "todo.updated"
                        ) {
                            repoScope.launch { refreshSessions() }
                            sessionIdProvider()?.let { (id, directory) ->
                                repoScope.launch { loadSessionDetail(id, directory) }
                            }
                        }
                    }
                }.onFailure {
                    _error.value = it.message
                    delay(2000)
                }
            }
        }
    }

    fun stopEvents() {
        eventsJob?.cancel()
        eventsJob = null
    }
}
