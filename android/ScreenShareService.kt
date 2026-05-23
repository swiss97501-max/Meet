package com.meetingswiss.app.screenshare

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.Service
import android.content.Context
import android.content.Intent
import android.media.projection.MediaProjection
import android.media.projection.MediaProjectionManager
import android.os.Build
import android.os.IBinder
import android.util.DisplayMetrics
import android.view.WindowManager
import androidx.core.app.NotificationCompat
import org.webrtc.*
import kotlin.concurrent.thread

/**
 * Android Screen Sharing Service
 * 
 * Captures OS-level screen content using MediaProjection API
 * - Foreground service (required for continuous capture)
 * - Hardware video encoding (H.264)
 * - Adaptive bitrate control
 * - Graceful lifecycle management
 */
class ScreenShareService : Service() {

  private var mediaProjection: MediaProjection? = null
  private var virtualDisplay: android.hardware.display.VirtualDisplay? = null
  private var videoEncoder: VideoEncoder? = null
  private var peerConnection: PeerConnection? = null
  private var videoTrack: VideoTrack? = null

  companion object {
    const val CHANNEL_ID = "screen_share_channel"
    const val NOTIFICATION_ID = 1
    const val EXTRA_RESULT_CODE = "result_code"
    const val EXTRA_DATA = "data"
    const val EXTRA_ROOM_ID = "room_id"
    const val EXTRA_PEER_ID = "peer_id"
  }

  override fun onCreate() {
    super.onCreate()
    createNotificationChannel()
    setupVideoEncoder()
  }

  override fun onStartCommand(
    intent: Intent?,
    flags: Int,
    startId: Int
  ): Int {
    if (intent == null) {
      stopSelf()
      return START_NOT_STICKY
    }

    val resultCode = intent.getIntExtra(EXTRA_RESULT_CODE, -1)
    val data = intent.getParcelableExtra<Intent>(EXTRA_DATA)
    val roomId = intent.getStringExtra(EXTRA_ROOM_ID) ?: ""
    val peerId = intent.getStringExtra(EXTRA_PEER_ID) ?: ""

    if (resultCode == -1 || data == null) {
      stopSelf()
      return START_NOT_STICKY
    }

    // Start foreground service
    val notification = createNotification()
    startForeground(NOTIFICATION_ID, notification)

    // Start screen capture
    startScreenCapture(resultCode, data, roomId, peerId)

    return START_STICKY
  }

  override fun onBind(intent: Intent?): IBinder? = null

  override fun onDestroy() {
    stopScreenCapture()
    super.onDestroy()
  }

  // MARK: - Screen Capture

  private fun startScreenCapture(
    resultCode: Int,
    data: Intent,
    roomId: String,
    peerId: String
  ) {
    thread {
      try {
        val mediaProjectionManager =
          getSystemService(Context.MEDIA_PROJECTION_SERVICE) as MediaProjectionManager

        mediaProjection = mediaProjectionManager.getMediaProjection(resultCode, data)

        if (mediaProjection == null) {
          log("Failed to get media projection")
          stopSelf()
          return@thread
        }

        // Get display metrics
        val windowManager = getSystemService(Context.WINDOW_SERVICE) as WindowManager
        val displayMetrics = DisplayMetrics()
        windowManager.defaultDisplay.getMetrics(displayMetrics)

        val width = displayMetrics.widthPixels
        val height = displayMetrics.heightPixels
        val dpi = displayMetrics.densityDpi

        log("Screen capture started: ${width}x${height} @ ${dpi}dpi")

        // Create virtual display for screen capture
        virtualDisplay = mediaProjection?.createVirtualDisplay(
          "ScreenShare",
          width,
          height,
          dpi,
          android.media.MediaProjection.VIRTUAL_DISPLAY_FLAG_AUTO_MIRROR,
          getSurfaceForCapture(width, height),
          null,
          null
        )

        // Connect to SFU
        connectToSFU(roomId, peerId, width, height)

      } catch (e: Exception) {
        log("Screen capture error: ${e.message}")
        stopSelf()
      }
    }
  }

  private fun stopScreenCapture() {
    try {
      virtualDisplay?.release()
      virtualDisplay = null

      mediaProjection?.stop()
      mediaProjection = null

      peerConnection?.close()
      peerConnection = null

      videoTrack = null

      log("Screen capture stopped")
    } catch (e: Exception) {
      log("Error stopping screen capture: ${e.message}")
    }
  }

  private fun getSurfaceForCapture(width: Int, height: Int): android.view.Surface {
    // Create surface texture for video encoding
    val surfaceTexture = android.graphics.SurfaceTexture(0)
    surfaceTexture.setDefaultBufferSize(width, height)
    return android.view.Surface(surfaceTexture)
  }

  // MARK: - Video Encoding

  private fun setupVideoEncoder() {
    try {
      // Use hardware H.264 encoder
      val mediaCodecList = android.media.MediaCodecList(android.media.MediaCodecList.REGULAR_CODECS)
      val codecInfo = mediaCodecList.findEncoderForFormat(
        android.media.MediaFormat.createVideoFormat(
          android.media.MediaFormat.MIMETYPE_VIDEO_AVC,
          1920,
          1080
        )
      )

      if (codecInfo != null) {
        log("Using hardware encoder: ${codecInfo.name}")
      } else {
        log("No hardware encoder found, using software encoder")
      }

    } catch (e: Exception) {
      log("Encoder setup error: ${e.message}")
    }
  }

  // MARK: - WebRTC Integration

  private fun connectToSFU(
    roomId: String,
    peerId: String,
    screenWidth: Int,
    screenHeight: Int
  ) {
    try {
      // Initialize WebRTC
      val options = PeerConnectionFactory.InitializationOptions.builder(this)
        .setEnableInternalTracer(true)
        .createInitializationOptions()

      PeerConnectionFactory.initialize(options)

      val peerConnectionFactory = PeerConnectionFactory.builder()
        .setVideoEncoderFactory(DefaultVideoEncoderFactory(this, true, true))
        .setVideoDecoderFactory(DefaultVideoDecoderFactory(this))
        .createPeerConnectionFactory()

      // Create peer connection
      val iceServers = listOf(
        PeerConnection.IceServer.builder("stun:stun.l.google.com:19302").createIceServer(),
        PeerConnection.IceServer.builder("turn:turn.example.com:3478")
          .setUsername("user")
          .setPassword("pass")
          .createIceServer()
      )

      val rtcConfig = PeerConnection.RTCConfiguration(iceServers)
      rtcConfig.bundlePolicy = PeerConnection.BundlePolicy.MAXBUNDLE
      rtcConfig.rtcpMuxPolicy = PeerConnection.RtcpMuxPolicy.REQUIRE

      peerConnection = peerConnectionFactory.createPeerConnection(
        rtcConfig,
        object : PeerConnection.Observer {
          override fun onSignalingChange(p0: PeerConnection.SignalingState?) {}
          override fun onIceConnectionChange(p0: PeerConnection.IceConnectionState?) {
            log("ICE connection state: $p0")
          }

          override fun onIceGatheringChange(p0: PeerConnection.IceGatheringState?) {}
          override fun onIceCandidate(p0: IceCandidate?) {
            // Send to SFU via signaling
            log("ICE candidate: ${p0?.candidate}")
          }

          override fun onIceCandidatesRemoved(p0: Array<out IceCandidate>?) {}
          override fun onAddStream(p0: MediaStream?) {}
          override fun onRemoveStream(p0: MediaStream?) {}
          override fun onDataChannel(p0: DataChannel?) {}
          override fun onRenegotiationNeeded() {
            log("Renegotiation needed")
          }

          override fun onAddTrack(p0: RtpReceiver?, p1: Array<out MediaStream>?) {}
        }
      )

      // Create video track for screen
      val videoSource = peerConnectionFactory.createVideoSource(false)
      videoTrack = peerConnectionFactory.createVideoTrack("screen-$peerId", videoSource)

      // Add track to peer connection
      val mediaStream = peerConnectionFactory.createLocalMediaStream("stream-$peerId")
      mediaStream.addTrack(videoTrack)
      peerConnection?.addTrack(videoTrack)

      log("WebRTC peer connection established for screen sharing")

      // Start sending offer
      createAndSendOffer(roomId, peerId)

    } catch (e: Exception) {
      log("SFU connection error: ${e.message}")
      stopSelf()
    }
  }

  private fun createAndSendOffer(roomId: String, peerId: String) {
    peerConnection?.createOffer(
      object : SdpObserver {
        override fun onCreateSuccess(sessionDescription: SessionDescription?) {
          peerConnection?.setLocalDescription(
            object : SdpObserver {
              override fun onCreateSuccess(p0: SessionDescription?) {}
              override fun onSetSuccess() {
                log("Local SDP set successfully")
                // Send offer to SFU via signaling
              }

              override fun onCreateFailure(p0: String?) {
                log("Set local SDP failed: $p0")
              }

              override fun onSetFailure(p0: String?) {
                log("Set local SDP failed: $p0")
              }
            },
            sessionDescription
          )
        }

        override fun onSetSuccess() {}
        override fun onCreateFailure(p0: String?) {
          log("Create offer failed: $p0")
        }

        override fun onSetFailure(p0: String?) {}
      },
      MediaConstraints()
    )
  }

  // MARK: - Adaptive Bitrate

  fun adjustBitrate(bitrateKbps: Int) {
    try {
      peerConnection?.getSenders()?.forEach { sender ->
        if (sender.track()?.kind() == "video") {
          val parameters = sender.parameters
          parameters.encodings.forEach { encoding ->
            encoding.maxBitrateBps = bitrateKbps * 1000
          }
          sender.parameters = parameters
          log("Bitrate adjusted to ${bitrateKbps}kbps")
        }
      }
    } catch (e: Exception) {
      log("Bitrate adjustment error: ${e.message}")
    }
  }

  // MARK: - Notifications

  private fun createNotificationChannel() {
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
      val channel = NotificationChannel(
        CHANNEL_ID,
        "Screen Sharing",
        NotificationManager.IMPORTANCE_LOW
      )
      channel.description = "Screen sharing is active"

      val manager = getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
      manager.createNotificationChannel(channel)
    }
  }

  private fun createNotification(): Notification {
    return NotificationCompat.Builder(this, CHANNEL_ID)
      .setContentTitle("Meeting Swiss")
      .setContentText("Screen sharing is active")
      .setSmallIcon(android.R.drawable.ic_media_play)
      .setOngoing(true)
      .build()
  }

  private fun log(message: String) {
    android.util.Log.d("ScreenShareService", message)
  }
}
