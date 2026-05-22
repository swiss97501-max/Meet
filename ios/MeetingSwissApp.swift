import SwiftUI
import ReplayKit
import AVFoundation
import WebRTC

// MARK: - App Entry Point

@main
struct MeetingSwissApp: App {
  var body: some Scene {
    WindowGroup {
      ContentView()
    }
  }
}

// MARK: - Main Content View

struct ContentView: View {
  @StateObject private var viewModel = MeetingViewModel()

  var body: some View {
    NavigationView {
      VStack(spacing: 20) {
        // Header
        VStack(alignment: .leading, spacing: 8) {
          HStack {
            Image(systemName: "video.circle.fill")
              .font(.system(size: 32))
              .foregroundColor(.cyan)
            VStack(alignment: .leading) {
              Text("Meeting Swiss")
                .font(.title2)
                .fontWeight(.bold)
              Text("Premium Video Meetings")
                .font(.caption)
                .foregroundColor(.gray)
            }
            Spacer()
          }
          .padding()
          .background(Color(.systemGray6))
          .cornerRadius(12)
        }
        .padding()

        Spacer()

        // Main Actions
        VStack(spacing: 16) {
          // Create Room
          NavigationLink(destination: CreateRoomView(viewModel: viewModel)) {
            HStack {
              Image(systemName: "plus.circle.fill")
                .font(.system(size: 24))
              VStack(alignment: .leading, spacing: 4) {
                Text("Create Room")
                  .font(.headline)
                Text("Start a new meeting instantly")
                  .font(.caption)
                  .foregroundColor(.gray)
              }
              Spacer()
              Image(systemName: "chevron.right")
            }
            .padding()
            .background(Color(.systemGray6))
            .cornerRadius(12)
            .foregroundColor(.primary)
          }

          // Join Room
          NavigationLink(destination: JoinRoomView(viewModel: viewModel)) {
            HStack {
              Image(systemName: "arrow.right.circle.fill")
                .font(.system(size: 24))
              VStack(alignment: .leading, spacing: 4) {
                Text("Join Room")
                  .font(.headline)
                Text("Enter an existing meeting")
                  .font(.caption)
                  .foregroundColor(.gray)
              }
              Spacer()
              Image(systemName: "chevron.right")
            }
            .padding()
            .background(Color(.systemGray6))
            .cornerRadius(12)
            .foregroundColor(.primary)
          }
        }
        .padding()

        Spacer()

        // Features
        VStack(alignment: .leading, spacing: 12) {
          Text("Features")
            .font(.headline)
            .padding(.horizontal)

          FeatureRow(icon: "video.fill", title: "Crystal-Clear Video", subtitle: "HD video with adaptive bitrate")
          FeatureRow(icon: "person.2.fill", title: "Multi-Participant", subtitle: "Unlimited participants per room")
          FeatureRow(icon: "rectangle.on.rectangle.fill", title: "Screen Sharing", subtitle: "Share your screen with ReplayKit")
          FeatureRow(icon: "lock.fill", title: "End-to-End Encrypted", subtitle: "Peer-to-peer WebRTC streams")
        }
        .padding()

        Spacer()
      }
      .navigationTitle("Meeting Swiss")
    }
  }
}

// MARK: - Feature Row Component

struct FeatureRow: View {
  let icon: String
  let title: String
  let subtitle: String

  var body: some View {
    HStack(spacing: 12) {
      Image(systemName: icon)
        .font(.system(size: 20))
        .foregroundColor(.cyan)
        .frame(width: 40)

      VStack(alignment: .leading, spacing: 2) {
        Text(title)
          .font(.subheadline)
          .fontWeight(.semibold)
        Text(subtitle)
          .font(.caption)
          .foregroundColor(.gray)
      }

      Spacer()
    }
    .padding()
    .background(Color(.systemGray6))
    .cornerRadius(8)
  }
}

// MARK: - Create Room View

struct CreateRoomView: View {
  @ObservedObject var viewModel: MeetingViewModel
  @State private var username = ""
  @State private var roomId = ""
  @Environment(\.presentationMode) var presentationMode

  var body: some View {
    VStack(spacing: 20) {
      Form {
        Section(header: Text("Your Information")) {
          TextField("Enter your name", text: $username)
            .textContentType(.name)
        }

        Section(header: Text("Room ID")) {
          HStack {
            TextField("Room ID", text: $roomId)
              .disabled(true)
            Button(action: generateRoomId) {
              Image(systemName: "arrow.clockwise")
                .foregroundColor(.cyan)
            }
          }
        }

        Section(header: Text("Features")) {
          Toggle("Enable Screen Sharing", isOn: $viewModel.enableScreenSharing)
          Toggle("Enable Audio", isOn: $viewModel.enableAudio)
          Toggle("Enable Video", isOn: $viewModel.enableVideo)
        }
      }

      Button(action: {
        if !username.isEmpty && !roomId.isEmpty {
          viewModel.createRoom(roomId: roomId, username: username)
          presentationMode.wrappedValue.dismiss()
        }
      }) {
        Text("Start Meeting")
          .frame(maxWidth: .infinity)
          .padding()
          .background(Color.cyan)
          .foregroundColor(.white)
          .cornerRadius(8)
      }
      .padding()
      .disabled(username.isEmpty || roomId.isEmpty)

      Spacer()
    }
    .navigationTitle("Create Room")
    .onAppear {
      generateRoomId()
    }
  }

  private func generateRoomId() {
    roomId = UUID().uuidString.prefix(10).uppercased() + String(UUID().uuidString.prefix(3).uppercased())
  }
}

// MARK: - Join Room View

struct JoinRoomView: View {
  @ObservedObject var viewModel: MeetingViewModel
  @State private var username = ""
  @State private var roomId = ""
  @Environment(\.presentationMode) var presentationMode

  var body: some View {
    VStack(spacing: 20) {
      Form {
        Section(header: Text("Your Information")) {
          TextField("Enter your name", text: $username)
            .textContentType(.name)
        }

        Section(header: Text("Room Details")) {
          TextField("Enter Room ID", text: $roomId)
            .textContentType(.none)
            .autocapitalization(.allCharacters)
        }

        Section(header: Text("Features")) {
          Toggle("Enable Screen Sharing", isOn: $viewModel.enableScreenSharing)
          Toggle("Enable Audio", isOn: $viewModel.enableAudio)
          Toggle("Enable Video", isOn: $viewModel.enableVideo)
        }
      }

      Button(action: {
        if !username.isEmpty && !roomId.isEmpty {
          viewModel.joinRoom(roomId: roomId, username: username)
          presentationMode.wrappedValue.dismiss()
        }
      }) {
        Text("Join Meeting")
          .frame(maxWidth: .infinity)
          .padding()
          .background(Color.cyan)
          .foregroundColor(.white)
          .cornerRadius(8)
      }
      .padding()
      .disabled(username.isEmpty || roomId.isEmpty)

      Spacer()
    }
    .navigationTitle("Join Room")
  }
}

// MARK: - View Model

class MeetingViewModel: NSObject, ObservableObject {
  @Published var enableScreenSharing = true
  @Published var enableAudio = true
  @Published var enableVideo = true
  @Published var isScreenSharing = false
  @Published var isMuted = false
  @Published var isCameraOff = false

  private var rtcClient: RTCClient?
  private var screenBroadcaster: ScreenBroadcaster?

  func createRoom(roomId: String, username: String) {
    print("Creating room: \(roomId) with username: \(username)")
    // Initialize WebRTC and connect to SFU
    rtcClient = RTCClient(roomId: roomId, username: username)
  }

  func joinRoom(roomId: String, username: String) {
    print("Joining room: \(roomId) with username: \(username)")
    // Initialize WebRTC and connect to SFU
    rtcClient = RTCClient(roomId: roomId, username: username)
  }

  func toggleScreenShare() {
    if isScreenSharing {
      stopScreenShare()
    } else {
      startScreenShare()
    }
  }

  private func startScreenShare() {
    guard RPScreenRecorder.shared().isAvailable else {
      print("Screen recording not available")
      return
    }

    screenBroadcaster = ScreenBroadcaster()
    screenBroadcaster?.startBroadcast { [weak self] error in
      if let error = error {
        print("Failed to start screen broadcast: \(error)")
      } else {
        self?.isScreenSharing = true
      }
    }
  }

  private func stopScreenShare() {
    screenBroadcaster?.stopBroadcast { [weak self] error in
      if let error = error {
        print("Failed to stop screen broadcast: \(error)")
      } else {
        self?.isScreenSharing = false
      }
    }
  }

  func toggleMute() {
    isMuted.toggle()
  }

  func toggleCamera() {
    isCameraOff.toggle()
  }
}

// MARK: - WebRTC Client

class RTCClient: NSObject {
  private let roomId: String
  private let username: String
  private var peerConnection: RTCPeerConnection?

  init(roomId: String, username: String) {
    self.roomId = roomId
    self.username = username
    super.init()
    setupWebRTC()
  }

  private func setupWebRTC() {
    let config = RTCConfiguration()
    config.iceServers = [
      RTCIceServer(urlStrings: ["stun:stun.l.google.com:19302"]),
      RTCIceServer(urlStrings: ["stun:stun1.l.google.com:19302"]),
    ]

    let constraints = RTCMediaConstraints(
      mandatoryConstraints: nil,
      optionalConstraints: ["DtlsSrtpKeyAgreement": kRTCMediaConstraintsValueTrue]
    )

    guard let factory = RTCPeerConnectionFactory() else { return }
    peerConnection = factory.peerConnection(with: config, constraints: constraints, delegate: self)
  }
}

extension RTCClient: RTCPeerConnectionDelegate {
  func peerConnection(_ peerConnection: RTCPeerConnection, didChange stateChanged: RTCSignalingState) {}
  func peerConnection(_ peerConnection: RTCPeerConnection, didAdd stream: RTCMediaStream) {}
  func peerConnection(_ peerConnection: RTCPeerConnection, didRemove stream: RTCMediaStream) {}
  func peerConnectionShouldNegotiate(_ peerConnection: RTCPeerConnection) {}
  func peerConnection(_ peerConnection: RTCPeerConnection, didChange newState: RTCIceConnectionState) {}
  func peerConnection(_ peerConnection: RTCPeerConnection, didChange newState: RTCIceGatheringState) {}
  func peerConnection(_ peerConnection: RTCPeerConnection, didGenerate candidate: RTCIceCandidate) {}
  func peerConnection(_ peerConnection: RTCPeerConnection, didRemove candidates: [RTCIceCandidate]) {}
  func peerConnection(_ peerConnection: RTCPeerConnection, didOpen dataChannel: RTCDataChannel) {}
}

// MARK: - Screen Broadcaster

class ScreenBroadcaster: NSObject {
  func startBroadcast(completion: @escaping (Error?) -> Void) {
    let broadcastPickerView = RPSystemBroadcastPickerView(frame: CGRect(x: 0, y: 0, width: 50, height: 50))
    broadcastPickerView.showsMicrophoneButton = true
    broadcastPickerView.preferredExtensionBundleIdentifier = "com.meetingswiss.broadcast"

    DispatchQueue.main.asyncAfter(deadline: .now() + 0.5) {
      if let button = broadcastPickerView.subviews.first as? UIButton {
        button.sendActions(for: .touchUpInside)
      }
      completion(nil)
    }
  }

  func stopBroadcast(completion: @escaping (Error?) -> Void) {
    RPScreenRecorder.shared().stopRecording { previewViewController, error in
      completion(error)
    }
  }
}

#Preview {
  ContentView()
}
