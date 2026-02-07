package ai.opencode.remote.ui.theme

import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.darkColorScheme
import androidx.compose.material3.lightColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.foundation.isSystemInDarkTheme

private val LightColors = lightColorScheme(
    primary = Ocean,
    secondary = Pine,
    tertiary = Coral,
    background = Mist,
    surface = Sand,
    onPrimary = Mist,
    onBackground = Ink,
    onSurface = Ink
)

private val DarkColors = darkColorScheme(
    primary = Pine,
    secondary = Ocean,
    tertiary = Coral,
    background = Ink,
    surface = ColorPalette.darkSurface,
    onPrimary = Ink,
    onBackground = Mist,
    onSurface = Mist
)

private object ColorPalette {
    val darkSurface = androidx.compose.ui.graphics.Color(0xFF0F172A)
}

@Composable
fun OpenCodeRemoteTheme(content: @Composable () -> Unit) {
    val useDark = isSystemInDarkTheme()
    MaterialTheme(
        colorScheme = if (useDark) DarkColors else LightColors,
        typography = Typography,
        content = content
    )
}
