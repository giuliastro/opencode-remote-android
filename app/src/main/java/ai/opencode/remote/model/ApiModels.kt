package ai.opencode.remote.model

import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable
import kotlinx.serialization.json.JsonElement

@Serializable
data class HealthResponse(
    val healthy: Boolean,
    val version: String
)

@Serializable
data class SessionDto(
    val id: String,
    val title: String,
    val directory: String,
    val time: SessionTimeDto,
    val summary: SessionSummaryDto? = null
)

@Serializable
data class SessionTimeDto(
    val created: Long,
    val updated: Long
)

@Serializable
data class SessionSummaryDto(
    val additions: Int = 0,
    val deletions: Int = 0,
    val files: Int = 0
)

@Serializable
data class TodoItemDto(
    val content: String,
    val status: String,
    val priority: String,
    val id: String
)

@Serializable
data class FileDiffDto(
    val file: String,
    val additions: Int,
    val deletions: Int
)

@Serializable
data class MessageEnvelopeDto(
    val info: MessageInfoDto,
    val parts: List<MessagePartDto>
)

@Serializable
data class MessageInfoDto(
    val id: String,
    val role: String,
    val sessionID: String,
    val time: MessageTimeDto
)

@Serializable
data class MessageTimeDto(
    val created: Long,
    val completed: Long? = null
)

@Serializable
data class MessagePartDto(
    val id: String,
    val type: String,
    val text: String? = null,
    val tool: String? = null,
    val state: JsonElement? = null
)

@Serializable
data class SessionCreateRequest(
    val title: String? = null
)

@Serializable
data class SessionUpdateRequest(
    val title: String? = null
)

@Serializable
data class TextPartInput(
    val type: String = "text",
    val text: String
)

@Serializable
data class SendMessageRequest(
    val parts: List<TextPartInput>,
    val noReply: Boolean = false
)

@Serializable
data class SendCommandRequest(
    val command: String,
    val arguments: String = ""
)

@Serializable
data class SessionStatusDto(
    val type: String,
    val attempt: Int? = null,
    val message: String? = null,
    val next: Long? = null
)

@Serializable
data class GlobalEventDto(
    val directory: String? = null,
    val payload: EventPayloadDto? = null
)

@Serializable
data class EventPayloadDto(
    val type: String,
    val properties: JsonElement? = null
)

data class SessionUi(
    val id: String,
    val title: String,
    val directory: String,
    val updatedAt: Long,
    val status: String,
    val additions: Int,
    val deletions: Int,
    val files: Int
)

data class MessageUi(
    val id: String,
    val role: String,
    val createdAt: Long,
    val text: String
)

@Serializable
data class ErrorMessageDto(
    @SerialName("message") val message: String? = null,
    @SerialName("name") val name: String? = null
)
