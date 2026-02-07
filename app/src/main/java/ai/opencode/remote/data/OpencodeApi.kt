package ai.opencode.remote.data

import ai.opencode.remote.model.ErrorMessageDto
import ai.opencode.remote.model.GlobalEventDto
import ai.opencode.remote.model.HealthResponse
import ai.opencode.remote.model.MessageEnvelopeDto
import ai.opencode.remote.model.SendCommandRequest
import ai.opencode.remote.model.SendMessageRequest
import ai.opencode.remote.model.ServerConfig
import ai.opencode.remote.model.SessionCreateRequest
import ai.opencode.remote.model.SessionDto
import ai.opencode.remote.model.SessionStatusDto
import ai.opencode.remote.model.SessionUpdateRequest
import ai.opencode.remote.model.TodoItemDto
import ai.opencode.remote.model.FileDiffDto
import java.io.IOException
import java.util.concurrent.TimeUnit
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import kotlinx.serialization.builtins.ListSerializer
import kotlinx.serialization.builtins.MapSerializer
import kotlinx.serialization.builtins.serializer
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.JsonNull
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.JsonPrimitive
import kotlinx.serialization.json.jsonObject
import kotlinx.serialization.json.jsonPrimitive
import okhttp3.Credentials
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.RequestBody.Companion.toRequestBody

class OpencodeApi {
    private val json = Json {
        ignoreUnknownKeys = true
        explicitNulls = false
    }

    private val client = OkHttpClient.Builder()
        .connectTimeout(8, TimeUnit.SECONDS)
        .readTimeout(30, TimeUnit.SECONDS)
        .writeTimeout(30, TimeUnit.SECONDS)
        .build()

    suspend fun health(config: ServerConfig): HealthResponse =
        get(config, "/global/health", HealthResponse.serializer())

    suspend fun listSessions(config: ServerConfig): List<SessionDto> =
        get(config, "/session", ListSerializer(SessionDto.serializer()))

    suspend fun listStatuses(config: ServerConfig): Map<String, SessionStatusDto> =
        get(
            config,
            "/session/status",
            MapSerializer(String.serializer(), SessionStatusDto.serializer())
        )

    suspend fun createSession(config: ServerConfig, title: String?): SessionDto =
        post(
            config,
            "/session",
            SessionCreateRequest(title),
            SessionCreateRequest.serializer(),
            SessionDto.serializer()
        )

    suspend fun updateSessionTitle(config: ServerConfig, id: String, title: String): SessionDto =
        patch(
            config,
            "/session/$id",
            SessionUpdateRequest(title),
            SessionUpdateRequest.serializer(),
            SessionDto.serializer()
        )

    suspend fun deleteSession(config: ServerConfig, id: String): Boolean =
        delete(config, "/session/$id")

    suspend fun getMessages(config: ServerConfig, sessionId: String, limit: Int = 100): List<MessageEnvelopeDto> =
        get(
            config,
            "/session/$sessionId/message?limit=$limit",
            ListSerializer(MessageEnvelopeDto.serializer())
        )

    suspend fun getTodos(config: ServerConfig, sessionId: String): List<TodoItemDto> =
        get(config, "/session/$sessionId/todo", ListSerializer(TodoItemDto.serializer()))

    suspend fun getDiff(config: ServerConfig, sessionId: String): List<FileDiffDto> =
        get(config, "/session/$sessionId/diff", ListSerializer(FileDiffDto.serializer()))

    suspend fun sendMessage(config: ServerConfig, sessionId: String, message: String): MessageEnvelopeDto =
        post(
            config,
            "/session/$sessionId/message",
            SendMessageRequest(parts = listOf(ai.opencode.remote.model.TextPartInput(text = message))),
            SendMessageRequest.serializer(),
            MessageEnvelopeDto.serializer()
        )

    suspend fun sendCommand(config: ServerConfig, sessionId: String, command: String, arguments: String): MessageEnvelopeDto =
        post(
            config,
            "/session/$sessionId/command",
            SendCommandRequest(command = command, arguments = arguments),
            SendCommandRequest.serializer(),
            MessageEnvelopeDto.serializer()
        )

    suspend fun abort(config: ServerConfig, sessionId: String): Boolean =
        post(
            config,
            "/session/$sessionId/abort",
            emptyMap<String, String>(),
            MapSerializer(String.serializer(), String.serializer()),
            Boolean.serializer()
        )

    suspend fun streamEvents(config: ServerConfig, onEvent: (GlobalEventDto) -> Unit) = withContext(Dispatchers.IO) {
        val request = request(config, "/event")
            .header("Accept", "text/event-stream")
            .build()

        client.newCall(request).execute().use { response ->
            if (!response.isSuccessful) {
                throw IOException("SSE failed with ${response.code}")
            }
            val source = response.body?.source() ?: throw IOException("No SSE body")
            val buffer = StringBuilder()

            while (!source.exhausted()) {
                val line = source.readUtf8Line() ?: break
                if (line.startsWith("data:")) {
                    buffer.append(line.removePrefix("data:").trimStart())
                }
                if (line.isBlank() && buffer.isNotBlank()) {
                    val payload = buffer.toString()
                    runCatching {
                        decodeGlobalEvent(payload)
                    }.onSuccess(onEvent)
                    buffer.clear()
                }
            }
        }
    }

    private suspend fun <T> get(
        config: ServerConfig,
        path: String,
        serializer: kotlinx.serialization.KSerializer<T>
    ): T = withContext(Dispatchers.IO) {
        val request = request(config, path).get().build()
        execute(request, serializer)
    }

    private suspend fun <B, T> post(
        config: ServerConfig,
        path: String,
        body: B,
        bodySerializer: kotlinx.serialization.KSerializer<B>,
        serializer: kotlinx.serialization.KSerializer<T>
    ): T = withContext(Dispatchers.IO) {
        val jsonBody = json.encodeToString(bodySerializer, body)
        val request = request(config, path)
            .post(jsonBody.toRequestBody("application/json".toMediaType()))
            .build()
        execute(request, serializer)
    }

    private suspend fun <B, T> patch(
        config: ServerConfig,
        path: String,
        body: B,
        bodySerializer: kotlinx.serialization.KSerializer<B>,
        serializer: kotlinx.serialization.KSerializer<T>
    ): T = withContext(Dispatchers.IO) {
        val jsonBody = json.encodeToString(bodySerializer, body)
        val request = request(config, path)
            .patch(jsonBody.toRequestBody("application/json".toMediaType()))
            .build()
        execute(request, serializer)
    }

    private suspend fun delete(config: ServerConfig, path: String): Boolean = withContext(Dispatchers.IO) {
        val request = request(config, path).delete().build()
        execute(request, Boolean.serializer())
    }

    private fun request(config: ServerConfig, path: String): Request.Builder {
        val credential = Credentials.basic(config.username, config.password)
        return Request.Builder()
            .url(config.baseUrl + path)
            .header("Authorization", credential)
            .header("Accept", "application/json")
    }

    private fun <T> execute(request: Request, serializer: kotlinx.serialization.KSerializer<T>): T {
        client.newCall(request).execute().use { response ->
            val payload = response.body?.string().orEmpty()
            if (!response.isSuccessful) {
                val err = runCatching {
                    json.decodeFromString(ErrorMessageDto.serializer(), payload)
                }.getOrNull()
                val message = err?.message ?: err?.name ?: "HTTP ${response.code}"
                throw IOException(message)
            }
            return json.decodeFromString(serializer, payload)
        }
    }

    private fun decodeGlobalEvent(payload: String): GlobalEventDto {
        val element = json.parseToJsonElement(payload)
        val obj = element as? JsonObject ?: return GlobalEventDto()
        return if (obj.containsKey("payload")) {
            json.decodeFromJsonElement(GlobalEventDto.serializer(), obj)
        } else if (obj.containsKey("type")) {
            val type = obj["type"]?.jsonPrimitive?.content ?: "unknown"
            val wrapped = JsonObject(
                mapOf(
                    "payload" to JsonObject(
                        mapOf(
                            "type" to JsonPrimitive(type),
                            "properties" to (obj["properties"] ?: JsonNull)
                        )
                    )
                )
            )
            json.decodeFromJsonElement(GlobalEventDto.serializer(), wrapped)
        } else {
            GlobalEventDto()
        }
    }
}
