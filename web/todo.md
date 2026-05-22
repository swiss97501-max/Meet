# Meeting Swiss — TODO

## Backend
- [x] Install Socket.IO dependencies
- [x] Upgrade to web-db-user template
- [x] Create Socket.IO signaling server in server/_core/index.ts
- [x] Implement room management (create, join, leave)
- [x] Implement WebRTC signaling (offer, answer, ICE candidates)
- [x] Implement participant tracking per room

## Frontend
- [x] Configure dark glassmorphism theme in index.css
- [x] Add Google Fonts (Space Grotesk + Inter + JetBrains Mono)
- [x] Create Socket.IO client service layer
- [x] Create WebRTC service layer (peer connection management)
- [x] Create useWebRTC hook
- [x] Create useSocket hook
- [x] Create Landing Page (Home.tsx) with hero section
- [x] Create Room Entry dialog (username + room ID input)
- [x] Create Meeting Room page (Room.tsx)
- [x] Create ParticipantTile component
- [x] Create VideoGrid component (adaptive layout)
- [x] Create ControlBar component (floating glassmorphism)
- [x] Create ActiveSpeaker highlighting
- [x] Implement screen sharing toggle
- [x] Implement mute/unmute microphone
- [x] Implement camera on/off
- [x] Implement leave room
- [x] Register /room/:roomId route in App.tsx
- [x] Responsive design (mobile + desktop)
- [x] Smooth animations and transitions
- [x] Test Generate Room ID functionality
- [x] Test navigation to room page

## Quality
- [x] Write vitest tests for signaling logic
- [x] Test multi-user WebRTC flow
- [x] Fix TypeScript MapIterator errors in signaling.ts
- [x] All 11 vitest tests passing

## Screen Sharing Improvements (Phase 2)
- [x] Add browser detection (Chrome/Edge/Brave/Safari/Firefox)
- [x] Implement desktop screen sharing with renegotiation support
- [x] Add iOS/iPad fallback UI with ReplayKit instructions
- [x] Create ScreenShareModal component for confirmation
- [x] Create ScreenShareIndicator component for active status
- [x] Create ScreenShareErrorFallback component for error handling
- [x] Integrate modal and indicator into Room.tsx
- [x] Add error handling for permission denied, not found, not supported
- [x] Add graceful fallback messages for unsupported browsers
- [x] Write vitest tests for browser detection and WebRTC service
- [x] All tests passing (11 tests)

## UI/UX Fixes (Phase 3)
- [x] Remove tagline from header
- [x] Fix screen sharing error messages to show browser-specific info
- [x] All tests still passing (11 tests)
