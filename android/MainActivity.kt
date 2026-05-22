package com.meetingswiss.app

import android.Manifest
import android.content.Intent
import android.content.pm.PackageManager
import android.media.projection.MediaProjectionManager
import android.os.Build
import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.core.content.ContextCompat
import org.webrtc.*
import java.util.*

class MainActivity : ComponentActivity() {
  private lateinit var mediaProjectionManager: MediaProjectionManager
  private var mediaProjection: android.media.MediaProjection? = null

  private val screenCapturePermissionLauncher = registerForActivityResult(
    ActivityResultContracts.StartActivityForResult()
  ) { result ->
    if (result.resultCode == RESULT_OK && result.data != null) {
      mediaProjection = mediaProjectionManager.getMediaProjection(result.resultCode, result.data!!)
      // Start screen capture
    }
  }

  private val cameraPermissionLauncher = registerForActivityResult(
    ActivityResultContracts.RequestMultiplePermissions()
  ) { permissions ->
    val allGranted = permissions.values.all { it }
    if (allGranted) {
      // Permissions granted, proceed with camera/microphone
    }
  }

  override fun onCreate(savedInstanceState: Bundle?) {
    super.onCreate(savedInstanceState)

    mediaProjectionManager = getSystemService(MediaProjectionManager::class.java)

    setContent {
      MeetingSwissTheme {
        Surface(
          modifier = Modifier.fillMaxSize(),
          color = Color(0xFF0A0E27)
        ) {
          MeetingSwissApp(
            onRequestScreenCapture = { requestScreenCapture() },
            onRequestCameraPermission = { requestCameraPermission() }
          )
        }
      }
    }
  }

  private fun requestScreenCapture() {
    val intent = mediaProjectionManager.createScreenCaptureIntent()
    screenCapturePermissionLauncher.launch(intent)
  }

  private fun requestCameraPermission() {
    val permissions = arrayOf(
      Manifest.permission.CAMERA,
      Manifest.permission.RECORD_AUDIO
    )

    val needsRequest = permissions.any {
      ContextCompat.checkSelfPermission(this, it) != PackageManager.PERMISSION_GRANTED
    }

    if (needsRequest) {
      cameraPermissionLauncher.launch(permissions)
    }
  }
}

// MARK: - Composables

@Composable
fun MeetingSwissTheme(content: @Composable () -> Unit) {
  MaterialTheme(
    colorScheme = darkColorScheme(
      primary = Color(0xFF00D9FF),
      secondary = Color(0xFF6366F1),
      background = Color(0xFF0A0E27),
      surface = Color(0xFF1A1F3A)
    )
  ) {
    content()
  }
}

@Composable
fun MeetingSwissApp(
  onRequestScreenCapture: () -> Unit,
  onRequestCameraPermission: () -> Unit
) {
  var currentScreen by remember { mutableStateOf<Screen>(Screen.Home) }

  when (currentScreen) {
    Screen.Home -> HomeScreen(
      onNavigateToCreate = { currentScreen = Screen.CreateRoom },
      onNavigateToJoin = { currentScreen = Screen.JoinRoom }
    )
    Screen.CreateRoom -> CreateRoomScreen(
      onRequestPermission = onRequestCameraPermission,
      onRequestScreenCapture = onRequestScreenCapture,
      onBack = { currentScreen = Screen.Home }
    )
    Screen.JoinRoom -> JoinRoomScreen(
      onRequestPermission = onRequestCameraPermission,
      onRequestScreenCapture = onRequestScreenCapture,
      onBack = { currentScreen = Screen.Home }
    )
  }
}

@Composable
fun HomeScreen(
  onNavigateToCreate: () -> Unit,
  onNavigateToJoin: () -> Unit
) {
  Column(
    modifier = Modifier
      .fillMaxSize()
      .verticalScroll(rememberScrollState())
      .padding(16.dp),
    verticalArrangement = Arrangement.spacedBy(16.dp)
  ) {
    // Header
    Row(
      modifier = Modifier
        .fillMaxWidth()
        .background(Color(0xFF1A1F3A), shape = RoundedCornerShape(12.dp))
        .padding(16.dp),
      horizontalArrangement = Arrangement.spacedBy(12.dp),
      verticalAlignment = Alignment.CenterVertically
    ) {
      Icon(
        imageVector = Icons.Default.VideoCall,
        contentDescription = null,
        tint = Color(0xFF00D9FF),
        modifier = Modifier.size(32.dp)
      )
      Column {
        Text(
          "Meeting Swiss",
          fontSize = 18.sp,
          fontWeight = FontWeight.Bold,
          color = Color.White
        )
        Text(
          "Premium Video Meetings",
          fontSize = 12.sp,
          color = Color.Gray
        )
      }
    }

    Spacer(modifier = Modifier.height(24.dp))

    // Create Room Button
    ActionCard(
      icon = Icons.Default.Add,
      title = "Create Room",
      subtitle = "Start a new meeting instantly",
      onClick = onNavigateToCreate
    )

    // Join Room Button
    ActionCard(
      icon = Icons.Default.Login,
      title = "Join Room",
      subtitle = "Enter an existing meeting",
      onClick = onNavigateToJoin
    )

    Spacer(modifier = Modifier.height(24.dp))

    // Features
    Text(
      "Features",
      fontSize = 16.sp,
      fontWeight = FontWeight.Bold,
      color = Color.White,
      modifier = Modifier.padding(horizontal = 8.dp)
    )

    FeatureItem("Video", "Crystal-clear HD video")
    FeatureItem("Participants", "Unlimited participants")
    FeatureItem("Screen Share", "Share your screen with MediaProjection")
    FeatureItem("Encrypted", "End-to-end WebRTC streams")
  }
}

@Composable
fun CreateRoomScreen(
  onRequestPermission: () -> Unit,
  onRequestScreenCapture: () -> Unit,
  onBack: () -> Unit
) {
  var username by remember { mutableStateOf("") }
  var roomId by remember { mutableStateOf(generateRoomId()) }
  var enableScreenShare by remember { mutableStateOf(true) }
  var enableAudio by remember { mutableStateOf(true) }
  var enableVideo by remember { mutableStateOf(true) }

  Column(
    modifier = Modifier
      .fillMaxSize()
      .verticalScroll(rememberScrollState())
      .padding(16.dp),
    verticalArrangement = Arrangement.spacedBy(16.dp)
  ) {
    // Back button
    IconButton(onClick = onBack) {
      Icon(Icons.Default.ArrowBack, contentDescription = "Back")
    }

    Text("Create Room", fontSize = 20.sp, fontWeight = FontWeight.Bold)

    OutlinedTextField(
      value = username,
      onValueChange = { username = it },
      label = { Text("Your Name") },
      modifier = Modifier.fillMaxWidth(),
      singleLine = true
    )

    OutlinedTextField(
      value = roomId,
      onValueChange = {},
      label = { Text("Room ID") },
      modifier = Modifier.fillMaxWidth(),
      readOnly = true,
      trailingIcon = {
        IconButton(onClick = { roomId = generateRoomId() }) {
          Icon(Icons.Default.Refresh, contentDescription = "Regenerate")
        }
      }
    )

    Divider()

    SwitchRow("Enable Screen Sharing", enableScreenShare) { enableScreenShare = it }
    SwitchRow("Enable Audio", enableAudio) { enableAudio = it }
    SwitchRow("Enable Video", enableVideo) { enableVideo = it }

    Spacer(modifier = Modifier.weight(1f))

    Button(
      onClick = {
        onRequestPermission()
        if (enableScreenShare) {
          onRequestScreenCapture()
        }
      },
      modifier = Modifier
        .fillMaxWidth()
        .height(48.dp),
      enabled = username.isNotEmpty()
    ) {
      Text("Start Meeting", fontSize = 16.sp)
    }
  }
}

@Composable
fun JoinRoomScreen(
  onRequestPermission: () -> Unit,
  onRequestScreenCapture: () -> Unit,
  onBack: () -> Unit
) {
  var username by remember { mutableStateOf("") }
  var roomId by remember { mutableStateOf("") }
  var enableScreenShare by remember { mutableStateOf(true) }
  var enableAudio by remember { mutableStateOf(true) }
  var enableVideo by remember { mutableStateOf(true) }

  Column(
    modifier = Modifier
      .fillMaxSize()
      .verticalScroll(rememberScrollState())
      .padding(16.dp),
    verticalArrangement = Arrangement.spacedBy(16.dp)
  ) {
    IconButton(onClick = onBack) {
      Icon(Icons.Default.ArrowBack, contentDescription = "Back")
    }

    Text("Join Room", fontSize = 20.sp, fontWeight = FontWeight.Bold)

    OutlinedTextField(
      value = username,
      onValueChange = { username = it },
      label = { Text("Your Name") },
      modifier = Modifier.fillMaxWidth(),
      singleLine = true
    )

    OutlinedTextField(
      value = roomId,
      onValueChange = { roomId = it },
      label = { Text("Room ID") },
      modifier = Modifier.fillMaxWidth(),
      singleLine = true
    )

    Divider()

    SwitchRow("Enable Screen Sharing", enableScreenShare) { enableScreenShare = it }
    SwitchRow("Enable Audio", enableAudio) { enableAudio = it }
    SwitchRow("Enable Video", enableVideo) { enableVideo = it }

    Spacer(modifier = Modifier.weight(1f))

    Button(
      onClick = {
        onRequestPermission()
        if (enableScreenShare) {
          onRequestScreenCapture()
        }
      },
      modifier = Modifier
        .fillMaxWidth()
        .height(48.dp),
      enabled = username.isNotEmpty() && roomId.isNotEmpty()
    ) {
      Text("Join Meeting", fontSize = 16.sp)
    }
  }
}

// MARK: - Components

@Composable
fun ActionCard(
  icon: androidx.compose.material.icons.materialIcon,
  title: String,
  subtitle: String,
  onClick: () -> Unit
) {
  Button(
    onClick = onClick,
    modifier = Modifier
      .fillMaxWidth()
      .height(80.dp),
    colors = ButtonDefaults.buttonColors(
      containerColor = Color(0xFF1A1F3A)
    )
  ) {
    Row(
      modifier = Modifier
        .fillMaxWidth()
        .padding(12.dp),
      horizontalArrangement = Arrangement.spacedBy(12.dp),
      verticalAlignment = Alignment.CenterVertically
    ) {
      Icon(
        imageVector = icon,
        contentDescription = null,
        tint = Color(0xFF00D9FF),
        modifier = Modifier.size(28.dp)
      )
      Column(modifier = Modifier.weight(1f)) {
        Text(title, fontWeight = FontWeight.Bold, color = Color.White)
        Text(subtitle, fontSize = 12.sp, color = Color.Gray)
      }
      Icon(Icons.Default.ChevronRight, contentDescription = null, tint = Color.Gray)
    }
  }
}

@Composable
fun FeatureItem(title: String, subtitle: String) {
  Row(
    modifier = Modifier
      .fillMaxWidth()
      .background(Color(0xFF1A1F3A), shape = RoundedCornerShape(8.dp))
      .padding(12.dp),
    horizontalArrangement = Arrangement.spacedBy(12.dp)
  ) {
    Icon(
      imageVector = Icons.Default.CheckCircle,
      contentDescription = null,
      tint = Color(0xFF00D9FF),
      modifier = Modifier.size(20.dp)
    )
    Column {
      Text(title, fontWeight = FontWeight.SemiBold, color = Color.White)
      Text(subtitle, fontSize = 12.sp, color = Color.Gray)
    }
  }
}

@Composable
fun SwitchRow(label: String, checked: Boolean, onCheckedChange: (Boolean) -> Unit) {
  Row(
    modifier = Modifier
      .fillMaxWidth()
      .padding(8.dp),
    horizontalArrangement = Arrangement.SpaceBetween,
    verticalAlignment = Alignment.CenterVertically
  ) {
    Text(label, color = Color.White)
    Switch(checked = checked, onCheckedChange = onCheckedChange)
  }
}

// MARK: - Utilities

fun generateRoomId(): String {
  val uuid = UUID.randomUUID().toString()
  return (uuid.substring(0, 10) + uuid.substring(24, 27)).uppercase()
}

sealed class Screen {
  object Home : Screen()
  object CreateRoom : Screen()
  object JoinRoom : Screen()
}
