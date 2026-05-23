import ReplayKit
import WebRTC

/**
 * iOS Screen Sharing via ReplayKit
 * 
 * This handler captures OS-level screen content including:
 * - App UI
 * - System notifications
 * - Other apps (if user permits)
 * 
 * Integration:
 * 1. Add Broadcast Extension target in Xcode
 * 2. Set this as the broadcast handler
 * 3. User starts broadcast from Control Center
 * 4. Frames are encoded and sent to WebRTC
 */

class ScreenShareBroadcastHandler: RPBroadcastSampleHandler {
  
  private var videoEncoder: RTCVideoEncoder?
  private var rtcTrack: RTCVideoTrack?
  private var frameCount = 0
  private let targetFramerate = 30
  private let targetBitrate = 2_500_000 // 2.5 Mbps
  
  override func broadcastStarted(withSetupInfo setupInfo: [String : NSObject]?) {
    print("[ScreenShare] Broadcast started")
    
    // Initialize video encoder
    setupVideoEncoder()
  }
  
  override func broadcastPaused() {
    print("[ScreenShare] Broadcast paused")
  }
  
  override func broadcastResumed() {
    print("[ScreenShare] Broadcast resumed")
  }
  
  override func broadcastFinished() {
    print("[ScreenShare] Broadcast finished")
    cleanup()
  }
  
  override func processSampleBuffer(
    _ sampleBuffer: CMSampleBuffer,
    with sampleBufferType: RPSampleBufferType
  ) {
    switch sampleBufferType {
    case .video:
      handleVideoSample(sampleBuffer)
    case .audioApp:
      handleAudioSample(sampleBuffer)
    case .audioMic:
      handleMicrophoneSample(sampleBuffer)
    @unknown default:
      break
    }
  }
  
  // MARK: - Video Processing
  
  private func handleVideoSample(_ sampleBuffer: CMSampleBuffer) {
    guard let pixelBuffer = CMSampleBufferGetImageBuffer(sampleBuffer) else {
      return
    }
    
    // Get timestamp
    let timestamp = CMSampleBufferGetPresentationTimeStamp(sampleBuffer)
    let timeStampUs = Int64(timestamp.value) * 1_000_000 / Int64(timestamp.timescale)
    
    // Create RTCVideoFrame
    let frame = RTCVideoFrame(
      buffer: RTCCVPixelBuffer(pixelBuffer: pixelBuffer),
      rotation: ._0,
      timeStampNs: timeStampUs * 1_000
    )
    
    // Send to WebRTC
    rtcTrack?.source.capturer(
      RTCVideoCapturer(),
      didCapture: frame
    )
    
    frameCount += 1
    
    // Log every 30 frames (~1 second at 30fps)
    if frameCount % 30 == 0 {
      print("[ScreenShare] Captured \(frameCount) frames")
    }
  }
  
  private func handleAudioSample(_ sampleBuffer: CMSampleBuffer) {
    // Audio from app (e.g., music, video playback)
    // Forward to WebRTC audio track if needed
    print("[ScreenShare] App audio sample received")
  }
  
  private func handleMicrophoneSample(_ sampleBuffer: CMSampleBuffer) {
    // Microphone audio (user commentary)
    // Forward to WebRTC audio track
    print("[ScreenShare] Microphone audio sample received")
  }
  
  // MARK: - Video Encoder Setup
  
  private func setupVideoEncoder() {
    // Create hardware video encoder (H.264 or VP8)
    let settings = RTCVideoEncoderSettings()
    settings.name = kRTCVideoCodecH264Name
    settings.width = 1920
    settings.height = 1080
    settings.maxFramerate = UInt32(targetFramerate)
    settings.maxBitrate = UInt32(targetBitrate / 1000) // Convert to kbps
    
    // Initialize encoder
    videoEncoder = RTCVideoEncoderH264()
    
    print("[ScreenShare] Video encoder initialized: H.264 @ \(targetFramerate)fps, \(targetBitrate/1_000_000)Mbps")
  }
  
  private func cleanup() {
    videoEncoder = nil
    rtcTrack = nil
    print("[ScreenShare] Cleanup complete")
  }
}

// MARK: - WebRTC Integration

extension ScreenShareBroadcastHandler {
  
  /**
   * Connect to SFU and start sending screen stream
   */
  func connectToSFU(
    roomId: String,
    peerId: String,
    sfuUrl: String
  ) {
    print("[ScreenShare] Connecting to SFU: \(sfuUrl)")
    
    // Create WebRTC peer connection
    let config = RTCConfiguration()
    config.iceServers = [
      RTCIceServer(urlStrings: ["stun:stun.l.google.com:19302"]),
      RTCIceServer(
        urls: ["turn:turn.example.com:3478"],
        username: "user",
        credential: "pass"
      ),
    ]
    
    let constraints = RTCMediaConstraints(
      mandatoryConstraints: nil,
      optionalConstraints: nil
    )
    
    let peerConnectionFactory = RTCPeerConnectionFactory()
    
    guard let peerConnection = peerConnectionFactory.peerConnection(
      with: config,
      constraints: constraints,
      delegate: self
    ) else {
      print("[ScreenShare] Failed to create peer connection")
      return
    }
    
    // Create video track for screen
    let videoSource = peerConnectionFactory.videoSource()
    rtcTrack = peerConnectionFactory.videoTrack(
      with: videoSource,
      trackId: "screen-\(peerId)"
    )
    
    // Add track to peer connection
    let streamId = "stream-\(peerId)"
    if let track = rtcTrack {
      peerConnection.add(track, streamIds: [streamId])
    }
    
    print("[ScreenShare] WebRTC peer connection established")
  }
}

// MARK: - RTCPeerConnectionDelegate

extension ScreenShareBroadcastHandler: RTCPeerConnectionDelegate {
  
  func peerConnection(
    _ peerConnection: RTCPeerConnection,
    didChange stateChanged: RTCSignalingState
  ) {
    print("[ScreenShare] Signaling state changed: \(stateChanged.rawValue)")
  }
  
  func peerConnection(
    _ peerConnection: RTCPeerConnection,
    didChange connectionState: RTCIceConnectionState
  ) {
    print("[ScreenShare] ICE connection state: \(connectionState.rawValue)")
  }
  
  func peerConnection(
    _ peerConnection: RTCPeerConnection,
    didChange gatheringState: RTCIceGatheringState
  ) {
    print("[ScreenShare] ICE gathering state: \(gatheringState.rawValue)")
  }
  
  func peerConnection(
    _ peerConnection: RTCPeerConnection,
    didGenerate candidate: RTCIceCandidate
  ) {
    print("[ScreenShare] ICE candidate generated")
    // Send to SFU via signaling
  }
  
  func peerConnectionShouldNegotiate(_ peerConnection: RTCPeerConnection) {
    print("[ScreenShare] Negotiation needed")
  }
  
  func peerConnection(
    _ peerConnection: RTCPeerConnection,
    didRemove stream: RTCMediaStream
  ) {
    print("[ScreenShare] Stream removed")
  }
}

// MARK: - Adaptive Bitrate Control

extension ScreenShareBroadcastHandler {
  
  /**
   * Adjust bitrate based on network conditions
   */
  func adjustBitrate(
    basedOnNetworkQuality quality: NetworkQuality
  ) {
    let newBitrate: Int
    
    switch quality {
    case .excellent:
      newBitrate = 2_500_000 // 2.5 Mbps
    case .good:
      newBitrate = 1_500_000 // 1.5 Mbps
    case .fair:
      newBitrate = 800_000   // 800 kbps
    case .poor:
      newBitrate = 400_000   // 400 kbps
    }
    
    print("[ScreenShare] Adjusting bitrate to \(newBitrate / 1_000_000)Mbps")
    
    // Update encoder settings
    let settings = RTCVideoEncoderSettings()
    settings.maxBitrate = UInt32(newBitrate / 1000)
    videoEncoder?.setRates(settings.maxBitrate, framerate: UInt32(targetFramerate))
  }
}

enum NetworkQuality {
  case excellent
  case good
  case fair
  case poor
}
