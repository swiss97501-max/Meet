import { useState, useEffect, useRef, useCallback } from "react";
import { connectSocket, disconnectSocket, type Participant } from "@/lib/socket";
import { WebRTCService } from "@/lib/webrtc";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface RoomParticipant extends Participant {
  stream?: MediaStream;
}

export interface RoomState {
  participants: RoomParticipant[];
  localStream: MediaStream | null;
  isMuted: boolean;
  isCameraOff: boolean;
  isScreenSharing: boolean;
  isConnected: boolean;
  isJoining: boolean;
  error: string | null;
}

// ─── useRoom hook ─────────────────────────────────────────────────────────────

export function useRoom(roomId: string, username: string) {
  const [state, setState] = useState<RoomState>({
    participants: [],
    localStream: null,
    isMuted: false,
    isCameraOff: false,
    isScreenSharing: false,
    isConnected: false,
    isJoining: true,
    error: null,
  });

  const webrtcRef = useRef<WebRTCService | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const mySocketIdRef = useRef<string>("");

  // ── Initialize media and join room ────────────────────────────────────────

  useEffect(() => {
    if (!roomId || !username) return;

    let mounted = true;

    async function init() {
      try {
        // Get local media
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { width: { ideal: 1280 }, height: { ideal: 720 }, frameRate: { ideal: 30 } },
          audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
        });

        if (!mounted) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }

        localStreamRef.current = stream;
        setState((prev) => ({ ...prev, localStream: stream }));

        // Connect socket
        const socket = connectSocket();
        mySocketIdRef.current = socket.id ?? "";

        // Create WebRTC service
        const webrtc = new WebRTCService(
          socket,
          // onTrack: remote stream received
          (socketId, remoteStream) => {
            if (!mounted) return;
            setState((prev) => ({
              ...prev,
              participants: prev.participants.map((p) =>
                p.socketId === socketId ? { ...p, stream: remoteStream } : p
              ),
            }));
          },
          // onRemoveTrack: peer disconnected
          (socketId) => {
            if (!mounted) return;
            setState((prev) => ({
              ...prev,
              participants: prev.participants.filter((p) => p.socketId !== socketId),
            }));
          }
        );

        webrtc.setLocalStream(stream);
        webrtcRef.current = webrtc;

        // ── Socket event handlers ────────────────────────────────────────

        socket.on("connect", () => {
          mySocketIdRef.current = socket.id ?? "";
        });

        socket.on(
          "room-joined",
          async ({ participants }: { participants: Participant[] }) => {
            if (!mounted) return;

            setState((prev) => ({
              ...prev,
              participants: participants.map((p) => ({ ...p })),
              isConnected: true,
              isJoining: false,
            }));

            // Initiate calls to all existing participants
            for (const p of participants) {
              await webrtc.initiateCall(p.socketId);
            }
          }
        );

        socket.on("participant-joined", async (participant: Participant) => {
          if (!mounted) return;

          setState((prev) => ({
            ...prev,
            participants: [...prev.participants, { ...participant }],
          }));
          // The new participant will send us an offer, we just need to wait
        });

        socket.on("participant-left", ({ socketId }: { socketId: string }) => {
          if (!mounted) return;
          webrtc.removePeer(socketId);
          setState((prev) => ({
            ...prev,
            participants: prev.participants.filter((p) => p.socketId !== socketId),
          }));
        });

        socket.on(
          "participant-media-changed",
          ({
            socketId,
            isMuted,
            isCameraOff,
            isScreenSharing,
          }: {
            socketId: string;
            isMuted?: boolean;
            isCameraOff?: boolean;
            isScreenSharing?: boolean;
          }) => {
            if (!mounted) return;
            setState((prev) => ({
              ...prev,
              participants: prev.participants.map((p) => {
                if (p.socketId !== socketId) return p;
                return {
                  ...p,
                  ...(isMuted !== undefined && { isMuted }),
                  ...(isCameraOff !== undefined && { isCameraOff }),
                  ...(isScreenSharing !== undefined && { isScreenSharing }),
                };
              }),
            }));
          }
        );

        // Join the room
        socket.emit("join-room", { roomId, username });

      } catch (err) {
        if (!mounted) return;
        const msg =
          err instanceof DOMException && err.name === "NotAllowedError"
            ? "Camera/microphone access denied. Please allow permissions and reload."
            : "Failed to access camera or microphone.";
        setState((prev) => ({ ...prev, error: msg, isJoining: false }));
      }
    }

    init();

    return () => {
      mounted = false;
      webrtcRef.current?.destroy();
      webrtcRef.current = null;
      localStreamRef.current?.getTracks().forEach((t) => t.stop());
      localStreamRef.current = null;
      const socket = connectSocket();
      socket.emit("leave-room");
      socket.off("room-joined");
      socket.off("participant-joined");
      socket.off("participant-left");
      socket.off("participant-media-changed");
      disconnectSocket();
    };
  }, [roomId, username]);

  // ── Controls ──────────────────────────────────────────────────────────────

  const toggleMute = useCallback(() => {
    const socket = connectSocket();
    setState((prev) => {
      const newMuted = !prev.isMuted;
      webrtcRef.current?.toggleMute(newMuted);
      socket.emit("media-state-change", { isMuted: newMuted });
      return { ...prev, isMuted: newMuted };
    });
  }, []);

  const toggleCamera = useCallback(() => {
    const socket = connectSocket();
    setState((prev) => {
      const newCameraOff = !prev.isCameraOff;
      webrtcRef.current?.toggleCamera(newCameraOff);
      socket.emit("media-state-change", { isCameraOff: newCameraOff });
      return { ...prev, isCameraOff: newCameraOff };
    });
  }, []);

  const toggleScreenShare = useCallback(async () => {
    const socket = connectSocket();

    if (state.isScreenSharing) {
      await webrtcRef.current?.stopScreenShare();
      setState((prev) => ({ ...prev, isScreenSharing: false }));
      socket.emit("media-state-change", { isScreenSharing: false });
    } else {
      const stream = await webrtcRef.current?.startScreenShare();
      if (stream) {
        setState((prev) => ({ ...prev, isScreenSharing: true }));
        socket.emit("media-state-change", { isScreenSharing: true });

        // Listen for native "Stop sharing" button
        stream.getVideoTracks()[0]?.addEventListener("ended", () => {
          setState((prev) => ({ ...prev, isScreenSharing: false }));
          socket.emit("media-state-change", { isScreenSharing: false });
        });
      }
    }
  }, [state.isScreenSharing]);

  return {
    ...state,
    mySocketId: mySocketIdRef.current,
    toggleMute,
    toggleCamera,
    toggleScreenShare,
    webrtcService: webrtcRef.current,
  };
}
