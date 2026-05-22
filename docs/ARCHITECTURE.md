# Meeting Swiss — System Architecture

## Overview

Meeting Swiss is a **Zoom-level video conferencing system** with true OS-level screen sharing across all platforms. The system uses a **Selective Forwarding Unit (SFU)** architecture for scalable multi-participant video calls.

```
┌─────────────────────────────────────────────────────────────────┐
│                         Meeting Swiss                           │
│                    Zoom-Like Architecture                       │
└─────────────────────────────────────────────────────────────────┘

┌──────────────────┐  ┌──────────────────┐  ┌──────────────────┐
│   Web Client     │  │  iOS Native App  │  │ Android Native   │
│  (Chrome/Edge)   │  │  (Swift+ReplayKit)   │  (Kotlin+MediaProj)
│                  │  │                  │  │                  │
│ • getUserMedia() │  │ • ReplayKit      │  │ • MediaProjection│
│ • getDisplayMedia│  │ • Screen Broadcast   │ • Screen Capture │
│ • WebRTC         │  │ • WebRTC         │  │ • WebRTC         │
└────────┬─────────┘  └────────┬─────────┘  └────────┬─────────┘
         │                     │                     │
         └─────────────────────┼─────────────────────┘
                               │
                      WebRTC + Socket.IO
                      (Signaling + Media)
                               │
         ┌─────────────────────▼─────────────────────┐
         │                                           │
         │      SFU Server (mediasoup)               │
         │                                           │
         │  • Room Management                        │
         │  • Producer/Consumer Routing              │
         │  • Media Forwarding                       │
         │  • Simulcast Support                      │
         │  • Low Latency (<200ms)                   │
         │                                           │
         └─────────────────────────────────────────┘
```

---

## Architecture Layers

### 1. **Clients**

#### Web Client (Browser)
- **Stack:** React 19 + Tailwind 4 + WebRTC
- **Media Capture:**
  - `getUserMedia()` for camera/microphone
  - `getDisplayMedia()` for desktop screen sharing
- **Screen Sharing:** Dynamic track replacement via `replaceTrack()`
- **Browsers:** Chrome, Edge, Firefox, Brave

#### iOS Native App
- **Stack:** Swift + SwiftUI + WebRTC
- **Screen Sharing:** ReplayKit Screen Broadcast Extension
  - `RPSystemBroadcastPickerView` for user selection
  - `RPBroadcastSampleHandler` for frame capture
  - OS-level screen capture (system UI included)
- **Media:** AVFoundation for camera/microphone
- **Deployment:** App Store

#### Android Native App
- **Stack:** Kotlin + Jetpack Compose + WebRTC
- **Screen Sharing:** MediaProjection API
  - `createScreenCaptureIntent()` for permission
  - `VirtualDisplay` for frame capture
  - Foreground service for continuous capture
- **Media:** Camera2/MediaRecorder
- **Deployment:** Google Play Store

---

### 2. **Signaling Server**

**Technology:** Node.js + Socket.IO + mediasoup

**Responsibilities:**
- Room management (create, join, leave)
- Peer discovery and connection establishment
- WebRTC offer/answer exchange
- ICE candidate relay
- Producer/consumer management
- Participant tracking

**Key Events:**
```
Client → Server:
  - join-room: { roomId, username }
  - create-producer-transport: { roomId }
  - connect-producer-transport: { dtlsParameters }
  - produce: { kind, rtpParameters }
  - consume: { producerId }

Server → Client:
  - peer-joined: { peerId, username }
  - existing-peers: { peers }
  - producer-transport-created: { id, iceParameters, dtlsParameters }
  - new-producer: { peerId, producerId, kind }
  - peer-left: { peerId }
```

---

### 3. **SFU (Selective Forwarding Unit)**

**Technology:** mediasoup (Node.js WebRTC SFU)

**Features:**
- **Router:** Central media hub per room
- **Producers:** Media sources (camera, screen, audio)
- **Consumers:** Media sinks (receive video/audio)
- **Transports:** DTLS-SRTP encrypted channels
- **Simulcast:** Multiple quality streams for adaptive bitrate
- **Codecs:**
  - Audio: Opus (48kHz, stereo)
  - Video: VP8, VP9, H.264

**Media Flow:**
```
Producer (Camera) → Router → Consumer (Other Peers)
Producer (Screen) → Router → Consumer (All Peers)
```

---

## Screen Sharing Strategy

### Web (Desktop)
1. User clicks "Share Screen" button
2. Browser calls `navigator.mediaDevices.getDisplayMedia()`
3. User selects screen/window/tab
4. New MediaStream obtained
5. Replace video track: `sender.replaceTrack(screenTrack)`
6. Notify SFU of track change
7. Other peers receive screen stream

### iOS
1. User clicks "Share Screen" button
2. App shows `RPSystemBroadcastPickerView`
3. User selects broadcast destination
4. ReplayKit captures OS-level screen
5. Frames encoded and sent to WebRTC
6. SFU forwards to other participants
7. User stops via Control Center

### Android
1. User clicks "Share Screen" button
2. App calls `createScreenCaptureIntent()`
3. System shows permission dialog
4. MediaProjection captures screen
5. VirtualDisplay renders frames
6. Frames encoded and sent to WebRTC
7. SFU forwards to other participants
8. User stops via notification

---

## Deployment Architecture

### Development
```
localhost:3000  → Web Client (Vite dev server)
localhost:3001  → SFU Server (mediasoup)
localhost:3002  → Socket.IO signaling
```

### Production
```
┌─────────────────────────────────────────────────────────┐
│                   CDN / Load Balancer                   │
└──────────────────────┬──────────────────────────────────┘
                       │
        ┌──────────────┼──────────────┐
        │              │              │
    ┌───▼────┐    ┌───▼────┐    ┌───▼────┐
    │ Web    │    │ SFU    │    │ SFU    │
    │ Server │    │ Node 1 │    │ Node 2 │
    │ (CDN)  │    │        │    │        │
    └────────┘    └───┬────┘    └───┬────┘
                      │              │
                  ┌───▼──────────────▼───┐
                  │   Redis (Session)    │
                  │   PostgreSQL (Rooms) │
                  └──────────────────────┘
```

**Scaling:**
- Multiple SFU nodes per region
- Redis for session management
- PostgreSQL for room persistence
- Geographic distribution for low latency

---

## Data Models

### Room
```typescript
{
  id: string;              // Unique room ID
  createdAt: timestamp;    // Room creation time
  participants: Peer[];    // Active participants
  router: mediasoup.Router; // SFU router instance
}
```

### Peer
```typescript
{
  id: string;                          // Socket ID
  username: string;                    // Display name
  producerTransport: Transport;        // Send transport
  consumerTransport: Transport;        // Receive transport
  producers: Map<string, Producer>;    // Media sources
  consumers: Map<string, Consumer>;    // Media sinks
  isScreenSharing: boolean;            // Screen share status
}
```

### Producer
```typescript
{
  id: string;                    // Producer ID
  kind: "audio" | "video";       // Media type
  rtpParameters: RTCRtpParameters; // Codec info
  paused: boolean;               // Pause state
}
```

---

## Security Considerations

### Transport Security
- **DTLS-SRTP:** All media encrypted end-to-end
- **TLS:** Signaling encrypted (WebSocket over HTTPS)
- **STUN/TURN:** NAT traversal with authentication

### Access Control
- **Room IDs:** Randomly generated (10-13 chars)
- **Peer Verification:** Socket ID + username
- **Producer Validation:** Only peer's own producers
- **Consumer Limits:** Configurable per room

### Privacy
- **No Recording:** Default (user opt-in)
- **No Cloud Storage:** Peer-to-peer by default
- **No Metadata Logging:** Minimal logging
- **User Control:** Full control over camera/mic/screen

---

## Performance Targets

| Metric | Target |
|--------|--------|
| Latency | <200ms |
| Video Quality | 720p @ 30fps |
| Audio Quality | 48kHz stereo |
| Participants | 50-100 per room |
| Bitrate (video) | 2.5-5 Mbps |
| Bitrate (audio) | 64-128 kbps |

---

## Deployment Steps

### 1. SFU Server
```bash
cd sfu-server
npm install
npm run build
npm start
```

### 2. Web Client
```bash
cd web
npm install
npm run dev
# or
npm run build && npm start
```

### 3. iOS App
```bash
cd ios
# Open in Xcode
# Configure signing
# Build for device
```

### 4. Android App
```bash
cd android
# Open in Android Studio
# Configure signing
# Build APK/AAB
```

---

## Environment Variables

### SFU Server
```
PORT=3001
MEDIASOUP_LISTEN_IP=0.0.0.0
MEDIASOUP_ANNOUNCED_IP=<public-ip>
REDIS_URL=redis://localhost:6379
DATABASE_URL=postgresql://...
LOG_LEVEL=info
```

### Web Client
```
VITE_SFU_URL=https://sfu.example.com
VITE_SIGNALING_URL=wss://sfu.example.com
VITE_STUN_SERVERS=stun:stun.l.google.com:19302
VITE_TURN_SERVERS=turn:turn.example.com:3478
```

---

## Monitoring & Logging

### Metrics
- Active rooms
- Connected peers
- Producer/consumer count
- Bitrate per stream
- Latency (RTT)
- Packet loss

### Logs
- Connection events
- Error traces
- Performance warnings
- Security events

---

## Future Enhancements

1. **Recording** — MediaRecorder + S3 storage
2. **Virtual Backgrounds** — Canvas/WebGL processing
3. **Chat** — Text messaging via data channels
4. **Reactions** — Emoji reactions with animations
5. **Analytics** — Call quality metrics
6. **Transcription** — Real-time speech-to-text
7. **Translation** — Multi-language support
8. **Whiteboard** — Collaborative drawing

---

## References

- [mediasoup Documentation](https://mediasoup.org)
- [WebRTC Specification](https://www.w3.org/TR/webrtc/)
- [ReplayKit Documentation](https://developer.apple.com/documentation/replaykit)
- [MediaProjection API](https://developer.android.com/reference/android/media/projection/MediaProjectionManager)
