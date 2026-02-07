package ai.opencode.remote.model

data class ServerConfig(
    val host: String = "",
    val port: Int = 4096,
    val username: String = "opencode",
    val password: String = ""
) {
    val isValid: Boolean
        get() = host.isNotBlank() && port in 1..65535 && username.isNotBlank() && password.isNotBlank()

    val baseUrl: String
        get() = "http://$host:$port"
}
