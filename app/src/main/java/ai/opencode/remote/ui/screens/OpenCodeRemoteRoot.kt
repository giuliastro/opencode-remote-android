package ai.opencode.remote.ui.screens

import ai.opencode.remote.model.ServerConfig
import ai.opencode.remote.model.SessionUi
import ai.opencode.remote.ui.AppUiState
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Add
import androidx.compose.material.icons.filled.Delete
import androidx.compose.material.icons.filled.PlayArrow
import androidx.compose.material.icons.filled.Refresh
import androidx.compose.material.icons.filled.Settings
import androidx.compose.material.icons.filled.Stop
import androidx.compose.material3.AssistChip
import androidx.compose.material3.AssistChipDefaults
import androidx.compose.material3.Button
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.Divider
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.FloatingActionButton
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Scaffold
import androidx.compose.material3.SnackbarHost
import androidx.compose.material3.SnackbarHostState
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.material3.TopAppBar
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun OpenCodeRemoteRoot(
    state: AppUiState,
    currentTab: String,
    onTabChange: (String) -> Unit,
    onSaveConfig: (ServerConfig) -> Unit,
    onTestConnection: () -> Unit,
    onRefreshSessions: () -> Unit,
    onOpenSession: (String) -> Unit,
    onCreateSession: (String?) -> Unit,
    onRenameSession: (String, String) -> Unit,
    onDeleteSession: (String) -> Unit,
    onSendMessage: (String) -> Unit,
    onSendCommand: (String, String) -> Unit,
    onAbort: () -> Unit,
    onClearError: () -> Unit
) {
    val snackbarHostState = remember { SnackbarHostState() }

    LaunchedEffect(state.error) {
        val message = state.error ?: return@LaunchedEffect
        snackbarHostState.showSnackbar(message)
        onClearError()
    }

    Scaffold(
        snackbarHost = { SnackbarHost(hostState = snackbarHostState) },
        topBar = {
            TopAppBar(
                title = {
                    Column {
                        Text("OpenCode Remote")
                        Text(
                            text = "Controllo server locale",
                            style = MaterialTheme.typography.labelMedium,
                            color = MaterialTheme.colorScheme.onSurfaceVariant
                        )
                    }
                },
                actions = {
                    IconButton(onClick = onRefreshSessions) {
                        Icon(Icons.Default.Refresh, contentDescription = "Aggiorna")
                    }
                }
            )
        },
        floatingActionButton = {
            if (currentTab == "sessions") {
                FloatingActionButton(onClick = { onCreateSession("Nuova sessione mobile") }) {
                    Icon(Icons.Default.Add, contentDescription = "Nuova sessione")
                }
            }
        }
    ) { paddingValues ->
        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(paddingValues)
                .background(
                    Brush.verticalGradient(
                        listOf(
                            MaterialTheme.colorScheme.surface,
                            MaterialTheme.colorScheme.background
                        )
                    )
                )
        ) {
            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(horizontal = 16.dp, vertical = 8.dp),
                horizontalArrangement = Arrangement.spacedBy(8.dp)
            ) {
                AssistChip(
                    onClick = { onTabChange("sessions") },
                    label = { Text("Sessioni") },
                    colors = chipColors(selected = currentTab == "sessions")
                )
                AssistChip(
                    onClick = { onTabChange("detail") },
                    label = { Text("Dettaglio") },
                    colors = chipColors(selected = currentTab == "detail")
                )
                AssistChip(
                    onClick = { onTabChange("settings") },
                    label = { Text("Server") },
                    leadingIcon = { Icon(Icons.Default.Settings, contentDescription = null) },
                    colors = chipColors(selected = currentTab == "settings")
                )
            }

            if (state.loading) {
                Row(
                    modifier = Modifier.padding(horizontal = 16.dp, vertical = 6.dp),
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    CircularProgressIndicator(modifier = Modifier.size(16.dp), strokeWidth = 2.dp)
                    Spacer(modifier = Modifier.width(8.dp))
                    Text("Aggiornamento in corso...", style = MaterialTheme.typography.labelMedium)
                }
            }

            when (currentTab) {
                "sessions" -> SessionsScreen(
                    state = state,
                    onOpenSession = {
                        onOpenSession(it)
                        onTabChange("detail")
                    },
                    onRenameSession = onRenameSession,
                    onDeleteSession = onDeleteSession
                )

                "detail" -> SessionDetailScreen(
                    state = state,
                    onSendMessage = onSendMessage,
                    onSendCommand = onSendCommand,
                    onAbort = onAbort
                )

                else -> SettingsScreen(
                    state = state,
                    onSaveConfig = onSaveConfig,
                    onTestConnection = onTestConnection
                )
            }
        }
    }
}

@Composable
private fun chipColors(selected: Boolean) =
    AssistChipDefaults.assistChipColors(
        containerColor = if (selected) MaterialTheme.colorScheme.primaryContainer else MaterialTheme.colorScheme.surface,
        labelColor = if (selected) MaterialTheme.colorScheme.onPrimaryContainer else MaterialTheme.colorScheme.onSurface
    )

@Composable
private fun SessionsScreen(
    state: AppUiState,
    onOpenSession: (String) -> Unit,
    onRenameSession: (String, String) -> Unit,
    onDeleteSession: (String) -> Unit
) {
    var query by remember { mutableStateOf("") }
    val visible = state.sessions.filter {
        query.isBlank() ||
            it.title.contains(query, ignoreCase = true) ||
            it.directory.contains(query, ignoreCase = true)
    }

    Column(modifier = Modifier.fillMaxSize()) {
        OutlinedTextField(
            value = query,
            onValueChange = { query = it },
            label = { Text("Cerca sessioni") },
            modifier = Modifier
                .fillMaxWidth()
                .padding(horizontal = 16.dp)
        )

        Spacer(modifier = Modifier.height(8.dp))

        LazyColumn(
            modifier = Modifier.fillMaxSize(),
            verticalArrangement = Arrangement.spacedBy(10.dp)
        ) {
            items(visible, key = { it.id }) { session ->
                SessionCard(
                    session = session,
                    onOpen = { onOpenSession(session.id) },
                    onRename = { onRenameSession(session.id, it) },
                    onDelete = { onDeleteSession(session.id) }
                )
            }
            item { Spacer(modifier = Modifier.height(90.dp)) }
        }
    }
}

@Composable
private fun SessionCard(
    session: SessionUi,
    onOpen: () -> Unit,
    onRename: (String) -> Unit,
    onDelete: () -> Unit
) {
    var editing by remember { mutableStateOf(false) }
    var draftTitle by remember(session.id) { mutableStateOf(session.title) }

    Card(
        modifier = Modifier
            .fillMaxWidth()
            .padding(horizontal = 16.dp)
            .clip(RoundedCornerShape(18.dp))
            .clickable(onClick = onOpen),
        colors = CardDefaults.cardColors(
            containerColor = MaterialTheme.colorScheme.surfaceVariant
        )
    ) {
        Column(modifier = Modifier.padding(14.dp)) {
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                Text(
                    text = session.title,
                    style = MaterialTheme.typography.titleMedium,
                    maxLines = 1,
                    overflow = TextOverflow.Ellipsis
                )
                StatusPill(session.status)
            }
            Spacer(modifier = Modifier.height(6.dp))
            Text(
                text = session.directory,
                style = MaterialTheme.typography.bodySmall,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
                maxLines = 1,
                overflow = TextOverflow.Ellipsis
            )

            Spacer(modifier = Modifier.height(10.dp))
            Row(horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                StatBadge("+${session.additions}", Color(0xFF0E9F6E))
                StatBadge("-${session.deletions}", Color(0xFFE11D48))
                StatBadge("${session.files} file", MaterialTheme.colorScheme.primary)
                Text(
                    text = formatEpoch(session.updatedAt),
                    style = MaterialTheme.typography.labelSmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant
                )
            }

            Spacer(modifier = Modifier.height(8.dp))
            if (editing) {
                Row(
                    horizontalArrangement = Arrangement.spacedBy(8.dp),
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    OutlinedTextField(
                        value = draftTitle,
                        onValueChange = { draftTitle = it },
                        label = { Text("Nuovo titolo") },
                        modifier = Modifier.weight(1f)
                    )
                    TextButton(onClick = { editing = false }) { Text("Annulla") }
                    Button(onClick = {
                        onRename(draftTitle)
                        editing = false
                    }) { Text("Salva") }
                }
            } else {
                Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    OutlinedButton(onClick = onOpen) {
                        Icon(Icons.Default.PlayArrow, contentDescription = null)
                        Spacer(Modifier.width(4.dp))
                        Text("Apri")
                    }
                    OutlinedButton(onClick = { editing = true }) {
                        Text("Rinomina")
                    }
                    OutlinedButton(onClick = onDelete) {
                        Icon(Icons.Default.Delete, contentDescription = null)
                    }
                }
            }
        }
    }
}

@Composable
private fun StatusPill(status: String) {
    val bg = when (status) {
        "busy" -> Color(0xFFFFF7ED)
        "retry" -> Color(0xFFFFFBEB)
        "idle" -> Color(0xFFF0FDF4)
        else -> MaterialTheme.colorScheme.surfaceVariant
    }
    val fg = when (status) {
        "busy" -> Color(0xFFB45309)
        "retry" -> Color(0xFFCA8A04)
        "idle" -> Color(0xFF15803D)
        else -> MaterialTheme.colorScheme.onSurfaceVariant
    }
    Box(
        modifier = Modifier
            .clip(RoundedCornerShape(999.dp))
            .background(bg)
            .padding(horizontal = 10.dp, vertical = 4.dp)
    ) {
        Text(status, color = fg, style = MaterialTheme.typography.labelMedium, fontWeight = FontWeight.SemiBold)
    }
}

@Composable
private fun StatBadge(value: String, color: Color) {
    Box(
        modifier = Modifier
            .clip(RoundedCornerShape(10.dp))
            .background(color.copy(alpha = 0.12f))
            .padding(horizontal = 8.dp, vertical = 4.dp)
    ) {
        Text(value, color = color, style = MaterialTheme.typography.labelMedium)
    }
}

@Composable
private fun SessionDetailScreen(
    state: AppUiState,
    onSendMessage: (String) -> Unit,
    onSendCommand: (String, String) -> Unit,
    onAbort: () -> Unit
) {
    val sessionId = state.selectedSessionId
    if (sessionId == null) {
        Box(modifier = Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
            Text("Apri una sessione dalla lista per vederne lo stato")
        }
        return
    }

    var text by remember { mutableStateOf("") }
    var isCommand by remember { mutableStateOf(false) }

    Column(modifier = Modifier.fillMaxSize()) {
        Card(
            modifier = Modifier
                .fillMaxWidth()
                .padding(horizontal = 16.dp, vertical = 8.dp),
            colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surfaceVariant)
        ) {
            Column(modifier = Modifier.padding(12.dp)) {
                Text("Sessione: $sessionId", style = MaterialTheme.typography.labelMedium)
                Spacer(modifier = Modifier.height(4.dp))
                Text("Todo: ${state.todos.size}  •  Diff file: ${state.diffFiles}")
                state.serverVersion?.let {
                    Text(
                        text = "Server OpenCode v$it (LAN)",
                        style = MaterialTheme.typography.bodySmall,
                        color = MaterialTheme.colorScheme.onSurfaceVariant
                    )
                }
            }
        }

        LazyColumn(
            modifier = Modifier
                .weight(1f)
                .fillMaxWidth(),
            verticalArrangement = Arrangement.spacedBy(8.dp)
        ) {
            if (state.todos.isNotEmpty()) {
                item {
                    Card(
                        modifier = Modifier
                            .fillMaxWidth()
                            .padding(horizontal = 16.dp),
                        colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.secondaryContainer)
                    ) {
                        Column(modifier = Modifier.padding(12.dp), verticalArrangement = Arrangement.spacedBy(6.dp)) {
                            Text("Todo attivi", style = MaterialTheme.typography.titleSmall)
                            state.todos.take(5).forEach {
                                Text("- ${it.content} [${it.status}]")
                            }
                        }
                    }
                }
            }
            items(state.messages, key = { it.id }) { msg ->
                val user = msg.role == "user"
                Card(
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(horizontal = 16.dp),
                    colors = CardDefaults.cardColors(
                        containerColor = if (user) MaterialTheme.colorScheme.primaryContainer else MaterialTheme.colorScheme.surfaceVariant
                    )
                ) {
                    Column(modifier = Modifier.padding(12.dp)) {
                        Text(
                            text = if (user) "Tu" else "OpenCode",
                            style = MaterialTheme.typography.labelMedium,
                            color = MaterialTheme.colorScheme.onSurfaceVariant
                        )
                        Spacer(modifier = Modifier.height(4.dp))
                        Text(msg.text)
                        Spacer(modifier = Modifier.height(4.dp))
                        Text(
                            formatEpoch(msg.createdAt),
                            style = MaterialTheme.typography.labelSmall,
                            color = MaterialTheme.colorScheme.onSurfaceVariant
                        )
                    }
                }
            }
            item { Spacer(modifier = Modifier.height(100.dp)) }
        }

        Divider()
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .padding(12.dp),
            verticalArrangement = Arrangement.spacedBy(8.dp)
        ) {
            Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                AssistChip(
                    onClick = { isCommand = false },
                    label = { Text("Prompt") },
                    colors = chipColors(selected = !isCommand)
                )
                AssistChip(
                    onClick = { isCommand = true },
                    label = { Text("Slash Command") },
                    colors = chipColors(selected = isCommand)
                )
            }
            OutlinedTextField(
                value = text,
                onValueChange = { text = it },
                placeholder = { Text(if (isCommand) "es: summarize --fast" else "Invia una richiesta ad OpenCode") },
                modifier = Modifier.fillMaxWidth()
            )
            Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                Button(
                    onClick = {
                        val value = text.trim()
                        if (value.isBlank()) return@Button
                        if (isCommand) {
                            val normalized = value.removePrefix("/")
                            val command = normalized.substringBefore(" ").trim()
                            if (command.isBlank()) return@Button
                            val args = normalized.substringAfter(" ", "")
                            onSendCommand(command, args)
                        } else {
                            onSendMessage(value)
                        }
                        text = ""
                    },
                    modifier = Modifier.weight(1f)
                ) {
                    Text("Invia")
                }
                OutlinedButton(onClick = onAbort) {
                    Icon(Icons.Default.Stop, contentDescription = null)
                    Spacer(Modifier.width(4.dp))
                    Text("Stop")
                }
            }
        }
    }
}

@Composable
private fun SettingsScreen(
    state: AppUiState,
    onSaveConfig: (ServerConfig) -> Unit,
    onTestConnection: () -> Unit
) {
    var host by remember(state.config.host) { mutableStateOf(state.config.host) }
    var port by remember(state.config.port) { mutableStateOf(state.config.port.toString()) }
    var username by remember(state.config.username) { mutableStateOf(state.config.username) }
    var password by remember(state.config.password) { mutableStateOf(state.config.password) }

    val draft = remember(host, port, username, password) {
        ServerConfig(
            host = host.trim(),
            port = port.toIntOrNull() ?: 0,
            username = username.trim(),
            password = password
        )
    }

    LazyColumn(
        modifier = Modifier.fillMaxSize(),
        verticalArrangement = Arrangement.spacedBy(10.dp)
    ) {
        item {
            Card(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(horizontal = 16.dp, vertical = 6.dp),
                colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.tertiaryContainer)
            ) {
                Text(
                    text = "Questa app e pensata per OpenCode su rete locale (LAN). Usa solo Wi-Fi fidata.",
                    modifier = Modifier.padding(12.dp)
                )
            }
        }
        item {
            OutlinedTextField(
                value = host,
                onValueChange = { host = it },
                label = { Text("Host locale") },
                placeholder = { Text("192.168.1.20") },
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(horizontal = 16.dp)
            )
        }
        item {
            OutlinedTextField(
                value = port,
                onValueChange = { port = it.filter(Char::isDigit) },
                label = { Text("Porta") },
                placeholder = { Text("4096") },
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(horizontal = 16.dp)
            )
        }
        item {
            OutlinedTextField(
                value = username,
                onValueChange = { username = it },
                label = { Text("Username Basic Auth") },
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(horizontal = 16.dp)
            )
        }
        item {
            OutlinedTextField(
                value = password,
                onValueChange = { password = it },
                label = { Text("Password Basic Auth") },
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(horizontal = 16.dp)
            )
        }
        item {
            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(horizontal = 16.dp),
                horizontalArrangement = Arrangement.spacedBy(8.dp)
            ) {
                Button(
                    onClick = { onSaveConfig(draft) },
                    enabled = draft.isValid,
                    modifier = Modifier.weight(1f)
                ) {
                    Text("Salva")
                }
                OutlinedButton(
                    onClick = onTestConnection,
                    enabled = state.config.isValid,
                    modifier = Modifier.weight(1f)
                ) {
                    Text("Test connessione")
                }
            }
        }
        state.connectionMessage?.let { msg ->
            item {
                Text(
                    text = msg,
                    modifier = Modifier.padding(horizontal = 16.dp),
                    color = if (msg.startsWith("Connesso")) Color(0xFF166534) else Color(0xFFB91C1C)
                )
            }
        }
        item { Spacer(modifier = Modifier.height(80.dp)) }
    }
}

private fun formatEpoch(epochMs: Long): String {
    return runCatching {
        SimpleDateFormat("dd/MM HH:mm", Locale.getDefault()).format(Date(epochMs))
    }.getOrElse { "-" }
}
