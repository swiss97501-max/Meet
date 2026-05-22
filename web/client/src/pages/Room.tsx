import { useEffect, useState, useRef } from "react";
import { useLocation, useParams } from "wouter";
import { Loader2, AlertCircle, Wifi, WifiOff } from "lucide-react";
import { toast } from "sonner";
import { useRoom } from "@/hooks/useRoom";
import VideoGrid from "@/components/VideoGrid";
import ControlBar from "@/components/ControlBar";
import { ScreenShareModal } from "@/components/ScreenShareModal";
import { ScreenShareIndicator } from "@/components/ScreenShareIndicator";
import type { RoomParticipant } from "@/hooks/useRoom";
import { detectBrowserCapabilities } from "@/lib/webrtc";

const LOGO_ICON = "https://d2xsxph8kpxj0f.cloudfront.net/310519663687101946/JTiiZBmYaPmTTYwZ4JcutS/logo-icon-CoEQhxiMT7RFSacxJUmzHr.webp";

// ─── Active speaker detection via audio level ─────────────────────────────────

function useActiveSpeaker(localStream: MediaStream | null): string {
  const [activeSpeakerId] = useState<string>("");
  // Simple placeholder — in production you'd use AudioContext analyser
  return activeSpeakerId;
}



// ─── Room page ────────────────────────────────────────────────────────────────

export default function Room() {
  const params = useParams<{ roomId: string }>();
  const [, navigate] = useLocation();

  // Parse username from URL query
  const [username] = useState<string>(() => {
    const search = window.location.search;
    const u = new URLSearchParams(search).get("username");
    return u ? decodeURIComponent(u) : "Guest";
  });

  // Screen share modal state
  const [showScreenShareModal, setShowScreenShareModal] = useState(false);
  const [isScreenShareLoading, setIsScreenShareLoading] = useState(false);
  const [screenShareError, setScreenShareError] = useState<string>();
  const browserCapabilities = detectBrowserCapabilities();

  const roomId = params.roomId ?? "";

  const {
    participants,
    localStream,
    isMuted,
    isCameraOff,
    isScreenSharing,
    isConnected,
    isJoining,
    error,
    mySocketId,
    toggleMute,
    toggleCamera,
    toggleScreenShare,
    webrtcService,
  } = useRoom(roomId, username);

  // Setup screen share status callback
  useEffect(() => {
    if (webrtcService) {
      webrtcService.setScreenShareStatusCallback((isSharing, error) => {
        if (error) {
          setScreenShareError(error);
          setIsScreenShareLoading(false);
        }
      });
    }
  }, [webrtcService]);

  // Handle screen share with modal
  const handleScreenShareClick = async () => {
    if (isScreenSharing) {
      // Stop screen share
      await toggleScreenShare();
    } else {
      // Show confirmation modal
      setShowScreenShareModal(true);
    }
  };

  const handleScreenShareConfirm = async () => {
    setShowScreenShareModal(false);
    setIsScreenShareLoading(true);
    setScreenShareError(undefined);
    
    try {
      await toggleScreenShare();
    } catch (err) {
      setScreenShareError(err instanceof Error ? err.message : "Screen sharing failed");
    } finally {
      setIsScreenShareLoading(false);
    }
  };

  const activeSpeakerId = useActiveSpeaker(localStream);

  // Clear error after 5 seconds
  useEffect(() => {
    if (screenShareError) {
      const timer = setTimeout(() => setScreenShareError(undefined), 5000);
      return () => clearTimeout(timer);
    }
  }, [screenShareError]);

  // Notify when participants join/leave
  const prevCountRef = useRef(0);
  useEffect(() => {
    const count = participants.length;
    if (count > prevCountRef.current) {
      const newest = participants[participants.length - 1];
      if (newest) {
        toast.success(`${newest.username} joined the meeting`, {
          duration: 3000,
        });
      }
    }
    prevCountRef.current = count;
  }, [participants]);

  // Leave room
  const handleLeave = () => {
    navigate("/");
  };

  // Build local participant object
  const localParticipant: RoomParticipant = {
    socketId: mySocketId || "local",
    username,
    roomId,
    isMuted,
    isCameraOff,
    isScreenSharing,
  };

  // ── Error state ─────────────────────────────────────────────────────────────

  if (error) {
    return (
      <div className="min-h-screen bg-void flex items-center justify-center p-6">
        <div className="glass-card p-8 max-w-md w-full text-center">
          <div
            className="w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4"
            style={{ background: "oklch(0.65 0.22 25 / 15%)", border: "1px solid oklch(0.65 0.22 25 / 30%)" }}
          >
            <AlertCircle className="w-8 h-8" style={{ color: "oklch(0.75 0.2 25)" }} />
          </div>
          <h2
            className="text-xl font-bold mb-3"
            style={{ fontFamily: "var(--font-display)" }}
          >
            Cannot Join Meeting
          </h2>
          <p className="text-muted-foreground mb-6 text-sm leading-relaxed">{error}</p>
          <button
            onClick={() => navigate("/")}
            className="btn-neon px-6 py-2.5 rounded-xl text-sm font-semibold"
            style={{ fontFamily: "var(--font-display)" }}
          >
            Back to Home
          </button>
        </div>
      </div>
    );
  }

  // ── Loading/joining state ───────────────────────────────────────────────────

  if (isJoining) {
    return (
      <div className="min-h-screen bg-void flex items-center justify-center">
        <div className="text-center">
          <div
            className="w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-6"
            style={{
              background: "oklch(0.82 0.18 195 / 10%)",
              border: "1px solid oklch(0.82 0.18 195 / 30%)",
              boxShadow: "0 0 40px oklch(0.82 0.18 195 / 20%)",
            }}
          >
            <Loader2 className="w-8 h-8 animate-spin text-neon-cyan" />
          </div>
          <h2
            className="text-xl font-bold mb-2 text-gradient-neon"
            style={{ fontFamily: "var(--font-display)" }}
          >
            Joining Meeting
          </h2>
          <p className="text-muted-foreground text-sm">
            Connecting to room <span className="font-mono text-neon-cyan">{roomId}</span>...
          </p>
        </div>
      </div>
    );
  }

  // ── Main room UI ────────────────────────────────────────────────────────────

  return (
    <div className="h-screen bg-void flex flex-col overflow-hidden">
      {/* ── Top bar ─────────────────────────────────────────────────────────── */}
      <header
        className="flex items-center justify-between px-5 py-3 shrink-0"
        style={{
          background: "oklch(0.08 0.015 260 / 80%)",
          backdropFilter: "blur(16px)",
          borderBottom: "1px solid oklch(1 0 0 / 8%)",
        }}
      >
        <div className="flex items-center gap-2.5">
          <img src={LOGO_ICON} alt="Meeting Swiss" className="w-7 h-7 rounded-lg" />
          <span
            className="text-base font-bold"
            style={{ fontFamily: "var(--font-display)", color: "oklch(0.95 0.008 260)" }}
          >
            Meeting <span className="text-gradient-neon">Swiss</span>
          </span>
        </div>

        <div className="flex items-center gap-3">
          {/* Connection status */}
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            {isConnected ? (
              <>
                <Wifi className="w-3.5 h-3.5 text-[oklch(0.75_0.18_170)]" />
                <span className="text-[oklch(0.75_0.18_170)]">Connected</span>
              </>
            ) : (
              <>
                <WifiOff className="w-3.5 h-3.5 text-[oklch(0.75_0.2_25)]" />
                <span className="text-[oklch(0.75_0.2_25)]">Reconnecting...</span>
              </>
            )}
          </div>

          {/* Participant count */}
          <div
            className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium"
            style={{
              background: "oklch(1 0 0 / 6%)",
              border: "1px solid oklch(1 0 0 / 10%)",
              color: "oklch(0.7 0.01 260)",
            }}
          >
            <span className="font-mono text-neon-cyan">{roomId}</span>
          </div>
        </div>
      </header>

      {/* ── Video grid area ──────────────────────────────────────────────────── */}
      <main className="flex-1 overflow-hidden pb-28">
        <VideoGrid
          participants={participants}
          localParticipant={localParticipant}
          localStream={localStream}
          activeSpeakerId={activeSpeakerId}
        />
      </main>

      {/* ── Screen share modal ───────────────────────────────────────────────── */}
      <ScreenShareModal
        isOpen={showScreenShareModal}
        onClose={() => setShowScreenShareModal(false)}
        onConfirm={handleScreenShareConfirm}
        browserCapabilities={browserCapabilities}
        isLoading={isScreenShareLoading}
      />

      {/* ── Screen share indicator ────────────────────────────────────────────── */}
      <ScreenShareIndicator
        isSharing={isScreenSharing}
        onStop={() => toggleScreenShare()}
      />

      {/* ── Floating control bar ─────────────────────────────────────────────── */}
      <ControlBar
        isMuted={isMuted}
        isCameraOff={isCameraOff}
        isScreenSharing={isScreenSharing}
        participantCount={participants.length + 1}
        roomId={roomId}
        onToggleMute={toggleMute}
        onToggleCamera={toggleCamera}
        onToggleScreenShare={handleScreenShareClick}
        onLeave={handleLeave}
        screenShareError={screenShareError}
        isScreenShareLoading={isScreenShareLoading}
      />
    </div>
  );
}
