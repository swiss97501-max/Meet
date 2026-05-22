import type { Socket } from "socket.io-client";

// ─── DisplayMediaStreamOptions type ───────────────────────────────────────────

interface DisplayMediaStreamOptions {
  video?: {
    frameRate?: { ideal?: number };
    cursor?: "always" | "motion" | "never";
  } | boolean;
  audio?: boolean;
}

// ─── ICE servers (STUN) ───────────────────────────────────────────────────────

const ICE_SERVERS: RTCIceServer[] = [
  { urls: "stun:stun.l.google.com:19302" },
  { urls: "stun:stun1.l.google.com:19302" },
  { urls: "stun:stun2.l.google.com:19302" },
];

// ─── Types ────────────────────────────────────────────────────────────────────

export type OnTrackCallback = (socketId: string, stream: MediaStream) => void;
export type OnRemoveTrackCallback = (socketId: string) => void;
export type OnScreenShareStatusCallback = (isSharing: boolean, error?: string) => void;

// ─── Browser detection ────────────────────────────────────────────────────────

export interface BrowserCapabilities {
  supportsGetDisplayMedia: boolean;
  isIOS: boolean;
  isAndroid: boolean;
  isMobile: boolean;
  browserName: string;
}

export function detectBrowserCapabilities(): BrowserCapabilities {
  const ua = navigator.userAgent.toLowerCase();
  const isIOS = /iphone|ipad|ipod/.test(ua);
  const isAndroid = /android/.test(ua);
  const isMobile = isIOS || isAndroid;
  const supportsGetDisplayMedia = !!(navigator.mediaDevices?.getDisplayMedia);

  let browserName = "Unknown";
  if (/edg/.test(ua)) browserName = "Edge";
  else if (/chrome/.test(ua)) browserName = "Chrome";
  else if (/brave/.test(ua)) browserName = "Brave";
  else if (/safari/.test(ua)) browserName = "Safari";
  else if (/firefox/.test(ua)) browserName = "Firefox";

  return {
    supportsGetDisplayMedia,
    isIOS,
    isAndroid,
    isMobile,
    browserName,
  };
}

// ─── WebRTC Service ───────────────────────────────────────────────────────────

export class WebRTCService {
  private peerConnections = new Map<string, RTCPeerConnection>();
  private localStream: MediaStream | null = null;
  private screenStream: MediaStream | null = null;
  private socket: Socket;
  private onTrack: OnTrackCallback;
  private onRemoveTrack: OnRemoveTrackCallback;
  private onScreenShareStatus: OnScreenShareStatusCallback | null = null;
  private isScreenSharing = false;
  private originalVideoTrack: MediaStreamTrack | null = null;
  private browserCapabilities: BrowserCapabilities;

  constructor(socket: Socket, onTrack: OnTrackCallback, onRemoveTrack: OnRemoveTrackCallback) {
    this.socket = socket;
    this.onTrack = onTrack;
    this.onRemoveTrack = onRemoveTrack;
    this.browserCapabilities = detectBrowserCapabilities();
    this.setupSocketListeners();
  }

  // ── Set screen share status callback ────────────────────────────────────────

  setScreenShareStatusCallback(callback: OnScreenShareStatusCallback) {
    this.onScreenShareStatus = callback;
  }

  // ── Get browser capabilities ────────────────────────────────────────────────

  getBrowserCapabilities(): BrowserCapabilities {
    return this.browserCapabilities;
  }

  // ── Check if screen sharing is active ───────────────────────────────────────

  getIsScreenSharing(): boolean {
    return this.isScreenSharing;
  }

  // ── Socket signaling listeners ──────────────────────────────────────────────

  private setupSocketListeners() {
    this.socket.on(
      "webrtc-offer",
      async ({ fromSocketId, offer }: { fromSocketId: string; offer: RTCSessionDescriptionInit }) => {
        await this.handleOffer(fromSocketId, offer);
      }
    );

    this.socket.on(
      "webrtc-answer",
      async ({ fromSocketId, answer }: { fromSocketId: string; answer: RTCSessionDescriptionInit }) => {
        const pc = this.peerConnections.get(fromSocketId);
        if (pc) {
          await pc.setRemoteDescription(new RTCSessionDescription(answer));
        }
      }
    );

    this.socket.on(
      "ice-candidate",
      async ({ fromSocketId, candidate }: { fromSocketId: string; candidate: RTCIceCandidateInit }) => {
        const pc = this.peerConnections.get(fromSocketId);
        if (pc && candidate) {
          try {
            await pc.addIceCandidate(new RTCIceCandidate(candidate));
          } catch (e) {
            console.warn("[WebRTC] Failed to add ICE candidate:", e);
          }
        }
      }
    );
  }

  // ── Create a peer connection ────────────────────────────────────────────────

  private createPeerConnection(remoteSocketId: string): RTCPeerConnection {
    const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });

    // ICE candidate → send to remote peer via signaling
    pc.onicecandidate = (event) => {
      if (event.candidate) {
        this.socket.emit("ice-candidate", {
          targetSocketId: remoteSocketId,
          candidate: event.candidate.toJSON(),
        });
      }
    };

    // Remote track received
    pc.ontrack = (event) => {
      const [remoteStream] = event.streams;
      if (remoteStream) {
        this.onTrack(remoteSocketId, remoteStream);
      }
    };

    // Connection state change
    pc.onconnectionstatechange = () => {
      if (pc.connectionState === "failed" || pc.connectionState === "closed") {
        this.removePeer(remoteSocketId);
      }
    };

    // Add local tracks
    if (this.localStream) {
      this.localStream.getTracks().forEach((track) => {
        pc.addTrack(track, this.localStream!);
      });
    }

    this.peerConnections.set(remoteSocketId, pc);
    return pc;
  }

  // ── Initiate call to a new participant ─────────────────────────────────────

  async initiateCall(remoteSocketId: string) {
    const pc = this.createPeerConnection(remoteSocketId);

    const offer = await pc.createOffer({
      offerToReceiveAudio: true,
      offerToReceiveVideo: true,
    });
    await pc.setLocalDescription(offer);

    this.socket.emit("webrtc-offer", {
      targetSocketId: remoteSocketId,
      offer: pc.localDescription,
    });
  }

  // ── Handle incoming offer ──────────────────────────────────────────────────

  private async handleOffer(fromSocketId: string, offer: RTCSessionDescriptionInit) {
    const pc = this.createPeerConnection(fromSocketId);

    await pc.setRemoteDescription(new RTCSessionDescription(offer));
    const answer = await pc.createAnswer();
    await pc.setLocalDescription(answer);

    this.socket.emit("webrtc-answer", {
      targetSocketId: fromSocketId,
      answer: pc.localDescription,
    });
  }

  // ── Set local media stream ─────────────────────────────────────────────────

  setLocalStream(stream: MediaStream) {
    this.localStream = stream;

    // Add tracks to existing peer connections
    this.peerConnections.forEach((pc) => {
      stream.getTracks().forEach((track) => {
        const sender = pc.getSenders().find((s) => s.track?.kind === track.kind);
        if (sender) {
          sender.replaceTrack(track);
        } else {
          pc.addTrack(track, stream);
        }
      });
    });
  }

  // ── Toggle microphone ──────────────────────────────────────────────────────

  toggleMute(muted: boolean) {
    if (!this.localStream) return;
    this.localStream.getAudioTracks().forEach((track) => {
      track.enabled = !muted;
    });
  }

  // ── Toggle camera ──────────────────────────────────────────────────────────

  toggleCamera(cameraOff: boolean) {
    if (!this.localStream) return;
    this.localStream.getVideoTracks().forEach((track) => {
      track.enabled = !cameraOff;
    });
  }

  // ── Start screen sharing ───────────────────────────────────────────────────

  async startScreenShare(): Promise<MediaStream | null> {
    // Check if browser supports getDisplayMedia
    if (!this.browserCapabilities.supportsGetDisplayMedia) {
      let errorMsg = "Screen sharing not supported on this device.";
      
      if (this.browserCapabilities.isIOS) {
        errorMsg = `Screen sharing on ${this.browserCapabilities.browserName} (iOS) requires using the native iOS Screen Broadcast feature. Open Control Center and tap Screen Recording.`;
      } else if (this.browserCapabilities.isAndroid) {
        errorMsg = `Screen sharing on ${this.browserCapabilities.browserName} (Android) is not available. Please use a desktop browser like Chrome, Edge, or Brave.`;
      } else {
        errorMsg = `${this.browserCapabilities.browserName} does not support screen sharing. Please use Chrome, Edge, Brave, or Firefox on desktop.`;
      }

      this.onScreenShareStatus?.(false, errorMsg);
      console.warn("[WebRTC] Screen sharing not supported:", errorMsg);
      return null;
    }

    try {
      // Request screen capture with audio support for desktop
      const displayMediaOptions: DisplayMediaStreamOptions = {
        video: {
          frameRate: { ideal: 30 },
          cursor: "always",
        },
        audio: !this.browserCapabilities.isMobile,
      };

      const stream = await navigator.mediaDevices.getDisplayMedia(displayMediaOptions);
      this.screenStream = stream;
      this.isScreenSharing = true;

      // Save original video track for restoration
      const originalVideoTrack = this.localStream?.getVideoTracks()[0];
      if (originalVideoTrack) {
        this.originalVideoTrack = originalVideoTrack;
      }

      // Replace video track in all peer connections
      const screenVideoTrack = stream.getVideoTracks()[0];
      if (screenVideoTrack) {
        // Renegotiate with all peers
        const renegotiationPromises = Array.from(this.peerConnections.entries()).map(
          async ([remoteSocketId, pc]) => {
            try {
              const sender = pc.getSenders().find((s) => s.track?.kind === "video");
              if (sender) {
                await sender.replaceTrack(screenVideoTrack);
              }

              // Create new offer for renegotiation
              const offer = await pc.createOffer();
              await pc.setLocalDescription(offer);
              this.socket.emit("webrtc-offer", {
                targetSocketId: remoteSocketId,
                offer: pc.localDescription,
              });
            } catch (err) {
              console.warn(`[WebRTC] Failed to renegotiate with ${remoteSocketId}:`, err);
            }
          }
        );

        await Promise.all(renegotiationPromises);

        // When screen share ends (user clicks browser "Stop sharing")
        screenVideoTrack.onended = () => {
          this.stopScreenShare();
        };

        this.onScreenShareStatus?.(true);
      }

      return stream;
    } catch (e: any) {
      // Handle different error types
      let errorMsg = "Screen sharing failed";
      if (e.name === "NotAllowedError") {
        errorMsg = "Screen sharing was cancelled";
      } else if (e.name === "NotFoundError") {
        errorMsg = "No screen available to share";
      } else if (e.name === "NotSupportedError") {
        errorMsg = "Screen sharing is not supported in this context";
      }

      this.isScreenSharing = false;
      this.onScreenShareStatus?.(false, errorMsg);
      console.warn("[WebRTC] Screen share error:", e);
      return null;
    }
  }

  // ── Stop screen sharing ────────────────────────────────────────────────────

  async stopScreenShare() {
    if (!this.screenStream) return;

    // Stop screen tracks
    this.screenStream.getTracks().forEach((t) => t.stop());
    this.screenStream = null;
    this.isScreenSharing = false;

    // Restore original camera track in peer connections
    const restoreTrack = this.originalVideoTrack || this.localStream?.getVideoTracks()[0];
    if (restoreTrack) {
      const renegotiationPromises = Array.from(this.peerConnections.entries()).map(
        async ([remoteSocketId, pc]) => {
          try {
            const sender = pc.getSenders().find((s) => s.track?.kind === "video");
            if (sender) {
              await sender.replaceTrack(restoreTrack);
            }

            // Create new offer for renegotiation
            const offer = await pc.createOffer();
            await pc.setLocalDescription(offer);
            this.socket.emit("webrtc-offer", {
              targetSocketId: remoteSocketId,
              offer: pc.localDescription,
            });
          } catch (err) {
            console.warn(`[WebRTC] Failed to restore video for ${remoteSocketId}:`, err);
          }
        }
      );

      await Promise.all(renegotiationPromises);
    }

    this.originalVideoTrack = null;
    this.onScreenShareStatus?.(false);
  }

  // ── Remove a peer ──────────────────────────────────────────────────────────

  removePeer(socketId: string) {
    const pc = this.peerConnections.get(socketId);
    if (pc) {
      pc.close();
      this.peerConnections.delete(socketId);
      this.onRemoveTrack(socketId);
    }
  }

  // ── Cleanup all connections ────────────────────────────────────────────────

  destroy() {
    this.peerConnections.forEach((pc) => pc.close());
    this.peerConnections.clear();

    if (this.screenStream) {
      this.screenStream.getTracks().forEach((t) => t.stop());
      this.screenStream = null;
    }

    this.isScreenSharing = false;
    this.originalVideoTrack = null;
    this.socket.off("webrtc-offer");
    this.socket.off("webrtc-answer");
    this.socket.off("ice-candidate");
  }
}
